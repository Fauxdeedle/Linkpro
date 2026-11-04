(function () {
  var config = window.LINKPRO_COURSE;
  if (!config || !config.slug) return;

  var statusEl = document.getElementById('courseAccessStatus');
  var paywall = document.getElementById('coursePaywall');
  var progress = document.querySelector('.progress-section');
  var curriculum = document.getElementById('lessons');
  var form = document.getElementById('paywallLogin');
  var messageEl = document.getElementById('paywallMessage');
  var startButton = document.getElementById('startCourse');
  var continueButton = document.getElementById('continueCourse');
  var reveal = document.getElementById('coursePaywallReveal');

  function centerEmailForm() {
    var formEl = document.getElementById('paywallLogin');
    if (!formEl) return false;
    var rect = formEl.getBoundingClientRect();
    if (rect.height < 8) return false;
    var formBottom = window.scrollY + rect.bottom;
    var scrollHeight = document.documentElement.scrollHeight;
    // Collapsed overflow still reports the form's layout box, but that box
    // is not part of the scrollable page yet.
    if (formBottom > scrollHeight + 2) return false;
    var target = window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2;
    var maxScroll = Math.max(0, scrollHeight - window.innerHeight);
    if (target > maxScroll && paywall) {
      var current = parseFloat(window.getComputedStyle(paywall).paddingBottom) || 0;
      paywall.style.paddingBottom = current + (target - maxScroll) + 'px';
      scrollHeight = document.documentElement.scrollHeight;
      maxScroll = Math.max(0, scrollHeight - window.innerHeight);
    }
    if (target > maxScroll + 24) return false;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: Math.max(0, Math.min(target, maxScroll)),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
    return true;
  }

  function openPaywall() {
    if (!reveal || reveal.classList.contains('is-open')) return;
    reveal.classList.add('is-open');
    reveal.setAttribute('aria-hidden', 'false');
    if (paywall) paywall.inert = false;
    if (continueButton) continueButton.setAttribute('aria-expanded', 'true');

    var centered = false;
    function alignForm(forceFocus) {
      if (!centered && centerEmailForm()) centered = true;
      if (!centered && !forceFocus) return;
      var emailInput = paywall && paywall.querySelector('input[type="email"]');
      if (emailInput) emailInput.focus({ preventScroll: true });
    }

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(alignForm);
    });

    function onRevealEnd(event) {
      if (event.target !== reveal || event.propertyName !== 'grid-template-rows') return;
      reveal.removeEventListener('transitionend', onRevealEnd);
      alignForm();
    }
    reveal.addEventListener('transitionend', onRevealEnd);
    window.setTimeout(function () {
      reveal.removeEventListener('transitionend', onRevealEnd);
      alignForm(true);
    }, 560);
  }

  function showStatus(text) {
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = text;
    }
  }

  function showPaywall(offer) {
    if (statusEl) statusEl.hidden = true;
    if (progress) progress.hidden = true;
    if (curriculum) curriculum.hidden = true;
    if (continueButton) continueButton.hidden = false;
    if (startButton) {
      var priceLabel = offer && typeof offer.amount === 'number' ? ' — $' + offer.amount : '';
      startButton.textContent = 'Enroll to watch' + priceLabel;
      startButton.href = '/checkout.html?product=' + encodeURIComponent(config.slug);
    }
  }

  function showCourse(lessons) {
    if (statusEl) statusEl.hidden = true;
    if (reveal) {
      reveal.classList.remove('is-open');
      reveal.setAttribute('aria-hidden', 'true');
    }
    if (paywall) {
      paywall.inert = true;
      paywall.style.paddingBottom = '';
    }
    if (continueButton) {
      continueButton.hidden = true;
      continueButton.setAttribute('aria-expanded', 'false');
    }
    if (progress) progress.hidden = false;
    if (curriculum) curriculum.hidden = false;
    if (window.LINKPRO_COURSE_PLAYER) {
      window.LINKPRO_COURSE_PLAYER.start(lessons);
    }
  }

  if (continueButton) {
    continueButton.addEventListener('click', openPaywall);
  }

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var emailInput = form.querySelector('input[type="email"]');
      var submitButton = form.querySelector('button[type="submit"]');
      if (submitButton) submitButton.disabled = true;
      messageEl.textContent = 'Checking this email…';
      fetch('/api/access/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput ? emailInput.value : '',
          courseId: config.slug,
        }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (result.ok && result.data.action === 'login') {
            window.location.assign('/access-link-sent');
            return;
          }
          if (result.ok && result.data.action === 'pay' && result.data.checkoutUrl) {
            var checkoutUrl = new URL(result.data.checkoutUrl);
            if (checkoutUrl.protocol !== 'https:') {
              throw new Error('Invalid checkout URL.');
            }
            window.location.assign(checkoutUrl.href);
            return;
          }
          messageEl.textContent = (result.data && result.data.error) || 'Could not continue. Try again.';
          if (submitButton) submitButton.disabled = false;
        })
        .catch(function () {
          messageEl.textContent = 'Could not continue. Try again.';
          if (submitButton) submitButton.disabled = false;
        });
    });
  }

  fetch('/api/courses/' + encodeURIComponent(config.slug), { credentials: 'same-origin' })
    .then(function (res) {
      return res.json().then(function (data) {
        return { status: res.status, data: data };
      });
    })
    .then(function (result) {
      if (result.status === 200 && Array.isArray(result.data.lessons)) {
        showCourse(result.data.lessons);
        return;
      }
      showPaywall(result.data);
    })
    .catch(function () {
      showStatus('We could not check your access. Refresh the page to try again.');
    });
})();
