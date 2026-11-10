/**
 * Render LINK Pro training-event pages and catalog cards from event JSON.
 * Trusted HTML is allowed only in hero.titleHtml and hero.metaHtml.
 */

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function asList(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter((item) => item != null && item !== '') : [value];
}

function pageHref(event) {
  return `/${event.slug}`;
}

function isListed(event) {
  return event && event.status !== 'ended';
}

function catalogEvents(events, surface) {
  return events
    .filter((event) => isListed(event) && Array.isArray(event.listOn) && event.listOn.includes(surface))
    .slice()
    .sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0) || String(a.slug).localeCompare(String(b.slug)));
}

function assertSlug(event) {
  if (!event || !SLUG_RE.test(event.slug || '')) {
    throw new Error(`Event slug must match ${SLUG_RE}`);
  }
}

function titleText(event) {
  return (event.catalog && event.catalog.title) || event.slug;
}

function renderSeminarCard(event, variant, index) {
  assertSlug(event);
  const catalog = event.catalog || {};
  const href = pageHref(event);
  const title = esc(catalog.title || event.slug);
  const location = catalog.location ? esc(catalog.location) : '';
  const summary = catalog.summary ? esc(catalog.summary) : '';
  const comingSoon = event.status === 'coming-soon';
  const delay = variant === 'home' && index > 0 ? ` reveal-delay-${Math.min(index, 5)}` : '';

  const titleHtml = comingSoon ? `<a href="${esc(href)}">${title}</a>` : title;
  const priceHtml = comingSoon
    ? variant === 'home'
      ? '<span class="seminar-card__soon">Coming Soon</span>'
      : '<span class="seminar-soon">Coming Soon</span>'
    : [
        catalog.priceLabel
          ? variant === 'home'
            ? `<span class="seminar-card__price">${esc(catalog.priceLabel)}</span>`
            : `<span class="seminar-price">${esc(catalog.priceLabel)}</span>`
          : '',
        catalog.ctaLabel
          ? variant === 'home'
            ? `<a href="${esc(href)}" class="seminar-card__cta">${esc(catalog.ctaLabel)}</a>`
            : `<a href="${esc(href)}" class="seminar-cta">${esc(catalog.ctaLabel)}</a>`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

  if (variant === 'home') {
    return `<div class="seminar-card reveal${delay}">
          <div class="seminar-card__date">
            <span class="seminar-card__month">${esc(catalog.month)}</span>
            <span class="seminar-card__days">${esc(catalog.days)}</span>
          </div>
          <div class="seminar-card__content">
            <h4 class="seminar-card__title">${titleHtml}</h4>
            ${location ? `<p class="seminar-card__location">${location}</p>` : ''}
            ${summary ? `<p class="seminar-card__text">${summary}</p>` : ''}
          </div>
          <div class="seminar-card__price-block">
            ${priceHtml}
          </div>
        </div>`;
  }

  return `<div class="seminar reveal${delay}">
        <div class="seminar-date"><span class="seminar-month">${esc(catalog.month)}</span><span class="seminar-days">${esc(catalog.days)}</span></div>
        <div class="seminar-content">
          <h4>${titleHtml}</h4>
          ${location ? `<p class="seminar-location">${location}</p>` : ''}
          ${summary ? `<p class="seminar-text">${summary}</p>` : ''}
        </div>
        <div class="seminar-price-block">
          ${priceHtml}
        </div>
      </div>`;
}

function renderCatalog(events, surface, variant) {
  return catalogEvents(events, surface)
    .map((event, index) => renderSeminarCard(event, variant, index))
    .join('\n');
}

function renderSchedule(items) {
  const list = asList(items);
  if (!list.length) return '';
  const rows = list
    .map((item) => {
      if (typeof item === 'string') return `<li>${esc(item)}</li>`;
      const strong = item.strong || item.time || item.label || '';
      const text = item.text || '';
      if (strong && text) return `<li><strong>${esc(strong)}</strong> ${esc(text)}</li>`;
      return `<li>${esc(strong || text)}</li>`;
    })
    .join('');
  return `<ul class="schedule-list">${rows}</ul>`;
}

function renderParagraphs(value) {
  return asList(value)
    .map((paragraph) => `<p>${esc(paragraph)}</p>`)
    .join('');
}

function checkoutHref(productId) {
  return `/checkout.html?product=${encodeURIComponent(productId)}`;
}

function renderRegister(event) {
  const cta = event.cta || {};
  const title = esc(cta.title || 'Register');
  const body = cta.body ? `<p>${esc(cta.body)}</p>` : '';

  if (event.status === 'ended') {
    return `<section class="event-cta" id="register">
  <div class="container">
    <h2>${title}</h2>
    ${body}
    <a class="btn-primary" href="/courses#seminars">View current trainings</a>
  </div>
</section>`;
  }

  if (event.status === 'coming-soon' || !event.productId) {
    return `<section class="event-cta" id="register">
  <div class="container">
    <h2>${title}</h2>
    ${body}
    <p class="event-cta__soon">Coming soon</p>
  </div>
</section>`;
  }

  const label = esc(cta.buttonText || (event.catalog && event.catalog.ctaLabel) || 'Register');
  const href = checkoutHref(event.productId);
  return `<section class="event-cta" id="register">
  <div class="container">
    <h2>${title}</h2>
    ${body}
    <a class="btn-primary" href="${esc(href)}" data-flute-product="${esc(event.productId)}">${label}</a>
  </div>
</section>`;
}

function renderEventPage(event) {
  assertSlug(event);
  const catalog = event.catalog || {};
  const hero = event.hero || {};
  const details = event.details || {};
  const instructor = event.instructor || {};
  const meta = event.meta || {};
  const title = meta.title || `${titleText(event)} — LINK Pro`;
  const description = meta.description || catalog.summary || '';
  const heading = hero.titleHtml || esc(titleText(event));
  const metaHtml = hero.metaHtml || (catalog.location ? esc(catalog.location) : '');
  const gallery = asList(event.gallery);
  const scheduleHtml = renderSchedule(details.schedule);
  const logistics = asList(details.logistics);
  const intro = renderParagraphs(details.intro);
  const columns = [];

  if (scheduleHtml) {
    columns.push(`<div>
        <p class="label">${esc(details.scheduleLabel || 'Schedule')}</p>
        ${details.scheduleHeading ? `<h2>${esc(details.scheduleHeading)}</h2>` : ''}
        ${scheduleHtml}
      </div>`);
  }

  if (logistics.length) {
    columns.push(`<div>
        <p class="label">${esc(details.logisticsLabel || 'Logistics')}</p>
        ${details.logisticsHeading ? `<h2>${esc(details.logisticsHeading)}</h2>` : ''}
        ${logistics.map((item) => `<p>${esc(item)}</p>`).join('')}
      </div>`);
  }

  const detailsHtml =
    intro || columns.length
      ? `<section class="event-details">
  <div class="container">
    <p class="label">${esc(details.label || 'The training')}</p>
    <h2>${esc(details.heading || 'Hands-on intensive')}</h2>
    ${intro}
    ${columns.length ? `<div class="two-col${columns.length > 1 ? '' : ' is-single'}">${columns.join('')}</div>` : ''}
  </div>
</section>`
      : '';

  const bio = renderParagraphs(instructor.bio);
  const instructorHtml = instructor.name
    ? `<section class="event-instructor">
  <div class="container">
    <p class="label">${esc(instructor.label || 'Your instructor')}</p>
    <div class="instructor-grid${instructor.image ? '' : ' is-text'}">
      ${
        instructor.image
          ? `<img src="${esc(instructor.image)}" alt="${esc(instructor.imageAlt || instructor.name)}" width="280" height="373" loading="lazy">`
          : ''
      }
      <div>
        <h3>${esc(instructor.name)}</h3>
        ${instructor.role ? `<p class="instructor-role">${esc(instructor.role)}</p>` : ''}
        ${bio}
      </div>
    </div>
  </div>
</section>`
    : '';

  const galleryHtml = gallery.length
    ? `<div class="gallery">
${gallery
  .map(
    (image) =>
      `  <img src="${esc(image.src)}" alt="${esc(image.alt || titleText(event))}" width="800" height="600" loading="lazy">`
  )
  .join('\n')}
</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="/css/site-fonts.css">
<link rel="stylesheet" href="/css/site-nav.css">
<link rel="stylesheet" href="/css/event-page.css">
</head>
<body>
<!-- generated by build:events from content/events/${event.slug}.json -->
<!-- LINKPRO_NAV_START -->
<!-- LINKPRO_NAV_END -->

<header class="event-hero">
  ${event.status === 'ended' ? '<p class="event-ended">This training has ended.</p>' : ''}
  ${hero.eyebrow ? `<p class="event-hero__eyebrow">${esc(hero.eyebrow)}</p>` : ''}
  <h1>${heading}</h1>
  ${hero.tagline ? `<p class="event-hero__tagline">${esc(hero.tagline)}</p>` : ''}
  ${metaHtml ? `<p class="event-hero__meta">${metaHtml}</p>` : ''}
</header>

<div class="event-rule" aria-hidden="true"></div>
${galleryHtml}
${detailsHtml}
${instructorHtml}
${renderRegister(event)}

<footer class="footer">
  <div class="footer-inner">
    <a href="/" class="footer-logo">LINK <span>PRO</span></a>
    <p>&copy; 2026 LINK Pro. All rights reserved.</p>
    <div class="footer-links">
      <a href="/courses">Courses</a>
      <a href="/blog">Blog</a>
      <a href="/#contact">Contact</a>
      <a href="https://www.instagram.com/linkprosport/" target="_blank" rel="noopener">Instagram</a>
    </div>
  </div>
</footer>
<script src="/js/site-nav.js" defer></script>
<script src="/js/flute-checkout.js"></script>
<!-- LINKPRO_ANALYTICS_START -->
<!-- LINKPRO_ANALYTICS_END -->
</body>
</html>
`;
}

module.exports = {
  SLUG_RE,
  catalogEvents,
  renderCatalog,
  renderEventPage,
  renderSeminarCard,
};
