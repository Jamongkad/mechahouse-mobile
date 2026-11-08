import type {
  NarrationEngine,
  NarrationPassage,
} from "../narration/narration";
import {
  diffSystemObservations,
  projectAllSystemObservations,
  projectSystemObservation,
  selectObservableFacts,
  type SystemObservableProjections,
} from "../narration/observable-facts";
import type {
  SimulationEngine,
  SimulationResult,
} from "../simulation/simulation";

export type GameCoordinatorResult<State extends object> = Readonly<{
  state: State;
  changes: SimulationResult<State>["changes"];
  outcomes: SimulationResult<State>["outcomes"];
  narration: readonly NarrationPassage[];
}>;

export type GameCoordinatorFeedEntry<State extends object> = Readonly<{
  id: number;
  result: GameCoordinatorResult<State>;
}>;

export type GameCoordinatorSnapshot<State extends object> = Readonly<{
  state: State;
  gameTime: number;
  feed: readonly GameCoordinatorFeedEntry<State>[];
}>;

export class GameCoordinator<
  State extends object,
  Command extends { type: string; targetModuleId: string },
> {
  private snapshot: GameCoordinatorSnapshot<State>;
  private readonly listeners = new Set<() => void>();

  constructor(
    state: State,
    private readonly simulationEngine: SimulationEngine<State, Command>,
    private readonly narrationEngine: NarrationEngine,
    private readonly observableProjections: SystemObservableProjections<State> = {},
  ) {
    this.snapshot = { state, gameTime: 0, feed: [] };
  }

  getSnapshot = (): GameCoordinatorSnapshot<State> => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  inspect(systemId: string, detailGroup?: string): NarrationPassage[] {
    const observation = projectSystemObservation(
      this.snapshot.state,
      systemId,
      this.observableProjections,
    );

    return this.narrationEngine.inspect({
      ...observation,
      facts: selectObservableFacts(observation.facts, detailGroup),
    });
  }

  dispatch(command: Command): GameCoordinatorResult<State> {
    const previousObservations = projectAllSystemObservations(
      this.snapshot.state,
      this.observableProjections,
    );
    const simulationResult = this.simulationEngine.simulate(
      this.snapshot.state,
      command,
    );
    const nextObservations = projectAllSystemObservations(
      simulationResult.state,
      this.observableProjections,
    );
    const stateChanged = simulationResult.changes.length > 0;
    const narration = stateChanged
      ? this.narrationEngine.narrateAction({
          facts: nextObservations.flatMap(({ facts }) => facts),
          changes: diffSystemObservations(
            previousObservations,
            nextObservations,
          ),
        })
      : [];

    const result: GameCoordinatorResult<State> = {
      ...simulationResult,
      narration,
    };

    if (stateChanged) {
      this.snapshot = {
        state: result.state,
        gameTime: this.snapshot.gameTime + 1,
        feed:
          narration.length > 0
            ? [
                ...this.snapshot.feed,
                { id: this.snapshot.feed.length, result },
              ]
            : this.snapshot.feed,
      };
      for (const listener of this.listeners) listener();
    }

    return result;
  }
}
