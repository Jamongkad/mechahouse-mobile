# Spec Delta

## Purpose

Give players a concise, in-world view of Mecha House through system inspections and responses to actions. Narration presents only observable facts and gives context that helps players understand what those facts mean.

## ADDED Requirements

### Requirement: System inspection presents a concise player-observable view
When a player inspects a mech system, narration SHALL present a concise overview using only facts the player can observe from that system.

#### Scenario: Inspection omits hidden system state
- **WHEN** a player inspects a system whose internal state includes facts they cannot observe
- **THEN** the narration describes only facts observable from that system

#### Scenario: Inspection offers relevant details with context
- **WHEN** a player inspects a system with a relevant exact reading
- **THEN** the narration may include the exact reading and SHALL provide context that helps the player understand its significance

#### Scenario: Additional inspection provides more detail
- **WHEN** a player follows up on a system inspection to learn more
- **THEN** the narration provides further relevant observable detail without repeating unrelated system information

### Requirement: State-changing actions receive deterministic event narration
The narration service SHALL produce concise event narration for a state-changing action from its observable consequences and relevant game facts.

#### Scenario: Narration contextualizes an action result
- **WHEN** a state-changing action produces an observable consequence
- **THEN** the narration describes what happened in-world and gives context that helps the player understand the consequence

#### Scenario: Narration is deterministic
- **WHEN** the same observable facts and action consequences are narrated by the deterministic service
- **THEN** the service produces the same narration

#### Scenario: Narration avoids unrelated detail
- **WHEN** an action changes one or more mech systems
- **THEN** the narration focuses on salient observable consequences and omits unrelated system information
