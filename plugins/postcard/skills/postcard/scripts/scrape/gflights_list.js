async () => {
  // Google Flights result list -> JSON string. Run it in the page with any browser tool's eval.
  // 1. Open a search URL from `gflights.py url` (it sets hl=en; the parser reads English labels).
  // 2. Wait until the list shows ("Other flights" or "Other departing flights").
  // 3. Run this. It clicks "View more flights" and every "Flight details" button, then reads the list.
  // 4. Save the output to a file and run: python3 gflights.py parse <file> --group out
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const label = (e) => e.getAttribute("aria-label") || e.textContent || "";
  const more = [...document.querySelectorAll("button,[role=button]")].find((b) => /^View more flights|^\d+ more flights/i.test(label(b).trim()));
  if (more) { more.click(); await sleep(2500); }
  const details = [...document.querySelectorAll("button[aria-label]")].filter((b) => /^Flight details/.test(b.getAttribute("aria-label")) && b.getAttribute("aria-expanded") !== "true");
  details.forEach((b) => b.click());
  if (details.length) await sleep(1500);
  const cur = new URL(location.href).searchParams.get("curr") || "[A-Z]{3}";
  const heading = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      for (let p = n.previousElementSibling; p; p = p.previousElementSibling) {
        const h = p.matches("h2,h3") ? p : p.querySelector("h2,h3");
        if (h) return h.textContent.trim();
      }
    }
    return "";
  };
  const rows = [];
  const seen = new Set();
  for (const li of document.querySelectorAll("li")) {
    const main = [...li.querySelectorAll("[aria-label]")].find((e) => /Leaves .* arrives/.test(e.getAttribute("aria-label") || "") && /flight/i.test(e.getAttribute("aria-label")));
    if (!main) continue;
    const lab = main.getAttribute("aria-label");
    if (seen.has(lab)) continue;
    seen.add(lab);
    const tim = li.querySelector("[data-travelimpactmodelwebsiteurl]");
    const text = li.innerText.replace(/\u00a0/g, " ");
    const flat = text.replace(/\s+/g, " ").trim();
    rows.push({
      label: lab,
      itinerary: tim ? (tim.getAttribute("data-travelimpactmodelwebsiteurl").split("itinerary=")[1] || "") : "",
      section: heading(li),
      price_text: (flat.match(new RegExp("Price unavailable|(?:" + cur + "|[€$£])\\s?\\d[\\d.,']*")) || [""])[0],
      flags: [...new Set((flat.match(/Self transfer|Separate tickets[^.]*|Change of airport|Overnight|Arrives next day|Bag fees may apply[^.]*|Carry-on bag not included|No carry-on|[^.]*does not include overhead bin access|Price unavailable/gi) || []))],
      details: text.slice(0, 2500),
    });
  }
  return JSON.stringify({
    url: location.href,
    title: document.title,
    currency: cur.length === 3 ? cur : "",
    seen: new Date().toISOString().slice(0, 10),
    expanded: details.length,
    rows,
  });
}
