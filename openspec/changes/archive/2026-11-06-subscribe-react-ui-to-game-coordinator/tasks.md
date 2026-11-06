# Tasks

## 1. React integration test first

- [X] 1.1 Add a focused mounted React component test that subscribes to the coordinator, dispatches a typed command from a component action, and asserts updated state plus the appended feed result; confirm it fails before implementation and use the existing renderer if compatible.

## 2. Coordinator session publication

- [X] 2.1 Add a stable coordinator snapshot containing current state and an ordered in-memory feed, preserving `dispatch()`'s returned result; add unit tests for initial snapshot, append ordering, listener notification, unsubscribe, and unchanged state/feed when processing throws.
- [X] 2.2 Implement coordinator snapshot access and subscriber notification after successful command completion; verify coordinator unit and existing integration tests pass.

## 3. React adapter and integration

- [X] 3.1 Add a small React hook that subscribes to the coordinator snapshot and a typed command action path; verify the mounted component integration test passes and confirms React redraws with the latest state and feed.
- [X] 3.2 Run project lint and TypeScript checks and resolve any issues; verify with `npm run lint` and `npm run typecheck`.
