(function () {
  var body = document.body;
  var contentUrl = body.getAttribute('data-sales-content');
  if (!contentUrl) return;

  var mountId = body.getAttribute('data-sales-mount') || 'sales-content';
  var mount = document.getElementById(mountId);
  if (!mount) return;

  var cssPrefix = body.getAttribute('data-sales-css-prefix') || 'sales';

  function esc(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pClass() {
    return cssPrefix === 'peak' ? 'peak-p' : 'sales-p';
  }

  function paragraphHtml(text) {
    return '<p class="' + pClass() + '">' + esc(text) + '</p>';
  }

  function listHtml(items, listClass) {
    var cls = listClass || (cssPrefix === 'peak' ? 'peak-list' : 'sales-list');
    if (!items || !items.length) return '';
    return (
      '<ul class="' +
      cls +
      '">' +
      items
        .map(function (item) {
          return '<li>' + esc(item) + '</li>';
        })
        .join('') +
      '</ul>'
    );
  }

  function applyMeta(data) {
    if (data.meta && data.meta.title) document.title = data.meta.title;
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && data.meta && data.meta.description) {
      metaDesc.setAttribute('content', data.meta.description);
    }
    if (data.meta && data.meta.robots) {
      var robots = document.querySelector('meta[name="robots"]');
      if (!robots) {
        robots = document.createElement('meta');
        robots.setAttribute('name', 'robots');
        document.head.appendChild(robots);
      }
      robots.setAttribute('content', data.meta.robots);
    }
  }

  function initReveal(root) {
    var nodes = (root || document).querySelectorAll('.reveal');
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

  function renderCta(data, btnClass) {
    if (!data.cta) return '';
    var cls = btnClass || (cssPrefix === 'peak' ? 'peak-btn' : 'sales-btn');
    var html = '<section class="' + cssPrefix + '-cta reveal">';
    html += '<div class="' + cssPrefix + '-container ' + cssPrefix + '-cta__inner">';
    html += '<h2 class="' + cssPrefix + '-cta__title">' + esc(data.cta.title) + '</h2>';
    html += '<p class="' + cssPrefix + '-cta__body">' + esc(data.cta.body) + '</p>';
    html +=
      '<a class="' +
      cls +
      '" href="' +
      esc(data.cta.buttonHref) +
      '">' +
      esc(data.cta.buttonText) +
      '</a>';
    html += '</div></section>';
    return html;
  }

  function updateProgramHero(data) {
    var heroEyebrow = document.getElementById('peak-hero-eyebrow');
    var heroHeadline = document.getElementById('peak-hero-headline');
    var heroSub = document.getElementById('peak-hero-sub');
    if (heroEyebrow) heroEyebrow.textContent = data.hero.eyebrow;
    if (heroHeadline) heroHeadline.textContent = data.hero.headline;
    if (heroSub) heroSub.textContent = data.hero.subheadline;
    var logo = document.getElementById('peak-logo');
    if (logo && data.hero.logoAlt) logo.setAttribute('alt', data.hero.logoAlt);
  }

  function renderProgram(data) {
    applyMeta(data);
    updateProgramHero(data);

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

    html += renderCta(data, 'peak-btn');
    mount.innerHTML = html;
    initReveal(mount);
  }

  function updateProposalHero(data) {
    var h = data.hero || {};
    var elClient = document.getElementById('sales-hero-client');
    var elTitle = document.getElementById('sales-hero-title');
    var elDates = document.getElementById('sales-hero-dates');
    var elLed = document.getElementById('sales-hero-led');
    if (elClient) elClient.textContent = h.client || '';
    if (elTitle) elTitle.textContent = h.title || '';
    if (elDates) elDates.textContent = h.dates ? 'Dates: ' + h.dates : '';
    if (elLed) elLed.textContent = h.ledBy ? 'Led by: ' + h.ledBy : '';
    var logoWrap = document.getElementById('sales-hero-logos');
    if (logoWrap && h.logos && h.logos.length) {
      logoWrap.innerHTML = h.logos
        .map(function (src) {
          return (
            '<img src="' +
            esc(src) +
            '" alt="" class="sales-hero__logo" loading="lazy">'
          );
        })
        .join('');
    }
  }

  function renderProposal(data) {
    applyMeta(data);
    updateProposalHero(data);

    var html = '';

    if (data.letter) {
      html += '<section class="sales-section reveal" id="letter">';
      html += '<div class="sales-container sales-letter">';
      html += '<p class="sales-letter__salutation">' + esc(data.letter.salutation) + '</p>';
      data.letter.paragraphs.forEach(function (p) {
        html += paragraphHtml(p);
      });
      if (data.letter.signoff) {
        html +=
          '<p class="sales-letter__signoff">' +
          data.letter.signoff
            .split('\n')
            .map(function (line) {
              return esc(line);
            })
            .join('<br>') +
          '</p>';
      }
      html += '</div></section>';
    }

    if (data.sections && data.sections.length) {
      html += '<section class="sales-section sales-section--alt reveal" id="outline">';
      html += '<div class="sales-container">';
      html += '<h2 class="sales-h2">Course outline</h2>';
      data.sections.forEach(function (section) {
        html += '<article class="sales-block">';
        html += '<h3 class="sales-h3">' + esc(section.title) + '</h3>';
        if (section.body) html += paragraphHtml(section.body);
        if (section.paragraphs) {
          section.paragraphs.forEach(function (p) {
            html += paragraphHtml(p);
          });
        }
        if (section.bullets) html += listHtml(section.bullets);
        if (section.subsections) {
          section.subsections.forEach(function (sub) {
            html += '<h4 class="sales-h4">' + esc(sub.title) + '</h4>';
            if (sub.body) html += paragraphHtml(sub.body);
            if (sub.bullets) html += listHtml(sub.bullets);
          });
        }
        html += '</article>';
      });
      html += '</div></section>';
    }

    if (data.prepWork) {
      var prep = data.prepWork;
      html += '<section class="sales-section reveal" id="prep">';
      html += '<div class="sales-container">';
      html += '<div class="sales-callout">';
      html += '<p class="sales-label">' + esc(prep.label || 'Prep work (online)') + '</p>';
      html += '<h3 class="sales-h3">' + esc(prep.courseName) + '</h3>';
      if (prep.videos) html += paragraphHtml('Videos: ' + prep.videos);
      if (prep.cost) html += '<p class="sales-callout__cost">' + esc(prep.cost) + '</p>';
      if (prep.bullets) html += listHtml(prep.bullets);
      if (prep.notes) {
        prep.notes.forEach(function (n) {
          html += paragraphHtml(n);
        });
      }
      html += '</div></div></section>';
    }

    if (data.processNote) {
      html += '<section class="sales-section sales-section--alt reveal" id="process">';
      html += '<div class="sales-container">';
      html += paragraphHtml(data.processNote);
      html += '</div></section>';
    }

    if (data.days && data.days.length) {
      html += '<section class="sales-section reveal" id="schedule">';
      html += '<div class="sales-container">';
      html += '<h2 class="sales-h2">Onsite schedule</h2>';
      html += '<div class="sales-days">';
      data.days.forEach(function (day) {
        html += '<article class="sales-day">';
        html += '<p class="sales-day__label">' + esc(day.label) + '</p>';
        html += '<h3 class="sales-h3">' + esc(day.title) + '</h3>';
        html += listHtml(day.bullets);
        html += '</article>';
      });
      html += '</div></div></section>';
    }

    if (data.includedMaterials && data.includedMaterials.length) {
      html += '<section class="sales-section sales-section--alt reveal" id="included">';
      html += '<div class="sales-container">';
      html += '<h2 class="sales-h2">' + esc(data.includedTitle || 'Other online prep materials') + '</h2>';
      if (data.includedIntro) html += paragraphHtml(data.includedIntro);
      html += listHtml(data.includedMaterials);
      html += '</div></section>';
    }

    if (data.pricing && data.pricing.length) {
      html += '<section class="sales-section reveal" id="pricing">';
      html += '<div class="sales-container">';
      html += '<h2 class="sales-h2">' + esc(data.pricingTitle || 'Estimated investment') + '</h2>';
      html += '<div class="sales-table-wrap"><table class="sales-table">';
      html += '<thead><tr><th>Item</th><th>Details</th><th>Cost</th></tr></thead><tbody>';
      data.pricing.forEach(function (row) {
        html +=
          '<tr><td>' +
          esc(row.item) +
          '</td><td>' +
          esc(row.details) +
          '</td><td>' +
          esc(row.cost) +
          '</td></tr>';
      });
      html += '</tbody></table></div></div></section>';
    }

    if (data.figure) {
      html += '<section class="sales-section sales-section--alt reveal" id="figure">';
      html += '<div class="sales-container sales-figure">';
      html +=
        '<img src="' +
        esc(data.figure.src) +
        '" alt="' +
        esc(data.figure.alt || '') +
        '" loading="lazy">';
      if (data.figure.caption) {
        html += '<p class="sales-figure__caption">' + esc(data.figure.caption) + '</p>';
      }
      html += '</div></section>';
    }

    html += renderCta(data, 'sales-btn');
    mount.innerHTML = html;
    initReveal(mount);
  }

  function render(data) {
    var pageType = data.pageType || 'program';
    if (pageType === 'proposal') {
      renderProposal(data);
    } else {
      renderProgram(data);
    }
  }

  fetch(contentUrl)
    .then(function (res) {
      if (!res.ok) throw new Error('Failed to load content');
      return res.json();
    })
    .then(render)
    .catch(function () {
      var containerClass = cssPrefix === 'peak' ? 'peak-container' : 'sales-container';
      mount.innerHTML =
        '<div class="' +
        containerClass +
        '"><p class="' +
        pClass() +
        '">Unable to load page content. Please try again later.</p></div>';
    });
})();
