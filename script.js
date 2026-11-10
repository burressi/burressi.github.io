/* =========================================
   PROGRAMMER: Ian Burress
   DATE CREATED: 5/20/2025
    LAST UPDATED: 11/10/2026
    PURPOSE: Engineering Portfolio of Ian Burress
    CONTACT INFO: ian.n.burress@gmail.com
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {

  // 1. Image carousels (Projects page and case studies)
  document.querySelectorAll('.project-carousel-wrapper, .carousel').forEach(carousel => {
    const slides = carousel.querySelectorAll('.carouselImage');
    const prevBtn = carousel.querySelector('.prev');
    const nextBtn = carousel.querySelector('.next');
    if (!slides.length) return;

    let current = Array.from(slides).findIndex(s => s.classList.contains('active'));
    if (current < 0) current = 0;

    const show = index => {
      slides.forEach((slide, i) => slide.classList.toggle('active', i === index));
    };

    // Hide arrows when there is only one image
    if (slides.length < 2) {
      [prevBtn, nextBtn].forEach(btn => btn && (btn.hidden = true));
    }

    prevBtn && prevBtn.addEventListener('click', e => {
      e.preventDefault();
      current = (current - 1 + slides.length) % slides.length;
      show(current);
    });

    nextBtn && nextBtn.addEventListener('click', e => {
      e.preventDefault();
      current = (current + 1) % slides.length;
      show(current);
    });

    show(current);
  });

  // 2. Generic category filter
  //    buttonSelector: filter buttons with data-filter="..."
  //    cardSelector:   cards with data-categories="a b" (space separated) or data-category="a"
  const setupFilter = (buttonSelector, cardSelector, activeClass) => {
    const buttons = document.querySelectorAll(buttonSelector);
    const cards = document.querySelectorAll(cardSelector);
    if (!buttons.length || !cards.length) return;

    buttons.forEach(button => {
      button.setAttribute('aria-pressed', button.classList.contains(activeClass) ? 'true' : 'false');

      button.addEventListener('click', () => {
        buttons.forEach(b => {
          b.classList.remove(activeClass);
          b.setAttribute('aria-pressed', 'false');
        });
        button.classList.add(activeClass);
        button.setAttribute('aria-pressed', 'true');

        const filter = button.dataset.filter;
        cards.forEach(card => {
          const categories = (card.dataset.categories || card.dataset.category || '')
            .split(/\s+/)
            .filter(Boolean);
          const show = filter === 'all' || categories.includes(filter);
          card.hidden = !show;
        });
      });
    });
  };

  setupFilter('.filter-btn', '.project-display-card', 'active');          // Projects page
  setupFilter('.filter-safe-btn', '.award-safe-card', 'active-safe');     // Accolades page

  // 3. Resume download hook (ready for analytics later)
  document.querySelectorAll('a[href$="Resume.pdf"]').forEach(link => {
    link.addEventListener('click', () => console.log('Resume downloaded'));
  });
});
