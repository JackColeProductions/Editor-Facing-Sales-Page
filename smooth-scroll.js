// Lenis smooth scroll — premium inertial scrolling.
// Skipped entirely when the user prefers reduced motion, or when the
// Lenis CDN failed to load (script tag missing / blocked).
(function () {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;
  if (typeof Lenis === 'undefined') return;

  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    smoothTouch: false,
    wheelMultiplier: 1,
    touchMultiplier: 2,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // Route anchor-link clicks through Lenis so jump-to-section animates.
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#' || targetId === '#!') return;
      const target = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, {
        offset: -80,
        duration: 1.5,
      });
    });
  });

  window.lenis = lenis;
})();
