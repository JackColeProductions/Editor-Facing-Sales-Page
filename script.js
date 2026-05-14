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
  let active = Math.floor(total / 2);

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
