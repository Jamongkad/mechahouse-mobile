import type {
  NarrationContext,
  NarrationEngine,
  NarrationPassage,
} from "../narration/narration";
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
    private readonly narrationEngine: NarrationEngine<State>,
  ) {
    this.snapshot = { state, feed: [] };
  }

  getSnapshot = (): GameCoordinatorSnapshot<State> => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  dispatch(command: Command): GameCoordinatorResult<State> {
    const simulationResult = this.simulationEngine.simulate(
      this.snapshot.state,
      command,
    );

    const narration = this.narrationEngine.narrate(
      simulationResult as NarrationContext<State>,
    );

    const result: GameCoordinatorResult<State> = {
      ...simulationResult,
      narration,
    };

    this.snapshot = {
      state: result.state,
      feed: [
        ...this.snapshot.feed,
        { id: this.snapshot.feed.length, result },
      ],
    };
    for (const listener of this.listeners) listener();

    return result;
  }
}
