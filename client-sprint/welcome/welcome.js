// =========================================================
// /client-sprint/welcome — payment confirmation + conversion tracking.
//
// Stripe redirects here after confirmPayment with:
//   ?payment_intent=pi_...&payment_intent_client_secret=..._secret_...
//   &redirect_status=succeeded|processing|failed
//
// The status is confirmed with stripe.retrievePaymentIntent(), which
// takes only the publishable key — no server call happens on this page.
// redirect_status alone is not trusted: it is a URL parameter anyone can
// type, and this page fires a Purchase conversion.
//
// Granting access is NOT done here. That belongs to the membership
// system reacting to the Stripe webhook.
// =========================================================
(function () {
  'use strict';

  // =======================================================
  // 1 — CONFIGURATION
  // =======================================================

  // TODO(jack): same publishable key as the checkout page.
  // Keep these two in sync — or better, once your dev owns this, serve
  // it from one place.
  var STRIPE_PUBLISHABLE_KEY = '';

  // TODO(jack): your Discord invite URL. Leave it blank and the block
  // shows the "we'll email you" state instead of a dead button.
  // Note a plain invite is open to anyone who has the link — your dev's
  // linked flow (which ties a Discord account to a paid pass) should
  // replace this block via [data-membership-slot] when it's ready.
  var DISCORD_INVITE_URL = '';

  var PAGE_ID = 'client_sprint';
  var AMOUNT = 129;
  var CURRENCY = 'USD';
  var PRODUCT_CODE = 'vpp-client-sprint-129';
  var FIRED_KEY = 'vppSprintPurchaseFired';

  var PASSTHROUGH_PARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id',
    'fbclid', 'fbc', 'fbp',
    'gclid', 'gbraid', 'wbraid', 'msclkid', 'ttclid', 'twclid', 'li_fat_id', 'epik',
    'ref', 'aff', 'src'
  ];

  // =======================================================
  // 2 — Helpers
  // =======================================================

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  var params;
  try {
    params = new URLSearchParams(window.location.search);
  } catch (e) {
    params = { get: function () { return null; } };
  }

  function showState(name) {
    document.querySelectorAll('[data-state]').forEach(function (el) {
      el.hidden = el.getAttribute('data-state') !== name;
    });
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.textContent = value;
    });
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

  var attribution = (function () {
    var found = {};
    PASSTHROUGH_PARAMS.forEach(function (key) {
      var value = params.get && params.get(key);
      if (value) found[key] = value;
    });
    if (Object.keys(found).length) return found;
    try {
      var raw = sessionStorage.getItem('vppSprintParams');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  })();

  // =======================================================
  // 3 — The Purchase conversion
  // =======================================================

  // Fires at most once per PaymentIntent, ever, on this browser.
  // A refresh of this URL must not double-count a sale.
  function alreadyFired(paymentIntentId) {
    try {
      var raw = window.localStorage.getItem(FIRED_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) && list.indexOf(paymentIntentId) !== -1;
    } catch (e) {
      return false;
    }
  }
  function markFired(paymentIntentId) {
    try {
      var raw = window.localStorage.getItem(FIRED_KEY);
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
      list.push(paymentIntentId);
      // Keep the list short — this is a dedup guard, not a ledger.
      window.localStorage.setItem(FIRED_KEY, JSON.stringify(list.slice(-25)));
    } catch (e) { /* no-op */ }
  }

  function firePurchase(paymentIntent) {
    var id = paymentIntent.id;
    if (!id || alreadyFired(id)) return;
    markFired(id);

    var props = {
      value: AMOUNT,
      currency: CURRENCY,
      product: PRODUCT_CODE,
      transaction_id: id,
      pass_days: 90
    };
    Object.keys(attribution).forEach(function (key) { props[key] = attribution[key]; });

    track(PAGE_ID + '_purchase', props);

    // Meta standard Purchase.
    //
    // event_id is the Stripe PaymentIntent ID. That matters: if the
    // membership webhook ALSO sends a server-side Conversions API
    // Purchase, it must use this same pi_... as its event_id. Meta then
    // deduplicates the pair instead of counting the sale twice — which
    // otherwise silently doubles reported ROAS and wrecks optimisation.
    try {
      if (typeof window.fbq === 'function') {
        window.fbq('track', 'Purchase', {
          value: AMOUNT,
          currency: CURRENCY,
          content_name: 'VP+ 90-Day Client Acquisition Pass',
          content_ids: [PRODUCT_CODE],
          content_type: 'product'
        }, { eventID: id });
      }
    } catch (e) { /* no-op */ }
  }

  // =======================================================
  // 4 — Membership seam (Discord)
  // =======================================================

  function renderAccessBlock() {
    var link = document.querySelector('[data-discord-link]');
    var text = document.querySelector('[data-discord-text]');
    if (!link || !DISCORD_INVITE_URL) return;

    link.setAttribute('href', DISCORD_INVITE_URL);
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener');
    link.hidden = false;
    if (text) {
      text.textContent = 'Jump into the VP+ editor community now. Your marketplace access ' +
        'details are on their way to your email.';
    }
    link.addEventListener('click', function () {
      track(PAGE_ID + '_discord_join_click', {});
    });
  }

  // =======================================================
  // 5 — Confirm the payment
  // =======================================================

  var clientSecret = params.get && params.get('payment_intent_client_secret');
  var redirectStatus = (params.get && params.get('redirect_status')) || '';

  if (!clientSecret) {
    showState('unknown');
    return;
  }

  // Stripe.js is blocked, or the key is not configured yet. The payment
  // itself already happened server-side, so do not alarm the buyer — show
  // the success path, minus the confirmation-dependent details. No
  // Purchase event fires, because nothing here has verified a sale.
  function degrade() {
    showState(redirectStatus === 'failed' ? 'failed' : 'succeeded');
    renderAccessBlock();
  }

  // Stripe.js is loaded with `async` so it never blocks first paint, which
  // means it may not have parsed by the time this runs. Wait for it rather
  // than assuming script order. The page sits on its loading state
  // meanwhile, and degrades if Stripe never shows up.
  function whenStripeReady(timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (typeof window.Stripe === 'function') return resolve();
      var waited = 0;
      var step = 60;
      var timer = setInterval(function () {
        if (typeof window.Stripe === 'function') { clearInterval(timer); resolve(); }
        else if ((waited += step) >= timeoutMs) { clearInterval(timer); reject(new Error('stripe-unavailable')); }
      }, step);
    });
  }

  if (!STRIPE_PUBLISHABLE_KEY) {
    degrade();
    return;
  }

  whenStripeReady(8000).then(confirmPaymentIntent).catch(degrade);

  function confirmPaymentIntent() {
  var stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY);

  stripe.retrievePaymentIntent(clientSecret).then(function (result) {
    var pi = result && result.paymentIntent;

    if (!pi) {
      showState('unknown');
      return;
    }

    var email = (pi.receipt_email) ||
      (pi.charges && pi.charges.data && pi.charges.data[0] && pi.charges.data[0].billing_details &&
        pi.charges.data[0].billing_details.email) || '';

    if (email) setText('[data-buyer-email]', email);
    setText('[data-payment-ref]', pi.id);

    switch (pi.status) {
      case 'succeeded':
        showState('succeeded');
        renderAccessBlock();
        firePurchase(pi);
        break;

      case 'processing':
        showState('processing');
        track(PAGE_ID + '_purchase_processing', { transaction_id: pi.id });
        break;

      case 'requires_payment_method':
      case 'requires_action':
      case 'canceled': {
        showState('failed');
        var msg = document.querySelector('[data-failure-message]');
        if (msg && pi.last_payment_error && pi.last_payment_error.message) {
          msg.textContent = pi.last_payment_error.message + ' Your card was not charged.';
        }
        track(PAGE_ID + '_purchase_failed', { transaction_id: pi.id, status: pi.status });
        break;
      }

      default:
        showState('processing');
    }
  }).catch(function () {
    // Could not reach Stripe to confirm. The buyer has very likely paid,
    // so do not show them a failure — show the success path without the
    // verified details, and fire nothing.
    showState('succeeded');
    renderAccessBlock();
  });
  } // end confirmPaymentIntent()
})();
