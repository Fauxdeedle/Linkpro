(function () {
  var config = window.LINKPRO_COURSE || {};
  var storageKey = config.storageKey;
  var resetLabel = config.resetLabel || 'this course';

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[char];
    });
  }

  window.LINKPRO_COURSE_PLAYER = {
    start: function (lessonData) {
      var lessons = Array.isArray(lessonData) ? lessonData : [];
      var completed = [];
      var activeLesson = 0;
      var lastFocusedElement = null;
      var lessonList = document.getElementById('lessonList');
      var lessonView = document.getElementById('lessonView');
      var lessonMedia = document.getElementById('lessonMedia');
      var lessonVideoFrame = document.getElementById('lessonVideoFrame');

      function parseYoutubeId(input) {
        if (!input || typeof input !== 'string') return null;
        var trimmed = input.trim();
        if (!trimmed) return null;
        if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
        var match = trimmed.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|shorts\/|watch\?v=|watch\?.+&v=))([a-zA-Z0-9_-]{11})/);
        return match ? match[1] : null;
      }

      function updateLessonVideo(lesson) {
        var id = parseYoutubeId(lesson.youtube);
        if (id) {
          lessonMedia.classList.add('has-video');
          lessonVideoFrame.title = lesson.title + ' — lesson video';
          lessonVideoFrame.src = 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0&modestbranding=1';
        } else {
          lessonMedia.classList.remove('has-video');
          lessonVideoFrame.removeAttribute('src');
          lessonVideoFrame.title = 'Lesson video';
        }
      }

      function clearLessonVideo() {
        lessonMedia.classList.remove('has-video');
        lessonVideoFrame.removeAttribute('src');
        lessonVideoFrame.title = 'Lesson video';
      }

      try {
        var saved = JSON.parse(localStorage.getItem(storageKey));
        if (Array.isArray(saved)) {
          completed = saved.filter(function (index) {
            return Number.isInteger(index) && index >= 0 && index < lessons.length;
          });
        }
      } catch (error) {
        completed = [];
      }

      function saveProgress() {
        try { localStorage.setItem(storageKey, JSON.stringify(completed)); } catch (error) {}
      }

      function renderLessons() {
        lessonList.innerHTML = lessons.map(function (lesson, index) {
          var isComplete = completed.indexOf(index) !== -1;
          return '<article class="lesson' + (isComplete ? ' is-complete' : '') + '" data-index="' + index + '">' +
            '<div class="lesson__number">' + String(index + 1).padStart(2, '0') + '</div>' +
            '<div><span class="lesson__kicker">' + (isComplete ? 'Complete' : 'Lesson ' + (index + 1)) + '</span>' +
            '<h3 class="lesson__title">' + escapeHtml(lesson.title) + '</h3><span class="lesson__duration">' + escapeHtml(lesson.duration) + '</span></div>' +
            '<button class="lesson__action" type="button" data-open="' + index + '"><span>' + (isComplete ? 'Review' : 'Begin') + '</span>' +
            '<span class="lesson__status"><svg class="lesson__play" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m5 3 7 5-7 5V3Z" fill="currentColor"/></svg>' +
            '<svg class="lesson__check" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 8 3 3 7-7" stroke="currentColor" stroke-width="1.8"/></svg></span></button></article>';
        }).join('');
        lessonList.querySelectorAll('[data-open]').forEach(function (button) {
          button.addEventListener('click', function () { openLesson(Number(button.dataset.open)); });
        });
      }

      function updateProgress() {
        var percent = lessons.length ? Math.round((completed.length / lessons.length) * 100) : 0;
        document.getElementById('progressNumber').textContent = percent + '%';
        document.getElementById('progressCount').textContent = completed.length + ' of ' + lessons.length + ' lessons complete';
        document.getElementById('progressFill').style.width = percent + '%';
        document.querySelector('.progress__track').setAttribute('aria-valuenow', percent);
        document.getElementById('resetProgress').classList.toggle('visible', completed.length > 0);
        var nextLesson = lessons.findIndex(function (_, index) { return completed.indexOf(index) === -1; });
        document.getElementById('startCourse').firstChild.nodeValue = completed.length === 0 ? 'Start course ' : completed.length === lessons.length ? 'Review course ' : 'Continue course ';
        document.getElementById('startCourse').dataset.lesson = nextLesson === -1 ? 0 : nextLesson;
      }

      function openLesson(index) {
        activeLesson = index;
        lastFocusedElement = document.activeElement;
        var lesson = lessons[index];
        document.getElementById('lessonModalEyebrow').textContent = 'Lesson ' + (index + 1) + ' of ' + lessons.length + ' · ' + lesson.duration;
        document.getElementById('lessonModalTitle').textContent = lesson.title;
        document.getElementById('lessonModalDescription').textContent = lesson.description;
        document.getElementById('previousLesson').disabled = index === 0;
        document.getElementById('nextLesson').disabled = index === lessons.length - 1;
        updateLessonVideo(lesson);
        updateCompleteButton();
        lessonView.classList.add('open');
        document.body.classList.add('lesson-open');
        document.getElementById('closeLesson').focus();
      }

      function closeLesson() {
        clearLessonVideo();
        lessonView.classList.remove('open');
        document.body.classList.remove('lesson-open');
        if (lastFocusedElement) lastFocusedElement.focus();
      }

      function updateCompleteButton() {
        var button = document.getElementById('completeLesson');
        var isComplete = completed.indexOf(activeLesson) !== -1;
        button.textContent = isComplete ? 'Lesson complete ✓' : 'Mark lesson complete';
        button.classList.toggle('completed', isComplete);
      }

      document.getElementById('startCourse').addEventListener('click', function (event) {
        event.preventDefault();
        openLesson(Number(event.currentTarget.dataset.lesson || 0));
      });
      document.getElementById('completeLesson').addEventListener('click', function () {
        if (completed.indexOf(activeLesson) === -1) {
          completed.push(activeLesson);
          completed.sort(function (a, b) { return a - b; });
          saveProgress();
          renderLessons();
          updateProgress();
          updateCompleteButton();
        }
      });
      document.getElementById('previousLesson').addEventListener('click', function () { if (activeLesson > 0) openLesson(activeLesson - 1); });
      document.getElementById('nextLesson').addEventListener('click', function () { if (activeLesson < lessons.length - 1) openLesson(activeLesson + 1); });
      document.getElementById('closeLesson').addEventListener('click', closeLesson);
      lessonView.addEventListener('click', function (event) { if (event.target === lessonView) closeLesson(); });
      document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && lessonView.classList.contains('open')) closeLesson(); });
      document.getElementById('resetProgress').addEventListener('click', function () {
        if (window.confirm('Reset all progress for ' + resetLabel + '?')) {
          completed = [];
          saveProgress();
          renderLessons();
          updateProgress();
        }
      });

      renderLessons();
      updateProgress();
    },
  };
})();
