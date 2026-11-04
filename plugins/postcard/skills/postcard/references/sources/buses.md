# Buses

FlixBus has an open search API with prices. Transitous has the other coaches and the local
transfer buses, without prices. Checked on 2026-11-04.

## FlixBus and FlixTrain

1. Run `python3 flixbus.py search Hamburg Berlin --date 2027-05-21 --adults 2 --currency EUR
   --prefix f --paths <trip>/paths --out flix.json`.
   - The price is for the whole group, with the platform fee.
   - `--direct` keeps only rides without a change.
   - A bus that stops at several stops in the destination city is one journey. `--all-stops`
     keeps one journey for each stop.
2. The helper places each stop with the FlixBus station search (matched by station id). It
   draws an OSRM road line for each bus leg and a Transitous line for each FlixTrain leg.
3. Offers have `bags_note`: 1 hand luggage up to 7 kg and 1 hold bag up to 20 kg are included.
   `seats_left` is the number of seats at that price.
4. FlixBus sells about 6 months ahead. On 2026-11-04, May 2027 was on sale.

## Other coaches and transfer buses

1. Use `transitous.py plan` without `--modes`. It includes coaches (BlaBlaCar Bus, regional
   lines such as the Savoie ski buses) and the local bus at the end of a train journey.
2. These have no price. Read it on the operator's site, or keep the journey with a warning.
3. Private ski shuttles (such as Geneva airport transfers) are not in the feeds. Read them on the
   operator's site and add the journey by hand, with a road line from `geometry.py road`.

## Site status (2026-11-04)

| Site | Result |
| --- | --- |
| FlixBus API (global.api.flixbus.com) | Works, no key. |
| BlaBlaCar Bus | In Transitous. Prices not tried. |
