import { NarrationEngine, type NarrationModule } from "../narration/narration";
import {
  SimulationEngine,
  type SimulationModule,
} from "../simulation/simulation";
import { GameCoordinator } from "./game-coordinator";

type GameState = {
  temperature: { value: number };
};

type Command = {
  targetModuleId: "engine";
  type: "SET_TEMPERATURE";
  value: number;
};

test("coordinates a command, simulation result, and narration passage", () => {
  const initialState: GameState = {
    temperature: { value: 100 },
  };
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
          return context.outcomes.some(({ id }) => id === "temperature.updated")
            ? { id: "temperature.updated" }
            : undefined;
        },
      },
    ],
  };
  const narrationEngine = new NarrationEngine(narrationModule, [
    {
      id: "temperature.updated",
      lines: ["Temperature rises to {temperature.value} degrees."],
    },
  ]);
  const narrate = jest.spyOn(narrationEngine, "narrate");
  const coordinator = new GameCoordinator(
    initialState,
    new SimulationEngine([simulationModule]),
    narrationEngine,
  );

  const result = coordinator.dispatch({
    targetModuleId: "engine",
    type: "SET_TEMPERATURE",
    value: 120,
  });

  expect(narrate).toHaveBeenCalledWith({
    state: { temperature: { value: 120 } },
    changes: [{ path: "temperature.value", previous: 100, next: 120 }],
    outcomes: [{ id: "temperature.updated" }],
  });
  expect(result).toEqual({
    state: { temperature: { value: 120 } },
    changes: [{ path: "temperature.value", previous: 100, next: 120 }],
    outcomes: [{ id: "temperature.updated" }],
    narration: [
      {
        id: "temperature.updated",
        lines: ["Temperature rises to 120 degrees."],
      },
    ],
  });
});
