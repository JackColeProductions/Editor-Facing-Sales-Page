// =========================================================
// /tipra landing page — page-specific JS.
// Loads alongside the shared script.js (which already wires the
// reused components: .nav menu, .faq accordion, .stories + .proof
// carousels, and the #year stamp — all by class name).
// =========================================================

// --- Single source of truth for every CTA on the page -----------------
// Default: the existing VP+ checkout. TODO: swap for Tipra's affiliate link.
const TIPRA_CTA_URL = 'https://checkout.videoproduction.plus/premium-intro';
document.querySelectorAll('a[data-cta]').forEach((el) => {
  el.setAttribute('href', TIPRA_CTA_URL);
});

// --- Lazy VSL player --------------------------------------------------
// Nothing loads until the visitor presses play. Prefers an embed URL
// (data-embed: YouTube / Vimeo / Wistia) and falls back to a native
// <video> (data-video). Both are injected on demand.
document.querySelectorAll('[data-vsl]').forEach((vsl) => {
  const frame = vsl.querySelector('.tipra-vsl__frame');
  const play = vsl.querySelector('.tipra-vsl__play');
  if (!frame || !play) return;

  const launch = () => {
    const embed = (vsl.getAttribute('data-embed') || '').trim();
    const video = (vsl.getAttribute('data-video') || '').trim();
    let media;

    if (embed) {
      media = document.createElement('iframe');
      media.src = embed + (embed.includes('?') ? '&' : '?') + 'autoplay=1';
      media.title = 'Tipra — watch the video';
      media.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
      media.setAttribute('allowfullscreen', '');
    } else if (video) {
      media = document.createElement('video');
      media.src = video;
      media.controls = true;
      media.autoplay = true;
      media.playsInline = true;
      media.setAttribute('playsinline', '');
    } else {
      return; // no source wired yet (TODO: VSL embed)
    }

    media.className = 'tipra-vsl__media';
    frame.appendChild(media);
    vsl.classList.add('is-playing');
    if (media.tagName === 'VIDEO') {
      media.play().catch(() => { /* user can hit the native control */ });
    }
  };

  play.addEventListener('click', launch);
});
