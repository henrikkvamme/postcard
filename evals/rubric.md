# Rubric

Score each criterion from 0 to 10. A page is **great** when every criterion is 8 or more. Give
evidence for each score: what you saw, where (a screenshot, a probe line, a file and line).
Score what the page does, not what its code intends.

| # | Criterion | 10 looks like | 5 looks like |
| --- | --- | --- | --- |
| 1 | Truth | Every price, time and fact on the page comes from the data, with its source. Unknowns (a bag fee, an estimate) are marked as such. No invented numbers. | Mostly right, but a number has no source, or an estimate looks like a fact. |
| 2 | Answers the question | The main view answers the scenario's question in five seconds. The best option and why it is best are obvious. Every "must" in evals.json is met. | Shows the data, but the person must work out the answer. A "must" is missing. |
| 3 | Model | Options are built correctly (legs, stays, groups, connections, passengers). The ranking is sensible for this person, and the page says what it values in one line. | Options are right but the ranking ignores a stated priority, or the costs are partial. |
| 4 | Map | Each mode is drawn the right way on its real line. The chosen option is clear; both ends are on screen and not under the HUD at desktop and phone width. Labels and drawings do not collide with the route. | Routes are drawn, but a guessed straight line, a hidden end, or clutter. |
| 5 | Calm and craft | One accent colour used for the pick and the action. Few text styles, aligned edges, tabular numbers, no needless words. Looks like one designed object with the map. | Works, but busy: too many colours, borders, words or controls. |
| 6 | Interaction | Every control changes something visible. A pick updates the map, the postcard and the book band together. Hover moves the vehicle along the route. Keyboard and Esc work. Choices survive a reload. | Some controls do nothing for this data, or parts go out of sync. |
| 7 | Robustness | No console errors. The probe is ok at 1440 x 900 and at 390 x 844. Reduced motion works. Nothing clips or overflows. | One probe failure or a phone layout that is hard to use. |
| 8 | Booking | The book band books exactly what the postcard shows, at the shown price. The prompt names every journey, seller, price, bag and the stop-at-payment rule. | Books, but the prompt misses a leg, a seller or the bag terms. |

## Reply

```json
{ "scenario": "<id>", "scores": { "truth": 0, "question": 0, "model": 0, "map": 0, "craft": 0, "interaction": 0, "robustness": 0, "booking": 0 },
  "great": false,
  "evidence": { "truth": "...", "...": "..." },
  "fixes": [ { "where": "page | kit | references | data", "what": "one concrete change", "why": "the criterion it raises" } ] }
```

`where` matters: `page` is this trip's `app.js` or `index.html`; `kit` is a shared module that every
page would gain from; `references` is guidance that would have made the builder do it right; `data`
is the scenario data.
