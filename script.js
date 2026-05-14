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
