$(document).ready(function() {
  $('.sidebarIcon').hover(function() {
    $(this).css('opacity', '0.6');
  }, function() {
    $(this).css('opacity', '1');
  });
});
document.querySelectorAll('.carousel').forEach(carousel => {
  const images = carousel.querySelectorAll('.carouselImage');
  let current = 0;

  const showImage = index => {
    images.forEach((img, i) => img.classList.toggle('active', i === index));
  };

  carousel.querySelector('.prev').addEventListener('click', () => {
    current = (current - 1 + images.length) % images.length;
    showImage(current);
  });

  carousel.querySelector('.next').addEventListener('click', () => {
    current = (current + 1) % images.length;
    showImage(current);
  });

  showImage(current);
});
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('.carousel').forEach(carousel => {
    const images = carousel.querySelectorAll('.carouselImage');
    const prevBtn = carousel.querySelector('.prev');
    const nextBtn = carousel.querySelector('.next');
    let current = 0;

    const showImage = index => {
      images.forEach((img, i) => {
        img.classList.toggle('active', i === index);
      });
    };

    prevBtn.addEventListener('click', () => {
      current = (current - 1 + images.length) % images.length;
      showImage(current);
    });

    nextBtn.addEventListener('click', () => {
      current = (current + 1) % images.length;
      showImage(current);
    });

    showImage(current); // Initialize
  });
});
// In script.js - Remove duplicate carousel code and add touch support:
document.querySelectorAll('.carousel').forEach(carousel => {
  // Add touch events for mobile
  carousel.addEventListener('touchstart', handleTouchStart);
  carousel.addEventListener('touchmove', handleTouchMove);
});

// Carousel Functionality (single implementation)
function initCarousels() {
  $('.carousel, .award-images').each(function() {
    const $container = $(this);
    const $images = $container.find('img');
    let current = 0;
    
    if($images.length <= 1) return;
    
    // Create nav buttons if not exist
    if(!$container.find('.carouselBtn').length) {
      $container.append(`
        <button class="carouselBtn prev" aria-label="Previous">&#10094;</button>
        <button class="carouselBtn next" aria-label="Next">&#10095;</button>
      `);
    }
    
    function showImage(index) {
      $images.removeClass('active').eq(index).addClass('active');
    }
    
    $container.on('click', '.prev', function() {
      current = (current - 1 + $images.length) % $images.length;
      showImage(current);
    });
    
    $container.on('click', '.next', function() {
      current = (current + 1) % $images.length;
      showImage(current);
    });
    
    // Touch support
    let touchStartX = 0;
    $container.on('touchstart', function(e) {
      touchStartX = e.touches[0].clientX;
    });
    
    $container.on('touchend', function(e) {
      const touchEndX = e.changedTouches[0].clientX;
      if(touchStartX - touchEndX > 50) {
        $container.find('.next').click(); // Swipe left
      } else if(touchEndX - touchStartX > 50) {
        $container.find('.prev').click(); // Swipe right
      }
    });
    
    showImage(0);
  });
}

// Dark Mode Toggle
function initDarkMode() {
  const darkModeToggle = $(`
    <button id="darkModeToggle" aria-label="Toggle dark mode">
      <span class="light-icon">☀️</span>
      <span class="dark-icon">🌙</span>
    </button>
  `).css({
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '1000',
    background: 'rgba(0,0,0,0.7)',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    cursor: 'pointer'
  }).appendTo('body');
  
  if(localStorage.getItem('darkMode') === 'true') {
    $('body').addClass('dark-mode');
    darkModeToggle.find('.light-icon').hide();
  } else {
    darkModeToggle.find('.dark-icon').hide();
  }
  
  darkModeToggle.click(function() {
    $('body').toggleClass('dark-mode');
    const isDark = $('body').hasClass('dark-mode');
    localStorage.setItem('darkMode', isDark);
    
    if(isDark) {
      $(this).find('.dark-icon').hide();
      $(this).find('.light-icon').show();
    } else {
      $(this).find('.light-icon').hide();
      $(this).find('.dark-icon').show();
    }
  });
}
$(document).ready(function() {
  // Initialize carousels
  initCarousels();
  
  // Initialize dark mode from localStorage
  initDarkMode();
  
  // Sidebar icon hover
  $('.sidebarIcon').hover(
    function() { $(this).css('opacity', '0.7'); },
    function() { $(this).css('opacity', '1'); }
  );
  
  // Awards filtering
  $('.filter-btn').click(function() {
    const filter = $(this).data('filter');
    $('.filter-btn').removeClass('active');
    $(this).addClass('active');
    
    if(filter === 'all') {
      $('.award-card').show();
    } else {
      $('.award-card').each(function() {
        $(this).toggle($(this).data('categories').includes(filter));
      });
    }
  });
});

function initCarousels() {
  $('.award-images').each(function() {
    const $container = $(this);
    const $images = $container.find('img');
    let current = 0;
    
    if($images.length <= 1) return;
    
    // Create nav buttons
    $container.append(`
      <button class="carouselBtn prev" aria-label="Previous">&#10094;</button>
      <button class="carouselBtn next" aria-label="Next">&#10095;</button>
    `);
    
    function showImage(index) {
      $images.removeClass('active').addClass('hidden');
      $images.eq(index).removeClass('hidden').addClass('active');
    }
    
    $container.on('click', '.prev', function(e) {
      e.stopPropagation();
      current = (current - 1 + $images.length) % $images.length;
      showImage(current);
    });
    
    $container.on('click', '.next', function(e) {
      e.stopPropagation();
      current = (current + 1) % $images.length;
      showImage(current);
    });
    
    // Touch support
    let touchStartX = 0;
    $container.on('touchstart', function(e) {
      touchStartX = e.touches[0].clientX;
    });
    
    $container.on('touchend', function(e) {
      const touchEndX = e.changedTouches[0].clientX;
      if(touchStartX - touchEndX > 50) {
        $container.find('.next').click();
      } else if(touchEndX - touchStartX > 50) {
        $container.find('.prev').click();
      }
    });
    
    showImage(0);
  });
}

function initDarkMode() {
  // Check for saved preference
  if(localStorage.getItem('darkMode') === 'true') {
    $('body').addClass('dark-mode');
    $('.dark-icon').show();
    $('.light-icon').hide();
  }
  
  // Toggle handler
  $('#darkModeToggle').click(function() {
    $('body').toggleClass('dark-mode');
    const isDark = $('body').hasClass('dark-mode');
    localStorage.setItem('darkMode', isDark);
    
    $('.dark-icon, .light-icon').toggle();
  });
}
// Initialize everything
$(document).ready(function() {
  // Sidebar icon hover
  $('.sidebarIcon').hover(
    function() { $(this).css('opacity', '0.7'); },
    function() { $(this).css('opacity', '1'); }
  );
  
  initCarousels();
  initDarkMode();
});
// Project Filter Functionality
function initProjectFilters() {
  $('.project-filters .filter-btn').click(function() {
    const filter = $(this).data('filter');
    
    // Update active button
    $('.project-filters .filter-btn').removeClass('active');
    $(this).addClass('active');
    
    // Filter projects
    if (filter === 'all') {
      $('.project-card').show();
    } else {
      $('.project-card').each(function() {
        const categories = $(this).data('categories');
        $(this).toggle(categories.includes(filter));
      });
    }
  });
}

// Initialize when document ready
$(document).ready(function() {
  initCarousels();
  initDarkMode();
  initProjectFilters();
  
  // Initialize all project carousels
  $('.project-carousel').each(function() {
    const $carousel = $(this);
    const $images = $carousel.find('img');
    let current = 0;
    
    if ($images.length <= 1) return;
    
    function showImage(index) {
      $images.removeClass('active').addClass('hidden');
      $images.eq(index).removeClass('hidden').addClass('active');
    }
    
    $carousel.on('click', '.prev', function(e) {
      e.stopPropagation();
      current = (current - 1 + $images.length) % $images.length;
      showImage(current);
    });
    
    $carousel.on('click', '.next', function(e) {
      e.stopPropagation();
      current = (current + 1) % $images.length;
      showImage(current);
    });
    
    // Touch support
    let touchStartX = 0;
    $carousel.on('touchstart', function(e) {
      touchStartX = e.touches[0].clientX;
    });
    
    $carousel.on('touchend', function(e) {
      const touchEndX = e.changedTouches[0].clientX;
      if (touchStartX - touchEndX > 50) {
        $carousel.find('.next').click();
      } else if (touchEndX - touchStartX > 50) {
        $carousel.find('.prev').click();
      }
    });
    
    showImage(0);
  });
});
// Find elements wider than viewport
const docWidth = document.documentElement.offsetWidth;
[].forEach.call(
    document.querySelectorAll('*'),
    function(el) {
        if (el.offsetWidth > docWidth) {
            console.log(el);
        }
    }
);
