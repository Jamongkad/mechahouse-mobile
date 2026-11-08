# Design

## Context

See `proposal.md` for motivation and `specs/game-narration/spec.md` plus `specs/react-game-session/spec.md` for behavior contracts. `GameCoordinator` currently sends the full post-simulation state, changes, and outcomes to `NarrationEngine`. Narration rules can inspect the full state and select registered passages whose template lines interpolate state values. The project has no game-time representation or player-observability projection yet.

## Goals / Non-Goals

**Goals:**
- Give read-only system inspection and state-changing action narration distinct inputs and outputs while keeping both behind the game coordinator boundary.
- Build narration from a curated projection of player-observable facts rather than exposing the full internal state.
- Keep deterministic rules and templates as the MVP implementation, with a stable fact-based boundary that a future text generator could consume.
- Advance a minimal game-time counter once for each successful state-changing action.

**Non-Goals:**
- Integrating an LLM, network service, prompt system, or model-selection policy.
- Modeling real-world action durations, fractional time, or continuous simulation.
- Designing final narrative prose, voice, or a large library of system passages.

## Decisions

### Separate observation from narration

Introduce a player-observable fact projection for each inspected system. Inspection requests identify a system and read current state through that projection; action narration receives the action's observable consequences and relevant projected facts. The narration layer should not receive unrestricted internal state as its player-facing context.

Alternative considered: let narration rules read the complete state and decide what to reveal. The current engine permits this, but it makes hidden-information boundaries implicit and encourages overlong output. A curated projection makes visibility and relevance explicit and can be reused by a future LLM.

### Keep inspections as read-only coordinator queries

Expose inspection through a query path that does not invoke state-changing simulation commands. It returns a concise current system view, does not advance game time, and does not append to the action event feed. Follow-up inspection can request additional relevant details.

Alternative considered: model inspection as a no-op game command. That would couple read-only presentation to simulation dispatch and risks counting or recording an interaction that has no game effect.

### Advance one fixed time step for each successful mutation

Represent MVP game time as a discrete counter. When a successful player action changes game state, advance the counter once as part of the resulting game-session update. Actions that fail or produce no state change do not advance it; inspections never advance it.

Alternative considered: assign duration to every action. That needs duration metadata and balancing rules that the current game model does not have. A fixed step preserves the turn-based rule with a small, testable mechanism and can later be replaced by explicit durations.

### Keep deterministic selection and rendering for the MVP

Continue selecting narrative content deterministically from observable facts and action consequences, then render the selected passage using authored text and exact readings where useful. Keep the narration input expressed as structured, curated facts so a future LLM can produce prose from the same trusted context without changing game-state visibility rules.

Alternative considered: add an LLM now. That would add latency, dependency, and output-control concerns before the observation model and desired narrative style are established.

### Keep every narration entry point fact-based

Expose inspection and action narration through contexts made from player-observable facts. Remove the unused full-state narration entry point and its raw-state rule types so callers cannot accidentally bypass the projection boundary.

Alternative considered: retain the full-state method for compatibility. The repository has no runtime callers for it, and keeping it would make the safe and unsafe narration paths look equally supported.

### Keep the event feed focused on state-changing actions

Append action narration to the existing session feed only after a successful state change. Return inspection narration to the requesting view without storing it in that feed.

Alternative considered: store every read in the feed. That would make the feed a transcript of navigation and inspection rather than a history of game events.

## Risks / Trade-offs

- [No current observability model] -> Define per-system projections explicitly and pass only their facts to narration; avoid defaulting to full-state exposure.
- [One time step per mutation may not reflect action duration] -> Keep the counter discrete and the advancement policy isolated so duration-based time can be added later.
- [Deterministic passages may feel repetitive] -> Start with concise authored variations based on observable conditions; defer generative prose until the core context boundary is proven.
- [Narration runs as part of a successful action] -> Keep deterministic narration local and bounded so it does not add variable latency or make action success depend on a remote service.
