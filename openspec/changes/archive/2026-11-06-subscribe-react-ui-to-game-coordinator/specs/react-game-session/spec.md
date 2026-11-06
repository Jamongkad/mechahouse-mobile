# Spec Delta

## Purpose

Allow React screens to send commands to the game coordinator and observe the resulting game state and session history, so the interface can stay in sync with the active game.

## ADDED Requirements

### Requirement: React views observe the current game session
The game session SHALL expose its current state and accumulated command results to subscribed React views, and notify those views after a successful command updates the session.

#### Scenario: View updates after a successful command
- **WHEN** a mounted React view subscribes to a game session and a command successfully changes game state
- **THEN** the view renders the updated state and the corresponding result in the session feed

#### Scenario: Session feed accumulates command results
- **WHEN** multiple commands successfully update the game session
- **THEN** the subscribed view can observe a feed entry for each command in dispatch order

### Requirement: Failed commands do not enter the session feed
The game session SHALL leave its published state and feed unchanged when command processing fails.

#### Scenario: Command processing throws
- **WHEN** simulation or narration fails while processing a command
- **THEN** subscribers do not receive a new session snapshot and no feed entry is added for that command

### Requirement: React views can send game commands
React views SHALL be able to submit a typed game command to the coordinator, with the coordinator remaining responsible for applying game rules.

#### Scenario: UI action dispatches a command
- **WHEN** a player activates a control in a React view
- **THEN** the view submits the corresponding command and observes the coordinator's resulting session update
