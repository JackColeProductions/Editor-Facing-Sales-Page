// =========================================================
// /client-sprint — VP+ 90-Day Client Acquisition Pass (V2).
// Page-specific JS, loaded alongside the shared script.js (which
// wires the nav, FAQ accordion, #year stamp and its own reveal
// wave by class name). Everything here is wrapped in an IIFE
// because script.js declares top-level consts in global script
// scope (yearEl, nav, navMenu, scrollBehavior, faqItems, stories,
// proof, portal) and a redeclaration would throw.
//
// Sections:
//   1. Configuration — everything Jack edits lives here
//   2. Marketplace stats -> DOM (single source of truth)
//   3. Query-parameter passthrough (UTMs + ad click IDs)
//   4. Analytics
//   5. CTA wiring
//   6. Sticky conversion bar
//   7. Scroll lock (shared by both dialogs)
//   8. Guarantee terms modal
//   9. Screenshot slots + lightbox
//  10. FAQ interaction tracking
//  11. Count-up animation for the big numbers
//  12. Scroll reveal for Sprint-only sections
// =========================================================
(function () {
  'use strict';

  // =======================================================
  // 1 — CONFIGURATION
  // =======================================================

  // TODO(jack): the one string to change. There is still no $129 product
  // in checkout. Point this at the real Pass checkout before spending on
  // traffic, and keep the no-JS fallback href on the offer card in
  // index.html in sync with it.
  var SPRINT_CHECKOUT_URL = 'https://checkout.videoproduction.plus/client-sprint';

  var SPRINT_PRICE = 129;
  var SPRINT_CURRENCY = 'USD';
  var PAGE_ID = 'client_sprint';

  // ---- Marketplace proof numbers — the ONLY place they live. ----
  // Every number in the page's proof sections renders from this object,
  // so updating the page means editing these values and nothing else.
  // The HTML ships with the same values baked in as a no-JS fallback;
  // keep them matching when you update.
  //
  // Shaped to match a future live endpoint (see the brief's live-proof
  // spec): swap the literal for a fetch() of the same shape and the
  // page becomes a live scoreboard with no markup changes.
  //
  // TODO(jack): re-verify "jobsPerDay" and the record days before
  // spending — never display a number merely because it looks stronger.
  var SPRINT_STATS = {
    clients_last_30_days: 160,
    total_job_value: 107825,
    total_jobs: 297,
    jobs_per_day: '3–8',
    // How old the marketplace is, in days — used verbatim in the growth
    // and demand copy so the two can never drift apart again.
    active_days: 113,
    record_days: [
      { value: 4030, jobs: 7, date: 'Jul 27' },
      { value: 3939, jobs: 8, date: 'Jul 20' },
      { value: 3580, jobs: 5, date: 'Aug 1' },
      { value: 3500, jobs: 1, date: 'Apr 2' }
    ],
    last_updated: '21 Aug 2026'
  };

  // Query parameters worth carrying through to checkout.
  var PASSTHROUGH_PARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id',
    'fbclid', 'fbc', 'fbp',
    'gclid', 'gbraid', 'wbraid', 'msclkid', 'ttclid', 'twclid', 'li_fat_id', 'epik',
    'ref', 'aff', 'src'
  ];

  // =======================================================
  // 2 — STATS -> DOM
  // =======================================================

  function fmtMoney(n) { return '$' + Number(n).toLocaleString('en-US'); }
  function fmtNum(n) { return Number(n).toLocaleString('en-US'); }

  (function renderStats() {
    // For counted stats, carry the raw number too: the count-up animation
    // reads data-count, so renderStats refreshes that attribute as well —
    // editing SPRINT_STATS alone can never leave a stale animation target.
    var RAW = {
      clients30: SPRINT_STATS.clients_last_30_days,
      clients30b: SPRINT_STATS.clients_last_30_days,
      jobValue: SPRINT_STATS.total_job_value,
      jobValueB: SPRINT_STATS.total_job_value,
      jobs: SPRINT_STATS.total_jobs,
      jobsB: SPRINT_STATS.total_jobs
    };
    var map = {
      clients30: fmtNum(SPRINT_STATS.clients_last_30_days),
      clients30b: fmtNum(SPRINT_STATS.clients_last_30_days),
      jobValue: fmtMoney(SPRINT_STATS.total_job_value),
      jobValueB: fmtMoney(SPRINT_STATS.total_job_value),
      jobs: fmtNum(SPRINT_STATS.total_jobs),
      jobsB: fmtNum(SPRINT_STATS.total_jobs),
      jobsPerDay: SPRINT_STATS.jobs_per_day,
      activeDays: fmtNum(SPRINT_STATS.active_days),
      recordValue: (SPRINT_STATS.record_days && SPRINT_STATS.record_days.length)
        ? fmtMoney(SPRINT_STATS.record_days[0].value)
        : '',
      lastUpdated: SPRINT_STATS.last_updated
    };
    Object.keys(map).forEach(function (key) {
      document.querySelectorAll('[data-stat="' + key + '"]').forEach(function (el) {
        el.textContent = map[key];
        if (el.hasAttribute('data-count') && RAW[key] !== undefined) {
          el.setAttribute('data-count', String(RAW[key]));
        }
      });
    });

    // Record-day cards render from config too, so a new record is a
    // one-line edit. The HTML fallback carries the same four cards.
    var grid = document.querySelector('[data-record-days]');
    if (grid && SPRINT_STATS.record_days && SPRINT_STATS.record_days.length) {
      grid.innerHTML = '';
      SPRINT_STATS.record_days.forEach(function (day) {
        var li = document.createElement('li');
        li.className = 'sprint-record';
        var v = document.createElement('span');
        v.className = 'sprint-record__value';
        v.textContent = fmtMoney(day.value);
        var m = document.createElement('span');
        m.className = 'sprint-record__meta';
        m.textContent = day.jobs + (day.jobs === 1 ? ' job' : ' jobs') + ' · ' + day.date;
        li.appendChild(v);
        li.appendChild(m);
        grid.appendChild(li);
      });
    }
  })();

  // =======================================================
  // 3 — QUERY-PARAMETER PASSTHROUGH
  // =======================================================

  // Cold paid traffic lands with attribution in the URL. If it does not
  // survive the hop to checkout, the purchase cannot be tied back to the
  // ad that produced it. A visit carrying ANY attribution replaces the
  // stored set outright — merging per key would let campaign A's click
  // ID ride along on campaign B's checkout.
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

  var attribution = (function () {
    var fresh = readParams();
    if (Object.keys(fresh).length) {
      storeParams(fresh);
      return fresh;
    }
    return loadStoredParams();
  })();

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
  // 4 — ANALYTICS
  // =======================================================

  // One funnel through every analytics surface the site has: GTM/dataLayer
  // if present, GA4 gtag if present, and the Meta pixel inlined in the
  // head. Every call is guarded so a blocked pixel never breaks the page.
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

  function trackMetaStandard(eventName, props) {
    try {
      if (typeof window.fbq === 'function') window.fbq('track', eventName, props || {});
    } catch (e) { /* no-op */ }
  }

  // NOTE: client_sprint_purchase is deliberately NOT fired here. It
  // belongs on the post-checkout confirmation page, which lives in the
  // checkout stack rather than in this repo. Whoever wires that page
  // should fire client_sprint_purchase plus the Meta standard Purchase
  // event with value 129 / currency USD, carry these same UTM params
  // through, and — if server-side (CAPI) tracking also fires — send the
  // SAME event_id from browser and server so Meta deduplicates instead
  // of double-counting.
  track(PAGE_ID + '_page_view', {
    utm_source: attribution.utm_source || null,
    utm_medium: attribution.utm_medium || null,
    utm_campaign: attribution.utm_campaign || null,
    utm_content: attribution.utm_content || null
  });

  // =======================================================
  // 5 — CTA WIRING
  // =======================================================

  // Every conversion CTA carries data-cta and a data-cta-location naming
  // its section (hero / after-mechanism / after-proof / guarantee /
  // checkout / sticky / final / footer / nav / guarantee-modal). The
  // markup ships with href="#offer" so the page works without JS; here
  // they all become the real checkout link with attribution attached.
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
        content_name: 'VP+ 90-Day Client Acquisition Pass',
        content_ids: ['vpp-client-sprint-129'],
        content_type: 'product',
        value: SPRINT_PRICE,
        currency: SPRINT_CURRENCY
      });
    });
  });

  // =======================================================
  // 6 — STICKY CONVERSION BAR
  // =======================================================

  // Appears once the hero has scrolled away; stands down whenever a
  // full-size CTA is already on screen, so the visitor never sees two
  // competing buy buttons at once.
  (function stickyBar() {
    var bar = document.getElementById('sprintSticky');
    var hero = document.querySelector('.sprint-hero');
    if (!bar || !hero || !('IntersectionObserver' in window)) return;

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
        // the transition never gets a start value.
        bar.hidden = false;
        requestAnimationFrame(function () {
          if (shown) bar.classList.add('is-visible');
        });
        // One impression per page load — the bar legitimately comes and
        // goes many times on a page this long.
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
  // 7 — SCROLL LOCK (shared by both dialogs)
  // =======================================================

  // `body { overflow: hidden }` is inert on this site: the shared
  // stylesheet sets `html { overflow-x: clip }`, which blocks body
  // overflow from propagating to the viewport. Lock the root element
  // instead, with scrollbar-gutter compensation so the page doesn't
  // shift when the scrollbar disappears.
  var scrollLock = null;
  var scrollLockDepth = 0;

  function lockScroll() {
    scrollLockDepth++;
    if (scrollLock !== null) return;
    var root = document.documentElement;
    var gutter = window.innerWidth - root.clientWidth;
    scrollLock = { overflow: root.style.overflow, padding: root.style.paddingRight };
    root.style.overflow = 'hidden';
    if (gutter > 0) root.style.paddingRight = gutter + 'px';
  }

  function unlockScroll() {
    if (scrollLock === null) return;
    scrollLockDepth = Math.max(0, scrollLockDepth - 1);
    if (scrollLockDepth > 0) return;
    var root = document.documentElement;
    root.style.overflow = scrollLock.overflow;
    root.style.paddingRight = scrollLock.padding;
    scrollLock = null;
  }

  function focusQuietly(el) {
    if (!el || typeof el.focus !== 'function') return;
    try {
      el.focus({ preventScroll: true });
    } catch (e) {
      el.focus();
    }
  }

  // =======================================================
  // 8 — GUARANTEE TERMS MODAL
  // =======================================================

  (function guaranteeModal() {
    var modal = document.getElementById('guaranteeModal');
    if (!modal) return;

    var opener = null;
    var supportsDialog = typeof modal.showModal === 'function';
    if (!supportsDialog) modal.classList.add('sprint-modal--fallback');

    function open(trigger) {
      opener = trigger || null;
      if (supportsDialog) modal.showModal();
      else modal.setAttribute('open', '');
      modal.classList.add('is-open');
      document.body.classList.add('sprint-modal-open');
      lockScroll();
      if (!supportsDialog) trapFocus(true);
      focusQuietly(modal.querySelector('[data-guarantee-close]'));
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

    // showModal() makes the rest of the document inert for free; the
    // [open]-attribute fallback does not, so keep focus inside by hand.
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
    modal.addEventListener('click', function (e) {
      if (e.target === modal) close();
    });
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
    // A CTA inside the modal leaves for checkout — drop the lock so a
    // back-navigation never lands on a frozen page.
    modal.querySelectorAll('a[data-cta]').forEach(function (link) {
      link.addEventListener('click', close);
    });
  })();

  // =======================================================
  // 9 — SCREENSHOT SLOTS + LIGHTBOX
  // =======================================================

  // [data-shot] figures show the real image when the file exists in
  // media/sprint/ and an honest labelled placeholder while it doesn't —
  // so Jack ships screenshots by uploading files, not editing HTML.
  (function shots() {
    document.querySelectorAll('[data-shot]').forEach(function (fig) {
      var img = fig.querySelector('img');
      if (!img) return;
      function loaded() {
        // A zero-size decode means the file is missing but the server
        // answered with an HTML error page (SPA fallbacks do this).
        if (img.naturalWidth > 0) fig.classList.add('is-loaded');
        else fig.classList.add('is-empty');
      }
      function failed() { fig.classList.add('is-empty'); }
      if (img.complete) {
        if (img.naturalWidth > 0) loaded();
        else failed();
      } else {
        img.addEventListener('load', loaded, { once: true });
        img.addEventListener('error', failed, { once: true });
      }
    });

    // Tap to expand any loaded proof image.
    var box = document.getElementById('sprintLightbox');
    if (!box) return;
    var boxImg = box.querySelector('.sprint-lightbox__img');
    var supportsDialog = typeof box.showModal === 'function';
    if (!supportsDialog) box.classList.add('sprint-lightbox--fallback');
    var opener = null;

    function openBox(img) {
      opener = img;
      boxImg.src = img.currentSrc || img.src;
      boxImg.alt = img.alt || '';
      if (supportsDialog) box.showModal();
      else box.setAttribute('open', '');
      lockScroll();
      focusQuietly(box.querySelector('[data-lightbox-close]'));
      track(PAGE_ID + '_proof_screenshot_expanded', {
        screenshot: (img.getAttribute('src') || '').split('/').pop()
      });
    }
    function closeBox() {
      if (supportsDialog && box.open) box.close();
      else box.removeAttribute('open');
      unlockScroll();
      if (opener) focusQuietly(opener);
      opener = null;
    }

    document.querySelectorAll('img[data-expand]').forEach(function (img) {
      function expandable() {
        var fig = img.closest('.sprint-shot');
        return !fig || fig.classList.contains('is-loaded');
      }
      img.addEventListener('click', function () {
        if (expandable()) openBox(img);
      });
      // Keyboard: a zoomable image is a control, so it needs to be one.
      img.setAttribute('role', 'button');
      img.setAttribute('tabindex', '0');
      img.setAttribute('aria-label', 'Expand screenshot: ' + (img.alt || 'marketplace screenshot'));
      img.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && expandable()) {
          e.preventDefault();
          openBox(img);
        }
      });
    });
    box.querySelectorAll('[data-lightbox-close]').forEach(function (btn) {
      btn.addEventListener('click', closeBox);
    });
    box.addEventListener('click', function (e) {
      if (e.target === box) closeBox();
    });
    box.addEventListener('close', function () { unlockScroll(); });
    if (!supportsDialog) {
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && box.hasAttribute('open')) closeBox();
      });
    }
  })();

  // =======================================================
  // 10 — FAQ INTERACTION TRACKING
  // =======================================================

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
  // 11 — COUNT-UP for the big numbers
  // =======================================================

  // The receipts land harder when they tick up as they enter the
  // viewport. Pure decoration: the real value is already in the DOM, so
  // no-JS, reduced-motion and pre-observer states all read correctly.
  (function countUp() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    var els = Array.prototype.slice.call(document.querySelectorAll('[data-count]'));
    if (!els.length) return;

    function animate(el) {
      var target = parseInt(el.getAttribute('data-count'), 10);
      if (!isFinite(target)) return;
      var prefix = el.getAttribute('data-prefix') || '';
      var duration = 1100;
      var start = null;
      function frame(ts) {
        if (start === null) start = ts;
        var t = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - t, 3);
        el.textContent = prefix + Math.round(target * eased).toLocaleString('en-US');
        if (t < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        animate(entry.target);
      });
    }, { threshold: 0.6 });

    els.forEach(function (el) { io.observe(el); });
  })();

  // =======================================================
  // 12 — SCROLL REVEAL for Sprint-only sections
  // =======================================================

  // The shared reveal wave in script.js enrols a fixed selector list
  // from the main page (which this page's reused components — .nav,
  // .faq__item, .cta__inner, .footer__inner, .pricing__plan — are on).
  // Anything marked data-rv gets the same treatment here, same classes,
  // same timing curve, plus the scroll-sweep backstop so nothing can
  // strand at opacity 0.
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
      if (el.getBoundingClientRect().bottom < 0) return;
      var variant = el.getAttribute('data-rv') || 'up';
      el.classList.add('rv', 'rv--' + variant);
      pending.add(el);
      io.observe(el);
    });

    // Scroll-sweep backstop, mirroring the shared wave: anything the
    // observer misses gets released by a cheap rAF-throttled sweep.
    // Invisible copy on a sales page is a lost sale.
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

    document.documentElement.classList.add('rv-init');
  })();
})();
