(() => {
  const slides = [...document.querySelectorAll('.hero-slide')];
  const dots = [...document.querySelectorAll('.hero-dots button')];
  let current = 0;
  let timer;

  function showSlide(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => slide.classList.toggle('active', i === current));
    dots.forEach((dot, i) => dot.classList.toggle('active', i === current));
  }

  function restartTimer() {
    clearInterval(timer);
    timer = setInterval(() => showSlide(current + 1), 6500);
  }

  document.getElementById('prevSlide').addEventListener('click', () => { showSlide(current - 1); restartTimer(); });
  document.getElementById('nextSlide').addEventListener('click', () => { showSlide(current + 1); restartTimer(); });
  dots.forEach(dot => dot.addEventListener('click', () => { showSlide(Number(dot.dataset.go)); restartTimer(); }));
  restartTimer();

  const search = document.getElementById('siteSearch');
  const popover = document.getElementById('searchPopover');
  search.addEventListener('focus', () => popover.classList.add('show'));
  search.addEventListener('input', () => popover.classList.toggle('show', search.value.length < 2));
  document.querySelectorAll('[data-search]').forEach(button => button.addEventListener('click', () => {
    search.value = button.dataset.search;
    popover.classList.remove('show');
  }));
  document.addEventListener('click', event => {
    if (!event.target.closest('.site-search')) popover.classList.remove('show');
  });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (window.innerWidth > 820) search.focus();
    }
    if (event.key === 'Escape') document.querySelectorAll('.modal-backdrop:not([hidden])').forEach(modal => modal.hidden = true);
  });

  document.querySelectorAll('[data-modal]').forEach(trigger => trigger.addEventListener('click', () => {
    const modal = document.getElementById(trigger.dataset.modal);
    modal.hidden = false;
    setTimeout(() => modal.querySelector('input')?.focus(), 30);
  }));
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('.modal-backdrop').hidden = true));
  document.querySelectorAll('.modal-backdrop').forEach(modal => modal.addEventListener('click', event => {
    if (event.target === modal) modal.hidden = true;
  }));

  document.querySelectorAll('.role-select button').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.role-select button').forEach(item => item.classList.remove('selected'));
    button.classList.add('selected');
  }));

  document.querySelectorAll('.filter-row button').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.filter-row button').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    const type = button.dataset.filter;
    document.querySelectorAll('.reel-card').forEach(card => card.hidden = type !== 'all' && card.dataset.type !== type);
  }));

  document.querySelectorAll('.play-button').forEach(button => button.addEventListener('click', () => {
    const video = button.parentElement.querySelector('video');
    document.querySelectorAll('.reel-media video').forEach(other => { if (other !== video) { other.pause(); other.closest('.reel-media').querySelector('.play-button').textContent = '▶'; } });
    if (video.paused) { video.play(); button.textContent = '❚❚'; }
    else { video.pause(); button.textContent = '▶'; }
  }));

  const sections = [...document.querySelectorAll('main section[id]')];
  const navLinks = [...document.querySelectorAll('.nav-inner a')];
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
    });
  }, { rootMargin: '-35% 0px -55% 0px' });
  sections.forEach(section => observer.observe(section));
})();
