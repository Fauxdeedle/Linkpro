(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof document !== 'undefined') {
    const start = function () {
      api.mount(document);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
  const PRODUCT_ID = /^[a-z0-9-]+$/;
  const LOAD_ERROR = 'Events could not be loaded.';
  const EMPTY = 'No upcoming events.';

  function isIsoDate(value) {
    const match = typeof value === 'string' ? ISO_DATE.exec(value) : null;
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function pacificDate(now) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const value = function (type) {
      const part = parts.find(function (item) {
        return item.type === type;
      });
      return part ? part.value : '';
    };
    return value('year') + '-' + value('month') + '-' + value('day');
  }

  function dateBox(start, end) {
    const startMatch = ISO_DATE.exec(start);
    const endMatch = ISO_DATE.exec(end);
    const startMonth = Number(startMatch[2]);
    const endMonth = Number(endMatch[2]);
    const startDay = Number(startMatch[3]);
    const endDay = Number(endMatch[3]);
    let days = String(startDay);
    if (start !== end) {
      days += '\u2013';
      if (startMatch[1] === endMatch[1] && startMonth === endMonth) {
        days += String(endDay);
      } else {
        const endName = MONTHS[endMonth - 1];
        days += endName.charAt(0) + endName.slice(1).toLowerCase() + ' ' + endDay;
      }
    }
    return { month: MONTHS[startMonth - 1], days: days };
  }

  function safeHref(value) {
    if (typeof value !== 'string') return '';
    const href = value.trim();
    if (href.startsWith('/') && !href.startsWith('//')) return href;
    if (/^https:\/\//i.test(href)) return href;
    return '';
  }

  function safeProductId(value) {
    if (typeof value !== 'string') return '';
    const id = value.trim();
    return PRODUCT_ID.test(id) ? id : '';
  }

  function isListing(event) {
    return (
      event &&
      typeof event.id === 'string' &&
      event.id.trim() &&
      typeof event.title === 'string' &&
      event.title.trim() &&
      typeof event.location === 'string' &&
      typeof event.summary === 'string' &&
      isIsoDate(event.start) &&
      isIsoDate(event.end) &&
      event.end >= event.start
    );
  }

  function selectEvents(events, now, options) {
    const home = Boolean(options && options.home);
    const today = pacificDate(now);
    return (Array.isArray(events) ? events : [])
      .filter(function (event) {
        if (!isListing(event) || event.end < today) return false;
        return home ? event.showOnHome === true : true;
      })
      .slice()
      .sort(function (a, b) {
        if (a.start !== b.start) return a.start < b.start ? -1 : 1;
        return String(a.id).localeCompare(String(b.id));
      });
  }

  function coursesCta(event) {
    if (typeof event.ctaLabel === 'string' && event.ctaLabel.trim()) return event.ctaLabel.trim();
    if (safeProductId(event.productId) && event.priceLabel) return 'Register \u2014 ' + String(event.priceLabel).trim();
    if (safeHref(event.href)) return 'View event \u2014 Register';
    return '';
  }

  function homeCta(event) {
    if (safeProductId(event.productId)) return 'Register';
    if (typeof event.ctaLabel === 'string' && event.ctaLabel.trim()) return event.ctaLabel.trim();
    if (safeHref(event.href)) return 'View event \u2014 Register';
    return '';
  }

  function el(doc, tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function priceBlock(doc, event, variant) {
    const block = el(doc, 'div', variant === 'home' ? 'seminar-card__price-block' : 'seminar-price-block');
    const price = typeof event.priceLabel === 'string' ? event.priceLabel.trim() : '';
    if (price) {
      block.appendChild(el(doc, 'span', variant === 'home' ? 'seminar-card__price' : 'seminar-price', price));
    }
    const productId = safeProductId(event.productId);
    const href = safeHref(event.href);
    const label = variant === 'home' ? homeCta(event) : coursesCta(event);
    if (productId && label) {
      const link = el(doc, 'a', variant === 'home' ? 'seminar-card__cta' : 'seminar-cta', label);
      link.href = '/checkout.html?product=' + encodeURIComponent(productId);
      link.setAttribute('data-flute-product', productId);
      block.appendChild(link);
    } else if (href && label) {
      const link = el(doc, 'a', variant === 'home' ? 'seminar-card__cta' : 'seminar-cta', label);
      link.href = href;
      block.appendChild(link);
    } else {
      block.appendChild(el(doc, 'span', variant === 'home' ? 'seminar-card__soon' : 'seminar-soon', 'Coming Soon'));
    }
    return block;
  }

  function coursesCard(doc, event) {
    const box = dateBox(event.start, event.end);
    const card = el(doc, 'div', 'seminar reveal');
    const date = el(doc, 'div', 'seminar-date');
    date.appendChild(el(doc, 'span', 'seminar-month', box.month));
    date.appendChild(el(doc, 'span', 'seminar-days', box.days));
    const content = el(doc, 'div', 'seminar-content');
    content.appendChild(el(doc, 'h4', '', event.title.trim()));
    content.appendChild(el(doc, 'p', 'seminar-location', event.location));
    content.appendChild(el(doc, 'p', 'seminar-text', event.summary));
    card.appendChild(date);
    card.appendChild(content);
    card.appendChild(priceBlock(doc, event, 'courses'));
    return card;
  }

  function homeCard(doc, event, index) {
    const box = dateBox(event.start, event.end);
    const delay = index > 0 ? ' reveal-delay-' + Math.min(index, 5) : '';
    const card = el(doc, 'div', 'seminar-card reveal' + delay);
    const date = el(doc, 'div', 'seminar-card__date');
    date.appendChild(el(doc, 'span', 'seminar-card__month', box.month));
    date.appendChild(el(doc, 'span', 'seminar-card__days', box.days));
    const content = el(doc, 'div', 'seminar-card__content');
    content.appendChild(el(doc, 'h4', 'seminar-card__title', event.title.trim()));
    content.appendChild(el(doc, 'p', 'seminar-card__location', event.location));
    content.appendChild(el(doc, 'p', 'seminar-card__text', event.summary));
    card.appendChild(date);
    card.appendChild(content);
    card.appendChild(priceBlock(doc, event, 'home'));
    return card;
  }

  function statusLine(doc, mount, message) {
    const variant = mount.getAttribute('data-live-events');
    const className = variant === 'home' ? 'seminar-card__text' : 'seminar-text';
    mount.replaceChildren(el(doc, 'p', className, message));
  }

  function reveal(element) {
    if (!('IntersectionObserver' in window)) {
      element.classList.add('visible');
      return;
    }
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.1 }
    );
    observer.observe(element);
  }

  function render(doc, mount, events) {
    const variant = mount.getAttribute('data-live-events');
    const visible = selectEvents(events, new Date(), { home: variant === 'home' });
    mount.replaceChildren();
    if (!visible.length) {
      statusLine(doc, mount, EMPTY);
      return;
    }
    visible.forEach(function (event, index) {
      const card = variant === 'home' ? homeCard(doc, event, index) : coursesCard(doc, event);
      mount.appendChild(card);
      reveal(card);
    });
  }

  function mount(doc, fetchImpl) {
    const rootDoc = doc || document;
    const mounts = rootDoc.querySelectorAll('[data-live-events]');
    if (!mounts.length) return Promise.resolve();
    const fetcher = fetchImpl || globalThis.fetch.bind(globalThis);
    return fetcher('/content/events.json', { cache: 'no-cache' })
      .then(function (response) {
        if (!response.ok) throw new Error('events request failed');
        return response.json();
      })
      .then(function (events) {
        if (!Array.isArray(events)) throw new Error('events payload is not a list');
        mounts.forEach(function (node) {
          render(rootDoc, node, events);
        });
      })
      .catch(function () {
        mounts.forEach(function (node) {
          statusLine(rootDoc, node, LOAD_ERROR);
        });
      });
  }

  return {
    LOAD_ERROR: LOAD_ERROR,
    EMPTY: EMPTY,
    pacificDate: pacificDate,
    dateBox: dateBox,
    selectEvents: selectEvents,
    coursesCta: coursesCta,
    homeCta: homeCta,
    render: render,
    mount: mount,
  };
});
