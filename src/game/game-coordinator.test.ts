import { NarrationEngine, type NarrationModule } from "../narration/narration";
import {
  SimulationEngine,
  type SimulationModule,
} from "../simulation/simulation";
import type { SystemObservableProjections } from "../narration/observable-facts";
import { GameCoordinator } from "./game-coordinator";

type GameState = {
  temperature: { value: number };
  internalDiagnosticCode: string;
};

type Command = {
  targetModuleId: "engine";
  type: "SET_TEMPERATURE";
  value: number;
};

test("coordinates a command, simulation result, and narration passage", () => {
  const initialState: GameState = {
    temperature: { value: 100 },
    internalDiagnosticCode: "SECRET-42",
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
  const narrationModule: NarrationModule = {
    id: "engine",
    actionRules: [
      {
        id: "temperature.updated",
        evaluate(context) {
          return context.changes.some(
            ({ factId, previous, next }) =>
              factId === "temperature.value" &&
              previous?.value === 100 &&
              next?.value === 120,
          )
            ? { id: "temperature.updated" }
            : undefined;
        },
      },
    ],
  };
  const narrationEngine = new NarrationEngine(narrationModule, [
    {
      id: "temperature.updated",
      lines: ["Temperature rises to {temperature.value}."],
    },
  ]);
  const narrateAction = jest.spyOn(narrationEngine, "narrateAction");
  const coordinator = new GameCoordinator(
    initialState,
    new SimulationEngine([simulationModule]),
    narrationEngine,
    {
      engine: (state) => [
        {
          id: "temperature.value",
          label: "Temperature",
          value: state.temperature.value,
          unit: "degrees",
        },
      ],
    } satisfies SystemObservableProjections<GameState>,
  );

  const result = coordinator.dispatch({
    targetModuleId: "engine",
    type: "SET_TEMPERATURE",
    value: 120,
  });

  expect(narrateAction).toHaveBeenCalledWith({
    facts: [
      {
        id: "temperature.value",
        label: "Temperature",
        value: 120,
        unit: "degrees",
      },
    ],
    changes: [
      {
        systemId: "engine",
        factId: "temperature.value",
        previous: {
          id: "temperature.value",
          label: "Temperature",
          value: 100,
          unit: "degrees",
        },
        next: {
          id: "temperature.value",
          label: "Temperature",
          value: 120,
          unit: "degrees",
        },
      },
    ],
  });
  expect(result).toEqual({
    state: {
      temperature: { value: 120 },
      internalDiagnosticCode: "SECRET-42",
    },
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
