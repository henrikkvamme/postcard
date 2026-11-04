// Time on a postcard page.
// Booking sites show local wall times. The page turns each one into a number: hours since 00:00 of the
// window's first day, in the trip's clock zone. Every bar, cursor and sum uses these hours.

const FMT = {};
const fmt = (tz) => FMT[tz] ||= new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', weekday: 'short',
  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const parts = (ms, tz) => Object.fromEntries(fmt(tz).formatToParts(ms).map((p) => [p.type, p.value]));
const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

// Minutes that the zone is ahead of UTC at this instant.
export const offsetMin = (ms, tz) => { const p = parts(ms, tz);
  return (Date.UTC(+p.year, MON[p.month], +p.day, +p.hour, +p.minute) - Math.floor(ms / 60000) * 60000) / 60000; };

// 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM', read as a wall clock in tz -> epoch ms. Two passes settle the offset across a DST change.
export function wallMs(iso, tz) {
  const [d, tm = '00:00'] = iso.split('T'), [y, mo, da] = d.split('-').map(Number), [h, mi] = tm.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, da, h, mi);
  return guess - offsetMin(guess - offsetMin(guess, tz) * 60000, tz) * 60000;
}

// A clock for one trip. tz is the zone of the page's timeline; start is the window's first day.
export function makeClock(tz, start) {
  const epoch = wallMs(start.slice(0, 10), tz);
  const H = (iso, zone = tz) => (wallMs(iso, zone) - epoch) / 3600000;
  const ms = (T) => epoch + T * 3600000;
  // Hours -> what a wall clock in that zone shows.
  const local = (T, zone = tz) => { const p = parts(ms(T), zone);
    return { wd: p.weekday, day: +p.day, mon: p.month, month: MON[p.month], year: +p.year, hm: `${p.hour}:${p.minute}`, h: +p.hour + p.minute / 60,
      date: `${p.year}-${String(MON[p.month] + 1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}` }; };
  const abbr = (zone = tz, T = 0) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, timeZoneName: 'short' })
    .formatToParts(ms(T)).find((p) => p.type === 'timeZoneName').value;
  // Calendar days between two hour marks, in the clock zone: [{ s, e, date, label, wd, day, mon }].
  const days = (T0, T1) => { const out = [];
    for (let i = -1; i < 4000; i++) { const l = local(i * 24 + 12), s = H(l.date), e = H(l.date + 'T23:59') + 1 / 60;
      if (e <= T0) continue; if (s >= T1) break; if (!out.length || out[out.length - 1].date !== l.date) out.push({ s, e, date: l.date, wd: l.wd, day: l.day, mon: l.mon, label: `${l.wd} ${l.day}` }); }
    return out; };
  // Hours difference between two zones, at T.
  const shift = (a, b, T = 0) => (offsetMin(ms(T), a) - offsetMin(ms(T), b)) / 60;
  return { tz, epoch, H, ms, local, abbr, days, shift };
}

// 95 -> '1h 35m'. 0.5 -> '30m'. 50 -> '2d 2h' when days is true.
export function fmtDur(h, { days = false } = {}) {
  const m = Math.round(h * 60);
  if (days && m >= 1440) { const d = Math.floor(m / 1440), r = Math.round((m % 1440) / 60); return r ? `${d}d ${r}h` : `${d}d`; }
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
