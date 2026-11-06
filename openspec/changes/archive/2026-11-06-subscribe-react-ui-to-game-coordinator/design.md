# Design

## Context

`GameCoordinator` currently owns mutable session state and returns a result from `dispatch()`, but has no snapshot or observer API. Its unit test verifies the returned result without rendering React. React and Jest Expo are installed; the lockfile includes `react-test-renderer`, but no React Native Testing Library package is declared.

## Goals / Non-Goals

**Goals:**
- Let React read a stable current snapshot containing game state and the in-memory session feed.
- Notify React after successful dispatches and provide a small typed route for UI actions to dispatch commands.
- Prove the integration by mounting a small React component, dispatching a command, and asserting the rendered update.

**Non-Goals:**
- Persisting the session feed across app restarts.
- Implementing game screens, visual feed design, or narration presentation policy.
- Making simulation or narration depend on React.

## Decisions

### Coordinator owns the session snapshot and feed

Extend the coordinator boundary to expose a snapshot getter and subscription function. Keep a stable snapshot object until a successful command produces a new one; append one structured result per successful dispatch in order. Preserve `dispatch()`'s result return for direct callers. A thrown simulation or narration operation must not publish a new snapshot or append a feed entry.

Alternative considered: let React components assemble and own the feed from `dispatch()` results. This creates competing copies when multiple components observe the same session.

### React subscribes through an adapter hook

Use a small hook based on React's external-store subscription API to read the coordinator snapshot. Components send commands through the coordinator (or a minimal app action wrapper). Keep this adapter outside the simulation engine and avoid Jotai as a mirrored source of game state.

Alternative considered: mirror coordinator state into Jotai atoms. This would add synchronization and ownership questions without current app-wide Jotai usage.

### Verify behavior with a mounted component test

Add a focused test that mounts a component reading the snapshot, triggers a typed command through an interaction or handler, and verifies updated state and feed content in the rendered output. Reuse the installed React renderer if compatible with the Expo Jest preset; otherwise select the smallest compatible React Native component testing dependency during implementation.

Alternative considered: test only `subscribe()` callbacks. That would verify the coordinator API but not that React actually redraws from it.

## Risks / Trade-offs

- [Every snapshot replacement may redraw all subscribers] -> Start with one small snapshot and component-level subscriptions; add selectors only if profiling or screen complexity warrants them.
- [A test renderer may be deprecated or incompatible with the current React Native setup] -> Confirm compatibility when writing the test and use a maintained Expo-compatible renderer if needed.
- [An ever-growing session feed uses increasing memory] -> Keep this first slice session-only and defer retention limits until expected session length and feed UX are understood.
