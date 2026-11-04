async () => {
  // Google Flights "Date grid" -> JSON string. Open a ROUND-TRIP search first (gflights.py url ... --back).
  // It opens the grid, waits for the prices and reads every cell: 7 departure days x 7 return days
  // around the dates in the search. Then run: python3 gflights.py dates <file>
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const visible = (d) => d.getBoundingClientRect().height > 0;
  const grid = () => [...document.querySelectorAll("[role=dialog]")].find((d) => visible(d) && /Price graph/.test(d.innerText));
  if (!grid()) {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Date grid");
    if (!b) return JSON.stringify({ error: "no Date grid button; is this a round-trip result page?" });
    b.click();
  }
  // Cells say "Loading prices, Jan 20 to Jan 27" until the prices come. After many searches in a
  // row Google can leave them loading: then wait some minutes and try again. Do not reload in a loop.
  let cells = [];
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const d = grid();
    cells = d ? [...d.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label")).filter((a) => /\w{3} \d{1,2} to \w{3} \d{1,2}/.test(a)) : [];
    if (cells.length >= 49 && !cells.some((a) => /^Loading/.test(a))) break;
  }
  const loading = cells.filter((a) => /^Loading/.test(a)).length;
  return JSON.stringify({
    url: location.href,
    currency: new URL(location.href).searchParams.get("curr") || "",
    seen: new Date().toISOString().slice(0, 10),
    loading, // cells that still had no price when the script gave up
    cells, // such as "CHF 137, Jan 6 to Jan 13"; a cell with no price says "No flights" or has no number
  });
}
