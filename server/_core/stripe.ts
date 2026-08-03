import Stripe from "stripe";
import { ENV } from "./env";
import {
  getOrganization,
  getOrgByStripeCustomerId,
  updateOrganization,
  claimStripeEvent,
  markStripeEventFailed,
  commitStripeEffectUnderLease,
  type OrgSubscriptionEffect,
} from "../db";
import { toSafeLogError } from "./safeLog";
import type { Organization } from "../../drizzle/schema";

// Um evento 'processing' sem conclusão por mais que isto = worker abandonado
// (crash/deploy no meio) → pode ser reivindicado por outro retry.
const STRIPE_EVENT_STALE_MS = 5 * 60 * 1000;

let _stripe: Stripe | null = null;

// Fail-closed: sem a secret key, qualquer operação de cobrança falha visível.
export function getStripe(): Stripe {
  if (!ENV.stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY não configurada");
  }
  if (!_stripe) {
    _stripe = new Stripe(ENV.stripeSecretKey);
  }
  return _stripe;
}

/**
 * Cobrança só é considerada configurada com os TRÊS segredos.
 *
 * O webhook entra na conta de propósito: sem ele o checkout abre, o cartão é
 * cobrado e NINGUÉM é liberado — o dinheiro entra e o cliente fica de fora,
 * sem sinal nenhum no produto. Aconteceu de verdade nesta implantação. É
 * melhor o paywall dizer "pagamento não configurado" do que cobrar sem entregar.
 */
// Decisão PURA de "cobrança completa": os TRÊS segredos presentes. O webhook
// entra de propósito — sem ele o checkout cobra e ninguém é liberado.
export function stripeConfigCompleta(cfg: {
  secretKey: string;
  priceId: string;
  webhookSecret: string;
}): boolean {
  return Boolean(cfg.secretKey && cfg.priceId && cfg.webhookSecret);
}

export function isStripeConfigured(): boolean {
  return stripeConfigCompleta({
    secretKey: ENV.stripeSecretKey,
    priceId: ENV.stripePriceId,
    webhookSecret: ENV.stripeWebhookSecret,
  });
}

// Garante um Stripe Customer para a organização (cria e persiste se faltar).
async function ensureCustomer(
  org: Organization,
  email: string
): Promise<string> {
  if (org.stripeCustomerId) return org.stripeCustomerId;
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    name: org.name,
    metadata: { orgId: String(org.id) },
  });
  await updateOrganization(org.id, { stripeCustomerId: customer.id });
  return customer.id;
}

// Decisão PURA: uma org com assinatura ATIVA/pendente não pode abrir um checkout
// NOVO (criaria uma SEGUNDA assinatura cobrando em paralelo). Ela deve usar o
// Portal do Cliente para gerenciar. Só none/canceled podem (re)assinar.
export function bloqueiaNovoCheckout(
  status: Organization["subscriptionStatus"]
): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

/**
 * Cria a sessão de Checkout (assinatura). Retorna a URL para redirecionar.
 * O cartão é cobrado no Stripe; a liberação vem pelo webhook.
 */
export async function createCheckoutSession(params: {
  orgId: number;
  email: string;
}): Promise<string> {
  // Fail-closed: só abre checkout se a cobrança estiver COMPLETA — incluindo o
  // webhook. Sem webhook, o pagamento seria cobrado e ninguém liberado (dinheiro
  // entra, cliente trancado). A trava fica aqui, na raiz, para valer mesmo se
  // outro chamador esquecer de checar — não depende da tela.
  if (!isStripeConfigured()) {
    throw new Error(
      "Cobrança não está totalmente configurada (chave, preço e webhook)."
    );
  }
  const org = await getOrganization(params.orgId);
  if (!org) throw new Error("Organização não encontrada");

  // Impede assinatura DUPLICADA: org já ativa/pendente vai para o portal, não
  // abre um checkout concorrente (que cobraria duas vezes).
  if (bloqueiaNovoCheckout(org.subscriptionStatus)) {
    throw new Error(
      "Já existe uma assinatura ativa. Gerencie pelo portal do cliente."
    );
  }

  const stripe = getStripe();
  const customerId = await ensureCustomer(org, params.email);
  const base = ENV.appBaseUrl.replace(/\/$/, "");

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: ENV.stripePriceId, quantity: 1 }],
    success_url: `${base}/?checkout=success`,
    cancel_url: `${base}/?checkout=cancel`,
    metadata: { orgId: String(org.id) },
    subscription_data: { metadata: { orgId: String(org.id) } },
  });

  if (!session.url) throw new Error("Falha ao criar sessão de checkout");
  return session.url;
}

// Portal do cliente Stripe (gerenciar/cancelar assinatura, atualizar cartão).
export async function createPortalSession(orgId: number): Promise<string> {
  const org = await getOrganization(orgId);
  if (!org?.stripeCustomerId) {
    throw new Error("Organização sem cliente Stripe");
  }
  const stripe = getStripe();
  const base = ENV.appBaseUrl.replace(/\/$/, "");
  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${base}/`,
  });
  return session.url;
}

// Mapeia o status da assinatura Stripe para o enum interno.
export function mapStripeStatus(
  status: Stripe.Subscription.Status
): Organization["subscriptionStatus"] {
  switch (status) {
    case "active":
    case "trialing":
      return status;
    case "past_due":
    case "unpaid":
      return "past_due";
    default:
      return "canceled";
  }
}

// Resolve o orgId de uma assinatura (metadata ou via customer).
async function resolveOrgId(sub: Stripe.Subscription): Promise<number | null> {
  const metaOrg = sub.metadata?.orgId;
  if (metaOrg) return Number(metaOrg);
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const org = await getOrgByStripeCustomerId(customerId);
  return org?.id ?? null;
}

// A decisão de ordem migrou para deveAplicarEfeito (server/_core/stripeEventState),
// que é determinística por org/assinatura e fail-closed no empate de timestamp —
// aplicada sob o lock da org dentro de commitStripeEffectUnderLease.

type ResolvedEffect = {
  orgId: number | null;
  effect: OrgSubscriptionEffect | null;
};

// Constrói o efeito aplicável a partir de uma assinatura (fonte da verdade).
async function effectFromSubscription(
  sub: Stripe.Subscription
): Promise<ResolvedEffect> {
  const orgId = await resolveOrgId(sub);
  if (!orgId) {
    console.warn("[Stripe] Assinatura sem orgId resolvível:", sub.id);
    return { orgId: null, effect: null };
  }
  const periodEnd = sub.items.data[0]?.current_period_end;
  return {
    orgId,
    effect: {
      subscriptionStatus: mapStripeStatus(sub.status),
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    },
  };
}

// Resolve o EFEITO aplicável (orgId + campos) a partir da fonte da verdade do
// Stripe. TODA chamada de rede (retrieve) acontece AQUI, FORA da transação de
// commit. Sempre re-consultamos o estado ATUAL; a ORDEM/desempate por org é
// decidida sob o lock da org por deveAplicarEfeito (determinística, fail-closed
// no empate de timestamp — deleted vence updated do mesmo segundo). orgId/effect
// nulos = nada a aplicar; o evento ainda é marcado 'processed' (idempotência).
async function resolveOrgEffect(
  event: Stripe.Event,
  stripe: Stripe
): Promise<ResolvedEffect> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (!session.subscription) return { orgId: null, effect: null };
      const subId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id;
      const sub = await stripe.subscriptions.retrieve(subId);
      return effectFromSubscription(sub);
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      // Re-consulta ANTES de liberar acesso — o payload pode estar
      // desatualizado/fora de ordem; a fonte da verdade é a API.
      const fresh = await stripe.subscriptions.retrieve(event.data.object.id);
      return effectFromSubscription(fresh);
    }
    case "customer.subscription.deleted": {
      // Estado terminal: usa o objeto do evento (mapeia p/ canceled). A ordem
      // monotônica no UPDATE impede um updated atrasado de reabrir.
      return effectFromSubscription(event.data.object);
    }
    default:
      // Outros eventos ignorados de propósito (nada a aplicar).
      return { orgId: null, effect: null };
  }
}

/**
 * Verifica a assinatura do webhook (HMAC, fail-closed) e processa o evento.
 * Recebe o corpo CRU (Buffer) — a rota deve usar express.raw nesse path.
 */
export async function handleWebhookEvent(
  rawBody: Buffer,
  signature: string
): Promise<void> {
  if (!ENV.stripeWebhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET não configurado");
  }
  const stripe = getStripe();
  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    ENV.stripeWebhookSecret
  );
  await processStripeEvent(event, stripe);
}

/**
 * Processa um evento JÁ verificado (HMAC feito por handleWebhookEvent). Separado
 * para ser testável sem assinatura real. `stripe` é injetado (re-consulta a API).
 */
export async function processStripeEvent(
  event: Stripe.Event,
  stripe: Stripe
): Promise<void> {
  // Lifecycle idempotente + retry-safe: reivindica o evento ('processing'),
  // aplica o efeito, e SÓ ENTÃO marca 'processed'. Se o efeito falhar, marca
  // 'failed' e relança → o Stripe faz retry e um novo claim reprocessa. Um
  // 'processing' abandonado (worker morto) é reivindicado após STALE_MS.
  const claim = await claimStripeEvent(
    event.id,
    event.type,
    STRIPE_EVENT_STALE_MS,
    new Date()
  );
  if (claim.claim === "processed") {
    console.warn(`[Stripe] webhook já processado, ignorado (${event.type})`);
    return;
  }
  if (claim.claim === "busy") {
    // Outro worker está processando este mesmo evento. Não confirmamos o efeito
    // → devolve erro para o Stripe reenviar (o outro worker conclui e o próximo
    // retry vê 'processed'). Nunca retorna sucesso sem o efeito comprovado.
    throw new Error("Evento Stripe em processamento concorrente");
  }

  // Geração conquistada nesta claim — exigida para FECHAR a transição (fencing):
  // um worker antigo, reivindicado por stale, não sobrescreve o estado novo.
  const generation = claim.generation;
  const eventCreatedAt = new Date(event.created * 1000);
  try {
    // 1) Fonte da verdade: re-consulta o estado ATUAL no Stripe (REDE) — FORA
    //    da transação de commit. Nenhuma chamada de rede dentro da transação.
    const { orgId, effect } = await resolveOrgEffect(event, stripe);
    // 2) Efeito na organização + marca 'processed' ATÔMICOS, sob a geração
    //    (row lock + fencing). Se o lease foi perdido (worker antigo retomou
    //    após reclaim/stale), a organização NÃO é tocada e nada é marcado —
    //    outro worker conduz o lifecycle. Nunca gravamos entitlement de um
    //    snapshot antigo.
    const outcome = await commitStripeEffectUnderLease({
      eventId: event.id,
      generation,
      orgId,
      effect,
      eventCreatedAt,
    });
    if (outcome === "lease-lost") {
      console.warn(`[Stripe] lease perdido ao concluir (${event.type})`);
    }
  } catch (e) {
    // Falha ANTES do commit (rede, ou rollback por inconsistência): marca
    // 'failed' (permite retry) e relança para o Stripe reenviar. O erro é
    // sanitizado (não vaza SQL/PII no banco). Fencing: se o lease já é de outra
    // geração — OU o commit já concluiu (status 'processed') — a marca falha
    // (0 linhas) e não rebaixa nada. Falha APÓS o commit não vira 'failed'.
    const safe = toSafeLogError(e);
    const marcou = await markStripeEventFailed(
      event.id,
      generation,
      `${safe.name}${safe.code ? ":" + safe.code : ""}`
    );
    if (!marcou) {
      console.warn(`[Stripe] lease perdido ao falhar (${event.type})`);
    }
    throw e;
  }
}
