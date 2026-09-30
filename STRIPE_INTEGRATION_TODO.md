# Stripe integration — TODO

**This file is the single source of truth for what is left before Stripe Checkout can take money.**

SideCut now accepts payments through **hosted Stripe Checkout**: the customer is sent to a page Stripe runs, and comes back to the app when it is done. The integration is **Scenario B** — this repository had no Checkout Session call anywhere, so one minimal endpoint was added next to the one server-side function that already existed (`api/spotify-search.js`).

**Nothing has been charged and nothing will be until the placeholders below are replaced.**

---

## Values to Replace

The following values are placeholders and must be updated before going live.

**Files containing placeholders:**
- [api/create-checkout-session.js](api/create-checkout-session.js)

| Field | Current Value | What to Set |
|-------|--------------|-------------|
| `mode` | `payment` | `"payment"` for one-time charges or `"subscription"` for recurring billing. A tip is a one-time charge, so `payment` is right today. If you ever sell a recurring plan, change this **and** the code already adds `payment_method_collection: "always"` for you, because Stripe rejects that parameter for `payment`. |
| `line_items[0].price` | `price_...` | Your actual Stripe Price ID from the [Dashboard](https://dashboard.stripe.com/prices) or the API. Create the product first: Dashboard → **Product catalog → Add product** → one-time, set the amount → copy the `price_…` id. For tiers (`$1`, `$3`, `$5`… like the Donate tab) create one Price per tier and map the tapped tier to its id. |
| `success_url` | `{DOMAIN}/?checkout=success&session_id={CHECKOUT_SESSION_ID}` | Your actual post-payment page. One is provided that returns to the app root; change the path if you would rather land somewhere else. **Keep the `{CHECKOUT_SESSION_ID}` template** — that is how the returned page can look the payment up. |
| `cancel_url` | `{DOMAIN}/?checkout=cancelled` | Your actual cancel/return page. |

`{DOMAIN}` above is the `DOMAIN` environment variable, so the two return URLs are configuration rather than code — set it once and both are correct.

---

## Configured Parameters

These parameters were configured in Checkout Studio and are already set correctly.

**Files containing these parameters:**
- [api/create-checkout-session.js](api/create-checkout-session.js)

| Parameter | Value |
|-----------|-------|
| `ui_mode` | `hosted_page` |
| `billing_address_collection` | `auto` |
| `phone_number_collection.enabled` | `false` |
| `automatic_tax.enabled` | `true` |
| `allow_promotion_codes` | `false` |
| `payment_method_collection` | `always` — **sent only when `mode` is `"subscription"`** (see the guard in the code) |
| `submit_type` | `auto` |
| `integration_identifier` | `hosted_web_0002` |
| `origin_context` | `web` |

Two of them are worth knowing about before you go live:

- **`ui_mode` depends on your Stripe API version.** SDK 21.0.0 and above use `hosted_page`; older versions use `hosted`. This repository installs no Stripe SDK (the endpoint calls the REST API directly, so it runs against your account's own default API version) — the version could not be read from the project, so **`hosted_page` is what shipped, as the default**. If Stripe ever answers `Invalid value for ui_mode`, change that one line to `hosted` and nothing else.
- **`automatic_tax` needs a real tax setup.** With it enabled, Stripe calculates tax, which means an **origin address** and, for the countries you sell into, a tax **registration** have to exist in the Dashboard. Without them the session creation fails with a tax error. If you are not ready for tax, set `params.set('automatic_tax[enabled]', 'true')` to `'false'` — that is the only line involved.

---

## Setup and next steps

### 1. Environment variables

Add these in the host that runs `api/` (see *Where this runs* below). **Server-only — never exposed to the browser, so they must NOT be prefixed:**

| Variable | Where to get it |
|----------|----------------|
| `STRIPE_SECRET_KEY` | Dashboard → **Developers → API keys** → Secret key (`sk_test_…` while testing, `sk_live_…` when live). |
| `DOMAIN` | The origin the app is served from, e.g. `https://anekthegreat.github.io` (no trailing slash needed — one is stripped). |

**No `VITE_`-prefixed variable is needed.** Hosted Checkout redirects to a page Stripe hosts, so no Stripe.js runs in SideCut and there is no browser-side key at all. The publishable key is unused by this integration.

`STRIPE_WEBHOOK_SECRET` is **not** set and no webhook endpoint was added: a tip unlocks nothing in SideCut, so there is no fulfilment to perform. Add a webhook (and that secret) only if you later sell something that has to be granted, tracked or emailed. The endpoint's own response already reports failures.

### 2. Where this runs

`api/spotify-search.js` already tells you how this repo does server-side work: one file per endpoint, exported as a CommonJS `(req, res)` handler, secrets from `process.env`. **`api/` is not served by GitHub Pages** (Pages only serves static files), so it is deployed somewhere that runs functions — the same place that already serves `api/spotify-search.js`. Keep the new file next to it and it is deployed by the same pipeline.

### 3. Project structure of new files

```
api/
  create-checkout-session.js   <- new: POST -> { url, id } for a hosted Checkout page
  spotify-search.js            <- pre-existing, same shape and conventions
STRIPE_INTEGRATION_TODO.md     <- this file
```

No dependency was added to `package.json` and no build step changed: the endpoint uses `fetch`, exactly like the endpoint beside it.

### 4. How the integration works

1. The app (or a form, or `curl`) sends `POST /api/create-checkout-session`.
2. The endpoint validates nothing about money it does not own: it builds a Checkout Session from the product and the configured parameters above, then calls `https://api.stripe.com/v1/checkout/sessions` with the secret key.
3. Stripe answers with a Session. The endpoint returns `{ "url": "https://checkout.stripe.com/…", "id": "cs_…" }`.
4. The app opens that `url` (in a browser, or an external browser window on Android). The customer pays on Stripe's page.
5. Stripe sends them to `success_url` with `session_id` attached — or to `cancel_url` if they back out. Both are query parameters on the return, so the app can say thank you rather than guessing.

Wiring it into the Donate tab: the tab already has a hosted-URL setting (`PAYMENT_CONFIG.donateUrl`, shipped in **70.1.6**). Either paste a **Payment Link** (`https://buy.stripe.com/…`, no key needed, quickest) or point the tab at this endpoint and open the `url` it returns (needed if the tier tapped must set the amount). Until a hosted page exists, the tab falls back to the Play listing exactly as it does today.

### 5. Testing

Use a **test-mode key** (`sk_test_…`) and test prices. No real money moves, and the return URLs still work.

| Card | Result |
|------|--------|
| `4242 4242 4242 4242` | Payment succeeds |
| `4000 0025 0000 3155` | Requires 3D Secure authentication |
| `4000 0000 0000 9995` | Declined (insufficient funds) |

Any future expiry date, any 3-digit CVC, any postal code. Check what happened in Dashboard → **Payments** (test mode) and in the **Events** stream. Switch to `sk_live_…` only when the live prices are in place.

### 6. Next steps

- Replace `price_...` with a real Price ID — **nothing works without this**.
- Create one Price per Donate tier if the tier should decide the amount, and map the tapped tier to its `price_…` id.
- Decide `mode`: `payment` for tips (current), `subscription` only if a recurring plan is added.
- Confirm the tax settings if `automatic_tax` stays enabled (origin address + registrations).
- Set `DOMAIN`, `STRIPE_SECRET_KEY` in the environment that serves `api/`, and redeploy.
- Buy one item with a test card end to end, then read it back in the Dashboard.
- Fulfilment: nothing to grant today. If that changes, add a webhook and store the Stripe `customer`/`subscription` ids against your own records.

### 7. Resources

- Stripe support: https://support.stripe.com
- Stripe docs (MCP): https://docs.stripe.com/mcp
- Checkout Sessions API: https://docs.stripe.com/api/checkout/sessions
- Best practices for API keys: https://docs.stripe.com/keys-best-practices
