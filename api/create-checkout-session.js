// POST /api/create-checkout-session -> { url } for a Stripe-hosted payment page.
//
// SideCut is a static single-file PWA (plus a Capacitor wrap), so there is no
// application server anywhere in this repo. The one server-side thing it already
// has is this directory: `api/spotify-search.js`, a plain CommonJS handler
// (req, res) that reads its secrets from process.env and talks to its provider
// with fetch, with no SDK installed. This endpoint follows that exact shape, so
// nothing new is introduced - no framework, no dependency, no build step.
//
// WHY HOSTED CHECKOUT AND NOT A PAYMENT LINK. Both end on a Stripe-hosted page.
// A Payment Link needs no key at all and is the quickest route; this endpoint
// exists for the amounts and the products that have to be decided per tap (the
// Donate tab's tiers) and for a return URL the site controls.
//
// The response is JSON - `{ url, id }` - because the caller is the app, which
// opens that url in the browser. A plain <form> that would rather be redirected
// can post here too and read the same url out of the body.
//
// Env (server-side only, never exposed to the browser):
//   STRIPE_SECRET_KEY   sk_live_... / sk_test_...   (Dashboard -> Developers -> API keys)
//   DOMAIN              https://your-site          (used to build the return URLs)
//
// THE PLACEHOLDERS BELOW ARE THE POINT. `price_...`, `mode`, `success_url` and
// `cancel_url` come from Checkout Studio as sample values and MUST be replaced
// before this can take money - see STRIPE_INTEGRATION_TODO.md at the repo root,
// which is the single source of truth for what is left to do.

const STRIPE_SESSIONS_URL = 'https://api.stripe.com/v1/checkout/sessions';

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST') return json(res, 405, { error: 'Use POST.' });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    // A missing key is a configuration problem, not a client error - and it is
    // never echoed back, only its absence.
    return json(res, 503, { error: 'Stripe is not configured on this endpoint (STRIPE_SECRET_KEY is unset).' });
  }

  const domain = String(process.env.DOMAIN || '').replace(/\/+$/, '');

  // TODO: replace this with the Price ID from the Stripe Dashboard
  // (https://dashboard.stripe.com/prices), and set `mode` to "payment" for a
  // one-time charge or "subscription" for recurring billing.
  const mode = 'payment';
  const priceId = 'price_...';

  const params = new URLSearchParams();

  // --- configured in Checkout Studio, used exactly as configured -------------
  params.set('ui_mode', 'hosted_page');
  params.set('billing_address_collection', 'auto');
  params.set('phone_number_collection[enabled]', 'false');
  params.set('automatic_tax[enabled]', 'true');
  params.set('allow_promotion_codes', 'false');
  params.set('submit_type', 'auto');
  params.set('integration_identifier', 'hosted_web_0002');
  params.set('origin_context', 'web');
  // payment_method_collection is a subscription parameter - a one-time payment
  // has nothing to save, and Stripe rejects it for mode=payment.
  if (mode === 'subscription') params.set('payment_method_collection', 'always');

  // --- the product being sold, and where the customer comes back to ---------
  params.set('mode', mode);
  params.set('line_items[0][price]', priceId);
  params.set('line_items[0][quantity]', '1');
  params.set('success_url', `${domain}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${domain}/?checkout=cancelled`);

  try {
    // No Stripe SDK, so no API version to pin either: the request runs against
    // the account's own default version, exactly as the Dashboard shows it.
    const response = await fetch(STRIPE_SESSIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = data?.error?.message || '';
      return json(res, response.status, {
        error: `Stripe could not create the checkout session (${response.status}).`,
        detail
      });
    }
    if (!data || !data.url) {
      return json(res, 502, { error: 'Stripe returned a session with no hosted page URL.' });
    }
    return json(res, 200, { url: data.url, id: data.id });
  } catch (error) {
    return json(res, 502, { error: error.message || 'Could not reach Stripe.' });
  }
};
