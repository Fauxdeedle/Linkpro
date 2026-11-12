const fs = require('fs');
const path = require('path');
const { esc } = require('./event-pages');
const { SLUG_RE } = require('./event-store');
const { products } = require('../server/config/products');

const MONTHS = {
  january: 'JAN',
  february: 'FEB',
  march: 'MAR',
  april: 'APR',
  may: 'MAY',
  june: 'JUN',
  july: 'JUL',
  august: 'AUG',
  september: 'SEP',
  october: 'OCT',
  november: 'NOV',
  december: 'DEC',
  jan: 'JAN',
  feb: 'FEB',
  mar: 'MAR',
  apr: 'APR',
  jun: 'JUN',
  jul: 'JUL',
  aug: 'AUG',
  sep: 'SEP',
  oct: 'OCT',
  nov: 'NOV',
  dec: 'DEC',
};

const MONTH_NAMES = {
  JAN: 'January',
  FEB: 'February',
  MAR: 'March',
  APR: 'April',
  MAY: 'May',
  JUN: 'June',
  JUL: 'July',
  AUG: 'August',
  SEP: 'September',
  OCT: 'October',
  NOV: 'November',
  DEC: 'December',
};

const RESERVED_SLUGS = new Set([
  'about',
  'admin',
  'api',
  'assets',
  'blog',
  'checkout',
  'classes',
  'content',
  'courses',
  'css',
  'index',
  'js',
  'lib',
  'media-kit',
  'scripts',
  'server',
  'services',
  'test',
]);

function cleanLine(value, max) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function formatUsd(amount) {
  return `$${Number(amount).toLocaleString('en-US')}`;
}

function eventDateLabel(event) {
  if (typeof event.dateLabel === 'string' && event.dateLabel.trim()) {
    return event.dateLabel.trim();
  }
  const month = event.catalog?.month || '';
  const days = event.catalog?.days || '';
  const monthName = MONTH_NAMES[String(month).toUpperCase()] || month;
  return [monthName, days].filter(Boolean).join(' ');
}

function eventCopy(event) {
  if (typeof event.body === 'string') return event.body.replace(/\r\n/g, '\n');

  const details = event.details || {};
  const parts = [];
  const intro = details.intro;
  if (Array.isArray(intro)) parts.push(intro.filter(Boolean).join('\n\n'));
  else if (intro) parts.push(String(intro));

  for (const item of Array.isArray(details.schedule) ? details.schedule : []) {
    if (typeof item === 'string') {
      parts.push(item);
      continue;
    }
    const line = [item?.strong, item?.text].filter(Boolean).join('\n');
    if (line) parts.push(line);
  }

  for (const line of Array.isArray(details.logistics) ? details.logistics : []) {
    if (line) parts.push(String(line));
  }

  return parts.filter(Boolean).join('\n\n');
}

function summaryFromCopy(copy) {
  const first = String(copy)
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .find(Boolean);
  if (!first) return '';
  const sentence = first.split(/(?<=[.!?])\s/)[0];
  return sentence.slice(0, 220);
}

function parseDateLabel(label) {
  const monthWord = String(label).match(/[A-Za-z]+/);
  const month = monthWord ? MONTHS[monthWord[0].toLowerCase()] || '' : '';
  const days = [...String(label).matchAll(/\d{1,2}/g)].map((match) => match[0]);
  let dayLabel = '';
  if (days.length === 1) dayLabel = days[0];
  else if (days.length > 1) dayLabel = `${days[0]}–${days[days.length - 1]}`;
  return { month, days: dayLabel };
}

function slugify(name) {
  return String(name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

function uniqueSlug(base, events) {
  let slug = base;
  let n = 2;
  const taken = new Set(events.map((event) => event.slug));
  while (taken.has(slug)) {
    const suffix = `-${n}`;
    slug = `${base.slice(0, 60 - suffix.length)}${suffix}`;
    n += 1;
  }
  return slug;
}

function readPrice(value) {
  if (value === '' || value === null || value === undefined) return { price: null };
  const amount = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(amount) || amount <= 0 || amount > 100000) {
    return { error: 'Enter the price in whole dollars.' };
  }
  return { price: amount };
}

function defaultInstructor(root) {
  const templatePath = path.join(root, 'content', 'events', '_template.json');
  if (fs.existsSync(templatePath)) {
    try {
      const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
      if (template.instructor && template.instructor.name) return template.instructor;
    } catch {
      // Fall through to the built-in instructor.
    }
  }
  return {
    label: 'Your instructor',
    name: 'Dr. Jason Amstutz',
    role: 'Founder & Lead Practitioner',
    image: '/assets/about/dr-jason-amstutz-portrait.png',
    imageAlt: 'Dr. Jason Amstutz',
    bio: 'Dr. Amstutz has spent his career studying how the body works as a single system, and why treating it in pieces so often fails. Under years of mentorship with osteopath Guy Voyer, DO, he developed a pelvis-first methodology that addresses musculoskeletal, visceral, and neurological function together rather than as separate problems.',
  };
}

function applyEventFields(event, input, { isNew }) {
  const name = cleanLine(input.name, 140);
  if (!name) return { error: 'Enter an event name.' };

  const date = cleanLine(input.date, 80);
  if (!date) return { error: 'Enter the event date.' };

  const copy = String(input.copy ?? '').replace(/\r\n/g, '\n').slice(0, 20000);
  const priced = readPrice(input.price);
  if (priced.error) return priced;

  const previousTitle = event.catalog?.title || '';
  event.catalog = event.catalog || {};
  event.meta = event.meta || {};
  event.hero = event.hero || {};
  event.details = event.details || {};
  event.cta = event.cta || {};

  event.catalog.title = name;
  if (isNew || name !== previousTitle) {
    event.meta.title = `${name} — LINK Pro`;
    event.hero.titleHtml = esc(name);
  }
  if (!event.hero.eyebrow) event.hero.eyebrow = 'In-person seminar';

  const previousDate = eventDateLabel(event);
  if (isNew || date !== previousDate) {
    event.dateLabel = date;
    const parsed = parseDateLabel(date);
    if (parsed.month) event.catalog.month = parsed.month;
    if (parsed.days) event.catalog.days = parsed.days;
    const location = event.catalog.location || '';
    event.hero.metaHtml =
      esc(date) + (location ? `<br><strong>${esc(location)}</strong>` : '');
  }

  const previousCopy = eventCopy(event).trim();
  if (isNew || copy.trim() !== previousCopy) {
    event.body = copy;
    event.details.intro = copy;
    const summary = summaryFromCopy(copy);
    if (summary) {
      event.catalog.summary = summary;
      event.meta.description = summary;
      if (isNew || !event.hero.tagline) event.hero.tagline = summary;
      if (isNew || !event.cta.body) event.cta.body = summary;
    }
  }

  if (priced.price) {
    const label = formatUsd(priced.price);
    event.price = priced.price;
    event.catalog.priceLabel = label;
    event.cta.buttonText = `Register — ${label}`;
    if (!event.cta.title) event.cta.title = 'Register for this training';
    if (!event.catalog.ctaLabel) event.catalog.ctaLabel = 'View training — Register';
    if (Array.isArray(event.details.logistics)) {
      event.details.logistics = event.details.logistics.map((line) =>
        /^\$[\d,]+$/.test(String(line).trim()) ? label : line
      );
    }
    if (!event.productId) event.productId = event.slug;
    if (event.status === 'coming-soon') event.status = 'upcoming';
  } else {
    delete event.price;
    delete event.productId;
    delete event.catalog.priceLabel;
    if (event.cta) event.cta.buttonText = 'Register';
    if (Array.isArray(event.details.logistics)) {
      event.details.logistics = event.details.logistics.filter(
        (line) => !/^\$[\d,]+$/.test(String(line).trim())
      );
    }
    if (event.status === 'upcoming') event.status = 'coming-soon';
  }

  return { event };
}

function createEventRecord(events, input, root) {
  const name = cleanLine(input.name, 140);
  if (!name) return { error: 'Enter an event name.' };
  const slug = uniqueSlug(slugify(name), events);
  if (!SLUG_RE.test(slug) || RESERVED_SLUGS.has(slug) || products[slug]) {
    return { error: 'Choose a different event name.' };
  }

  const sort =
    events.reduce((max, event) => Math.max(max, Number(event.sort) || 0), 0) + 10;
  const event = {
    slug,
    status: 'coming-soon',
    pageMode: 'generated',
    listOn: ['courses', 'home'],
    sort,
    catalog: {
      month: '',
      days: '',
      title: name,
      location: '',
      summary: '',
      ctaLabel: 'View training — Register',
    },
    meta: { title: `${name} — LINK Pro`, description: '' },
    hero: {
      eyebrow: 'In-person seminar',
      titleHtml: esc(name),
      tagline: '',
      metaHtml: '',
    },
    details: {
      label: 'The training',
      heading: 'Hands-on intensive',
      intro: '',
      logisticsLabel: 'Details',
      logistics: [],
    },
    instructor: defaultInstructor(root),
    gallery: [],
    cta: {
      title: 'Register for this training',
      body: '',
      buttonText: 'Register',
    },
  };

  return applyEventFields(event, input, { isNew: true });
}

function publicEvent(event) {
  const price = Number(event.price);
  const hasPrice = Number.isInteger(price) && price > 0;
  return {
    slug: event.slug,
    name: event.catalog?.title || event.slug,
    date: eventDateLabel(event),
    price: hasPrice ? price : null,
    priceLabel: hasPrice ? formatUsd(price) : '',
    copy: eventCopy(event),
    checkout: hasPrice,
  };
}

module.exports = {
  RESERVED_SLUGS,
  applyEventFields,
  createEventRecord,
  eventCopy,
  eventDateLabel,
  formatUsd,
  parseDateLabel,
  publicEvent,
  slugify,
};
