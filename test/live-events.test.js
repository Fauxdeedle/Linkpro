const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const {
  pacificDate,
  dateBox,
  selectEvents,
  coursesCta,
  homeCta,
} = require('../js/live-events');

const catalog = JSON.parse(readFileSync(join(__dirname, '../content/events.json'), 'utf8'));

describe('live events', () => {
  it('uses the Pacific calendar date', () => {
    assert.equal(pacificDate(new Date('2026-11-16T07:30:00.000Z')), '2026-11-15');
    assert.equal(pacificDate(new Date('2026-11-16T08:30:00.000Z')), '2026-11-16');
  });

  it('keeps an event through its end date, then drops it', () => {
    const during = selectEvents(catalog, new Date('2026-11-16T07:30:00.000Z'), {});
    const after = selectEvents(catalog, new Date('2026-11-16T08:30:00.000Z'), {});
    assert.equal(during.some((event) => event.id === 'nicolette-david-retreat'), true);
    assert.equal(after.some((event) => event.id === 'nicolette-david-retreat'), false);
  });

  it('sorts by start date and limits the homepage', () => {
    const courses = selectEvents(catalog, new Date('2026-11-04T18:00:00.000Z'), {}).map((event) => event.id);
    const home = selectEvents(catalog, new Date('2026-11-04T18:00:00.000Z'), { home: true }).map(
      (event) => event.id
    );
    assert.deepEqual(courses, [
      'nicolette-david-retreat',
      'trunk-pelvis',
      'upper-limb',
      'cranial-diaphragm',
      'lower-limb',
    ]);
    assert.deepEqual(home, ['trunk-pelvis', 'upper-limb', 'cranial-diaphragm', 'lower-limb']);
  });

  it('builds the month and day box from the date range', () => {
    assert.deepEqual(dateBox('2026-11-11', '2026-11-15'), { month: 'NOV', days: '11\u201315' });
    assert.deepEqual(dateBox('2027-08-01', '2027-08-05'), { month: 'AUG', days: '1\u20135' });
    assert.deepEqual(dateBox('2026-11-28', '2026-12-02'), { month: 'NOV', days: '28\u2013Dec 2' });
  });

  it('skips a row with a bad date instead of failing the list', () => {
    const events = selectEvents(
      [{ id: 'bad', title: 'Bad', location: '', summary: '', start: '2026-02-31', end: '2026-03-01' }, catalog[1]],
      new Date('2026-11-04T18:00:00.000Z'),
      {}
    );
    assert.deepEqual(
      events.map((event) => event.id),
      ['trunk-pelvis']
    );
  });

  it('labels checkout and page links', () => {
    const retreat = catalog.find((event) => event.id === 'nicolette-david-retreat');
    const upper = catalog.find((event) => event.id === 'upper-limb');
    const cranial = catalog.find((event) => event.id === 'cranial-diaphragm');
    assert.equal(coursesCta(retreat), 'View retreat \u2014 Register');
    assert.equal(coursesCta(upper), 'Register \u2014 $1,500');
    assert.equal(homeCta(upper), 'Register');
    assert.equal(coursesCta(cranial), '');
    assert.equal(homeCta(cranial), '');
  });
});
