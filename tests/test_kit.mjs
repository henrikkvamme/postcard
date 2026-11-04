// Tests for the kit's pure parts. Run: node tests/test_kit.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { wallMs, makeClock } from '../plugins/postcard/skills/postcard/kit/time.js';
import { openTrip } from '../plugins/postcard/skills/postcard/kit/trip.js';

const fixture = () => JSON.parse(readFileSync(new URL('./fixtures/minimal/trip.json', import.meta.url)));
const open = (raw) => openTrip({ raw, base: new URL('file:///nowhere/') });

test('a time that happens twice is the first one, as in Python fold=0', () => {
  // Zürich, 31 Oct 2027: the clocks go back from 03:00 CEST to 02:00 CET. 02:30 CEST is 00:30 UTC.
  assert.equal(new Date(wallMs('2027-10-31T02:30', 'Europe/Zurich')).toISOString(), '2027-10-31T00:30:00.000Z');
  // A time that does not exist (02:30 on 28 Mar 2027) uses the offset from before the change: 01:30 UTC.
  assert.equal(new Date(wallMs('2027-03-28T02:30', 'Europe/Zurich')).toISOString(), '2027-03-28T01:30:00.000Z');
  assert.equal(new Date(wallMs('2027-07-01T12:00', 'Europe/Zurich')).toISOString(), '2027-07-01T10:00:00.000Z');
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
