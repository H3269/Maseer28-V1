# Project Event Log — Masir 28 Content Expansion

## 2026-11-21 — T01–T14 owner-approval release gate

- **Scope:** prevent any T01–T14 daily exercise, dedicated action, examples, or prepared assistant answer from being treated as approved or shown to users before explicit approval by the app owner, Dr. Abedi.
- **Changes committed on `main`:**
  - `f6b254f` — introduced a fail-closed owner approval allowlist. It is intentionally empty; no T01–T14 day is approved by default.
  - `c86e1ff` — blocked prepared daily assistant answers for T01–T14 unless the exact canonical daily record is on the owner allowlist.
  - `df4b86a` — hid the T01–T14 daily page content until explicit owner approval.
  - `d0717c0` — extended the page gate to legacy records by resolving topic identity from the selected category when `topic_id` is absent.
  - `aa9c711` — added automated unit coverage for the default-deny approval rule and the UI/assistant enforcement points.
  - `14d4ed5` — hid T01–T14 prepared-question groups in the global assistant while the exact daily record is not owner-approved.
  - `cedeec4` — extended the gate test to cover prepared-question visibility.
- **Approval semantics:** review metadata, evidence metadata, safety classification, passing tests, or a generic specialist-review flag do not grant approval. Approval is per exact canonical daily record and must be explicitly added by the owner after review.
- **Current approval state:** zero T01–T14 daily records approved. This is intentional and fail-closed.
- **Verification status:** code and tests were committed, but the full Node test suite, production build, and browser checks have not yet been run in this environment. The repository's existing tests that expect T01–T14 assistant answers or daily content to be visible are now known to require updating to the new approval policy. The global assistant's prepared-question picker is also hidden for pending T01–T14 records. Do not report the suite as passing until those tests are updated and executed.
- **Not done:** no specialist approval was recorded; no daily content was marked approved; no Telegram/Bale publish action was run.

## Next execution steps

1. Update legacy unit and browser tests so T01–T14 are expected to remain hidden/unavailable while the allowlist is empty; preserve positive visibility tests for topics outside T01–T14.
2. Run the full test suite, content validation, assistant-topic validation, content-quality audit, and production build; fix all regressions.
3. Audit every T01–T14 day (392 daily records) for exercise/action/example completeness, topic fit, evidence, safety, and conceptual duplication. Keep audit findings separate from owner approval.
4. Only after Dr. Abedi explicitly approves an exact daily record, add that record ID to the owner allowlist. Never infer approval from metadata or test results.
5. Continue the broader 34-topic × 28-day review and retain owner-controlled release and publication gates.


## 2026-11-21 — owner-gate identity hardening

- **Finding:** the daily page previously preferred `data.topic_id` over the selected category when resolving the topic for the owner-approval gate. A stale or conflicting record topic identifier could therefore misclassify a T01–T14 page and potentially bypass the gate.
- **Correction:** the selected category is now authoritative; the record's `topic_id` is only a fallback for contexts where the category cannot be resolved. The regression assertion now checks this precedence.
- **Verification:** source and test assertions were updated on `main`. The test suite and browser build have not yet been executed, so this is a code-level correction, not a verified runtime pass.

- **Additional hardening:** the global assistant now hides any existing transcript immediately when the selected T01–T14 record is pending approval, then clears the transcript, draft, error, and conversation state. This closes a stale-message path where a previously approved/other-day answer could remain visible after switching to an unapproved day.
- **Verification:** a regression assertion was added for the immediate transcript render guard and state clearing. Runtime tests remain unexecuted in this environment.

- **Expanded test-debt inventory:** repository code search found additional legacy router tests still expecting `daily_guidance_available` for unapproved T01–T14 records, including `pageAssistantTurn.test.js`, `angerPreparedFaqSafetyBypass.test.js`, `preparedOnlyCurrentTopics.test.js`, `jealousyDailyAssistantPrompts.test.js`, `t09RuntimeIntegration.test.js`, `t10`/`t11`/`t12`/`t13`/`t14` assistant tests, grief, guilt, and emotional-dependency suites. These are not yet migrated to the owner-approval contract. Their content-level guide validation should remain, but live-router expectations must assert blocked output until an exact owner approval exists.


## 2026-11-21 — migrate legacy live-router expectations

- Updated the live `makePageAssistantTurn` integration expectations in the legacy T01–T14 suites to assert `daily_guidance_unavailable` and the explicit Dr. Abedi approval notice while the exact-record allowlist remains empty.
- Kept guide-content/unit checks (28-day completeness, 14-question structures, unique answers, topic/day identity, examples, and safety wording) intact where they validate source content independently of live release permission.
- Updated suites include page router, prepared-only contract, anger FAQ safety bypass, jealousy, T09, T11, T12, grief, guilt, emotional dependency, T13, and T14.
- **Important verification limit:** changes were committed to `main`, but no local test runner is available through the GitHub connector. The latest commit has not produced a visible Actions run or CI status yet; these tests are not claimed to pass.
- **Next:** finish auditing remaining router and rendering paths, inspect test diffs for accidental expectation changes, then run full tests/build in an available runner before presenting a live-browser candidate. No owner approval entries have been added; no public release was performed.
