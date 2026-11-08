# Proposal

## Why

Mecha House is a text-driven game, so narration is the player's viewport into the mech and its world. The current deterministic narration engine reacts to simulation results, but players also need concise, contextual descriptions when they inspect a system, with only information they can observe.

## What Changes

- Define a `game-narration` capability for concise, deterministic system inspections and event narration grounded in player-observable facts.
- Keep read-only inspections free of game-time advancement and session-feed entries; state-changing actions advance game time and produce event narration in the feed.
- Allow exact readings when useful, paired with prose that explains their significance, and leave room for a future small LLM to generate prose from the same curated observable facts.

## Capabilities

### New Capabilities
- `game-narration`: Provides concise player-facing system views and contextual narration for game events using observable game facts.

### Modified Capabilities
- `react-game-session`: Distinguishes read-only inspection from state-changing actions, defines time advancement, and keeps the session feed focused on narration caused by actions.

## Impact

- Affects `src/narration/` and its integration with `src/game/game-coordinator.ts`.
- Extends the game-session interaction contract; a game-time representation may need to be introduced or connected.
- No LLM provider or network dependency is introduced in this change; deterministic narration remains the implementation target.
