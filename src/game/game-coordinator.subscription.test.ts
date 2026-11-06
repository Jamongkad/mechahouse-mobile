import { NarrationEngine, type NarrationModule } from "../narration/narration";
import {
  SimulationEngine,
  type SimulationModule,
} from "../simulation/simulation";
import { GameCoordinator } from "./game-coordinator";

type GameState = { temperature: { value: number } };
type Command = {
  targetModuleId: "engine";
  type: "SET_TEMPERATURE";
  value: number;
};

function makeCoordinator() {
  let failNarration = false;
  const simulationModule: SimulationModule<GameState, Command> = {
    id: "engine",
    rules: [
      {
        id: "temperature.set",
        commands: ["SET_TEMPERATURE"],
        dependsOn: [],
        produces: ["temperature.value"],
        apply(_state, context) {
          return {
            changes: { "temperature.value": context.command.value },
            outcomes: [{ id: "temperature.updated" }],
          };
        },
      },
    ],
  };
  const narrationModule: NarrationModule<GameState> = {
    id: "engine",
    rules: [
      {
        id: "temperature.updated",
        evaluate(context) {
          if (failNarration) throw new Error("Narration failed");
          return context.outcomes.some(({ id }) => id === "temperature.updated")
            ? { id: "temperature.updated" }
            : undefined;
        },
      },
    ],
  };
  const coordinator = new GameCoordinator(
    { temperature: { value: 100 } },
    new SimulationEngine([simulationModule]),
    new NarrationEngine(narrationModule, [
      { id: "temperature.updated", lines: ["Updated"] },
    ]),
  );

  return {
    coordinator,
    failNarration() {
      failNarration = true;
    },
  };
}

function setTemperature(value: number): Command {
  return { targetModuleId: "engine", type: "SET_TEMPERATURE", value };
}

describe("GameCoordinator subscriptions", () => {
  test("starts with a stable snapshot of state and an empty feed", () => {
    const { coordinator } = makeCoordinator();

    const snapshot = coordinator.getSnapshot();

    expect(snapshot).toEqual({
      state: { temperature: { value: 100 } },
      feed: [],
    });
    expect(coordinator.getSnapshot()).toBe(snapshot);
  });

  test("publishes ordered results and notifies current subscribers", () => {
    const { coordinator } = makeCoordinator();
    const listener = jest.fn();
    const unsubscribe = coordinator.subscribe(listener);

    const firstResult = coordinator.dispatch(setTemperature(120));
    const firstSnapshot = coordinator.getSnapshot();
    const secondResult = coordinator.dispatch(setTemperature(130));

    expect(firstSnapshot.feed).toEqual([{ id: 0, result: firstResult }]);
    expect(coordinator.getSnapshot().feed).toEqual([
      { id: 0, result: firstResult },
      { id: 1, result: secondResult },
    ]);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    coordinator.dispatch(setTemperature(140));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  test("does not publish state or feed when narration fails", () => {
    const { coordinator, failNarration } = makeCoordinator();
    const listener = jest.fn();
    coordinator.subscribe(listener);
    const before = coordinator.getSnapshot();
    failNarration();

    expect(() => coordinator.dispatch(setTemperature(120))).toThrow(
      "Narration failed",
    );
    expect(coordinator.getSnapshot()).toBe(before);
    expect(coordinator.getSnapshot()).toEqual({
      state: { temperature: { value: 100 } },
      feed: [],
    });
    expect(listener).not.toHaveBeenCalled();
  });
});
