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
