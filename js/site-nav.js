(function () {
  'use strict';

  var nav = document.getElementById('nav');
  if (!nav) return;

  var lightSurface = document.body.classList.contains('nav-surface-light');

  function syncNavHeight() {
    document.documentElement.style.setProperty('--site-nav-height', nav.offsetHeight + 'px');
  }

  function handleScroll() {
    if (lightSurface) {
      nav.classList.add('scrolled');
      return;
    }
    if (window.scrollY > 80) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }

  syncNavHeight();
  handleScroll();
  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', syncNavHeight, { passive: true });
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(syncNavHeight).observe(nav);
  }

  var hamburger = document.getElementById('hamburger');
  var mobileNav = document.getElementById('mobileNav');
  if (hamburger && mobileNav) {
    function setMenuOpen(open) {
      mobileNav.classList.toggle('open', open);
      hamburger.classList.toggle('active', open);
      nav.classList.toggle('menu-open', open);
      mobileNav.setAttribute('aria-hidden', open ? 'false' : 'true');
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) {
        mobileNav.scrollTop = 0;
      }
      syncNavHeight();
    }

    hamburger.addEventListener('click', function () {
      setMenuOpen(!mobileNav.classList.contains('open'));
    });

    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        setMenuOpen(false);
      });
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (event) {
      var href = anchor.getAttribute('href');
      if (!href || href === '#') return;
      var target = document.querySelector(href);
      if (!target) return;
      event.preventDefault();
      var offset = 80;
      var y = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });

  document.querySelectorAll('a[href="/#contact"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (event) {
      if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        var contact = document.getElementById('contact');
        if (contact) {
          event.preventDefault();
          var offset = 80;
          var y = contact.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }
    });
  });
})();
