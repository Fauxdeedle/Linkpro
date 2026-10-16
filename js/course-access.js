(function () {
  var config = window.LINKPRO_COURSE;
  if (!config || !config.slug) return;

  var statusEl = document.getElementById('courseAccessStatus');
  var paywall = document.getElementById('coursePaywall');
  var progress = document.querySelector('.progress-section');
  var curriculum = document.getElementById('lessons');
  var priceEl = document.getElementById('paywallPrice');
  var enrollEl = document.getElementById('paywallEnroll');
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
    if (offer && enrollEl && offer.checkoutUrl) {
      enrollEl.href = offer.checkoutUrl;
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
      messageEl.textContent = 'Sending a login link…';
      fetch('/api/access/request', {
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
          messageEl.textContent = result.data.message || result.data.error || 'Check your email for a login link.';
        })
        .catch(function () {
          messageEl.textContent = 'Could not send a login link. Try again.';
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
