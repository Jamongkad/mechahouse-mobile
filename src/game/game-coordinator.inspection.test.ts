import {
  NarrationEngine,
  type NarrationModule,
} from "../narration/narration";
import { narrationFiles } from "../narration/narration-files";
import type { SystemObservableProjections } from "../narration/observable-facts";
import {
  SimulationEngine,
  type SimulationModule,
} from "../simulation/simulation";
import { GameCoordinator } from "./game-coordinator";

type GameState = {
  waterPump: {
    running: boolean;
    pressure: number;
    internalFaultCode: string;
  };
};

type Command = {
  targetModuleId: "water-pump";
  type: "SET_PRESSURE";
  value: number;
};

test("inspection returns projected narration without simulating or publishing", () => {
  const initialState: GameState = {
    waterPump: {
      running: true,
      pressure: 42,
      internalFaultCode: "P-SECRET-9",
    },
  };
  const simulationModule: SimulationModule<GameState, Command> = {
    id: "water-pump",
    rules: [
      {
        id: "pressure.set",
        commands: ["SET_PRESSURE"],
        dependsOn: [],
        produces: ["waterPump.pressure"],
        apply(_state, context) {
          return { changes: { "waterPump.pressure": context.command.value } };
        },
      },
    ],
  };
  const narrationModule: NarrationModule = {
    id: "station",
    inspectionRules: [
      {
        id: "water-pump.overview",
        systemId: "waterPump",
        evaluate: () => ({ id: "water-pump.overview" }),
      },
    ],
  };
  const simulation = new SimulationEngine([simulationModule]);
  const simulate = jest.spyOn(simulation, "simulate");
  const coordinator = new GameCoordinator(
    initialState,
    simulation,
    new NarrationEngine(narrationModule, narrationFiles),
    {
      waterPump: (state) => [
        {
          id: "waterPump.pressure",
          label: "Pressure",
          value: state.waterPump.pressure,
          unit: "PSI",
          context: "Pressure is within its normal operating range.",
        },
      ],
    } satisfies SystemObservableProjections<GameState>,
  );
  const before = coordinator.getSnapshot();

  const narration = coordinator.inspect("waterPump");
  const repeatedNarration = coordinator.inspect("waterPump");

  expect(narration).toEqual([
    {
      id: "water-pump.overview",
      lines: [
        "The pump holds at 42 PSI. Pressure is within its normal operating range.",
      ],
    },
  ]);
  expect(repeatedNarration).toEqual(narration);
  expect(simulate).not.toHaveBeenCalled();
  expect(coordinator.getSnapshot()).toBe(before);
  expect(coordinator.getSnapshot().gameTime).toBe(0);
  expect(coordinator.getSnapshot().feed).toEqual([]);
});
