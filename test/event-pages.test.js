const test = require('node:test');
const assert = require('node:assert/strict');

const { catalogEvents, renderCatalog, renderEventPage } = require('../lib/event-pages');

function event(overrides) {
  return {
    slug: 'seminar-upper-limb',
    status: 'upcoming',
    pageMode: 'generated',
    listOn: ['courses', 'home'],
    sort: 20,
    productId: 'seminar-upper-limb',
    catalog: {
      month: 'JUN',
      days: '7–9',
      title: 'Fascia & 2TLS Treatment of the Upper Limb',
      location: 'Newport Beach, CA',
      summary: 'Treat the upper limb as an integrated fascial system.',
      priceLabel: '$1,500',
      ctaLabel: 'View training — Register',
    },
    hero: {
      eyebrow: 'In-person seminar',
      titleHtml: 'Fascia &amp; 2TLS Treatment of the <em>Upper Limb</em>',
      tagline: 'Treat the upper limb as an integrated fascial system.',
      metaHtml: '<strong>Newport Beach, CA</strong>',
    },
    details: { intro: 'Hands-on lab.' },
    instructor: { name: 'Dr. Jason Amstutz', bio: 'Pelvis-first methodology.' },
    gallery: [],
    cta: { title: 'Register for this training', body: 'Secure checkout.', buttonText: 'Register — $1,500' },
    ...overrides,
  };
}

test('upcoming page links registration to the Flute product', () => {
  const html = renderEventPage(event());
  assert.match(html, /Fascia &amp; 2TLS Treatment of the <em>Upper Limb<\/em>/);
  assert.match(html, /data-flute-product="seminar-upper-limb"/);
  assert.match(html, /href="\/checkout\.html\?product=seminar-upper-limb"/);
  assert.doesNotMatch(html, /class="gallery"/);
});

test('coming-soon page has no checkout link', () => {
  const html = renderEventPage(
    event({
      slug: 'cranial-diaphragm',
      status: 'coming-soon',
      productId: undefined,
      catalog: { title: 'Cranial Diaphragm feat. Scott Herrara', summary: 'Advanced cranial techniques.' },
    })
  );
  assert.doesNotMatch(html, /checkout\.html/);
  assert.doesNotMatch(html, /data-flute-product/);
  assert.match(html, /Coming soon/);
});

test('empty gallery is omitted and a provided gallery is rendered', () => {
  assert.doesNotMatch(renderEventPage(event({ gallery: [] })), /class="gallery"/);
  const html = renderEventPage(
    event({
      gallery: [{ src: '/images/hero-fascia.webp', alt: 'Fascia treatment' }],
    })
  );
  assert.match(html, /class="gallery"/);
  assert.match(html, /src="\/images\/hero-fascia\.webp"/);
  assert.match(html, /alt="Fascia treatment"/);
});

test('ended events stay on a page and leave the catalog', () => {
  const ended = event({ status: 'ended', sort: 5 });
  const current = event({ slug: 'seminar-lower-limb', sort: 40 });
  const html = renderEventPage(ended);
  assert.match(html, /This training has ended/);
  assert.doesNotMatch(html, /data-flute-product/);
  assert.doesNotMatch(html, /checkout\.html/);

  const listed = catalogEvents([ended, current], 'home');
  assert.deepEqual(listed.map((item) => item.slug), ['seminar-lower-limb']);

  const cards = renderCatalog([ended, current], 'courses', 'courses');
  assert.match(cards, /seminar-lower-limb/);
  assert.doesNotMatch(cards, /seminar-upper-limb/);
  assert.doesNotMatch(cards, /checkout\.html/);
});

test('sections render headings, bullets, facts, and an in-page register link', () => {
  const html = renderEventPage(
    event({
      details: {
        label: '',
        heading: '',
        intro: ['Most treatment starts local.'],
        registerLink: 'Register here.',
        sections: [
          {
            heading: "What you'll learn",
            blocks: [
              {
                heading: 'Fascia normalization',
                paragraphs: ['Normalization is not soft tissue work.'],
                bullets: ['How to identify the true fascial chains'],
                closing: ['The sacrotuberous ligament and the thoracolumbar fascia are linked.'],
              },
            ],
          },
          {
            heading: 'Details',
            facts: [{ label: 'Location', text: '3134 Airway Ave, Costa Mesa, CA 92626' }],
          },
        ],
      },
    })
  );
  assert.match(html, /What you'll learn/);
  assert.match(html, /<h3>Fascia normalization<\/h3>/);
  assert.match(html, /<li>How to identify the true fascial chains<\/li>/);
  assert.match(html, /<dt>Location<\/dt><dd>3134 Airway Ave, Costa Mesa, CA 92626<\/dd>/);
  assert.match(html, /<a href="#register">Register here\.<\/a>/);
  assert.doesNotMatch(html, /Hands-on intensive/);
});

test('section text is escaped', () => {
  const html = renderEventPage(
    event({
      details: {
        sections: [
          {
            heading: '<script>',
            bullets: ['<b>fiber</b>'],
            facts: [{ label: 'Tuition', text: '$1,500 & day one' }],
          },
        ],
      },
    })
  );
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;b&gt;fiber&lt;\/b&gt;/);
  assert.match(html, /\$1,500 &amp; day one/);
  assert.doesNotMatch(html, /<h2><script>/);
  assert.doesNotMatch(html, /<b>fiber<\/b>/);
});

test('homepage feature row shows the first three live events', () => {
  const retreat = event({
    slug: 'nicolette-david-retreat',
    listOn: ['events'],
    sort: 10,
    productId: undefined,
    catalog: {
      month: 'NOV',
      days: '11–15',
      title: 'Live By The Sun, Love By The Moon — Hatha Yoga Retreat',
      location: 'El Pescadero, Baja · with Nicolette David',
      summary: 'Five days at Soluna Estate.',
      priceLabel: 'From $1,350',
      ctaLabel: 'View retreat — Register',
    },
  });
  const cranial = event({
    slug: 'cranial-diaphragm',
    status: 'coming-soon',
    productId: undefined,
    sort: 30,
    catalog: {
      month: 'AUG',
      days: '1–5',
      title: 'Cranial Diaphragm feat. Scott Herrara',
      location: 'Dallas, TX',
      summary: 'Advanced cranial techniques.',
    },
  });
  const lower = event({ slug: 'seminar-lower-limb', sort: 40 });
  const ended = event({ slug: 'old-seminar', status: 'ended', sort: 1 });
  const cards = renderCatalog([ended, lower, cranial, event(), retreat], 'events', 'feature', { limit: 3 });

  assert.match(cards, /live-event-card/);
  assert.match(cards, /href="\/nicolette-david-retreat"/);
  assert.match(cards, /href="\/seminar-upper-limb"/);
  assert.match(cards, /href="\/cranial-diaphragm"/);
  assert.match(cards, /Learn more/);
  assert.match(cards, /El Pescadero, Baja/);
  assert.match(cards, /<\/h3>\s*<p class="live-event-card__meta">El Pescadero, Baja/);
  assert.doesNotMatch(cards, /seminar-lower-limb/);
  assert.doesNotMatch(cards, /old-seminar/);
  assert.doesNotMatch(cards, /checkout\.html/);
  assert.doesNotMatch(cards, /\$1,500/);
  assert.doesNotMatch(cards, /More events coming soon/);
});

test('homepage feature row fills open slots with a coming soon card', () => {
  const cards = renderCatalog([event(), event({ slug: 'seminar-trunk-pelvis', sort: 30 })], 'events', 'feature', {
    limit: 3,
  });
  const soon = cards.match(/live-event-card--soon/g) || [];
  assert.equal(soon.length, 1);
  assert.match(cards, /More events coming soon/);
  assert.match(cards, /href="\/live-events"/);
  assert.match(cards, /See all events/);

  const one = renderCatalog([event()], 'events', 'feature', { limit: 3 });
  assert.equal((one.match(/live-event-card--soon/g) || []).length, 2);

  const none = renderCatalog([], 'events', 'feature', { limit: 3 });
  assert.equal((none.match(/live-event-card--soon/g) || []).length, 3);
  assert.doesNotMatch(none, /Learn more/);
});

test('an active sale shows the percent, struck price, and sale price', () => {
  const html = renderEventPage(
    event({
      price: 1500,
      sale: { percent: 20, endsOn: '2099-01-01' },
    })
  );
  assert.match(html, /class="sale-banner"/);
  assert.match(html, /Sale!/);
  assert.match(html, /event-hero__off">20% off/);
  assert.match(html, /event-hero__amounts"><s class="event-hero__was">\$1,500<\/s>/);
  assert.match(html, /event-hero__now">\$1,200</);
  assert.match(html, /data-sale-ends="2099-01-01"/);
  assert.match(html, /Register — \$1,200/);
  assert.match(html, /data-sale-list="Register — \$1,500"/);
  assert.match(html, /src="\/js\/event-sale.js"/);
  assert.match(html, /Hands-on lab\./);
});

test('a sale without an end date stays on and has no expiry attribute', () => {
  const html = renderEventPage(event({ price: 1500, sale: { percent: 10 } }));
  assert.match(html, /10% off/);
  assert.match(html, /\$1,350/);
  assert.doesNotMatch(html, /data-sale-ends/);
});

test('an expired sale renders the list price', () => {
  const html = renderEventPage(
    event({
      price: 1500,
      sale: { percent: 20, endsOn: '2000-01-01' },
    })
  );
  assert.doesNotMatch(html, /20% off/);
  assert.doesNotMatch(html, /sale-banner/);
  assert.doesNotMatch(html, /event-hero__was/);
  assert.match(html, /Register — \$1,500/);
});

test('catalog cards show a sale and a ranged price label is left alone', () => {
  const onSale = event({ price: 1500, sale: { percent: 20, endsOn: '2099-01-01' } });
  const cards = renderCatalog([onSale], 'events', 'courses');
  assert.match(cards, /class="sale-banner"/);
  assert.match(cards, /seminar-price__off">20% off/);
  assert.match(cards, /seminar-price__was">\$1,500/);
  assert.match(cards, /seminar-price__now">\$1,200/);

  const feature = renderCatalog([onSale], 'events', 'feature', { limit: 3 });
  assert.match(feature, /class="sale-banner"/);
  assert.match(feature, /live-event-card__off">20% off/);
  assert.match(feature, /live-event-card__amounts/);
  assert.match(feature, /live-event-card__was">\$1,500/);
  assert.match(feature, /live-event-card__now">\$1,200/);

  const plain = renderCatalog([event()], 'events', 'feature', { limit: 3 });
  assert.doesNotMatch(plain, /live-event-card__sale/);
  assert.doesNotMatch(plain, /\$1,500/);

  const ranged = event({
    slug: 'nicolette-david-retreat',
    price: undefined,
    productId: undefined,
    sale: { percent: 20 },
    catalog: {
      month: 'NOV',
      days: '11–15',
      title: 'Retreat',
      priceLabel: 'From $1,350',
      ctaLabel: 'View retreat — Register',
    },
  });
  const rangedCards = renderCatalog([ranged], 'events', 'courses');
  assert.match(rangedCards, /From \$1,350/);
  assert.doesNotMatch(rangedCards, /% off/);
  assert.doesNotMatch(rangedCards, /seminar-price__was/);
});

test('coming-soon catalog card links the title and does not sell a seat', () => {
  const card = renderCatalog(
    [event({ slug: 'cranial-diaphragm', status: 'coming-soon', productId: undefined, sort: 30 })],
    'courses',
    'courses'
  );
  assert.match(card, /<a href="\/cranial-diaphragm">/);
  assert.match(card, /Coming Soon/);
  assert.doesNotMatch(card, /seminar-cta/);
  assert.doesNotMatch(card, /checkout\.html/);
});
