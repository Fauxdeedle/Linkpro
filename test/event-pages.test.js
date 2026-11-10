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
