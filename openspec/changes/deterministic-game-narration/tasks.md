# Tasks

## 1. Player-observable fact projections

- [x] 1.1 Define a typed, per-system projection from game state to player-observable facts and add unit tests proving hidden fields are omitted and relevant readings are preserved.
- [x] 1.2 Add selection of concise salient facts and targeted follow-up details for a system, with tests showing unrelated facts are excluded from both views.

## 2. Read-only system inspection

- [x] 2.1 Add a coordinator inspection query that uses the observable projection and deterministic narration without running state-changing simulation; verify returned narration and unchanged game state, time, and event feed.
- [x] 2.2 Add deterministic inspection passages that contextualize exact readings; verify repeat requests with the same observable facts return the same concise narration.

## 3. Action narration and game time

- [x] 3.1 Update action narration to use observable consequences and relevant projected facts; add tests for contextual event narration and exclusion of unrelated or hidden details.
- [x] 3.2 Add a discrete game-time counter that advances once for a successful action that changes state; test that failed and no-change actions do not advance it.
- [x] 3.3 Keep inspection results out of the action event feed and append successful state-changing action narration in dispatch order; verify through coordinator subscription tests.
- [x] 3.4 Remove the unused full-state narration API and migrate its tests to fact-based inspection and action contexts; verify no raw-state narration API or rules remain.

## 4. Integration verification

- [x] 4.1 Run the relevant narration and coordinator tests, `npx expo lint`, and `npx tsc --noEmit`; resolve failures and confirm inspection and action narration work through the game session.
