# M1racle Study integrated website v10

The formal production target is the existing https://m1raclestudy.netlify.app/ site. This is the deployable website source; no new hosted product or domain is created by this directory.

Publish **site/** to the existing Netlify project. The output contains the home page, recorded-course progress, physical-exam study, self-authored quizzes, diagnosis chapter index, account page, and the same-origin Anki reviewer at `/#/anki`. The reviewer is kept mounted during internal route changes so the imported package and current reveal state survive navigation.

The existing independent Supabase project and public client key are retained. No database schema changes or user accounts are created by this release. Course metadata currently contains 205 lessons; course progress requires an existing email account. Browser tests mock authenticated calls and cannot establish successful production login or real two-device synchronization.

Anki media and grading remain browser-local and do not follow account switches. On the old experiment, import the original APKG and export its progress; then import the identical package and progress JSON on the formal site. The importer verifies the package hash and validates scheduling records before replacement. Import starts a fresh undo history. It cannot automatically read another origin's browser storage. Card-size limits and partial Anki compatibility are unchanged.

This directory intentionally excludes database SQL, private card packages, source textbooks, screenshots of real material and credentials. The public client key is not a service-role key. Self-authored quiz content is inherited from v9, with its original provenance; integration is not a clinical content review.

Run:

```sh
node --test m1racle-study/tests/review-core.test.cjs
node --test m1racle-study/tests/cloud-sync.test.cjs
```

The integrated browser workflow serves `site/` at the URL root, as Netlify does, and tests 320/390/1280 px layouts, navigation, quiz and map flows, iframe reveal and state retention, grading, progress import/export, page restoration, physical and account pages, plus explicitly mocked course saving and conflict handling. It never uploads a private APKG or writes test progress to production Supabase.
