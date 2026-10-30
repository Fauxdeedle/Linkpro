(function () {
  var config = window.LINKPRO_COURSE;
  if (!config || !config.slug) return;

  var statusEl = document.getElementById('courseAccessStatus');
  var paywall = document.getElementById('coursePaywall');
  var progress = document.querySelector('.progress-section');
  var curriculum = document.getElementById('lessons');
  var priceEl = document.getElementById('paywallPrice');
  var form = document.getElementById('paywallLogin');
  var messageEl = document.getElementById('paywallMessage');
  var startButton = document.getElementById('startCourse');

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
    if (paywall) paywall.hidden = false;
    if (offer && priceEl && typeof offer.amount === 'number') {
      priceEl.textContent = '$' + offer.amount;
    }
    if (startButton) {
      startButton.textContent = 'Enroll to watch';
      startButton.href = '#coursePaywall';
    }
  }

  function showCourse(lessons) {
    if (statusEl) statusEl.hidden = true;
    if (paywall) paywall.hidden = true;
    if (progress) progress.hidden = false;
    if (curriculum) curriculum.hidden = false;
    if (window.LINKPRO_COURSE_PLAYER) {
      window.LINKPRO_COURSE_PLAYER.start(lessons);
    }
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
