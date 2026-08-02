import Stripe from "stripe";
import { ENV } from "./env";
import {
  getOrganization,
  getOrgByStripeCustomerId,
  updateOrganization,
  claimStripeEvent,
  markStripeEventProcessed,
  markStripeEventFailed,
  updateOrgSubscriptionIfNewer,
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

// Decisão PURA de ORDEM: aplica o evento só se for igual/mais novo que o último
// já aplicado. Sem último (null) → aplica. Testável sem banco.
export function deveAplicarEvento(
  lastAppliedAt: Date | null | undefined,
  eventCreatedAt: Date
): boolean {
  if (!lastAppliedAt) return true;
  return lastAppliedAt.getTime() <= eventCreatedAt.getTime();
}

async function applySubscription(
  sub: Stripe.Subscription,
  eventCreatedAt: Date
): Promise<void> {
  const orgId = await resolveOrgId(sub);
  if (!orgId) {
    console.warn("[Stripe] Assinatura sem orgId resolvível:", sub.id);
    return;
  }
  const periodEnd = sub.items.data[0]?.current_period_end;
  // UPDATE condicional atômico: só aplica se o evento não for mais antigo que o
  // último aplicado (ordem monotônica por org).
  const aplicou = await updateOrgSubscriptionIfNewer(
    orgId,
    {
      subscriptionStatus: mapStripeStatus(sub.status),
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    },
    eventCreatedAt
  );
  if (!aplicou) {
    console.warn(`[Stripe] Evento atrasado ignorado (org ${orgId}, ${sub.id})`);
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
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          // Re-consulta o estado ATUAL no Stripe (não confia no payload).
          const sub = await stripe.subscriptions.retrieve(subId);
          await applySubscription(sub, eventCreatedAt);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        // Re-consulta a assinatura ANTES de liberar acesso — o payload pode
        // estar desatualizado/fora de ordem; a fonte da verdade é a API.
        const fresh = await stripe.subscriptions.retrieve(event.data.object.id);
        await applySubscription(fresh, eventCreatedAt);
        break;
      }
      case "customer.subscription.deleted": {
        // Estado terminal: usa o objeto do evento (mapeia p/ canceled). A ordem
        // monotônica no UPDATE impede um updated atrasado de reabrir.
        await applySubscription(event.data.object, eventCreatedAt);
        break;
      }
      default:
        // Outros eventos ignorados de propósito.
        break;
    }
    // Efeito aplicado (ou tipo ignorado de propósito) → marca concluído, com
    // FENCING pela geração. Se false, o lease foi perdido (outro worker
    // reivindicou por stale e conduz o lifecycle) — o efeito é idempotente
    // (updateOrgSubscriptionIfNewer é ordenado), então não relançamos, mas
    // TAMBÉM não afirmamos ter concluído a transição.
    const marcou = await markStripeEventProcessed(event.id, generation);
    if (!marcou) {
      console.warn(`[Stripe] lease perdido ao concluir (${event.type})`);
    }
  } catch (e) {
    // Efeito FALHOU: marca 'failed' (permite retry) e relança para o Stripe
    // reenviar. O erro é sanitizado (não vaza SQL/PII no banco). Com fencing:
    // se o lease já é de outra geração, a marca falha (0 linhas) e não sobrescreve.
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
