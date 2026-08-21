// =========================================================
// /client-sprint — VP+ 90-Day Client Sprint. Page-specific JS.
//
// Loads alongside the shared script.js, which already wires the reused
// components by class name (.nav menu, .faq accordion, .proof video
// carousel, the #year stamp and the scroll-reveal wave). Everything here
// is wrapped in an IIFE because script.js declares several top-level
// consts in global script scope (yearEl, nav, navMenu, scrollBehavior,
// faqItems, stories, proof, portal) and a redeclaration would throw.
//
// Sections, in order:
//   1. Configuration — the four things Jack edits
//   2. Query-parameter passthrough (UTMs + ad click IDs)
//   3. Analytics
//   4. CTA wiring
//   5. Sticky conversion bar
//   6. Guarantee terms modal
//   7. FAQ interaction tracking
//   8. Optional aggregate-data section
//   9. Optional founding-cohort scarcity
//  10. Scroll reveal for the Sprint-only sections
// =========================================================
(function () {
  'use strict';

  // =======================================================
  // 1 — CONFIGURATION
  // =======================================================

  // TODO(jack): the one string to change. There is no $129 Sprint product
  // in checkout yet — this is the expected sibling of the existing
  // /premium-intro link. Point it at the real Sprint checkout before
  // spending a penny on traffic, and keep the no-JS fallback href on the
  // offer card in index.html in sync with it.
  var SPRINT_CHECKOUT_URL = 'https://checkout.videoproduction.plus/client-sprint';

  var SPRINT_PRICE = 129;
  var SPRINT_CURRENCY = 'USD';

  // TODO(jack): aggregate proof. OFF until the cohort is defined and the
  // dataset is verified. Flip enabled to true and the section renders
  // itself from this object — headline, stat cards and the qualifier.
  // Add or remove stats freely; the grid adapts.
  // Do NOT restate a cohort-specific number as a blanket claim.
  var SPRINT_DATA = {
    enabled: false,
    headline: 'The More You Apply, The More Shots You Give Yourself.',
    lede: 'Application volume is the single biggest thing an editor controls.',
    stats: [
      {
        value: '40%',
        label: 'of editors who submitted 25&ndash;49 applications landed at least one client'
      }
      // Room to grow as Sprint data lands, e.g.:
      // { value: '__%', label: 'landed a client by Day 30' },
      // { value: '__',  label: 'median applications to first win' },
      // { value: '__',  label: 'median days to first win' },
    ],
    // Shown under the grid. Required: the cohort has to be legible.
    note: 'TODO(jack): state the cohort, the date range and the sample size here before this section goes live.'
  };

  // TODO(jack): founding-cohort scarcity. OFF unless the cap is real AND
  // remaining seats are genuinely tracked. If you are not restricting
  // intake, leave this off — do not invent a countdown.
  var SPRINT_COHORT = {
    enabled: false,
    total: 100,
    remaining: null // a real number, or null to show the cap without a count
  };

  // Query parameters worth carrying through to checkout.
  var PASSTHROUGH_PARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id',
    'fbclid', 'fbc', 'fbp',
    'gclid', 'gbraid', 'wbraid', 'msclkid', 'ttclid', 'twclid', 'li_fat_id', 'epik',
    'ref', 'aff', 'src'
  ];

  var PAGE_ID = 'client_sprint';

  // =======================================================
  // 2 — QUERY-PARAMETER PASSTHROUGH
  // =======================================================

  // Cold paid traffic lands with attribution in the URL. If it does not
  // survive the hop to checkout, the purchase cannot be tied back to the
  // ad that produced it. Read once, keep for the session (an in-page
  // anchor click or a back-forward navigation can drop the query string).
  var STORAGE_KEY = 'vppSprintParams';

  function readParams() {
    var found = {};
    var search;
    try {
      search = new URLSearchParams(window.location.search);
    } catch (e) {
      return found;
    }
    PASSTHROUGH_PARAMS.forEach(function (key) {
      var value = search.get(key);
      if (value) found[key] = value;
    });
    return found;
  }

  function loadStoredParams() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function storeParams(params) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(params));
    } catch (e) { /* Safari private mode — carry on in memory */ }
  }

  // A visit that carries ANY attribution replaces the stored set outright
  // rather than merging into it. Merging per key looks harmless until a
  // visitor arrives from campaign A, comes back later from campaign B whose
  // URL only carries utm_source, and campaign A's utm_campaign and click ID
  // ride along to checkout — attributing B's sale to A.
  var attribution = (function () {
    var fresh = readParams();
    if (Object.keys(fresh).length) {
      storeParams(fresh);
      return fresh;
    }
    return loadStoredParams();
  })();

  // Build the checkout URL with attribution appended. Anything already on
  // the configured checkout URL is left alone.
  function checkoutUrl() {
    var url;
    try {
      url = new URL(SPRINT_CHECKOUT_URL, window.location.href);
    } catch (e) {
      return SPRINT_CHECKOUT_URL;
    }
    Object.keys(attribution).forEach(function (key) {
      if (!url.searchParams.has(key)) url.searchParams.set(key, attribution[key]);
    });
    return url.toString();
  }

  // =======================================================
  // 3 — ANALYTICS
  // =======================================================

  // One funnel through every analytics surface the site actually has:
  // GTM/dataLayer if present, GA4 gtag if present, and the Meta pixel
  // that is inlined in the head of this page. Every call is guarded so a
  // blocked pixel never breaks the page.
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

  // Meta standard events, kept separate from the custom ones so the ad
  // account can optimise on them. Purchase fires on the confirmation
  // page, not here.
  function trackMetaStandard(eventName, props) {
    try {
      if (typeof window.fbq === 'function') window.fbq('track', eventName, props || {});
    } catch (e) { /* no-op */ }
  }

  // NOTE: client_sprint_purchase is deliberately NOT fired here. It belongs
  // on the post-checkout confirmation page, which lives in the checkout
  // stack rather than in this repo. Whoever wires that page should fire
  // client_sprint_purchase plus the Meta standard Purchase event with
  // value 129 / currency USD, and carry these same UTM params through.
  track(PAGE_ID + '_page_view', {
    utm_source: attribution.utm_source || null,
    utm_medium: attribution.utm_medium || null,
    utm_campaign: attribution.utm_campaign || null,
    utm_content: attribution.utm_content || null
  });

  // =======================================================
  // 4 — CTA WIRING
  // =======================================================

  // Every conversion CTA on the page carries data-cta and a
  // data-cta-location naming the section it sits in. The markup ships
  // with href="#offer" so the page still works without JS (it scrolls to
  // the offer card, whose own CTA carries the checkout URL literally).
  // Here they all become the real checkout link, with attribution.
  var ctas = Array.prototype.slice.call(document.querySelectorAll('a[data-cta]'));
  var resolvedCheckout = checkoutUrl();

  ctas.forEach(function (el) {
    el.setAttribute('href', resolvedCheckout);
    el.addEventListener('click', function () {
      var location = el.getAttribute('data-cta-location') || 'unknown';
      var label = (el.textContent || '').trim().replace(/\s+/g, ' ');
      track(PAGE_ID + '_cta_click', {
        cta_location: location,
        cta_label: label,
        value: SPRINT_PRICE,
        currency: SPRINT_CURRENCY
      });
      track(PAGE_ID + '_checkout_start', {
        cta_location: location,
        value: SPRINT_PRICE,
        currency: SPRINT_CURRENCY
      });
      trackMetaStandard('InitiateCheckout', {
        content_name: 'VP+ 90-Day Client Sprint',
        content_ids: ['vpp-client-sprint-129'],
        content_type: 'product',
        value: SPRINT_PRICE,
        currency: SPRINT_CURRENCY
      });
    });
  });

  // =======================================================
  // 5 — STICKY CONVERSION BAR
  // =======================================================

  // Appears once the hero has scrolled away; disappears again whenever a
  // full-size CTA is already on screen, so the page never shows the
  // visitor two competing buy buttons at once.
  (function stickyBar() {
    var bar = document.getElementById('sprintSticky');
    var hero = document.querySelector('.sprint-hero');
    if (!bar || !hero || !('IntersectionObserver' in window)) return;

    // Anywhere a full-size CTA is already on screen. Two buy buttons
    // competing for the same tap is clutter, so the bar stands down for
    // the offer card, the final CTA, the footer CTA and every in-section
    // CTA row (fast-win proof, marketplace, guarantee, proof wall).
    var quietZones = Array.prototype.slice.call(
      document.querySelectorAll(
        '#offer, .sprint-final, .footer, .sprint-cta-row, .sprint-guarantee__actions'
      )
    );

    var heroVisible = true;
    var quietVisible = 0;
    var shown = false;
    var reported = false;

    function apply() {
      var shouldShow = !heroVisible && quietVisible === 0;
      if (shouldShow === shown) return;
      shown = shouldShow;

      if (shouldShow) {
        // [hidden] has to come off a frame before .is-visible, or the
        // element goes display:none -> visible in one style change and
        // the opacity/transform transition never gets a start value.
        bar.hidden = false;
        requestAnimationFrame(function () {
          if (shown) bar.classList.add('is-visible');
        });
        // One impression per page load. The bar legitimately comes and
        // goes a dozen times on a page this long; reporting each one
        // would drown the funnel in noise.
        if (!reported) {
          reported = true;
          track(PAGE_ID + '_sticky_cta_shown', {});
        }
      } else {
        bar.classList.remove('is-visible');
        bar.hidden = true;
      }
    }

    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { heroVisible = entry.isIntersecting; });
      apply();
    }, { rootMargin: '-40% 0px 0px 0px' }).observe(hero);

    if (quietZones.length) {
      var quiet = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          entry.target.dataset.sprintQuiet = entry.isIntersecting ? '1' : '';
        });
        quietVisible = quietZones.filter(function (el) {
          return el.dataset.sprintQuiet === '1';
        }).length;
        apply();
      }, { threshold: 0 });
      quietZones.forEach(function (el) { quiet.observe(el); });
    }

    apply();
  })();

  // =======================================================
  // 5b — SCROLL LOCK
  // =======================================================

  // The obvious `body { overflow: hidden }` is inert on this site: the
  // shared stylesheet sets `html { overflow-x: clip }`, so the body's
  // overflow never propagates to the viewport, and the portal rule
  // already puts overflow:hidden on <body> anyway. Lock the root element
  // instead, and pad for the scrollbar width so the page does not jump
  // sideways when it disappears.
  var scrollLock = null;

  function lockScroll() {
    if (scrollLock !== null) return;
    var root = document.documentElement;
    var gutter = window.innerWidth - root.clientWidth;
    scrollLock = { overflow: root.style.overflow, padding: root.style.paddingRight };
    root.style.overflow = 'hidden';
    if (gutter > 0) root.style.paddingRight = gutter + 'px';
  }

  function unlockScroll() {
    if (scrollLock === null) return;
    var root = document.documentElement;
    root.style.overflow = scrollLock.overflow;
    root.style.paddingRight = scrollLock.padding;
    scrollLock = null;
  }

  // =======================================================
  // 6 — GUARANTEE TERMS MODAL
  // =======================================================

  // Material conditions stay in plain English on the page; this is the
  // long-form version. <dialog> where supported, a plain shown/hidden
  // panel where it is not.
  (function guaranteeModal() {
    var modal = document.getElementById('guaranteeModal');
    if (!modal) return;

    var opener = null;
    var supportsDialog = typeof modal.showModal === 'function';

    // Without showModal there is no ::backdrop, so the fallback paints its
    // own via a fixed pseudo-element on the dialog. Hit-testing attributes
    // clicks on a pseudo-element to its originating element, which is what
    // makes the click-outside-to-dismiss handler below work there too.
    if (!supportsDialog) modal.classList.add('sprint-modal--fallback');

    function open(trigger) {
      opener = trigger || null;
      if (supportsDialog) {
        modal.showModal();
      } else {
        modal.setAttribute('open', '');
      }
      modal.classList.add('is-open');
      document.body.classList.add('sprint-modal-open');
      lockScroll();
      if (!supportsDialog) trapFocus(true);
      // preventScroll: the page is locked behind the modal, but a plain
      // focus() can still scroll the document to reveal the focused node,
      // which drops the visitor somewhere new when the modal closes.
      var closeBtn = modal.querySelector('[data-guarantee-close]');
      if (closeBtn) focusQuietly(closeBtn);
      track(PAGE_ID + '_guarantee_details_opened', {
        source: (trigger && trigger.getAttribute('data-cta-location')) ||
                (trigger && trigger.closest('.faq__item') ? 'faq' : 'guarantee-section')
      });
    }

    function close() {
      if (supportsDialog && modal.open) modal.close();
      else modal.removeAttribute('open');
      modal.classList.remove('is-open');
      document.body.classList.remove('sprint-modal-open');
      if (!supportsDialog) trapFocus(false);
      unlockScroll();
      if (opener) focusQuietly(opener);
      opener = null;
    }

    // showModal() makes the rest of the document inert for free. The
    // [open]-attribute fallback does not, so keep focus inside by hand.
    function focusQuietly(el) {
      if (!el || typeof el.focus !== 'function') return;
      try {
        el.focus({ preventScroll: true });
      } catch (e) {
        el.focus();
      }
    }

    function onFocusIn(e) {
      if (modal.contains(e.target)) return;
      focusQuietly(modal.querySelector('[data-guarantee-close]'));
    }
    function trapFocus(on) {
      if (on) document.addEventListener('focusin', onFocusIn);
      else document.removeEventListener('focusin', onFocusIn);
    }

    document.querySelectorAll('[data-guarantee-open]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        open(btn);
      });
    });

    modal.querySelectorAll('[data-guarantee-close]').forEach(function (btn) {
      btn.addEventListener('click', close);
    });

    // Click the backdrop (the dialog element itself, outside its inner
    // panel) to dismiss.
    modal.addEventListener('click', function (e) {
      if (e.target === modal) close();
    });

    // Native dialogs already close on Escape; keep the class + body lock
    // in sync when they do, and handle Escape ourselves when they don't.
    modal.addEventListener('close', function () {
      modal.classList.remove('is-open');
      document.body.classList.remove('sprint-modal-open');
      unlockScroll();
    });
    if (!supportsDialog) {
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.hasAttribute('open')) close();
      });
    }

    // A CTA inside the modal leaves for checkout — drop the body lock so
    // a back-navigation never lands on a frozen page.
    modal.querySelectorAll('a[data-cta]').forEach(function (link) {
      link.addEventListener('click', close);
    });
  })();

  // =======================================================
  // 7 — FAQ INTERACTION TRACKING
  // =======================================================

  // The shared script.js already handles exclusive-open behaviour; this
  // only reports which questions cold traffic actually needs answered.
  document.querySelectorAll('.sprint-faq .faq__item').forEach(function (item, index) {
    item.addEventListener('toggle', function () {
      if (!item.open) return;
      var q = item.querySelector('.faq__q-text');
      track(PAGE_ID + '_faq_open', {
        faq_index: index,
        faq_question: q ? (q.textContent || '').trim() : ''
      });
    });
  });

  // =======================================================
  // 8 — OPTIONAL AGGREGATE-DATA SECTION
  // =======================================================

  (function renderData() {
    var section = document.getElementById('sprint-data');
    if (!section) return;
    if (!SPRINT_DATA.enabled || !SPRINT_DATA.stats || !SPRINT_DATA.stats.length) {
      section.remove();
      return;
    }

    var headline = section.querySelector('[data-sprint-data-headline]');
    var lede = section.querySelector('[data-sprint-data-lede]');
    var grid = section.querySelector('[data-sprint-data-grid]');
    var note = section.querySelector('[data-sprint-data-note]');

    if (headline) headline.innerHTML = SPRINT_DATA.headline;
    if (lede) {
      lede.innerHTML = SPRINT_DATA.lede || '';
      lede.hidden = !SPRINT_DATA.lede;
    }

    if (grid) {
      grid.innerHTML = '';
      SPRINT_DATA.stats.forEach(function (stat) {
        var li = document.createElement('li');
        li.className = 'sprint-data__stat';
        var v = document.createElement('span');
        v.className = 'sprint-data__value';
        v.innerHTML = stat.value;
        var l = document.createElement('span');
        l.className = 'sprint-data__label';
        l.innerHTML = stat.label;
        li.appendChild(v);
        li.appendChild(l);
        grid.appendChild(li);
      });
    }

    if (note) {
      note.innerHTML = SPRINT_DATA.note || '';
      note.hidden = !SPRINT_DATA.note;
    }

    section.hidden = false;
  })();

  // =======================================================
  // 9 — OPTIONAL FOUNDING-COHORT SCARCITY
  // =======================================================

  (function renderCohort() {
    var el = document.querySelector('[data-sprint-cohort]');
    if (!el) return;
    if (!SPRINT_COHORT.enabled) {
      el.remove();
      return;
    }

    var text = 'Founding Sprint Cohort &mdash; ' + SPRINT_COHORT.total + ' passes';
    if (typeof SPRINT_COHORT.remaining === 'number') {
      text += '. <strong>' + SPRINT_COHORT.remaining + ' remaining.</strong>';
    }
    text += ' VP+ limits editor intake so job opportunity stays dense.';

    el.innerHTML = text;
    el.hidden = false;
  })();

  // =======================================================
  // 10 — SCROLL REVEAL FOR THE SPRINT-ONLY SECTIONS
  // =======================================================

  // The shared reveal wave in script.js enrols a fixed list of selectors
  // from the main sales page. Reused components on this page (.nav,
  // .hero__*, .vs__card, .faq__item, .cta__inner, .footer__inner,
  // .proof__card, .testimonials__row, .showcase__frame, .pricing__plan)
  // are already on that list; the Sprint-only blocks are not. Rather than
  // edit the shared file, anything marked data-rv gets the same treatment
  // here, using the same classes so the timing curve matches exactly.
  (function reveal() {
    var targets = Array.prototype.slice.call(document.querySelectorAll('[data-rv]'));
    if (!targets.length) return;
    if (!('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var pending = new Set();

    function release(el) {
      el.classList.remove('rv', 'rv--up', 'rv--fade', 'rv--scale', 'rv-in');
      el.style.removeProperty('transition-delay');
    }

    var io = new IntersectionObserver(function (entries) {
      var batch = 0;
      entries.forEach(function (entry) {
        var el = entry.target;
        if (!pending.has(el)) return;
        if (entry.isIntersecting) {
          pending.delete(el);
          io.unobserve(el);
          var delay = Math.min(batch++ * 80, 480);
          el.style.transitionDelay = delay + 'ms';
          requestAnimationFrame(function () {
            requestAnimationFrame(function () { el.classList.add('rv-in'); });
          });
          setTimeout(function () { release(el); }, delay + 800);
        } else if (entry.boundingClientRect.bottom <= 0) {
          pending.delete(el);
          io.unobserve(el);
          release(el);
        }
      });
      if (!pending.size) io.disconnect();
    }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });

    targets.forEach(function (el) {
      // Already scrolled past on a restored scroll position — leave it be.
      if (el.getBoundingClientRect().bottom < 0) return;
      var variant = el.getAttribute('data-rv') || 'up';
      el.classList.add('rv', 'rv--' + variant);
      pending.add(el);
      io.observe(el);
    });

    // Scroll-sweep backstop, mirroring the shared wave in script.js. An
    // element that never gets an IntersectionObserver callback would sit
    // at opacity 0 forever, and on a sales page invisible copy is a lost
    // sale — so a cheap rAF-throttled sweep releases anything the
    // observer missed.
    var sweepQueued = false;

    function sweep() {
      sweepQueued = false;
      var vh = window.innerHeight;
      pending.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom <= 0 || r.top < vh * 0.93) {
          pending.delete(el);
          io.unobserve(el);
          if (r.bottom <= 0) {
            release(el);
          } else {
            requestAnimationFrame(function () { el.classList.add('rv-in'); });
            setTimeout(function () { release(el); }, 800);
          }
        }
      });
      if (!pending.size) {
        io.disconnect();
        window.removeEventListener('scroll', onScroll);
      }
    }

    function onScroll() {
      if (sweepQueued) return;
      sweepQueued = true;
      requestAnimationFrame(sweep);
    }

    window.addEventListener('scroll', onScroll, { passive: true });

    // The shared reveal adds this too; adding it again is a no-op, but a
    // page whose shared wave bailed early still needs it for .rv to bite.
    document.documentElement.classList.add('rv-init');
  })();
})();
