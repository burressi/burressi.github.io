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
