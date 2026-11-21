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

## 2026-11-21 — legacy router test migration (continued)

- Updated runtime-router expectations in `pageAssistantTurn.test.js`, `preparedOnlyCurrentTopics.test.js`, `angerPreparedFaqSafetyBypass.test.js`, `jealousyDailyAssistantPrompts.test.js`, `t09RuntimeIntegration.test.js`, `t11RuntimeIntegration.test.js`, `t12DailyAssistantGuide.test.js`, `guiltDailyAssistantPrompts.test.js`, and `emotionalDependencyDailyAssistantPrompts.test.js`.
- These changes separate content-integrity checks (which continue to validate the complete prepared guides) from live-router display checks (which must not expose T01–T14 content without exact owner approval).
- Urgent safety handoff and relationship-safety checks remain independently tested; they must not be disabled by the content-approval gate.
- The T01–T14 owner allowlist remains empty. No approval was recorded on behalf of Dr. Abedi.
- **Important verification limitation:** GitHub Actions execution and local Node test execution have not been confirmed. The updated tests are authored but not yet demonstrated passing. The app is not yet ready for the user's live browser test handoff.

- **Test-source repair:** during review, a malformed T11 non-disclosure assertion introduced by an automated text edit was detected and corrected. T11 router tests now explicitly assert that the blocked response does not contain the prepared answer, stop condition, human-support guidance, or other guide content. This source correction is committed; it has not yet been executed by Node.


## 2026-11-21 — audit of migrated T01–T14 router tests

- **T11 contradiction found and corrected:** the live-router test simultaneously asserted that prepared stop/support/mechanism text was absent and present in the same blocked response. Removed the contradictory positive assertions from the router test. The separate T11 guide/content tests remain responsible for proving those authored fields and answers exist; the live router test checks non-disclosure while owner approval is pending. Independent urgent-risk routing remains explicitly tested.
- **Clarified test intent:** renamed T12, T13, and T14 integration-test descriptions so they no longer claim that the live page assistant serves an unapproved guide or that generic review metadata constitutes owner approval.
- **Cross-check:** T07 and T08 positive answer assertions are in their guide/helper integrity sections; their live-router sections assert owner-gate blocking, while explicit urgent-risk handoff and relationship-safety checks remain separate. T12 relationship-safety confirmation is still evaluated before the owner-content gate; passing that safety check does not approve or reveal the daily guide.
- **Approval state:** the T01–T14 owner allowlist remains empty. No content approval was recorded.
- **Verification limit:** these are source-level test corrections only. The Node test suite, production build, and browser runtime have still not been executed in this environment. Do not treat the repository as test-passing or ready for user browser handoff until those checks run.


## 2026-11-21 — correction: remove the internal specialist-approval gate

- **Owner clarification:** Dr. Abedi is the specialist and the approval authority. The application must not require a separate system flag, allowlist entry, review metadata field, or automated specialist approval before showing T01–T14 content. The app must not display an internal “awaiting specialist approval” state or hide content for that reason.
- **Correction applied on `main`:**
  - `e0dc3c4` — removed the daily-screen return that replaced T01–T14 exercise/action content with an approval notice.
  - `0583086` — removed the owner-allowlist condition from prepared daily assistant answers.
  - `399f3a2` — restored the global assistant's prepared-question groups and transcript rendering without the approval-pending suppression/clearing behavior.
  - `6896fad` — deleted the now-obsolete `ownerDailyContentApproval.js` gate module.
  - `49557dc` — replaced gate-enforcement unit tests with regression checks that the runtime has no specialist-approval gate.
  - `7612cba` — changed the daily browser safety test to expect normal daily content, interaction controls, and prepared assistant questions rather than an approval notice.
  - `084c560` — restored T01 global-assistant browser expectations.
- **Important:** these are source changes only. Node tests, production build, and browser tests have not yet been run. Other legacy test files still contain assertions and descriptions based on the incorrect gate and must be migrated before the suite can be considered consistent.
- **Correct product behavior:** T01–T14 content and their prepared assistant answers are available through the normal app flow, subject to the existing canonical day/topic validation and genuine safety checks. No generic “specialist approval” mechanism or message belongs in the user-facing app.
- **Publication:** no Telegram/Bale publication was performed.


- **Follow-up test migration:** restored normal prepared-answer expectations in `pageAssistantTurn.test.js`, `t11RuntimeIntegration.test.js`, `t09RuntimeIntegration.test.js`, `t12DailyAssistantGuide.test.js`, `t14DailyAssistantPrompts.test.mjs`, `preparedOnlyCurrentTopics.test.js`, `angerDailyAssistantPrompts.test.js`, `angerPreparedFaqSafetyBypass.test.js`, `griefDailyAssistantPrompts.test.js`, `jealousyDailyAssistantPrompts.test.js`, `t13DailyAssistantPrompts.test.mjs`, `emotionalDependencyDailyAssistantPrompts.test.js`, `guiltDailyAssistantPrompts.test.js`, and `t11DailyAssistantPrompts.test.mjs`. Identity-mismatch checks remain separate and should continue to reject mismatched topic/day records.
- **Verification still pending:** these test edits have not been executed. More legacy browser/runtime assertions may remain; the full test suite and browser suite must run before the branch is considered ready for live user testing.


## 2026-11-21 — follow-up: distinguish content availability from safety restrictions

- Corrected the remaining prepared-question regression tests so T01–T14 exact day-specific questions expect normal answers, while unrelated free-form questions continue to return `prepared_question_required`.
- Preserved independent rejection for mismatched canonical topic/day identity, relationship-safety confirmation/blocking, and urgent-risk handoff.
- Corrected the T13 high-risk response copy: it now explains the recorded risk level and does not imply that specialist approval or a specialist review is pending.
- Added a T13 regression case proving that a high-risk safety classification can still block an unsafe answer for safety reasons, independently of review metadata.
- Updated the T12 integration test title to describe the restored answer route and its separate interpersonal-safety check.
- Static repository review found no remaining runtime references to the deleted owner-approval module or the owner-approval functions in the daily page, page assistant, or global assistant launcher. The obsolete owner-approval test filename remains for historical continuity, but its assertions now enforce absence of the gate.
- The test-only GitHub Pages workflow runs `npm test`, content validation, assistant-topic validation, content-quality audit, and a test build on pushes to `main`. The production Telegram/Bale workflow is separately manual and requires the explicit `publish` input. No production publish was triggered.
- **Execution status:** no Node tests, content validators, build, or Playwright browser scripts have been executed in this environment. A local clone attempt could not reach GitHub because network name resolution is unavailable. The available commit-status lookup returned no status entries; the workflow-run connector only exposes PR-triggered runs, so it cannot confirm the push-triggered Pages run. Do not treat this code review as a passing test result or as a ready-for-user-live-test release.


- **Browser-suite correction:** the 34-topic daily visibility test now distinguishes the 14 topics that actually have prepared assistant catalogues (T01–T14) from T15–T34, which should show daily exercise/action content but must not falsely claim to have prepared questions. This avoids turning the removal of the specialist gate into an incorrect expectation that all 34 assistant catalogues already exist. Commit: `a97151a`.
- **Additional source wording correction:** the T13 risk-based block now explains that the recorded risk level makes the response unsafe in that state; it no longer says the user must wait for specialist review. Regression test added for high-risk classification with review metadata present. Commits: `5ee26fc`, `4e69cbe`.

## 2026-11-21 — Persian-only audit of T01–T14 assistant output

- Completed a source-level review of all 14 daily assistant catalogues and their 28-day guide/question structures (392 topic/day records). The review distinguishes user-visible text from internal topic IDs, question IDs, field names, and code identifiers; internal identifiers are not to be displayed.
- Corrected user-visible Latin leakage found in the prepared content:
  - T09: replaced internal topic references in three visible explanations with Persian descriptions.
  - T10: expanded the repeated PTSD acronym in all 28 safety notes to its Persian clinical name.
  - T11: replaced BFRB, HRT, ComB, ERP, CBIT, OCD, masking, and internal subtopic codes with Persian descriptions across the visible guide and answer text.
  - T14: replaced 19 visible self-references to the internal topic code with the Persian topic name.
  - T06: replaced PGD and PTSD acronyms in the visible stop-condition text with Persian clinical names.
- Added a regression test to inspect visible guide fields, all prompt-group labels/questions, and every available prepared runtime answer for T01–T14 across all 392 day records. Any Latin-script character in that output now fails the test.
- Execution status: this audit and the source edits have been committed to main, but the Node/browser workflow has not yet been observed to complete. Do not treat the regression test or the test deployment as passing until GitHub Actions reports success.
- No Telegram/Bale production publication was triggered.

