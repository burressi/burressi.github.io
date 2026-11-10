/* =========================================
   PROGRAMMER: Ian Burress
   DATE CREATED: 5/20/2025
    LAST UPDATED: 11/10/2026
    PURPOSE: Engineering Portfolio of Ian Burress
    CONTACT INFO: ian.n.burress@gmail.com
   ========================================= */
/*1) portfolio scripts (plain JavaScript)
   1. Image carousels on project cards
   2. Category filter on the Projects page */

document.addEventListener('DOMContentLoaded', () => {

  // 1. Carousels: each .carousel holds .carousel-slide items and prev/next buttons
  document.querySelectorAll('.carousel').forEach(carousel => {
    const slides = carousel.querySelectorAll('.carousel-slide');
    const prev = carousel.querySelector('.carousel-btn.prev');
    const next = carousel.querySelector('.carousel-btn.next');
    const count = carousel.querySelector('.carousel-count');
    let current = 0;

    if (slides.length < 2) {
      [prev, next, count].forEach(el => el && el.remove());
      return;
    }

    const show = index => {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, i) => slide.classList.toggle('is-active', i === current));
      if (count) count.textContent = `${current + 1} / ${slides.length}`;
    };

    prev.addEventListener('click', () => show(current - 1));
    next.addEventListener('click', () => show(current + 1));
    show(0);
  });

  // 2. Filters: buttons in .filter-bar[data-target] show/hide matching cards
  document.querySelectorAll('.filter-bar').forEach(bar => {
    const buttons = bar.querySelectorAll('.filter');
    const cards = document.querySelectorAll(bar.dataset.target);

    buttons.forEach(button => {
      button.addEventListener('click', () => {
        buttons.forEach(b => {
          b.classList.toggle('is-active', b === button);
          b.setAttribute('aria-pressed', b === button ? 'true' : 'false');
        });

        const filter = button.dataset.filter;
        cards.forEach(card => {
          const categories = (card.dataset.categories || '').split(' ');
          card.hidden = !(filter === 'all' || categories.includes(filter));
        });
      });
    });
  });
});
