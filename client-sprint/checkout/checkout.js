// =========================================================
// /client-sprint/checkout — Stripe Payment Element wiring.
//
// FRONT END ONLY. This file collects an email and card details and
// confirms a payment. It does not grant access, touch Discord, or know
// anything about the 90-day expiry — that is the membership system's
// job, downstream of the Stripe webhook.
//
// Flow (Stripe "deferred intent creation"):
//   1. Build Elements client-side with {mode, amount, currency} so the
//      card form paints immediately — no blocking fetch on page load.
//   2. On submit, elements.submit() validates the inputs locally.
//   3. POST to the server for a PaymentIntent client secret.
//   4. stripe.confirmPayment() redirects to the return URL (or to the
//      bank for 3DS first, then back).
//
// The amount below is a DISPLAY/validation figure only. The real charge
// comes from the Stripe Price resolved server-side. Stripe rejects the
// confirmation if the two disagree, which is exactly the guard we want.
// =========================================================
(function () {
  'use strict';

  // =======================================================
  // 1 — CONFIGURATION  (the only part Jack edits)
  // =======================================================

  // TODO(jack): your Stripe publishable key. pk_test_... while testing,
  // pk_live_... to take real money. Publishable keys are public by
  // design — this one is meant to be in client-side code. The SECRET
  // key (sk_...) must never appear in this repo.
  // While this is blank the page shows a clear "not configured" notice
  // and disables the button, so it cannot ship silently broken.
  var STRIPE_PUBLISHABLE_KEY = '';

  // Where the create-payment-intent endpoint lives. "/api" means
  // same-origin. If the endpoint is on checkout.videoproduction.plus,
  // prefer proxying it via a vercel.json rewrite to keep it same-origin
  // rather than pointing this at another host — that avoids a CORS
  // preflight on the critical path.
  var API_BASE = '/api';

  // Must match the Stripe Price the server resolves. 12900 = $129.00.
  var AMOUNT_MINOR = 12900;
  var CURRENCY = 'usd';
  var PRODUCT_CODE = 'vpp-client-sprint-129';
  var RETURN_PATH = '/client-sprint/welcome';

  var PAGE_ID = 'client_sprint';

  // Same allowlist and sessionStorage key the sales page uses, so
  // attribution captured on /client-sprint carries into the charge.
  // Checkout is same-origin now, so sessionStorage simply works.
  var STORAGE_KEY = 'vppSprintParams';
  var PASSTHROUGH_PARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id',
    'fbclid', 'fbc', 'fbp',
    'gclid', 'gbraid', 'wbraid', 'msclkid', 'ttclid', 'twclid', 'li_fat_id', 'epik',
    'ref', 'aff', 'src'
  ];

  // =======================================================
  // 2 — DOM + small helpers
  // =======================================================

  var form = document.getElementById('payment-form');
  var payButton = document.getElementById('pay-button');
  var payLabel = payButton && payButton.querySelector('.ck-pay__label');
  var paySpinner = payButton && payButton.querySelector('.ck-pay__spinner');
  var messageBox = document.getElementById('payment-message');
  var yearEl = document.getElementById('year');

  if (yearEl) yearEl.textContent = new Date().getFullYear();
  if (!form || !payButton || !messageBox) return;

  function showMessage(text, kind) {
    messageBox.textContent = text;
    messageBox.classList.toggle('ck-message--info', kind === 'info');
    messageBox.hidden = false;
  }
  function clearMessage() {
    messageBox.hidden = true;
    messageBox.textContent = '';
  }
  function setBusy(busy) {
    payButton.disabled = busy;
    if (paySpinner) paySpinner.hidden = !busy;
    if (payLabel) payLabel.textContent = busy ? 'Processing…' : 'Pay $129 — Get My 90-Day Pass';
  }
  function disablePermanently(text) {
    payButton.disabled = true;
    if (paySpinner) paySpinner.hidden = true;
    showMessage(text, 'info');
  }

  function track(eventName, props) {
    var payload = props || {};
    payload.page = PAGE_ID;
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: eventName }, payload));
    } catch (e) { /* no-op */ }
    try {
      if (typeof window.gtag === 'function') window.gtag('event', eventName, payload);
    } catch (e) { /* no-op */ }
    try {
      if (typeof window.fbq === 'function') window.fbq('trackCustom', eventName, payload);
    } catch (e) { /* no-op */ }
  }

  // =======================================================
  // 3 — Attribution
  // =======================================================

  // Params on this page's URL win over the stored set, matching the
  // sales page's rule that a visit carrying attribution replaces the
  // stored values wholesale rather than merging per key (merging lets
  // campaign A's click ID ride along on campaign B's purchase).
  var attribution = (function () {
    var fresh = {};
    try {
      var search = new URLSearchParams(window.location.search);
      PASSTHROUGH_PARAMS.forEach(function (key) {
        var value = search.get(key);
        if (value) fresh[key] = value;
      });
    } catch (e) { /* no-op */ }

    if (Object.keys(fresh).length) {
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)); } catch (e) {}
      return fresh;
    }
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  })();

  // =======================================================
  // 4 — Stripe bootstrap
  // =======================================================

  // Stripe.js is loaded async so it cannot block first paint, which means
  // it may not be there yet when this deferred script runs. Poll briefly
  // rather than assuming script order.
  function whenStripeReady(timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (typeof window.Stripe === 'function') return resolve();
      var waited = 0;
      var step = 60;
      var timer = setInterval(function () {
        if (typeof window.Stripe === 'function') {
          clearInterval(timer);
          resolve();
        } else if ((waited += step) >= timeoutMs) {
          clearInterval(timer);
          reject(new Error('stripe-unavailable'));
        }
      }, step);
    });
  }

  if (!STRIPE_PUBLISHABLE_KEY) {
    disablePermanently(
      'Checkout is not configured yet. Add your Stripe publishable key in ' +
      '/client-sprint/checkout/checkout.js to switch payments on.'
    );
    return;
  }

  setBusy(true);
  showMessage('Loading the secure payment form…', 'info');

  whenStripeReady(12000).then(boot).catch(function () {
    // Blocked by an extension (ad blockers catch js.stripe.com more often
    // than you'd expect) or the network dropped it. Say so plainly rather
    // than leaving an inert button.
    disablePermanently(
      'We could not load the secure payment form. Disable any ad blocker for this page and reload, ' +
      'or email hello@videoproductionplus.com and we will send you a payment link.'
    );
  });

  function boot() {
  clearMessage();
  setBusy(false);
  var stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY);

  // The Payment Element lives in a cross-origin iframe, so checkout.css
  // cannot reach it. Everything below is how it gets to look like VP+.
  // Hex values are hand-matched to the design tokens in styles.css
  // (--primary is hsl(180 74% 63%) = #5be6e6).
  var appearance = {
    theme: 'night',
    variables: {
      colorPrimary: '#5be6e6',
      colorBackground: '#101019',
      colorText: '#ffffff',
      colorTextSecondary: '#b0b0bd',
      colorTextPlaceholder: '#6b6b7b',
      colorDanger: '#ff8f8f',
      colorSuccess: '#5be6e6',
      fontFamily: "'Lufga', ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSizeBase: '15px',
      spacingUnit: '4px',
      borderRadius: '10px'
    },
    rules: {
      '.Input': {
        border: '1px solid #26263a',
        boxShadow: 'none',
        padding: '12px'
      },
      '.Input:focus': {
        border: '1px solid #5be6e6',
        boxShadow: '0 0 0 3px rgba(91, 230, 230, 0.16)'
      },
      '.Input--invalid': { border: '1px solid #ff8f8f' },
      '.Label': { fontWeight: '600', marginBottom: '6px' },
      '.Tab': { border: '1px solid #26263a', backgroundColor: '#101019' },
      '.Tab--selected': { border: '1px solid #5be6e6', backgroundColor: '#12202a' }
    }
  };

  var elements = stripe.elements({
    mode: 'payment',
    amount: AMOUNT_MINOR,
    currency: CURRENCY,
    appearance: appearance,
    // Pull Lufga into the Stripe iframe so the fields match the page.
    fonts: [{ cssSrc: 'https://fonts.cdnfonts.com/css/lufga' }]
  });

  var buyerEmail = '';

  var linkAuth = elements.create('linkAuthentication');
  linkAuth.mount('#link-authentication-element');
  linkAuth.on('change', function (event) {
    buyerEmail = (event && event.value && event.value.email) || '';
  });

  var paymentElement = elements.create('payment', {
    layout: { type: 'tabs', defaultCollapsed: false }
  });
  paymentElement.mount('#payment-element');

  paymentElement.on('loaderror', function (event) {
    disablePermanently(
      (event && event.error && event.error.message) ||
      'The payment form failed to load. Please reload the page and try again.'
    );
  });

  // =======================================================
  // 5 — Submit
  // =======================================================

  // One idempotency key per page load. It is reused across retries of
  // the SAME attempt so a double-click or a retried network call cannot
  // create two PaymentIntents. It is rotated only after a hard failure
  // that produced no intent.
  function newIdempotencyKey() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }
    } catch (e) { /* fall through */ }
    return 'ck-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }
  var idempotencyKey = newIdempotencyKey();

  var submitting = false;

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    setBusy(true);
    clearMessage();

    // Validate the Elements inputs before we create anything server-side.
    elements.submit().then(function (result) {
      if (result.error) {
        throw { display: result.error.message || 'Please check your payment details and try again.' };
      }

      track(PAGE_ID + '_checkout_submit', {
        value: AMOUNT_MINOR / 100,
        currency: CURRENCY.toUpperCase()
      });

      return fetch(API_BASE + '/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          email: buyerEmail,
          product: PRODUCT_CODE,
          page: RETURN_PATH.replace('/welcome', '/checkout'),
          attribution: attribution
        })
      });
    }).then(function (response) {
      return response.json().catch(function () {
        throw { display: 'We could not reach the payment service. Please try again in a moment.' };
      }).then(function (data) {
        if (!response.ok || !data || !data.clientSecret) {
          var msg = (data && data.error && data.error.message) ||
            'We could not start the payment. Please try again, or email hello@videoproductionplus.com.';
          throw { display: msg };
        }
        return data;
      });
    }).then(function (data) {
      var returnUrl = new URL(RETURN_PATH, window.location.origin);
      // Carry attribution through the redirect so the thank-you page can
      // attach it to the Purchase event.
      Object.keys(attribution).forEach(function (key) {
        returnUrl.searchParams.set(key, attribution[key]);
      });

      return stripe.confirmPayment({
        elements: elements,
        clientSecret: data.clientSecret,
        confirmParams: { return_url: returnUrl.toString() }
      });
    }).then(function (result) {
      // Reached only when the confirmation fails without redirecting.
      // Card declines and validation problems land here; successes and
      // 3DS challenges navigate away instead.
      if (result && result.error) {
        throw { display: result.error.message || 'That payment could not be completed. Please try another card.' };
      }
    }).catch(function (err) {
      var message = (err && err.display) ||
        'Something went wrong taking that payment. No charge was made — please try again.';
      showMessage(message);
      track(PAGE_ID + '_checkout_error', { message: message });
      // New key: whatever failed, the next attempt is a fresh one.
      idempotencyKey = newIdempotencyKey();
      submitting = false;
      setBusy(false);
    });
  });
  } // end boot()
})();
