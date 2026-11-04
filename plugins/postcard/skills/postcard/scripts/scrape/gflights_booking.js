() => {
  // Google Flights "Booking options" page -> JSON string. Run it after you click one flight
  // (one-way) or the outbound and the return (round trip), when the page shows "Booking options".
  // An airline with fare families (Basic, Standard, Plus) lists each fare with its bag rules.
  // An agency or a single-fare airline shows one price only; get its bag rules from the seller.
  // Then run: python3 gflights.py booking <file>
  const t = document.body.innerText.replace(/\u00a0/g, " ");
  const i = t.indexOf("Booking options");
  const j = t.indexOf("Price insights", i);
  return JSON.stringify({
    url: location.href,
    currency: new URL(location.href).searchParams.get("curr") || "",
    seen: new Date().toISOString().slice(0, 10),
    // The flight summary above "Booking options" names the flights, the times and the trip type.
    summary: t.slice(Math.max(0, i - 2500), i),
    text: i >= 0 ? t.slice(i, j > i ? j : i + 8000) : "",
  });
}
