import {
  SimulationEngine,
  type SimulationModule,
  type SimulationRule,
} from "./simulation";

type GameState = {
  temperature: { value: number };
  power: { value: number };
  water: { value: number };
};

type Command = {
  targetModuleId: string;
  type: "SET_TEMPERATURE" | "SET_OIL_TEMPERATURE";
  value: number;
};

describe("simulation engine", () => {
  test("executes the rule declared for a module command", () => {
    const gameState: GameState = {
      temperature: { value: 100 },
      power: { value: 50 },
      water: { value: 0 },
    };
    const command: Command = {
      targetModuleId: "engine",
      type: "SET_TEMPERATURE",
      value: 120,
    };
    const rule: SimulationRule<GameState, Command> = {
      id: "temperature.set",
      commands: ["SET_TEMPERATURE"],
      dependsOn: [],
      produces: ["temperature.value"],
      apply(_state, context) {
        return { changes: { "temperature.value": context.command.value } };
      },
    };

    const engine: SimulationModule<GameState, Command> = {
      id: "engine",
      rules: [rule],
    };

    const newGameState = new SimulationEngine([engine]).simulate(
      gameState,
      command,
    );

    expect(newGameState.state.temperature.value).toBe(120);
    expect(newGameState.state.power.value).toBe(50);
    expect(newGameState.state.water.value).toBe(0);
    expect(newGameState.state).not.toBe(gameState);
    expect(newGameState.state.temperature).not.toBe(gameState.temperature);
    expect(newGameState.state.power).toBe(gameState.power);
    expect(newGameState.state.water).toBe(gameState.water);
    expect(gameState.temperature.value).toBe(100);
  });

  test("throws when a module has no rule for a command", () => {
    const gameState: GameState = {
      temperature: { value: 100 },
      power: { value: 50 },
      water: { value: 0 },
    };
    const command: Command = {
      targetModuleId: "engine",
      type: "SET_OIL_TEMPERATURE",
      value: 120,
    };
    const rule: SimulationRule<GameState, Command> = {
      id: "temperature.set",
      commands: ["SET_TEMPERATURE"],
      dependsOn: [],
      produces: ["temperature.value"],
      apply(_state, context) {
        return { changes: { "temperature.value": context.command.value } };
      },
    };

    const engine: SimulationModule<GameState, Command> = {
      id: "engine",
      rules: [rule],
    };

    expect(() =>
      new SimulationEngine([engine]).simulate(gameState, command),
    ).toThrow(/no matching rule/i);
  });
  test("propagates a temperature change to a rule in another module", () => {
    const gameState: GameState = {
      temperature: { value: 100 },
      power: { value: 50 },
      water: { value: 100 },
    };

    const command: Command = {
      targetModuleId: "engine",
      type: "SET_TEMPERATURE",
      value: 120,
    };

    const setTemperature: SimulationRule<GameState, Command> = {
      id: "temperature.set",
      commands: ["SET_TEMPERATURE"],
      dependsOn: [],
      produces: ["temperature.value"],
      apply(_state, context) {
        return { changes: { "temperature.value": context.command.value } };
      },
    };
    const affectWater: SimulationRule<GameState, Command> = {
      id: "water.temperature-effect",
      dependsOn: ["temperature.value"],
      produces: ["water.value"],
      apply(state) {
        const waterUsed = Math.max(0, state.temperature.value - 100);
        return { changes: { "water.value": state.water.value - waterUsed } };
      },
    };

    const engine: SimulationModule<GameState, Command> = {
      id: "engine",
      rules: [setTemperature],
    };
    const waterSystem: SimulationModule<GameState, Command> = {
      id: "water-system",
      rules: [affectWater],
    };

    const newGameState = new SimulationEngine([waterSystem, engine]).simulate(
      gameState,
      command,
    );

    expect(newGameState.state.temperature.value).toBe(120);
    expect(newGameState.state.water.value).toBe(80);
    expect(newGameState.state.power.value).toBe(50);
    expect(gameState.temperature.value).toBe(100);
    expect(gameState.water.value).toBe(100);
  });

  test("routes a command through its module rule", () => {
    const gameState = { water_temperature: { value: 100 } };
    type WaterCommand = {
      targetModuleId: "water-pump";
      type: "SET_WATER_TEMPERATURE";
      value: number;
    };
    const waterPumpModule: SimulationModule<typeof gameState, WaterCommand> = {
      id: "water-pump",
      rules: [
        {
          id: "water.temperature.set",
          commands: ["SET_WATER_TEMPERATURE"],
          dependsOn: [],
          produces: ["water_temperature.value"],
          apply(_state, context) {
            return {
              changes: { "water_temperature.value": context.command.value },
            };
          },
        },
      ],
    };
    const command: WaterCommand = {
      targetModuleId: "water-pump",
      type: "SET_WATER_TEMPERATURE",
      value: 120,
    };

    const newGameState = new SimulationEngine([waterPumpModule]).simulate(
      gameState,
      command,
    );

    expect(newGameState.state.water_temperature.value).toBe(120);
    expect(gameState.water_temperature.value).toBe(100);
  });

  test("runs two different controls in one module", () => {
    const initialState = { temperature: { value: 100 }, power: { value: 50 } };
    type EngineCommand = {
      targetModuleId: "engine";
      type: "SET_TEMPERATURE" | "SET_POWER";
      value: number;
    };
    const engine: SimulationModule<typeof initialState, EngineCommand> = {
      id: "engine",
      rules: [
        {
          id: "temperature.set",
          commands: ["SET_TEMPERATURE"],
          dependsOn: [],
          produces: ["temperature.value"],
          apply(_state, context) {
            return { changes: { "temperature.value": context.command.value } };
          },
        },
        {
          id: "power.set",
          commands: ["SET_POWER"],
          dependsOn: [],
          produces: ["power.value"],
          apply(_state, context) {
            return { changes: { "power.value": context.command.value } };
          },
        },
      ],
    };

    const simulationEngine = new SimulationEngine([engine]);
    const afterTemperature = simulationEngine.simulate(initialState, {
      targetModuleId: "engine",
      type: "SET_TEMPERATURE",
      value: 120,
    });
    const afterPower = simulationEngine.simulate(afterTemperature.state, {
      targetModuleId: "engine",
      type: "SET_POWER",
      value: 75,
    });

    expect(afterTemperature.state).toEqual({
      temperature: { value: 120 },
      power: { value: 50 },
    });
    expect(afterPower.state).toEqual({
      temperature: { value: 120 },
      power: { value: 75 },
    });
    expect(initialState).toEqual({
      temperature: { value: 100 },
      power: { value: 50 },
    });
  });

  test("allows two commands to share one rule", () => {
    const initialState = { power: { value: 50 } };
    type PowerCommand = {
      targetModuleId: "engine";
      type: "INCREASE_POWER" | "DECREASE_POWER";
      value: number;
    };
    const engine: SimulationModule<typeof initialState, PowerCommand> = {
      id: "engine",
      rules: [
        {
          id: "power.adjust",
          commands: ["INCREASE_POWER", "DECREASE_POWER"],
          dependsOn: [],
          produces: ["power.value"],
          apply(state, context) {
            const direction =
              context.command.type === "INCREASE_POWER" ? 1 : -1;
            return {
              changes: {
                "power.value":
                  state.power.value + direction * context.command.value,
              },
            };
          },
        },
      ],
    };

    const simulationEngine = new SimulationEngine([engine]);
    const increased = simulationEngine.simulate(initialState, {
      targetModuleId: "engine",
      type: "INCREASE_POWER",
      value: 10,
    });
    const decreased = simulationEngine.simulate(increased.state, {
      targetModuleId: "engine",
      type: "DECREASE_POWER",
      value: 5,
    });

    expect(increased.state.power.value).toBe(60);
    expect(decreased.state.power.value).toBe(55);
    expect(initialState.power.value).toBe(50);
  });

  test("rejects duplicate command claims in any module before running a rule", () => {
    const initialState: GameState = {
      temperature: { value: 100 },
      power: { value: 50 },
      water: { value: 100 },
    };
    const runEngineRule = jest.fn();
    const engine: SimulationModule<GameState, Command> = {
      id: "engine",
      rules: [
        {
          id: "temperature.set",
          commands: ["SET_TEMPERATURE"],
          dependsOn: [],
          produces: ["temperature.value"],
          apply(_state, context) {
            runEngineRule();
            return { changes: { "temperature.value": context.command.value } };
          },
        },
      ],
    };
    const brokenModule: SimulationModule<GameState, Command> = {
      id: "water-system",
      rules: [
        {
          id: "oil.first",
          commands: ["SET_OIL_TEMPERATURE"],
          dependsOn: [],
          produces: [],
          apply: () => ({ changes: {} }),
        },
        {
          id: "oil.second",
          commands: ["SET_OIL_TEMPERATURE"],
          dependsOn: [],
          produces: [],
          apply: () => ({ changes: {} }),
        },
      ],
    };

    expect(() => new SimulationEngine([engine, brokenModule])).toThrow(
      /duplicate command.*water-system.*SET_OIL_TEMPERATURE/i,
    );
    expect(runEngineRule).not.toHaveBeenCalled();
    expect(initialState.temperature.value).toBe(100);
  });

  test("runs a multi-dependency rule once when a command changes both inputs", () => {
    const initialState = {
      engine: {
        power: 50,
        enabled: false,
      },
      waterPump: {
        throughput: 0,
      },
    };
    type EngineCommand = {
      targetModuleId: "engine";
      type: "SET_ENGINE_PARAMETERS";
      value: {
        power: number;
        enabled: boolean;
      };
    };
    let dependentRuleRuns = 0;
    const engine: SimulationModule<typeof initialState, EngineCommand> = {
      id: "engine",
      rules: [
        {
          id: "engine.parameters.set",
          commands: ["SET_ENGINE_PARAMETERS"],
          dependsOn: [],
          produces: ["engine.power", "engine.enabled"],
          apply(_state, context) {
            return {
              changes: {
                "engine.power": context.command.value.power,
                "engine.enabled": context.command.value.enabled,
              },
            };
          },
        },
      ],
    };
    const waterPump: SimulationModule<typeof initialState, EngineCommand> = {
      id: "water-pump",
      rules: [
        {
          id: "water-pump.throughput.from-engine",
          dependsOn: ["engine.power", "engine.enabled"],
          produces: ["waterPump.throughput"],
          apply(state) {
            dependentRuleRuns += 1;
            return {
              changes: {
                "waterPump.throughput": state.engine.enabled
                  ? state.engine.power
                  : 0,
              },
            };
          },
        },
      ],
    };

    const result = new SimulationEngine([waterPump, engine]).simulate(
      initialState,
      {
        targetModuleId: "engine",
        type: "SET_ENGINE_PARAMETERS",
        value: { power: 80, enabled: true },
      },
    );

    expect(result.state.waterPump.throughput).toBe(80);
    expect(dependentRuleRuns).toBe(1);
  });

  test("rejects multiple rules that produce the same state path", () => {
    type State = {
      temperature: { value: 100 };
      water: { value: 100 };
    };
    type TemperatureCommand = {
      targetModuleId: "engine";
      type: "SET_TEMPERATURE";
      value: number;
    };
    const engine: SimulationModule<State, TemperatureCommand> = {
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
            };
          },
        },
        {
          id: "water.from-temperature",
          dependsOn: ["temperature.value"],
          produces: ["water.value"],
          apply: () => ({ changes: { "water.value": 80 } }),
        },
        {
          id: "water.from-engine",
          dependsOn: ["temperature.value"],
          produces: ["water.value"],
          apply: () => ({ changes: { "water.value": 70 } }),
        },
      ],
    };

    expect(() => new SimulationEngine([engine])).toThrow(
      /multiple producers.*water.value/i,
    );
  });

  test("rejects dependency cycles during construction", () => {
    type State = {
      trigger: { value: false };
      a: { value: 0 };
      b: { value: 0 };
    };
    type TriggerCommand = {
      targetModuleId: "engine";
      type: "TRIGGER";
    };
    const engine: SimulationModule<State, TriggerCommand> = {
      id: "engine",
      rules: [
        {
          id: "trigger.start",
          commands: ["TRIGGER"],
          dependsOn: [],
          produces: ["trigger.value"],
          apply: () => ({ changes: { "trigger.value": true } }),
        },
        {
          id: "a.from-trigger-and-b",
          dependsOn: ["trigger.value", "b.value"],
          produces: ["a.value"],
          apply: () => ({ changes: { "a.value": 1 } }),
        },
        {
          id: "b.from-a",
          dependsOn: ["a.value"],
          produces: ["b.value"],
          apply: () => ({ changes: { "b.value": 1 } }),
        },
      ],
    };

    expect(() => new SimulationEngine([engine])).toThrow(/cycle/i);
  });

  test("engine power increases water pump throughput", () => {
    const initialState = { power: { value: 50 }, water: { value: 50 } };
    type EngineCommand = {
      targetModuleId: "engine";
      type: "SET_POWER";
      value: number;
    };
    const engine: SimulationModule<typeof initialState, EngineCommand> = {
      id: "engine",
      rules: [
        {
          id: "power.set",
          commands: ["SET_POWER"],
          dependsOn: [],
          produces: ["power.value"],
          apply(_state, context) {
            return { changes: { "power.value": context.command.value } };
          },
        },
      ],
    };
    const waterPump: SimulationModule<typeof initialState, EngineCommand> = {
      id: "water-pump",
      rules: [
        {
          id: "water.throughput.from-power",
          dependsOn: ["power.value"],
          produces: ["water.value"],
          apply(state) {
            return { changes: { "water.value": state.power.value } };
          },
        },
      ],
    };

    const nextState = new SimulationEngine([waterPump, engine]).simulate(
      initialState,
      { targetModuleId: "engine", type: "SET_POWER", value: 80 },
    );

    expect(nextState.state).toEqual({
      power: { value: 80 },
      water: { value: 80 },
    });
    expect(initialState).toEqual({
      power: { value: 50 },
      water: { value: 50 },
    });
  });

  test("applies multi-faceted engine parameters", () => {
    const initialState = {
      engine: {
        power: 50,
        oilTemp: 20,
      },
      waterPump: {
        enabled: false,
      },
    };
    type EngineCommand = {
      targetModuleId: "engine";
      type: "SET_ENGINE_PARAMETERS";
      value: {
        power: number;
        oil_temp: number;
        water_pump_enabled: boolean;
      };
    };
    const engine: SimulationModule<typeof initialState, EngineCommand> = {
      id: "engine",
      rules: [
        {
          id: "engine.parameters.set",
          commands: ["SET_ENGINE_PARAMETERS"],
          dependsOn: [],
          produces: ["engine.power", "engine.oilTemp", "waterPump.enabled"],
          apply(_state, context) {
            return {
              changes: {
                "engine.power": context.command.value.power,
                "engine.oilTemp": context.command.value.oil_temp,
                "waterPump.enabled": context.command.value.water_pump_enabled,
              },
            };
          },
        },
      ],
    };

    const nextState = new SimulationEngine([engine]).simulate(initialState, {
      targetModuleId: "engine",
      type: "SET_ENGINE_PARAMETERS",
      value: {
        power: 80,
        oil_temp: 30,
        water_pump_enabled: true,
      },
    });

    expect(nextState.state).toEqual({
      engine: {
        power: 80,
        oilTemp: 30,
      },
      waterPump: {
        enabled: true,
      },
    });
    expect(initialState).toEqual({
      engine: {
        power: 50,
        oilTemp: 20,
      },
      waterPump: {
        enabled: false,
      },
    });
  });

  test("propagates changes through multiple dependent rules", () => {
    const initialState = {
      engine: { power: 50, cooling: 0 },
      waterPump: { throughput: 0 },
    };
    type EngineCommand = {
      targetModuleId: "engine";
      type: "SET_POWER";
      value: number;
    };
    const engine: SimulationModule<typeof initialState, EngineCommand> = {
      id: "engine",
      rules: [
        {
          id: "power.set",
          commands: ["SET_POWER"],
          dependsOn: [],
          produces: ["engine.power"],
          apply(_state, context) {
            return { changes: { "engine.power": context.command.value } };
          },
        },
        {
          id: "engine.cooling.from-pump",
          dependsOn: ["waterPump.throughput"],
          produces: ["engine.cooling"],
          apply(state) {
            return {
              changes: { "engine.cooling": state.waterPump.throughput },
            };
          },
        },
      ],
    };
    const waterPump: SimulationModule<typeof initialState, EngineCommand> = {
      id: "water-pump",
      rules: [
        {
          id: "water-pump.throughput.from-power",
          dependsOn: ["engine.power"],
          produces: ["waterPump.throughput"],
          apply(state) {
            return {
              changes: { "waterPump.throughput": state.engine.power },
            };
          },
        },
      ],
    };

    const nextState = new SimulationEngine([waterPump, engine]).simulate(
      initialState,
      { targetModuleId: "engine", type: "SET_POWER", value: 80 },
    );

    expect(nextState.state).toEqual({
      engine: { power: 80, cooling: 80 },
      waterPump: { throughput: 80 },
    });
    expect(initialState).toEqual({
      engine: { power: 50, cooling: 0 },
      waterPump: { throughput: 0 },
    });
  });

  test("fans out to affected modules and leaves unrelated modules unchanged", () => {
    const initialState = {
      engine: { power: 50 },
      waterProcessor: { throughput: 0, nutrientFlow: 12 },
      crewQuarters: { warmth: 0 },
      hydroponics: { food: 4 },
    };
    type EngineCommand = {
      targetModuleId: "engine";
      type: "SET_POWER";
      value: number;
    };
    const engine: SimulationModule<typeof initialState, EngineCommand> = {
      id: "engine",
      rules: [
        {
          id: "power.set",
          commands: ["SET_POWER"],
          dependsOn: [],
          produces: ["engine.power"],
          apply(_state, context) {
            return { changes: { "engine.power": context.command.value } };
          },
        },
      ],
    };
    const waterProcessor: SimulationModule<typeof initialState, EngineCommand> =
      {
        id: "water-processor",
        rules: [
          {
            id: "water-processor.throughput.from-power",
            dependsOn: ["engine.power"],
            produces: ["waterProcessor.throughput"],
            apply(state) {
              return {
                changes: {
                  "waterProcessor.throughput": state.engine.power,
                },
              };
            },
          },
        ],
      };
    const crewQuarters: SimulationModule<typeof initialState, EngineCommand> = {
      id: "crew-quarters",
      rules: [
        {
          id: "crew-quarters.warmth.from-power",
          dependsOn: ["engine.power"],
          produces: ["crewQuarters.warmth"],
          apply(state) {
            return {
              changes: { "crewQuarters.warmth": state.engine.power },
            };
          },
        },
      ],
    };
    const hydroponics: SimulationModule<typeof initialState, EngineCommand> = {
      id: "hydroponics",
      rules: [
        {
          id: "hydroponics.food.from-nutrients",
          dependsOn: ["waterProcessor.nutrientFlow"],
          produces: ["hydroponics.food"],
          apply(state) {
            return {
              changes: {
                "hydroponics.food": state.waterProcessor.nutrientFlow,
              },
            };
          },
        },
      ],
    };

    const nextState = new SimulationEngine([
      hydroponics,
      crewQuarters,
      waterProcessor,
      engine,
    ]).simulate(initialState, {
      targetModuleId: "engine",
      type: "SET_POWER",
      value: 80,
    });

    expect(nextState.state).toEqual({
      engine: { power: 80 },
      waterProcessor: { throughput: 80, nutrientFlow: 12 },
      crewQuarters: { warmth: 80 },
      hydroponics: { food: 4 },
    });
  });

  test("does not propagate an unchanged value", () => {
    const initialState = {
      engine: { power: 50 },
      waterPump: { throughput: 50, updateCount: 0 },
    };
    type EngineCommand = {
      targetModuleId: "engine";
      type: "SET_POWER";
      value: number;
    };
    const engine: SimulationModule<typeof initialState, EngineCommand> = {
      id: "engine",
      rules: [
        {
          id: "power.set",
          commands: ["SET_POWER"],
          dependsOn: [],
          produces: ["engine.power"],
          apply(_state, context) {
            return { changes: { "engine.power": context.command.value } };
          },
        },
      ],
    };
    const waterPump: SimulationModule<typeof initialState, EngineCommand> = {
      id: "water-pump",
      rules: [
        {
          id: "water-pump.update-from-power",
          dependsOn: ["engine.power"],
          produces: ["waterPump.throughput", "waterPump.updateCount"],
          apply(state) {
            return {
              changes: {
                "waterPump.throughput": state.engine.power,
                "waterPump.updateCount": state.waterPump.updateCount + 1,
              },
            };
          },
        },
      ],
    };

    const nextState = new SimulationEngine([waterPump, engine]).simulate(
      initialState,
      { targetModuleId: "engine", type: "SET_POWER", value: 50 },
    );

    expect(nextState.state).toEqual(initialState);
    expect(nextState.state).toBe(initialState);
    expect(nextState.changes).toEqual([]);
    expect(nextState.outcomes).toEqual([]);
  });

  test("rejects a rule output that is not declared", () => {
    const initialState = { engine: { power: 50, oilTemp: 20 } };
    type EngineCommand = {
      targetModuleId: "engine";
      type: "SET_POWER";
      value: number;
    };
    const engine: SimulationModule<typeof initialState, EngineCommand> = {
      id: "engine",
      rules: [
        {
          id: "power.set",
          commands: ["SET_POWER"],
          dependsOn: [],
          produces: ["engine.power"],
          apply(_state, context) {
            return {
              changes: { "engine.oilTemp": context.command.value },
            };
          },
        },
      ],
    };

    expect(() =>
      new SimulationEngine([engine]).simulate(initialState, {
        targetModuleId: "engine",
        type: "SET_POWER",
        value: 80,
      }),
    ).toThrow(/undeclared output.*power.set.*engine.oilTemp/i);
    expect(initialState).toEqual({ engine: { power: 50, oilTemp: 20 } });
  });

  //Validation shit
  test("rejects duplicate rule IDs before running a rule", () => {
    type State = { temperature: { value: number } };
    type TemperatureCommand = {
      targetModuleId: "engine";
      type: "SET_TEMPERATURE";
      value: number;
    };
    const runRule = jest.fn();
    const duplicateRule: SimulationRule<State, TemperatureCommand> = {
      id: "temperature.set",
      commands: ["SET_TEMPERATURE"],
      dependsOn: [],
      produces: ["temperature.value"],
      apply() {
        runRule();
        return { changes: { "temperature.value": 120 } };
      },
    };
    const engine: SimulationModule<State, TemperatureCommand> = {
      id: "engine",
      rules: [duplicateRule, { ...duplicateRule, commands: undefined }],
    };

    expect(() => new SimulationEngine([engine])).toThrow(
      /duplicate rule id.*engine.*temperature.set/i,
    );
    expect(runRule).not.toHaveBeenCalled();
  });

  test.each([
    {
      missing: "dependsOn",
      dependsOn: [],
      produces: ["water.value"],
    },
    {
      missing: "produces",
      dependsOn: ["temperature.value"],
      produces: [],
    },
  ])(
    "rejects a dependent rule without $missing before running a command",
    ({ missing, dependsOn, produces }) => {
      const initialState: GameState = {
        temperature: { value: 100 },
        power: { value: 50 },
        water: { value: 100 },
      };
      const runEngineRule = jest.fn();
      const engine: SimulationModule<GameState, Command> = {
        id: "engine",
        rules: [
          {
            id: "temperature.set",
            commands: ["SET_TEMPERATURE"],
            dependsOn: [],
            produces: ["temperature.value"],
            apply(_state, context) {
              runEngineRule();
              return {
                changes: { "temperature.value": context.command.value },
              };
            },
          },
        ],
      };
      const waterSystem: SimulationModule<GameState, Command> = {
        id: "water-system",
        rules: [
          {
            id: "water.invalid",
            dependsOn,
            produces,
            apply: () => ({ changes: {} }),
          },
        ],
      };

      expect(() =>
        new SimulationEngine([engine, waterSystem]).simulate(initialState, {
          targetModuleId: "engine",
          type: "SET_TEMPERATURE",
          value: 120,
        }),
      ).toThrow(
        new RegExp(
          `invalid dependent rule.*water-system.*water.invalid.*${missing}`,
          "i",
        ),
      );
      expect(runEngineRule).not.toHaveBeenCalled();
      expect(initialState.temperature.value).toBe(100);
    },
  );

  test("returns outcomes emitted by the rule that updates state", () => {
    const initialState: GameState = {
      temperature: { value: 100 },
      power: { value: 50 },
      water: { value: 100 },
    };
    const engine: SimulationModule<GameState, Command> = {
      id: "engine",
      rules: [
        {
          id: "temperature.set",
          commands: ["SET_TEMPERATURE"],
          dependsOn: [],
          produces: ["temperature.value"],
          apply(_state, context) {
            // do additional logic here to determine outcomes based on the new state
            return {
              changes: { "temperature.value": context.command.value },
              outcomes: [{ id: "temperature.changed" }],
            };
          },
        },
      ],
    };

    const result = new SimulationEngine([engine]).simulate(initialState, {
      targetModuleId: "engine",
      type: "SET_TEMPERATURE",
      value: 120,
    });

    expect(result.state.temperature.value).toBe(120);
    expect(result.changes).toEqual([
      { path: "temperature.value", previous: 100, next: 120 },
    ]);
    expect(result.outcomes).toEqual([{ id: "temperature.changed" }]);
  });

  test("propagates a multifaceted command through multiple outcome-producing rules", () => {
    const initialState = {
      engine: {
        power: 50,
        oilTemp: 20,
      },
      waterPump: {
        enabled: false,
        throughput: 0,
      },
      crewQuarters: {
        warmth: 0,
      },
    };
    type EngineCommand = {
      targetModuleId: "engine";
      type: "SET_ENGINE_PARAMETERS";
      value: {
        power: number;
        oil_temp: number;
        water_pump_enabled: boolean;
      };
    };

    const engine: SimulationModule<typeof initialState, EngineCommand> = {
      id: "engine",
      rules: [
        {
          id: "engine.parameters.set",
          commands: ["SET_ENGINE_PARAMETERS"],
          dependsOn: [],
          produces: ["engine.power", "engine.oilTemp", "waterPump.enabled"],
          apply(_state, context) {
            return {
              changes: {
                "engine.power": context.command.value.power,
                "engine.oilTemp": context.command.value.oil_temp,
                "waterPump.enabled": context.command.value.water_pump_enabled,
              },
              outcomes: [{ id: "engine.parameters.updated" }],
            };
          },
        },
      ],
    };
    const waterPump: SimulationModule<typeof initialState, EngineCommand> = {
      id: "water-pump",
      rules: [
        {
          id: "water-pump.throughput.from-engine",
          dependsOn: ["waterPump.enabled"],
          produces: ["waterPump.throughput"],
          apply(state) {
            return {
              changes: {
                "waterPump.throughput": state.waterPump.enabled
                  ? state.engine.power
                  : 0,
              },
              outcomes: [{ id: "water-pump.throughput.updated" }],
            };
          },
        },
      ],
    };
    const crewQuarters: SimulationModule<typeof initialState, EngineCommand> = {
      id: "crew-quarters",
      rules: [
        {
          id: "crew-quarters.warmth.from-engine",
          dependsOn: ["engine.power"],
          produces: ["crewQuarters.warmth"],
          apply(state) {
            return {
              changes: { "crewQuarters.warmth": state.engine.power },
              outcomes: [{ id: "crew-quarters.warmth.updated" }],
            };
          },
        },
      ],
    };

    const command: EngineCommand = {
      targetModuleId: "engine",
      type: "SET_ENGINE_PARAMETERS",
      value: {
        power: 80,
        oil_temp: 30,
        water_pump_enabled: true,
      },
    };
    const result = new SimulationEngine([
      waterPump,
      crewQuarters,
      engine,
    ]).simulate(initialState, command);
    const reorderedResult = new SimulationEngine([
      crewQuarters,
      waterPump,
      engine,
    ]).simulate(initialState, command);

    expect(result.state).toEqual({
      engine: {
        power: 80,
        oilTemp: 30,
      },
      waterPump: {
        enabled: true,
        throughput: 80,
      },
      crewQuarters: {
        warmth: 80,
      },
    });
    expect(result.outcomes).toEqual([
      { id: "engine.parameters.updated" },
      { id: "crew-quarters.warmth.updated" },
      { id: "water-pump.throughput.updated" },
    ]);
    expect(reorderedResult.state).toEqual(result.state);
    expect(reorderedResult.outcomes).toEqual(result.outcomes);
  });
});
