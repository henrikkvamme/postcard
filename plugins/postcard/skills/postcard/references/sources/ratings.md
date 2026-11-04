# Seller ratings

The page shows a star rating for each seller. Use Trustpilot scores. Skyscanner showed seller
ratings, but its bot check stops automated browsers.

## Order of work

1. Run `python3 ratings.py annotate <trip>/trip.json`. It fills `stars`, `reviews` and
   `rating_source` on each offer from the shipped table (`scripts/scrape/ratings.json`, read on
   2026-11-04) and your own cache. It prints the sellers it does not know.
2. For each unknown seller:
   1. Find its domain (such as `www.bravofly.com`).
   2. Run `python3 ratings.py fetch <domain>`. Trustpilot usually refuses plain HTTP clients
      (HTTP 403). Do not work around it.
   3. Read `https://www.trustpilot.com/review/<domain>` with a web fetch or web search tool.
   4. Store the score: `ratings.py set <domain> --name <Name> --kind agency --stars 4.1 --reviews 1200`.
   5. Run `annotate` again.
3. `ratings.py get <seller>` warns when a rating is older than 180 days. Read it again then.

## How to read the scores

- Airlines, railways and other operators score low on Trustpilot (often 1.1 to 1.6). Most of
  their reviews are complaints about delays. Compare an operator only with other operators.
- Compare an agency with other agencies. An agency with 2.5 stars and many reviews is a real
  warning sign (refund and change problems).
- Keep the low-rated sellers in the trip. The page explains why it did not pick them.
- A seller without a Trustpilot page gets no stars. Do not invent a score.
