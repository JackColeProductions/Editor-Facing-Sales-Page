# `/client-sprint/checkout` — server contract

The checkout front end is built and lives at `/client-sprint/checkout`. It is
**front end only**. It needs exactly **one endpoint** to take money.

Everything after the payment lands — granting the 90 days, the Discord role,
the expiry sweep, revocation — is the existing membership system's job and is
deliberately not implemented here.

---

## 1. The endpoint

```
POST {API_BASE}/create-payment-intent
Content-Type: application/json
Idempotency-Key: <uuid, stable across retries of one attempt>
```

`API_BASE` is `/api` by default (same-origin) — set at the top of
`client-sprint/checkout/checkout.js`.

### Request

```jsonc
{
  "email": "editor@example.com",     // from the Link Authentication Element
  "product": "vpp-client-sprint-129",
  "page": "/client-sprint/checkout",
  "attribution": {                   // 0–20 keys, all optional
    "utm_source": "facebook",
    "utm_medium": "paid",
    "utm_campaign": "pass-cold-1",
    "utm_content": "hook-a",
    "fbclid": "IwAR..."
    // also possible: utm_term, utm_id, fbc, fbp, gclid, gbraid, wbraid,
    // msclkid, ttclid, twclid, li_fat_id, epik, ref, aff, src
  }
}
```

### Response — 200

```jsonc
{
  "clientSecret": "pi_3ABC..._secret_xyz",
  "paymentIntentId": "pi_3ABC..."
}
```

### Response — 4xx / 5xx

```jsonc
{ "error": { "message": "Card issuer declined the setup. Try another card." } }
```

`error.message` is rendered directly to the buyer, so keep it human and never
leak internals.

---

## 2. What the endpoint must do

**Derive the amount server-side.** Read the price from the Stripe Price on
product `prod_V8DaksbCULZhvP`. Never accept an amount from the browser.

It must resolve to **`12900` / `usd`**. The page builds its Elements instance
with that figure and Stripe rejects the confirmation if the two disagree — a
mismatch fails loudly rather than silently charging the wrong number, which is
the behaviour we want. If you change the price in Stripe, change `AMOUNT_MINOR`
in `checkout.js` in the same deploy.

**Create the PaymentIntent with:**

```js
const intent = await stripe.paymentIntents.create({
  amount,                                   // from the Price, not the request
  currency: 'usd',
  automatic_payment_methods: { enabled: true },
  receipt_email: body.email,
  metadata: {
    product: 'vpp-client-sprint-129',
    pass_days: '90',
    ...body.attribution                     // see the limits below
  }
}, { idempotencyKey: req.headers['idempotency-key'] });

return { clientSecret: intent.client_secret, paymentIntentId: intent.id };
```

**Stripe metadata limits:** ≤50 keys, key ≤40 chars, value ≤500 chars. The 20
attribution keys plus the two fixed ones fit comfortably, but truncate values
defensively rather than letting the create call throw.

**Honour `Idempotency-Key`.** The page sends one key per attempt and reuses it
across retries, so a double-click or a retried fetch cannot create two
PaymentIntents — but only if you pass it to Stripe.

**Never return anything but the client secret.** The secret key stays server-side.

---

## 3. Downstream (your existing system)

Nothing in this repo touches fulfilment. Your webhook owns it.

- Verify the webhook signature against the **raw** request body. Most frameworks
  parse JSON before you get to it, which breaks verification — Vercel needs
  `bodyParser: false` or the equivalent.
- Make the `payment_intent.succeeded` handler **idempotent**. Stripe retries.
- `metadata.pass_days` is `90`; `metadata.product` identifies this offer so it
  can be told apart from the monthly/annual memberships.
- The buyer's email is on `receipt_email` and in the attribution metadata you
  may want for reporting.

### One thing that will silently cost money if missed

If your webhook also sends a **server-side Conversions API `Purchase`** to Meta,
it must use the **Stripe PaymentIntent ID (`pi_...`) as the `event_id`**.

The thank-you page already fires the browser-side `Purchase` with
`{ eventID: pi_... }`. Matching IDs let Meta deduplicate the pair. Mismatched
IDs double-count every sale, which inflates reported ROAS and degrades campaign
optimisation — and it looks like the ads are working better than they are.

---

## 4. Where the endpoint can live

**Same-origin (preferred).** Ship it as a Vercel function at
`/api/create-payment-intent` in this repo. Note that `vercel.json` rewrites
unmatched *single-segment* root paths to a click tracker — `/api/...` is two
segments and unaffected, and Vercel resolves functions before rewrites anyway.

**On `checkout.videoproduction.plus`.** Then either:

- add a `vercel.json` rewrite proxying `/api/checkout/(.*)` to it, keeping the
  browser call same-origin and skipping a CORS preflight on the critical path
  (recommended), or
- point `API_BASE` in `checkout.js` at the absolute URL and serve
  `Access-Control-Allow-Origin: https://videoproduction.plus` plus
  `Access-Control-Allow-Headers: Content-Type, Idempotency-Key` and handle
  `OPTIONS`.

---

## 5. Before this can take a payment

1. Paste the Stripe **publishable** key into `STRIPE_PUBLISHABLE_KEY` at the top
   of `client-sprint/checkout/checkout.js` **and** `client-sprint/welcome/welcome.js`.
   `pk_test_...` to trial, `pk_live_...` to ship. Publishable keys are public by
   design and belong in client-side code.
2. Implement the endpoint above.
3. Optionally set `DISCORD_INVITE_URL` in `welcome.js` so buyers can join
   immediately. Leave it blank and the block shows a "we'll email you" state
   rather than a dead button. A plain invite link is open to anyone who has it,
   so your linked flow should replace the `[data-membership-slot]` block when
   it's ready.

Until step 1 is done the checkout shows a clear "not configured" notice and the
pay button stays disabled — it cannot ship silently broken.

---

## 6. Testing

Stripe test mode, with `pk_test_` in place and the endpoint pointed at a test
secret key:

| Card | Expected |
|---|---|
| `4242 4242 4242 4242` | Succeeds, redirects to `/client-sprint/welcome`, `Purchase` fires once |
| `4000 0027 6000 3184` | 3DS challenge, then returns and succeeds |
| `4000 0000 0000 9995` | Declined, inline error, no redirect, no `Purchase` |

Any future expiry, any CVC, any postcode.

Check in the Meta Pixel Helper that `Purchase` fires **exactly once** with
`eventID` equal to the `pi_...` shown on the thank-you page, and that refreshing
the thank-you page does **not** fire it again.
