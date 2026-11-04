async () => {
  // Set the passengers on a Google Flights result page. The words "for 2 adults and 2 children" in
  // the q= URL gave empty lists on 2026-11-04, so search for 1 adult, then run this.
  // Edit the two numbers. Children are aged 2 to 11; Google asks for infants separately.
  const ADULTS = 2, CHILDREN = 2;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const vis = (b) => b.getBoundingClientRect().height > 0;
  const btn = (label) => [...document.querySelectorAll("button")].find((b) => vis(b) && (b.getAttribute("aria-label") || "").startsWith(label));
  const open = [...document.querySelectorAll("button[aria-label]")].find((b) => vis(b) && /passengers?, change number of passengers/.test(b.getAttribute("aria-label")));
  if (!open) return JSON.stringify({ error: "no passenger button; open a result page first" });
  open.click();
  await sleep(600);
  for (let i = 1; i < ADULTS; i++) { btn("Add adult")?.click(); await sleep(150); }
  for (let i = 0; i < CHILDREN; i++) { btn("Add child aged 2 to 11")?.click(); await sleep(150); }
  [...document.querySelectorAll("button")].find((b) => vis(b) && b.textContent.trim() === "Done")?.click();
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    const m = document.body.innerText.match(/Prices include required taxes \+ fees for (\d+) passengers/);
    if (m && +m[1] === ADULTS + CHILDREN) return JSON.stringify({ ok: true, passengers: +m[1], url: location.href });
  }
  return JSON.stringify({ ok: false, url: location.href });
}
