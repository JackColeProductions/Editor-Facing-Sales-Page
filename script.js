// Year stamp
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Mobile menu toggle
const nav = document.querySelector('.nav');
const navMenu = document.getElementById('navMenu');
if (nav && navMenu) {
  const closeMenu = () => {
    nav.classList.remove('is-open');
    navMenu.setAttribute('aria-expanded', 'false');
  };
  navMenu.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    navMenu.setAttribute('aria-expanded', String(open));
  });
  // The links live in .nav__pill (a previous selector targeted a
  // .nav__links element that doesn't exist, so the panel stayed
  // open over the page after tapping a link).
  nav.querySelectorAll('.nav__pill a').forEach(a => {
    a.addEventListener('click', closeMenu);
  });
  // pointerdown, not click: iOS Safari doesn't synthesize click
  // events for taps on non-interactive elements, so an outside tap
  // on plain page content would never close the panel.
  document.addEventListener('pointerdown', (e) => {
    if (nav.classList.contains('is-open') && !nav.contains(e.target)) closeMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
  // The nav is absolute, so an open panel scrolls away with the
  // page while staying "open" — close it as soon as scrolling starts.
  window.addEventListener('scroll', () => {
    if (nav.classList.contains('is-open')) closeMenu();
  }, { passive: true });
}

// Respect reduced-motion in JS-initiated scrolling too (the CSS
// side is handled by the global reduced-motion block).
const scrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

// Close other FAQ items when one opens (accordion behavior)
const faqItems = document.querySelectorAll('.faq__item');
faqItems.forEach(item => {
  item.addEventListener('toggle', () => {
    if (item.open) {
      faqItems.forEach(other => { if (other !== item) other.open = false; });
    }
  });
});

// Success-stories testimonial carousel
const stories = document.querySelector('.stories');
if (stories) {
  const cards = Array.from(stories.querySelectorAll('.stories__card'));
  const avatars = Array.from(stories.querySelectorAll('.stories__avatar'));
  const prevBtn = stories.querySelector('[data-action="prev"]');
  const nextBtn = stories.querySelector('[data-action="next"]');
  const total = cards.length;
  const mod = (n, m) => ((n % m) + m) % m;
  // Use the card flagged with [data-default] as the starting active
  // card; fall back to the middle if none is flagged.
  let active = cards.findIndex((c) => c.hasAttribute('data-default'));
  if (active < 0) active = Math.floor(total / 2);

  const setCardPos = (el, offset) => {
    let pos = 'far';
    if (offset === 0) pos = 'active';
    else if (offset === -1) pos = 'prev';
    else if (offset === 1) pos = 'next';
    el.dataset.pos = pos;
  };

  const setAvatarPos = (el, offset) => {
    const abs = Math.abs(offset);
    let pos = 'far';
    if (abs === 0) pos = 'active';
    else if (abs === 1) pos = 'near';
    else if (abs === 2) pos = 'mid';
    el.dataset.pos = pos;
  };

  // Shortest signed offset around the ring so wrap-around stays adjacent.
  const ringOffset = (i) => {
    let d = i - active;
    if (d > total / 2) d -= total;
    if (d < -total / 2) d += total;
    return d;
  };

  const render = () => {
    cards.forEach((card, i) => setCardPos(card, ringOffset(i)));
    avatars.forEach((av, i) => {
      const d = ringOffset(i);
      setAvatarPos(av, d);
      av.setAttribute('aria-selected', d === 0 ? 'true' : 'false');
    });
    syncCarouselHeight();
  };

  // On phones the carousel container is height:auto with absolutely
  // positioned cards, so it can't grow with its content. Track the
  // active card's real height to kill the dead band under short
  // quotes without clipping long ones.
  const carouselEl = stories.querySelector('.stories__carousel');
  const mobileCarousel = window.matchMedia('(max-width: 640px)');
  const syncCarouselHeight = () => {
    if (!carouselEl) return;
    if (!mobileCarousel.matches) { carouselEl.style.height = ''; return; }
    const activeCard = cards[active];
    if (activeCard) carouselEl.style.height = activeCard.offsetHeight + 'px';
  };
  window.addEventListener('resize', syncCarouselHeight);
  // Re-measure once assets/fonts have settled — text metrics shift
  // when the webfont swaps in.
  window.addEventListener('load', syncCarouselHeight);

  const go = (i) => { active = mod(i, total); render(); };

  prevBtn?.addEventListener('click', () => go(active - 1));
  nextBtn?.addEventListener('click', () => go(active + 1));
  avatars.forEach((av, i) => av.addEventListener('click', () => go(i)));

  stories.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1); }
  });

  // Drag-to-scroll. Cards track the pointer in real time via a
  // --drag CSS var (active/prev/next translates pick it up), and
  // .is-dragging kills the card transition during the drag so the
  // rail follows the finger 1:1. On release, the class comes off
  // and either snaps forward/back (>40px) or springs home.
  const carousel = stories.querySelector('.stories__carousel') || stories;
  const DRAG_THRESHOLD = 40;
  let pointerStartX = null;
  let pointerLastDx = 0;
  let pointerActiveId = null;
  let dragRaf = null;
  let pendingDrag = null;

  const flushDrag = () => {
    dragRaf = null;
    if (pendingDrag == null) return;
    carousel.style.setProperty('--drag', pendingDrag + 'px');
    pendingDrag = null;
  };
  const scheduleDrag = (val) => {
    pendingDrag = val;
    if (!dragRaf) dragRaf = requestAnimationFrame(flushDrag);
  };

  const onPointerDown = (e) => {
    if (e.target.closest('.stories__nav-btn, .stories__avatar')) return;
    pointerStartX = e.clientX ?? e.touches?.[0]?.clientX ?? null;
    if (pointerStartX == null) return;
    pointerLastDx = 0;
    pointerActiveId = e.pointerId;
    try { carousel.setPointerCapture?.(e.pointerId); } catch (_) {}
    carousel.classList.add('is-dragging');
    carousel.style.cursor = 'grabbing';
  };
  const onPointerMove = (e) => {
    if (pointerStartX == null) return;
    const x = e.clientX ?? e.touches?.[0]?.clientX;
    if (x == null) return;
    let dx = x - pointerStartX;
    // Soft resistance past ~180px so a long drag doesn't fling cards
    // off into space before the snap kicks in.
    const cap = 180;
    if (Math.abs(dx) > cap) {
      const over = Math.abs(dx) - cap;
      dx = Math.sign(dx) * (cap + over * 0.35);
    }
    pointerLastDx = dx;
    scheduleDrag(dx);
    if (e.cancelable) e.preventDefault?.();
  };
  const onPointerUp = () => {
    if (pointerStartX == null) return;
    try { carousel.releasePointerCapture?.(pointerActiveId); } catch (_) {}
    const dx = pointerLastDx;
    pointerStartX = null;
    pointerActiveId = null;
    pointerLastDx = 0;
    carousel.style.cursor = '';
    carousel.classList.remove('is-dragging');
    // Re-render first so the new active card snaps in, then clear
    // the offset on the next frame so the transition glides home.
    if (Math.abs(dx) >= DRAG_THRESHOLD) {
      if (dx < 0) go(active + 1);
      else        go(active - 1);
    }
    requestAnimationFrame(() => {
      carousel.style.setProperty('--drag', '0px');
    });
  };

  if (window.PointerEvent) {
    carousel.addEventListener('pointerdown', onPointerDown);
    carousel.addEventListener('pointermove', onPointerMove);
    carousel.addEventListener('pointerup', onPointerUp);
    carousel.addEventListener('pointercancel', onPointerUp);
  } else {
    carousel.addEventListener('touchstart', onPointerDown, { passive: true });
    carousel.addEventListener('touchmove',  onPointerMove, { passive: false });
    carousel.addEventListener('touchend',   onPointerUp);
    carousel.addEventListener('mousedown',  onPointerDown);
    carousel.addEventListener('mousemove',  onPointerMove);
    carousel.addEventListener('mouseup',    onPointerUp);
    carousel.addEventListener('mouseleave', onPointerUp);
  }
  carousel.style.cursor = 'grab';
  carousel.style.touchAction = 'pan-y';
  carousel.style.userSelect = 'none';

  render();
}

// Video testimonial carousel — horizontal scroll with snap, click to play.
const proof = document.querySelector('.proof');
if (proof) {
  const track = proof.querySelector('.proof__track');
  const cards = Array.from(proof.querySelectorAll('.proof__card'));
  const videos = Array.from(proof.querySelectorAll('.proof__video'));
  const prevBtn = proof.querySelector('[data-action="prev"]');
  const nextBtn = proof.querySelector('[data-action="next"]');
  const dots = Array.from(proof.querySelectorAll('.proof__dot'));

  const fmtTime = (s) => {
    if (!s || !isFinite(s)) return '';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  // Click a card → toggle that video; pause and re-mute the others.
  cards.forEach((card) => {
    const video = card.querySelector('.proof__video');
    if (!video) return;

    // Inject duration pill + PLAYING badge into the video wrap so the markup
    // stays simple but every card gets the upgraded chrome.
    const wrap = card.querySelector('.proof__video-wrap');
    if (wrap && !wrap.querySelector('.proof__duration')) {
      const live = document.createElement('span');
      live.className = 'proof__live';
      live.setAttribute('aria-hidden', 'true');
      live.textContent = 'PLAYING';
      wrap.appendChild(live);

      const dur = document.createElement('span');
      dur.className = 'proof__duration';
      dur.setAttribute('aria-hidden', 'true');
      dur.textContent = '';
      wrap.appendChild(dur);
    }
    const durEl = card.querySelector('.proof__duration');

    const playOthers = () => {
      videos.forEach(v => {
        if (v !== video) { v.pause(); v.muted = true; }
      });
      // The founder VSL has its own controls but shares the page's
      // audio space — don't let it talk over a testimonial.
      const vsl = document.querySelector('.vsl__video');
      if (vsl && !vsl.paused) vsl.pause();
    };

    card.addEventListener('click', () => {
      if (video.paused) {
        playOthers();
        video.muted = false;
        video.play().catch(() => {
          video.muted = true;
          video.play().catch(() => {});
        });
      } else {
        video.pause();
      }
    });

    video.addEventListener('play',  () => card.classList.add('is-playing'));
    video.addEventListener('pause', () => card.classList.remove('is-playing'));
    video.addEventListener('ended', () => card.classList.remove('is-playing'));

    // Populate the duration pill whenever metadata becomes available.
    // (Posters cover the first frame now, so no currentTime poke —
    // that used to force a media-data range fetch per video.)
    const fillDuration = () => { if (durEl) durEl.textContent = fmtTime(video.duration); };
    if (video.readyState >= 1) fillDuration();
    else video.addEventListener('loadedmetadata', fillDuration, { once: true });
  });

  // Carousel arrows — scroll by one card width + gap.
  const cardStep = () => {
    if (!cards[0]) return 0;
    const cardWidth = cards[0].getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 16;
    return cardWidth + gap;
  };
  prevBtn?.addEventListener('click', () => track.scrollBy({ left: -cardStep(), behavior: scrollBehavior }));
  nextBtn?.addEventListener('click', () => track.scrollBy({ left:  cardStep(), behavior: scrollBehavior }));

  // Dot click → snap to that card.
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      const card = cards[i];
      if (!card) return;
      const offset = card.offsetLeft - track.offsetLeft;
      track.scrollTo({ left: offset, behavior: scrollBehavior });
    });
  });

  // Click-and-drag scroll on the track. Pointermove updates are
  // batched into a single requestAnimationFrame write so the rail
  // doesn't tear when the mouse fires faster than the display. On
  // release we kick off a velocity-based inertia glide and only let
  // scroll-snap re-engage once the glide settles — that's what
  // makes the swipe feel smooth instead of stuttery + snappy.
  let dragStartX = null;
  let dragStartScroll = 0;
  let dragMoved = false;
  let dragPointerId = null;
  let lastX = 0;
  let lastTime = 0;
  let velocity = 0; // px / ms, positive = pointer moving right
  let pendingScroll = null;
  let scrollRaf = null;
  let momentumRaf = null;

  const flushScroll = () => {
    scrollRaf = null;
    if (pendingScroll == null) return;
    track.scrollLeft = pendingScroll;
    pendingScroll = null;
  };
  const scheduleScroll = (val) => {
    pendingScroll = val;
    if (!scrollRaf) scrollRaf = requestAnimationFrame(flushScroll);
  };
  const cancelMomentum = () => {
    if (momentumRaf) { cancelAnimationFrame(momentumRaf); momentumRaf = null; }
  };

  const onTrackDown = (e) => {
    if (e.target.closest('.proof__nav-btn, .proof__dot')) return;
    // Touch gets native scrolling + scroll-snap (smoother, and the
    // custom scrollLeft writes would fight the browser's gesture);
    // this drag layer is for mouse users only.
    if (e.pointerType && e.pointerType !== 'mouse') return;
    cancelMomentum();
    dragStartX = e.clientX;
    lastX = e.clientX;
    lastTime = performance.now();
    velocity = 0;
    dragStartScroll = track.scrollLeft;
    dragMoved = false;
    dragPointerId = e.pointerId;
    // NOTE: do NOT setPointerCapture here. Capturing on pointerdown
    // reroutes pointerup to the track, which breaks the synthesised
    // click on the card and stops play-on-click. We capture lazily
    // inside onTrackMove once a real drag is detected.
  };
  const onTrackMove = (e) => {
    if (dragStartX == null) return;
    const dx = e.clientX - dragStartX;
    if (!dragMoved && Math.abs(dx) > 6) {
      dragMoved = true;
      try { track.setPointerCapture?.(dragPointerId); } catch (_) {}
      track.style.cursor = 'grabbing';
      track.style.scrollSnapType = 'none';
      track.style.scrollBehavior = 'auto';
      track.style.willChange = 'scroll-position';
    }
    if (!dragMoved) return;
    scheduleScroll(dragStartScroll - dx);
    const now = performance.now();
    const dt = now - lastTime;
    if (dt > 0) {
      velocity = velocity * 0.6 + ((e.clientX - lastX) / dt) * 0.4;
    }
    lastX = e.clientX;
    lastTime = now;
    if (e.cancelable) e.preventDefault?.();
  };
  const endDrag = (id) => {
    if (dragStartX == null) return;
    try { track.releasePointerCapture?.(id ?? dragPointerId); } catch (_) {}
    const wasDragged = dragMoved;
    const flingV = velocity;
    dragStartX = null;
    dragPointerId = null;
    track.style.cursor = '';

    const restoreSnap = () => {
      track.style.scrollSnapType = '';
      track.style.scrollBehavior = '';
      track.style.willChange = '';
    };

    if (wasDragged) {
      const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      track.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => track.removeEventListener('click', swallow, { capture: true }), 0);

      // Inertia: convert px/ms into px/frame at ~60fps, then decay.
      let v = -flingV * 16;
      const friction = 0.93;
      if (Math.abs(v) < 0.4) { restoreSnap(); return; }
      const step = () => {
        track.scrollLeft += v;
        v *= friction;
        // Stop once we're below sub-pixel motion or hit an edge.
        const atStart = track.scrollLeft <= 0 && v < 0;
        const atEnd   = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1 && v > 0;
        if (Math.abs(v) < 0.4 || atStart || atEnd) {
          momentumRaf = null;
          restoreSnap();
          return;
        }
        momentumRaf = requestAnimationFrame(step);
      };
      momentumRaf = requestAnimationFrame(step);
    } else {
      restoreSnap();
    }
  };
  const onTrackUp = (e) => endDrag(e.pointerId);

  if (window.PointerEvent) {
    track.addEventListener('pointerdown', onTrackDown);
    track.addEventListener('pointermove', onTrackMove);
    track.addEventListener('pointerup', onTrackUp);
    track.addEventListener('pointercancel', onTrackUp);
  } else {
    track.addEventListener('mousedown',  onTrackDown);
    track.addEventListener('mousemove',  onTrackMove);
    track.addEventListener('mouseup',    onTrackUp);
    track.addEventListener('mouseleave', onTrackUp);
  }
  track.style.cursor = 'grab';
  track.style.userSelect = 'none';

  // Keep the active dot in sync with scroll position. rAF-batched:
  // cardStep() forces a layout read, so once per frame at most.
  let dotsRaf = null;
  const updateDots = () => {
    if (dotsRaf) return;
    dotsRaf = requestAnimationFrame(() => {
      dotsRaf = null;
      if (!cards.length || !dots.length) return;
      const step = cardStep() || 1;
      const idx = Math.min(dots.length - 1, Math.max(0, Math.round(track.scrollLeft / step)));
      dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
    });
  };
  track.addEventListener('scroll', updateDots, { passive: true });
  window.addEventListener('resize', updateDots);
  updateDots();

  // Pause a playing video once its card scrolls out of view, so
  // audio doesn't keep running under the rest of the page.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) {
          const v = target.querySelector('video');
          if (v && !v.paused) { v.pause(); if (v.classList.contains('proof__video')) v.muted = true; }
        }
      });
    }, { threshold: 0.35 });
    cards.forEach(c => io.observe(c));
    const vslFrame = document.querySelector('.vsl');
    if (vslFrame) io.observe(vslFrame);
  }
}

// Visitor portal — Editor / Client gate. Clients are a plain link to the
// hiring site; editors dismiss the gate here and the choice is remembered
// for the rest of the browsing session (the head snippet skips the gate
// before first paint on revisit).
const portal = document.getElementById('portal');
if (portal) {
  if (document.documentElement.classList.contains('portal-done')) {
    portal.remove();
  } else {
    const editorBtn = document.getElementById('portalEditor');
    if (editorBtn) editorBtn.addEventListener('click', () => {
      try { sessionStorage.setItem('vppVisitorType', 'editor'); } catch (e) {}
      portal.classList.add('portal--closing');
      // Matches the .4s opacity transition; also covers reduced-motion,
      // where the transition is disabled and transitionend never fires.
      setTimeout(() => {
        document.documentElement.classList.add('portal-done');
        portal.remove();
      }, 450);
    });
  }
}

// Scroll-reveal wave — each section's elements rise/fade in as they enter
// the viewport. Config-driven (no markup changes): containers are enrolled
// here, hidden only after init (html.rv-init), revealed with a per-batch
// stagger, then released (classes removed) so native transitions and hover
// states come back untouched.
//
// An IntersectionObserver does the precise triggering, but it can miss
// elements that cross the whole viewport between two rendering frames on a
// fast flick — so a rAF-throttled scroll sweep over the still-pending set
// is the correctness backstop: in-view -> reveal, already passed -> release.
(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  // What animates, and how. Containers over children: elements with their
  // own perpetual animations (job-card fan, profile-pic fan, marquee
  // tracks, carousel slides) are only ever revealed via their wrapper.
  const GROUPS = [
    // Hero — plays as the visitor portal lifts
    { sel: '.nav', v: 'fade' },
    { sel: '.hero .trusted-pill', v: 'up' },
    { sel: '.hero__title', v: 'up' },
    { sel: '.hero__lede', v: 'up' },
    { sel: '.hero__cta', v: 'up' },
    { sel: '.hero__cards', v: 'scale' },
    // Stats band
    { sel: '.stat', v: 'up' },
    // Partnership + formats (ads page only — selectors miss elsewhere)
    { sel: '.partners .section__head', v: 'up' },
    { sel: '.partners__card', v: 'up' },
    { sel: '.partners__x', v: 'fade' },
    { sel: '.partners__claim', v: 'up' },
    { sel: '.formats .section__head', v: 'up' },
    { sel: '.formats__card', v: 'up' },
    // Marketplace showcase
    { sel: '.showcase .section__head', v: 'up' },
    { sel: '.showcase__frame', v: 'scale' },
    { sel: '.showcase__claim', v: 'up' },
    { sel: '.showcase__cta', v: 'up' },
    // Success stories
    { sel: '.stories .section__head', v: 'up' },
    { sel: '.stories__avatar', v: 'up' },
    { sel: '.stories__carousel', v: 'up' },
    { sel: '.stories__nav', v: 'fade' },
    { sel: '.stories__cta', v: 'up' },
    // Pricing
    { sel: '.pricing .section__head', v: 'up' },
    { sel: '.pricing__plan', v: 'up' },
    // Profile setup
    { sel: '.profile-setup__pill', v: 'up' },
    { sel: '.profile-setup__title', v: 'up' },
    { sel: '.profile-setup__lede', v: 'up' },
    { sel: '.profile-setup__cta', v: 'up' },
    { sel: '.profile-setup__cards', v: 'up' },
    // Video wins
    { sel: '.proof .section__head', v: 'up' },
    { sel: '.proof__card', v: 'up' },
    // Platform comparison
    { sel: '.platform .section__head', v: 'up' },
    { sel: '.vs__card', v: 'up' },
    { sel: '.vs__faded', v: 'up' },
    // Testimonials marquee
    { sel: '.testimonials__head', v: 'up' },
    { sel: '.testimonials__row', v: 'fade' },
    // VSL
    { sel: '.vsl-section .section__head', v: 'up' },
    { sel: '.vsl', v: 'scale' },
    { sel: '.vsl__cta', v: 'up' },
    // FAQ
    { sel: '.faq .section__head', v: 'up' },
    { sel: '.faq__social-proof', v: 'up' },
    { sel: '.faq__item', v: 'up' },
    { sel: '.faq__visual', v: 'up' },
    // Final CTA + footer
    { sel: '.cta__inner', v: 'scale' },
    { sel: '.footer__inner', v: 'fade' },
  ];

  const targets = [];
  GROUPS.forEach(({ sel, v }) => {
    document.querySelectorAll(sel).forEach((el) => {
      if (el.closest('.portal')) return;
      targets.push({ el, v });
    });
  });
  if (!targets.length) return;

  const pending = new Set();
  let io = null;
  let sweepQueued = false;

  const release = (el) => {
    el.classList.remove('rv', 'rv--up', 'rv--fade', 'rv--scale', 'rv-in');
    el.style.removeProperty('transition-delay');
  };

  const finish = () => {
    if (pending.size) return;
    if (io) io.disconnect();
    window.removeEventListener('scroll', onScroll);
  };

  // Animated entrance, staggered within whatever batch arrived together.
  const reveal = (el, batchIndex) => {
    if (!pending.has(el)) return;
    pending.delete(el);
    if (io) io.unobserve(el);
    const delay = Math.min(batchIndex * 80, 480);
    el.style.transitionDelay = delay + 'ms';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.classList.add('rv-in');
    }));
    setTimeout(() => release(el), delay + 800);
    finish();
  };

  // Instant appearance for elements the user already flicked past —
  // animating something that is above the viewport helps nobody.
  const dismiss = (el) => {
    if (!pending.has(el)) return;
    pending.delete(el);
    if (io) io.unobserve(el);
    release(el);
    finish();
  };

  const sweep = () => {
    sweepQueued = false;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    let batch = 0;
    pending.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom <= 0) {
        dismiss(el);
      } else if (r.top < vh * 0.93 && r.left < vw && r.right > 0) {
        reveal(el, batch++);
      }
    });
  };

  const onScroll = () => {
    if (sweepQueued) return;
    sweepQueued = true;
    requestAnimationFrame(sweep);
  };

  const start = () => {
    io = new IntersectionObserver((entries) => {
      let batch = 0;
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          reveal(entry.target, batch++);
        } else if (entry.boundingClientRect.bottom <= 0) {
          dismiss(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });

    targets.forEach(({ el, v }) => {
      // Anything already scrolled past at init (restored scroll position)
      // must simply stay visible.
      if (el.getBoundingClientRect().bottom < 0) return;
      el.classList.add('rv', 'rv--' + v);
      pending.add(el);
      io.observe(el);
    });
    document.documentElement.classList.add('rv-init');
    window.addEventListener('scroll', onScroll, { passive: true });
  };

  // First visit: hold the wave until the visitor portal lifts, so the hero
  // reveals as the gate fades instead of finishing unseen behind it.
  const portalGate = document.getElementById('portal');
  if (portalGate && !document.documentElement.classList.contains('portal-done')) {
    let started = false;
    const startOnce = () => { if (!started) { started = true; setTimeout(start, 150); } };
    const editorChoice = document.getElementById('portalEditor');
    if (editorChoice) editorChoice.addEventListener('click', startOnce);
    window.addEventListener('scroll', startOnce, { once: true, passive: true });
  } else {
    start();
  }
})();
