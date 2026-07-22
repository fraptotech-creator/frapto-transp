import Stripe from "stripe";
import { ENV } from "./env";
import {
  getOrganization,
  getOrgByStripeCustomerId,
  updateOrganization,
} from "../db";
import type { Organization } from "../../drizzle/schema";

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
export function isStripeConfigured(): boolean {
  return Boolean(
    ENV.stripeSecretKey && ENV.stripePriceId && ENV.stripeWebhookSecret
  );
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
  if (!ENV.stripePriceId) {
    throw new Error("STRIPE_PRICE_ID não configurado");
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

async function applySubscription(sub: Stripe.Subscription): Promise<void> {
  const orgId = await resolveOrgId(sub);
  if (!orgId) {
    console.warn("[Stripe] Assinatura sem orgId resolvível:", sub.id);
    return;
  }
  const periodEnd = sub.items.data[0]?.current_period_end;
  await updateOrganization(orgId, {
    subscriptionStatus: mapStripeStatus(sub.status),
    stripeSubscriptionId: sub.id,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
  });
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

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.subscription) {
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
        const sub = await stripe.subscriptions.retrieve(subId);
        await applySubscription(sub);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await applySubscription(event.data.object);
      break;
    }
    default:
      // Outros eventos ignorados de propósito.
      break;
  }
}
