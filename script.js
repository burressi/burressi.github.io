/* =========================================
   PROGRAMMER: Ian Burress
   PURPOSE: Interactive Logic for Engineering Portfolio
   ========================================= */

$(document).ready(function() {
  
  // 1. Social Icon Hover Effects
  $('.sidebarIcon').hover(function() {
    $(this).css('opacity', '0.6');
  }, function() {
    $(this).css('opacity', '1');
  });

  // 2. Initialize Dynamic Project Carousels
  // Maps natively to the .carousel wrapper in your updated homepage layout
  document.querySelectorAll('.carousel').forEach(carousel => {
    const images = carousel.querySelectorAll('.carouselImage');
    const prevBtn = carousel.querySelector('.prev');
    const nextBtn = carousel.querySelector('.next');
    let current = 0;

    // Safety check: if buttons or images don't exist in a block, skip it
    if (!images.length || !prevBtn || !nextBtn) return;

    const showImage = index => {
      images.forEach((img, i) => {
        img.classList.toggle('active', i === index);
      });
    };

    // Left navigation control
    prevBtn.addEventListener('click', (e) => {
      e.preventDefault();
      current = (current - 1 + images.length) % images.length;
      showImage(current);
    });

    // Right navigation control
    nextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      current = (current + 1) % images.length;
      showImage(current);
    });

    // Initialize the first image viewport state
    showImage(current);
  });
});

// 3. Resume Tracking Metric Utility Hook
function trackDownload() {
  console.log('Resume downloaded');
  // Ready to be hooked into Google Analytics Event tags if needed later

// 4. Interactive Projects Filter Mechanics
$('.filter-btn').click(function() {
  // Highlight chosen button
  $('.filter-btn').removeClass('active');
  $(this).addClass('active');

  const selectedFilter = $(this).data('filter');

  $('.project-display-card').each(function() {
    // Parse individual card tags string natively
    const cardCategories = eval($(this).attr('data-categories'));
    
    if (selectedFilter === 'all' || cardCategories.includes(selectedFilter)) {
      $(this).fadeIn(300);
    } else {
      $(this).fadeOut(200);
    }
  });
});
}
