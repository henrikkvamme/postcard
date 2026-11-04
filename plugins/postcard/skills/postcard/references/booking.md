# Booking

The person picks a trip on the page and clicks Book. You fill the booking in their browser and stop
on the payment page. They pay. Then you do the work after booking.

## The rule

**Never pay.** Do not click the final pay or purchase button. Do not type card numbers, security
codes or bank details. Stop when the next step takes money, and tell the person.

## The queue

`serve.py` saves each Book click as one JSON file in the queue folder
(`~/.local/state/postcard/checkout`, or `POSTCARD_QUEUE`). A job has an `id`, a `status`, a `log`,
the chosen `trip` and a `prompt` in plain words.

| Status | Set by | Meaning |
| --- | --- | --- |
| `pending` | page | The person clicked Book. |
| `claimed` | waiter | You picked it up. |
| `working` | you | You are filling the booking. |
| `at-payment` | you | You stopped on the payment page. The page turns the button green. |
| `booked` | page | The person paid and clicked "I've paid". |
| `done` | you | The work after booking is finished. |
| `failed` | you | You stopped. Say why in the note. |

## Steps

1. **Wait.** Before the person clicks Book, start the waiter as a background command, so your
   harness wakes you when it exits:

   ```sh
   python3 <skill>/scripts/wait_checkout.py 7000
   ```

   It prints the claimed job and exits 0, or exits 3 after the timeout. Start it again after each
   job.

2. **Report as you go.** Each report adds a line to the page's checkout sheet:

   ```sh
   curl -s -X POST localhost:4471/api/checkout/<id>/status \
     -H 'content-type: application/json' -d '{"status":"working","note":"Finnair: flights chosen, filling passenger details."}'
   ```

   Only a request from the same machine can report.

3. **Book** (`"wake": "book"`). Open the seller from the job in the person's browser. Choose the
   exact journeys: flights, trains or ferries. Fill the passenger details from the browser's saved profile or the person's
   password manager. Choose the fare that matches the brief, for example with a cabin bag. Check
   the price. If it is more than 15% above the expected price, stop and report `failed` with both
   prices. On the payment page, report `at-payment` with the final price, and tell the person.
   Book both directions before you report `at-payment` when they are separate tickets. Report
   `at-payment` once per payment page.

4. **After booking** (`"wake": "after-booking"`). The person paid. Then:

   - Find the confirmation mails. Record the booking references (PNRs) and the order numbers.
   - Check that the tickets are issued. An agency can take hours. If a ticket is not issued, say so.
   - Add each journey to the person's calendar, with the flight or train numbers and the booking
     reference.
   - Set reminders for online check-in. For flights it usually opens 24 to 36 hours before
     departure. Rail and ferry tickets often need no check-in; say so.
   - Report `done` with a one-line summary.

   Store booking references where the person keeps such things, not in `trip.json`.

## The page's side

The page calls `checkout()` from `kit/checkout.js` (see kit.md). Its `prompt` is the request you
get in the job, in plain words: what to book, from which seller, the expected price, the bags and
the stop rule. Write it so that you could book from it alone.

## Without a server

When the page cannot reach `serve.py`, the Book button copies the booking request to the
clipboard. The person can paste it to you.
