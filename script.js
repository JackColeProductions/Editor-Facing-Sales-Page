// Year stamp
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Mobile menu toggle
const nav = document.querySelector('.nav');
const navMenu = document.getElementById('navMenu');
if (nav && navMenu) {
  navMenu.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    navMenu.setAttribute('aria-expanded', String(open));
  });
  nav.querySelectorAll('.nav__links a').forEach(a => {
    a.addEventListener('click', () => {
      nav.classList.remove('is-open');
      navMenu.setAttribute('aria-expanded', 'false');
    });
  });
}

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
  };

  const go = (i) => { active = mod(i, total); render(); };

  prevBtn?.addEventListener('click', () => go(active - 1));
  nextBtn?.addEventListener('click', () => go(active + 1));
  avatars.forEach((av, i) => av.addEventListener('click', () => go(i)));

  stories.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1); }
  });

  // Drag-to-scroll on the carousel area — works on both touch
  // (phones) and mouse drag (desktop). Threshold of ~50px so
  // small jitters don't trigger a swap.
  const carousel = stories.querySelector('.stories__carousel') || stories;
  const DRAG_THRESHOLD = 50;
  let pointerStartX = null;
  let pointerActiveId = null;

  const onPointerDown = (e) => {
    // Don't capture clicks targeting the nav buttons or avatars.
    if (e.target.closest('.stories__nav-btn, .stories__avatar')) return;
    pointerStartX = e.clientX ?? e.touches?.[0]?.clientX ?? null;
    pointerActiveId = e.pointerId;
    carousel.style.cursor = 'grabbing';
  };
  const onPointerMove = (e) => {
    if (pointerStartX == null) return;
    // Prevent text-selection drag artefacts during a swipe.
    if (e.cancelable) e.preventDefault?.();
  };
  const onPointerUp = (e) => {
    if (pointerStartX == null) return;
    const endX = e.clientX ?? e.changedTouches?.[0]?.clientX ?? pointerStartX;
    const dx = endX - pointerStartX;
    pointerStartX = null;
    pointerActiveId = null;
    carousel.style.cursor = '';
    if (Math.abs(dx) >= DRAG_THRESHOLD) {
      // Swipe LEFT (negative dx) -> show next card; swipe RIGHT -> prev.
      if (dx < 0) go(active + 1);
      else        go(active - 1);
    }
  };

  if (window.PointerEvent) {
    carousel.addEventListener('pointerdown', onPointerDown);
    carousel.addEventListener('pointermove', onPointerMove);
    carousel.addEventListener('pointerup', onPointerUp);
    carousel.addEventListener('pointercancel', onPointerUp);
  } else {
    // Fallback for older Safari iOS / desktop without PointerEvent.
    carousel.addEventListener('touchstart', onPointerDown, { passive: true });
    carousel.addEventListener('touchmove',  onPointerMove, { passive: true });
    carousel.addEventListener('touchend',   onPointerUp);
    carousel.addEventListener('mousedown',  onPointerDown);
    carousel.addEventListener('mousemove',  onPointerMove);
    carousel.addEventListener('mouseup',    onPointerUp);
    carousel.addEventListener('mouseleave', onPointerUp);
  }
  carousel.style.cursor = 'grab';
  carousel.style.touchAction = 'pan-y';
  /* Disable native text selection during drag so the cursor stays
     a grab indicator. */
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

    const playOthers = () => videos.forEach(v => {
      if (v !== video) { v.pause(); v.muted = true; }
    });

    card.addEventListener('click', () => {
      if (video.paused) {
        playOthers();
        video.muted = false;
        video.play().catch(() => { video.muted = true; video.play(); });
      } else {
        video.pause();
      }
    });

    video.addEventListener('play',  () => card.classList.add('is-playing'));
    video.addEventListener('pause', () => card.classList.remove('is-playing'));
    video.addEventListener('ended', () => card.classList.remove('is-playing'));

    // Force the first painted frame + populate duration pill on metadata load.
    video.addEventListener('loadedmetadata', () => {
      try { video.currentTime = 0.1; } catch (_) {}
      if (durEl) durEl.textContent = fmtTime(video.duration);
    }, { once: true });
  });

  // Carousel arrows — scroll by one card width + gap.
  const cardStep = () => {
    if (!cards[0]) return 0;
    const cardWidth = cards[0].getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 16;
    return cardWidth + gap;
  };
  prevBtn?.addEventListener('click', () => track.scrollBy({ left: -cardStep(), behavior: 'smooth' }));
  nextBtn?.addEventListener('click', () => track.scrollBy({ left:  cardStep(), behavior: 'smooth' }));

  // Dot click → snap to that card.
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      const card = cards[i];
      if (!card) return;
      const offset = card.offsetLeft - track.offsetLeft;
      track.scrollTo({ left: offset, behavior: 'smooth' });
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
    cancelMomentum();
    dragStartX = e.clientX;
    lastX = e.clientX;
    lastTime = performance.now();
    velocity = 0;
    dragStartScroll = track.scrollLeft;
    dragMoved = false;
    dragPointerId = e.pointerId;
    try { track.setPointerCapture?.(e.pointerId); } catch (_) {}
    track.style.cursor = 'grabbing';
    track.style.scrollSnapType = 'none';
    track.style.scrollBehavior = 'auto';
    track.style.willChange = 'scroll-position';
  };
  const onTrackMove = (e) => {
    if (dragStartX == null) return;
    const dx = e.clientX - dragStartX;
    if (Math.abs(dx) > 4) dragMoved = true;
    scheduleScroll(dragStartScroll - dx);
    const now = performance.now();
    const dt = now - lastTime;
    if (dt > 0) {
      // Low-pass filter the velocity so a single noisy sample
      // doesn't fling the rail.
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

  // Keep the active dot in sync with scroll position.
  const updateDots = () => {
    if (!cards.length || !dots.length) return;
    const step = cardStep() || 1;
    const idx = Math.min(dots.length - 1, Math.max(0, Math.round(track.scrollLeft / step)));
    dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
  };
  track.addEventListener('scroll', updateDots, { passive: true });
  window.addEventListener('resize', updateDots);
  updateDots();
}
