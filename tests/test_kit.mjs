// Tests for the kit's pure parts. Run: node tests/test_kit.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { wallMs, makeClock } from '../plugins/postcard/skills/postcard/kit/time.js';
import { openTrip } from '../plugins/postcard/skills/postcard/kit/trip.js';
import { bill, fare } from '../plugins/postcard/skills/postcard/kit/bill.js';

const fixture = () => JSON.parse(readFileSync(new URL('./fixtures/minimal/trip.json', import.meta.url)));
const open = (raw) => openTrip({ raw, base: new URL('file:///nowhere/') });

test('a time that happens twice is the first one, as in Python fold=0', () => {
  // Zürich, 31 Oct 2027: the clocks go back from 03:00 CEST to 02:00 CET. 02:30 CEST is 00:30 UTC.
  assert.equal(new Date(wallMs('2027-10-31T02:30', 'Europe/Zurich')).toISOString(), '2027-10-31T00:30:00.000Z');
  // A time that does not exist (02:30 on 28 Mar 2027) uses the offset from before the change: 01:30 UTC.
  assert.equal(new Date(wallMs('2027-03-28T02:30', 'Europe/Zurich')).toISOString(), '2027-03-28T01:30:00.000Z');
  assert.equal(new Date(wallMs('2027-07-01T12:00', 'Europe/Zurich')).toISOString(), '2027-07-01T10:00:00.000Z');
});

test('far from UTC and half-hour changes agree with Python fold=0', () => {
  const iso = (w, tz) => new Date(wallMs(w, tz)).toISOString().slice(0, 16);
  assert.equal(iso('2027-04-04T02:30', 'Pacific/Auckland'), '2027-04-03T13:30');    // twice: the first
  assert.equal(iso('2027-09-26T02:30', 'Pacific/Auckland'), '2027-09-25T14:30');    // does not exist
  assert.equal(iso('2027-10-03T02:15', 'Australia/Lord_Howe'), '2027-10-02T15:45'); // half-hour jump forward
  assert.equal(iso('2027-04-04T01:45', 'Australia/Lord_Howe'), '2027-04-03T14:45'); // half-hour repeat
});

test('local() reads the wall clock across a clock change', () => {
  const c = makeClock('Europe/Zurich', '2027-03-28');
  assert.equal(c.local(3).hm, '04:00');   // three hours after midnight is 04:00 on the day the clocks go forward
});

test('a fare that cannot carry a bag is dropped, even when another bag is unknown', async () => {
  const raw = fixture();
  raw.journeys.find((j) => j.id === 'o1').offers[0].bags = { checked: 'none' };
  const T = await open(raw);
  assert.equal(T.bagCost(T.byId.o1.offers[0], { cabin: true, checked: 1 }), null);
  assert.equal(T.best(T.byId.o1, { bags: { cabin: true, checked: 1 } }), null);
});

test('unknown bag fees keep the known part and say they are unknown', async () => {
  const T = await open(fixture());
  const c = T.bagCost({ bags: { checked: 30 } }, { cabin: true, checked: 1 });
  assert.deepEqual(c, { extra: 30, known: false });
});

test('deals are priced and filtered with bags', async () => {
  const raw = fixture();
  raw.deals = [{ journeys: ['o1', 'r1'], price: 350, seller: 'Test Air', kind: 'operator', bags: { cabin: 'none', checked: 40 } }];
  const T = await open(raw), js = [T.byId.o1, T.byId.r1];
  assert.equal(T.price(js, { bags: { cabin: true } }).deal, null);                 // the deal has no cabin bag
  const p = T.price(js, { bags: { checked: 1 } });                                    // 350 + 2 x 40 = 430 > split
  assert.equal(p.deal, null);
  assert.equal(T.price(js).deal.total, 350);
  assert.equal(T.price(js).bagsKnown, true);
});

test('whereAt does not fail in a gap the data leaves', async () => {
  const T = await open(fixture());
  const o2 = T.byId.o2, mid = (o2.segments[0].b + o2.segments[1].a) / 2;
  assert.equal(T.whereAt([o2], mid).place, 'AMS');
});

test('shift() moves a journey by wall-clock days and marks its prices as read for another day', async () => {
  const T = await open(fixture());
  const j = T.journeys[0], m = await T.shift(j, 2);
  assert.equal(m.base, j.id); assert.equal(m.shifted, 2);
  assert.equal(m.depL.hm, j.depL.hm);
  assert.equal(Date.parse(m.depL.date) - Date.parse(j.depL.date), 2 * 86400000);
  assert.ok(m.offers.every((o) => o.basis === 'other-date' && o.read_for === j.raw.dep.slice(0, 10)));
  assert.equal(await T.shift(j, 0), j);
});

test('a window end without a time means the end of that day', async () => {
  const a = fixture(), b = fixture();
  a.window.end = a.window.end.slice(0, 10);
  const day = new Date(Date.parse(a.window.end) + 86400000).toISOString().slice(0, 10);
  b.window.end = day + 'T00:00';
  assert.equal((await open(a)).T1, (await open(b)).T1);
});

test('a bill keeps unread fees beside the total and splits what the agent books', async () => {
  const T = await open(fixture());
  const b = bill(T, [
    ...fare(T, T.byId.o1, T.byId.o1.offers[0], { cabin: 1, checked: 2 }, { ticket: 'out' }),  // cabin included, 2 x 30 read
    ...fare(T, T.byId.r1, T.byId.r1.offers[0], { cabin: 1 }, { ticket: 'back' }),             // cabin fee not listed
    ...fare(T, T.byId.r2, T.byId.r2.offers[0], { checked: 1 }, { ticket: 'alt', guess: { checked: { value: 40, basis: 'list' } } }),
    { what: 'Train to the airport', amount: 7, state: 'estimate', who: 'person' },
    { what: 'Hotel', amount: null, who: 'out' },
  ]);
  // 189 + 60 + 201 + 133 + 40 (estimate) + 7 (estimate)
  assert.equal(b.total, 630);
  assert.equal(b.approx, true);
  assert.deepEqual(b.unknown, [`cabin bag fee, ${T.places.LIS.label} → ${T.places.OSL.label}`]);
  assert.match(b.text(), /^≈ EUR 630 \+ cabin bag fee, .* not read \+ Hotel not counted$/);
  assert.equal(b.book.total, 623);
  assert.equal(b.tickets.length, 3);
  assert.equal(b.tickets[0].total, 249);
  assert.equal(b.tickets[1].known, false);
  assert.equal(b.others.length, 1);
  assert.equal(b.items().length, 4);
  assert.match(b.promptLines()[1], /^2\. .*\. Cabin bag fee, .* was not read: read it before you fill anything/);
  assert.doesNotMatch(b.promptLines().join('\n'), /\.\./);
  assert.match(b.promptLines()[0], /Legs: .*20[0-9][0-9] [0-9][0-9]:[0-9][0-9] → /);
});

test('a bill never shows an unread fare as 0, and names unread fees of one kind together', async () => {
  const T = await open(fixture());
  const noFare = { seller: 'SBB', bags_note: 'Two bags free.' };
  const b = bill(T, [
    ...fare(T, T.byId.o1, noFare, {}, { ticket: 'out' }),
    ...fare(T, T.byId.r1, T.byId.r1.offers[0], { cabin: 1 }, { ticket: 'back' }),
    ...fare(T, T.byId.r2, T.byId.r2.offers[0], { cabin: 1 }, { ticket: 'alt' }),
  ]);
  assert.equal(b.tickets[0].figure(), 'not read');
  assert.equal(b.items()[0].price, 'fare not read');
  assert.match(b.promptLines()[0], /Expected price: not known\. Bags: Two bags free\. The fare was not read/);
  assert.match(b.book.tail({ max: 3 }), /\+ 2 cabin bag fees not read/);
  assert.match(b.book.tail(), /\+ 2 more$/);
  assert.equal(bill(T, [{ what: 'Ferry', amount: 80, limit: 'from price; cabin type not read' }]).figure(), 'from EUR 80');
  assert.equal(bill(T, [{ what: 'Ferry', amount: 80, limit: 'from price; cabin type not read' }]).text(), 'from EUR 80 + cabin type not read');
  const none = bill(T, [{ what: 'Couchette', amount: null }]);
  assert.equal(none.figure(), 'not read');
  assert.equal(none.text(), 'not read');
});
