# Proposal

## Why

The coordinator can process a command and return its result, but React components have no shared way to observe later game state and feed updates. A small integration slice will establish that connection and test it through an actual React component, providing a safe foundation for the game's session feed UI.

## What Changes

- Give the coordinator a session snapshot and a subscription mechanism for React to observe state and accumulated command results.
- Add a small React-facing subscription hook or adapter and demonstrate it with a component-level test that dispatches a command and observes the rendered update.

## Capabilities

### New Capabilities
- `react-game-session`: React can send game commands through the coordinator and reflect its current state and session feed.

### Modified Capabilities
- None.

## Impact

- Affects `src/game/game-coordinator.ts`, its tests, and a new React adapter/hook and component-level test.
- Uses the existing React/Jest Expo setup; testing-library availability and any needed test dependency should be confirmed during implementation.
- No persistence or UI styling is in scope; the session feed remains in memory.
