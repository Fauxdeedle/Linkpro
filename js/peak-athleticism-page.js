(function () {
  var mount = document.getElementById('peak-content');
  if (!mount) return;

  function esc(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function paragraphHtml(text) {
    return '<p class="peak-p">' + esc(text) + '</p>';
  }

  function listHtml(items) {
    return (
      '<ul class="peak-list">' +
      items.map(function (item) {
        return '<li>' + esc(item) + '</li>';
      }).join('') +
      '</ul>'
    );
  }

  function render(data) {
    document.title = data.meta.title;
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', data.meta.description);

    var heroEyebrow = document.getElementById('peak-hero-eyebrow');
    var heroHeadline = document.getElementById('peak-hero-headline');
    var heroSub = document.getElementById('peak-hero-sub');
    if (heroEyebrow) heroEyebrow.textContent = data.hero.eyebrow;
    if (heroHeadline) heroHeadline.textContent = data.hero.headline;
    if (heroSub) heroSub.textContent = data.hero.subheadline;
    var logo = document.getElementById('peak-logo');
    if (logo) logo.setAttribute('alt', data.hero.logoAlt);

    var html = '';

    html += '<section class="peak-section reveal" id="intro">';
    html += '<div class="peak-container">';
    html += '<p class="peak-lead">' + esc(data.intro.lead) + '</p>';
    data.intro.paragraphs.forEach(function (p) {
      html += paragraphHtml(p);
    });
    html += '</div></section>';

    html += '<section class="peak-section peak-section--dark reveal" id="pillars">';
    html += '<div class="peak-container">';
    html += '<h2 class="peak-h2">How we <em>ReCondition</em></h2>';
    html += '<div class="peak-pillars">';
    data.pillars.forEach(function (pillar) {
      html +=
        '<article class="peak-pillar">' +
        '<h3 class="peak-h3">' +
        esc(pillar.title) +
        '</h3>' +
        paragraphHtml(pillar.body) +
        '</article>';
    });
    html += '</div></div></section>';

    html += '<section class="peak-section reveal" id="method">';
    html += '<div class="peak-container peak-split">';
    html += '<div>';
    html += '<h2 class="peak-h2">' + esc(data.method.title) + '</h2>';
    data.method.paragraphs.forEach(function (p) {
      html += paragraphHtml(p);
    });
    html += '</div>';
    html += '<div class="peak-callout">';
    html += '<h3 class="peak-h3">' + esc(data.classes.title) + '</h3>';
    html += paragraphHtml(data.classes.scheduleNote);
    html += listHtml(data.classes.details);
    html += '</div>';
    html += '</div></section>';

    html += '<section class="peak-section peak-section--dark reveal" id="topics">';
    html += '<div class="peak-container">';
    html += '<h2 class="peak-h2">What parents &amp; coaches should <em>know</em></h2>';
    html += '<div class="peak-topics">';
    data.topics.forEach(function (topic, i) {
      html +=
        '<details class="peak-topic"' +
        (i === 0 ? ' open' : '') +
        '>' +
        '<summary class="peak-topic__summary">' +
        esc(topic.title) +
        '</summary>' +
        '<div class="peak-topic__body">' +
        listHtml(topic.points) +
        '</div></details>';
    });
    html += '</div></div></section>';

    if (data.throwing) {
      html += '<section class="peak-section reveal" id="throwing">';
      html += '<div class="peak-container">';
      html += '<p class="peak-label">' + esc(data.throwing.subtitle) + '</p>';
      html += '<h2 class="peak-h2">' + esc(data.throwing.title) + '</h2>';
      html += paragraphHtml(data.throwing.intro);
      html += listHtml(data.throwing.points);
      html += paragraphHtml(data.throwing.closing);
      html += '</div></section>';
    }

    if (data.quotes && data.quotes.length) {
      html += '<section class="peak-section peak-quotes reveal">';
      html += '<div class="peak-container">';
      data.quotes.forEach(function (q) {
        html += '<blockquote class="peak-quote">' + esc(q) + '</blockquote>';
      });
      html += '</div></section>';
    }

    html += '<section class="peak-cta reveal">';
    html += '<div class="peak-container peak-cta__inner">';
    html += '<h2 class="peak-cta__title">' + esc(data.cta.title) + '</h2>';
    html += '<p class="peak-cta__body">' + esc(data.cta.body) + '</p>';
    html +=
      '<a class="peak-btn" href="' +
      esc(data.cta.buttonHref) +
      '">' +
      esc(data.cta.buttonText) +
      '</a>';
    html += '</div></section>';

    mount.innerHTML = html;
    initReveal(mount.querySelectorAll('.reveal'));
  }

  function initReveal(nodes) {
    if (!nodes.length) return;
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      },
      { threshold: 0.08 }
    );
    nodes.forEach(function (el) {
      observer.observe(el);
    });
  }

  fetch('/content/peak-athleticism.json')
    .then(function (res) {
      if (!res.ok) throw new Error('Failed to load content');
      return res.json();
    })
    .then(render)
    .catch(function () {
      mount.innerHTML =
        '<div class="peak-container"><p class="peak-p">Unable to load page content. Please try again later.</p></div>';
    });
})();
