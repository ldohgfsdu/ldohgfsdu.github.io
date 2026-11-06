# M1racle Study · Anki experiment

This directory is the Anki experiment in the existing GitHub Pages repository. The formal M1racle Study site remains https://m1raclestudy.netlify.app/ . No second formal study product is introduced here.

## v3.4 behavior

- Kevin Image Cloze keeps one original image: reveal individual rectangles, or reveal the remaining rectangles together. Scoring becomes available after all rectangles are revealed.
- New, learning, relearning, review, suspended and buried cards have separate counts. Due learning cards are selected before review and new cards.
- Each deck has local new-card and review limits (defaults 20 / 200). Ancestor limits always apply, including when selecting a child directly. The `all` selection also has a collection-wide cap. These are independent local options, not imported Anki presets.
- Intraday learning/relearning repetitions do not consume another daily slot. Interday learning consumes the review budget. New and review budgets are separate; new cards ignore the review limit in this version.
- The study day starts at a configurable local hour, default 04:00. Review cards are due through that study day; learning cards are due by their precise timestamps. A waiting queue checks automatically, at most once per minute.
- Bury a card until the next study day, or restore the selected deck's buried cards early. Suspension lasts until manually reversed in `Browse all`.
- `Undo last rating` remains accessible after the last card or daily limit is reached. Undo restores both the previous card record and the consumed daily slot. It retains one rating, including after a page reload.
- Answer buttons show approximate next intervals from the vendored ts-fsrs v5.4.2 / FSRS-6.0. Space reveals an answer, Space after reveal selects Good, and 1–4 select a rating when no form control has focus.

## Persistence

The complete package bytes identify a local collection using SHA-256. Renaming identical bytes preserves progress. Different bytes, even with the same filename and size, use separate progress. Re-exporting or changing an archive creates a new identity; automatic matching across exports is not implemented.

Card records, their capped 200-entry histories, daily counters, options, suspension, bury and the single undo snapshot are committed together in one localStorage value. A failed storage write does not advance the queue. The last imported package is stored separately in IndexedDB. This is browser-local persistence, not cloud backup or offline application caching.

Existing v3.3 records/suspensions are migrated on the first import with the original filename and size. A legacy identity is bound to the new content hash so another same-name, same-size package does not inherit that history. Legacy keys are retained for recovery. Legacy undo is not imported, and historical counters reconstructed from the capped history may be incomplete. If an old package was renamed before its first v3.4 import, import it under its old name once to find the legacy records.

Changes from another tab are observed through storage events and stale writes are rejected. Browser-local storage does not provide a cross-device merge or a transactional guarantee for simultaneous writers in multiple tabs.

## Validation

Run the pure queue/hash tests with Node 22 or later:

```sh
TZ=Asia/Shanghai node --test m1racle-anki-lab/tests/review-core.test.cjs
TZ=America/New_York node --test m1racle-anki-lab/tests/review-core.test.cjs
```

The GitHub Actions core workflow generates a small public-domain synthetic APKG and tests 390 px touch and 1280 px desktop views with Playwright 1.56.1. It covers original reveal behavior, FSRS grading, caps, empty-queue and last-card undo, bury/unbury, suspension recovery, reload, renamed files, simulated storage failure, reset and delayed learning wake-up. The separate Enhanced occlusion workflow checks its existing mask alignment and fail-closed behavior. It does not establish compatibility with arbitrary Anki templates.

The original private fixture is intentionally excluded from this repository. Local browser checks additionally use its 8 cards / 256 Kevin rectangles, checking individual and all-at-once reveal on every card.

## Remaining parity gaps

| Area | State |
| --- | --- |
| Original Anki schedules, revlog, presets and imported suspension | Not imported; the website starts independent local scheduling |
| FSRS parameter optimization and exact Anki interval equivalence | Not implemented or claimed |
| Arbitrary template scripts, CSS, audio and native image occlusion | Partial or unsupported; original sanitization still applies |
| Editing / creating notes, tags, search, filtered decks and flags | Not implemented |
| Automatic sibling bury and undo of non-rating actions | Not implemented |
| Large packages | Still limited to 120 MiB / 60,000 loaded cards; 360 MB is unsupported |
| Full statistics, APKG export and versioned progress backup | Not implemented |
| Complete offline application / multi-device synchronization | Not implemented |
| Supabase and AnkiWeb synchronization | Not implemented |
| Integration into the formal Netlify site | Not completed |

These limits prevent labeling the module as feature-equivalent to Anki.

## Upstream references

Scheduling and bury semantics were checked against the [Anki manual](https://docs.ankiweb.net/manual/studying) and [deck options](https://docs.ankiweb.net/manual/deck-options). Queue policy here is independently implemented and deliberately exposes its supported subset. No Anki GPL/AGPL code was copied into this change.

The HTTP development-preview SHA-256 fallback vendors the relevant unchanged files from MIT-licensed [@noble/hashes 2.4.0](https://github.com/paulmillr/noble-hashes), with its license in `vendor/noble/LICENSE`. HTTPS uses Web Crypto. Existing parser and FSRS dependencies remain vendored locally.
