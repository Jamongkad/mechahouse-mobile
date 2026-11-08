# Spec Delta

## MODIFIED Requirements

### Requirement: React views observe the current game session
The game session SHALL expose its current state and the ordered narration feed for state-changing actions to subscribed React views, and notify those views after a successful state-changing action updates the session.

#### Scenario: View updates after a successful command
- **WHEN** a mounted React view subscribes to a game session and a command successfully changes game state
- **THEN** the view renders the updated state and the corresponding event narration in the session feed

#### Scenario: Session feed accumulates command results
- **WHEN** multiple commands successfully change the game session
- **THEN** the subscribed view can observe a feed entry for each action in dispatch order

#### Scenario: Read-only inspection leaves the session feed unchanged
- **WHEN** a subscribed view requests a read-only system inspection
- **THEN** the view receives the inspection narration without adding a session feed entry or publishing a changed game state

### Requirement: React views can send game commands
React views SHALL be able to submit a typed game command to the coordinator, with the coordinator remaining responsible for applying game rules, and request read-only system inspections without submitting a state-changing command.

#### Scenario: UI action dispatches a command
- **WHEN** a player activates a control in a React view that changes game state
- **THEN** the view submits the corresponding command and observes the coordinator's resulting session update

#### Scenario: UI requests a read-only inspection
- **WHEN** a player inspects a mech system from a React view
- **THEN** the view receives a narration of the system's current player-observable state without changing game state

## ADDED Requirements

### Requirement: Read-only interactions do not advance game time
The game session SHALL treat interactions that do not change game state as read-only and SHALL NOT advance game time for them.

#### Scenario: System inspection does not advance time
- **WHEN** a player inspects a mech system and the inspection does not change game state
- **THEN** the game time remains unchanged

### Requirement: State-changing actions advance game time
The game session SHALL advance game time when a successful action changes game state.

#### Scenario: Successful action advances time
- **WHEN** a player action successfully changes game state
- **THEN** the game time advances as part of that action
