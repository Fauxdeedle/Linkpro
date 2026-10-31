(function () {
  var form = document.getElementById('survey-form');
  var thanks = document.getElementById('survey-thanks');
  var errorEl = document.getElementById('form-error');
  var submitButton = document.getElementById('survey-submit');
  if (!form || !thanks || !errorEl || !submitButton) return;

  var scaleIds = ['confidence', 'outcomes', 'balance', 'anotherCourse', 'explained'];
  var textIds = ['lectures', 'methodology', 'formatLength', 'applyMost', 'colleague', 'aha'];

  function showError(message) {
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  function clearError() {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }

  function selectedFormats() {
    return Array.prototype.map.call(
      form.querySelectorAll('input[name="formats"]:checked'),
      function (input) { return input.value; }
    );
  }

  function selectedScale(id) {
    var input = form.querySelector('input[name="' + id + '"]:checked');
    return input ? input.value : '';
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    clearError();

    if (!form.reportValidity()) return;

    var formats = selectedFormats();
    if (formats.length === 0) {
      showError('Choose at least one course format.');
      var formatLegend = document.getElementById('format-legend');
      if (formatLegend) formatLegend.focus();
      return;
    }

    var scales = {};
    scaleIds.forEach(function (id) {
      scales[id] = selectedScale(id);
    });

    var payload = {
      firstName: form.firstName.value,
      lastName: form.lastName.value,
      email: form.email.value,
      newsOptIn: Boolean(form.newsOptIn.checked),
      formats: formats,
      scales: scales,
      company: form.company.value,
    };
    textIds.forEach(function (id) {
      payload[id] = form.elements[id].value;
    });

    submitButton.disabled = true;
    submitButton.textContent = 'Sending…';

    fetch('/api/event-survey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          return { ok: response.ok, body: body };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          showError(result.body.error || 'Could not send your response. Please try again.');
          submitButton.disabled = false;
          submitButton.textContent = 'Submit';
          return;
        }
        form.hidden = true;
        thanks.hidden = false;
        thanks.focus();
      })
      .catch(function () {
        showError('Could not send your response. Please try again.');
        submitButton.disabled = false;
        submitButton.textContent = 'Submit';
      });
  });
})();
