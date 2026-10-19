import {
  NarrationEngine,
  type NarrationFile,
  type NarrationModule,
  type NarrationContext,
} from "./narration";
import { narrationFiles } from "./narration-files";

type GameState = {
  temperature: { value: number };
  power: { value: number };
  water: { value: number };
};

describe("NarrationEngine", () => {
  it("creates a passage from game state through a narration outcome", () => {
    const gameState: GameState = {
      temperature: { value: 100 },
      power: { value: 50 },
      water: { value: 25 },
    };
    const context: NarrationContext<GameState> = {
      state: gameState,
      changes: [{ path: "temperature.value", previous: 90, next: 100 }],
      outcomes: [{ id: "temperature.current" }],
    };
    const module: NarrationModule<GameState> = {
      id: "engine",
      rules: [
        {
          id: "temperature.current",
          evaluate(receivedContext) {
            expect(receivedContext).toEqual(context);
            return receivedContext.state.temperature.value === 100
              ? { id: "temperature.current" }
              : undefined;
          },
        },
      ],
    };
    const file: NarrationFile = {
      id: "temperature.current",
      lines: ["Temperature is {temperature.value}"],
    };
    const narrationEngine = new NarrationEngine(module, [file]);

    const narration = narrationEngine.narrate(context);

    expect(narration).toEqual([
      {
        id: "temperature.current",
        lines: ["Temperature is 100"],
      },
    ]);
  });

  it("returns a passage when the water pump starts", () => {
    type PumpState = {
      waterPump: { running: boolean };
    };
    const context: NarrationContext<PumpState> = {
      state: { waterPump: { running: true } },
      changes: [{ path: "waterPump.running", previous: false, next: true }],
      outcomes: [],
    };
    const module: NarrationModule<PumpState> = {
      id: "water-pump",
      rules: [
        {
          id: "pump-started",
          evaluate(receivedContext) {
            const change = receivedContext.changes.find(
              ({ path }) => path === "waterPump.running",
            );
            return change?.previous === false && change.next === true
              ? { id: "pump-started" }
              : undefined;
          },
        },
      ],
    };
    const file: NarrationFile = {
      id: "pump-started",
      lines: ["The aging pump groans to life."],
    };

    const narration = new NarrationEngine(module, [file]).narrate(context);

    expect(narration).toEqual([
      {
        id: "pump-started",
        lines: ["The aging pump groans to life."],
      },
    ]);
  });

  it("does not narrate a pump start when the pump remains running", () => {
    type PumpState = {
      waterPump: { running: boolean };
    };
    const context: NarrationContext<PumpState> = {
      state: { waterPump: { running: true } },
      changes: [],
      outcomes: [],
    };
    const module: NarrationModule<PumpState> = {
      id: "water-pump",
      rules: [
        {
          id: "pump-started",
          evaluate(receivedContext) {
            const change = receivedContext.changes.find(
              ({ path }) => path === "waterPump.running",
            );
            return change?.previous === false && change.next === true
              ? { id: "pump-started" }
              : undefined;
          },
        },
      ],
    };

    expect(new NarrationEngine(module, []).narrate(context)).toEqual([]);
  });

  it("narrates a pump stop without narrating a pump start", () => {
    type PumpState = {
      waterPump: { running: boolean };
    };
    const context: NarrationContext<PumpState> = {
      state: { waterPump: { running: false } },
      changes: [{ path: "waterPump.running", previous: true, next: false }],
      outcomes: [],
    };
    const module: NarrationModule<PumpState> = {
      id: "water-pump",
      rules: [
        {
          id: "pump-started",
          evaluate(receivedContext) {
            const change = receivedContext.changes.find(
              ({ path }) => path === "waterPump.running",
            );
            return change?.previous === false && change.next === true
              ? { id: "pump-started" }
              : undefined;
          },
        },
        {
          id: "pump-stopped",
          evaluate(receivedContext) {
            const change = receivedContext.changes.find(
              ({ path }) => path === "waterPump.running",
            );
            return change?.previous === true && change.next === false
              ? { id: "pump-stopped" }
              : undefined;
          },
        },
      ],
    };
    const files: NarrationFile[] = [
      {
        id: "pump-stopped",
        lines: ["The water pump falls silent."],
      },
    ];

    const narration = new NarrationEngine(module, files).narrate(context);

    expect(narration).toEqual([
      {
        id: "pump-stopped",
        lines: ["The water pump falls silent."],
      },
    ]);
  });

  it("does not narrate a pump start for an unrelated pressure change", () => {
    type PumpState = {
      waterPump: { running: boolean; pressure: number };
    };
    const context: NarrationContext<PumpState> = {
      state: { waterPump: { running: true, pressure: 42 } },
      changes: [{ path: "waterPump.pressure", previous: 0, next: 42 }],
      outcomes: [],
    };
    const module: NarrationModule<PumpState> = {
      id: "water-pump",
      rules: [
        {
          id: "pump-started",
          evaluate(receivedContext) {
            const change = receivedContext.changes.find(
              ({ path }) => path === "waterPump.running",
            );
            return change?.previous === false && change.next === true
              ? { id: "pump-started" }
              : undefined;
          },
        },
      ],
    };

    expect(new NarrationEngine(module, []).narrate(context)).toEqual([]);
  });

  it("returns a passage for a matching simulation outcome", () => {
    type PumpState = {
      waterPump: { running: boolean };
    };
    const context: NarrationContext<PumpState> = {
      state: { waterPump: { running: true } },
      changes: [],
      outcomes: [{ id: "waterPump.started" }],
    };
    const module: NarrationModule<PumpState> = {
      id: "water-pump",
      rules: [
        {
          id: "pump-started-outcome",
          evaluate(receivedContext) {
            return receivedContext.outcomes.some(
              ({ id }) => id === "waterPump.started",
            )
              ? { id: "pump-started" }
              : undefined;
          },
        },
      ],
    };
    const file: NarrationFile = {
      id: "pump-started",
      lines: ["The aging pump groans to life."],
    };

    const narration = new NarrationEngine(module, [file]).narrate(context);

    expect(narration).toEqual([
      {
        id: "pump-started",
        lines: ["The aging pump groans to life."],
      },
    ]);
  });

  it("does not return a passage when the expected simulation outcome is missing", () => {
    type PumpState = {
      waterPump: { running: boolean };
    };
    const context: NarrationContext<PumpState> = {
      state: { waterPump: { running: true } },
      changes: [],
      outcomes: [],
    };
    const module: NarrationModule<PumpState> = {
      id: "water-pump",
      rules: [
        {
          id: "pump-started-outcome",
          evaluate(receivedContext) {
            return receivedContext.outcomes.some(
              ({ id }) => id === "waterPump.started",
            )
              ? { id: "pump-started" }
              : undefined;
          },
        },
      ],
    };

    expect(new NarrationEngine(module, []).narrate(context)).toEqual([]);
  });

  it("uses an outcome and resulting state to select a passage", () => {
    type PumpState = {
      waterPump: { running: boolean; worn: boolean };
    };
    const context: NarrationContext<PumpState> = {
      state: { waterPump: { running: true, worn: true } },
      changes: [],
      outcomes: [{ id: "waterPump.started" }],
    };
    const module: NarrationModule<PumpState> = {
      id: "water-pump",
      rules: [
        {
          id: "worn-pump-started",
          evaluate(receivedContext) {
            const pumpStarted = receivedContext.outcomes.some(
              ({ id }) => id === "waterPump.started",
            );
            return pumpStarted && receivedContext.state.waterPump.worn
              ? { id: "worn-pump-started" }
              : undefined;
          },
        },
      ],
    };
    const file: NarrationFile = {
      id: "worn-pump-started",
      lines: ["The worn pump coughs and shudders into motion."],
    };

    const narration = new NarrationEngine(module, [file]).narrate(context);

    expect(narration).toEqual([
      {
        id: "worn-pump-started",
        lines: ["The worn pump coughs and shudders into motion."],
      },
    ]);
  });

  it("returns passages for independent transitions from multiple modules", () => {
    type GameState = {
      hydroponics: { lightsOn: boolean };
      generator: { overloaded: boolean };
      waterPump: { running: boolean };
    };
    const context: NarrationContext<GameState> = {
      state: {
        hydroponics: { lightsOn: true },
        generator: { overloaded: true },
        waterPump: { running: true },
      },
      changes: [
        { path: "hydroponics.lightsOn", previous: false, next: true },
        { path: "generator.overloaded", previous: false, next: true },
      ],
      outcomes: [],
    };
    const module: NarrationModule<GameState> = {
      id: "station",
      rules: [
        {
          id: "hydroponics-started",
          evaluate(receivedContext) {
            return receivedContext.changes.some(
              ({ path, previous, next }) =>
                path === "hydroponics.lightsOn" &&
                previous === false &&
                next === true,
            )
              ? { id: "hydroponics-started" }
              : undefined;
          },
        },
        {
          id: "generator-overloaded",
          evaluate(receivedContext) {
            return receivedContext.changes.some(
              ({ path, previous, next }) =>
                path === "generator.overloaded" &&
                previous === false &&
                next === true,
            )
              ? { id: "generator-overloaded" }
              : undefined;
          },
        },
      ],
    };
    const files: NarrationFile[] = [
      {
        id: "hydroponics-started",
        lines: ["The hydroponics lights flicker on."],
      },
      {
        id: "generator-overloaded",
        lines: ["The generator strains under the load."],
      },
    ];

    const narration = new NarrationEngine(module, files).narrate(context);

    expect(narration).toEqual([
      {
        id: "hydroponics-started",
        lines: ["The hydroponics lights flicker on."],
      },
      {
        id: "generator-overloaded",
        lines: ["The generator strains under the load."],
      },
    ]);
  });

  it("returns a composite passage for transitions across modules", () => {
    type GameState = {
      hydroponics: { lightsOn: boolean };
      generator: { overloaded: boolean };
      waterPump: { running: boolean };
    };
    const context: NarrationContext<GameState> = {
      state: {
        hydroponics: { lightsOn: false },
        generator: { overloaded: true },
        waterPump: { running: false },
      },
      changes: [
        { path: "generator.overloaded", previous: false, next: true },
        { path: "waterPump.running", previous: true, next: false },
      ],
      outcomes: [],
    };
    const module: NarrationModule<GameState> = {
      id: "station",
      rules: [
        {
          id: "cascading-power-failure",
          evaluate(receivedContext) {
            const generatorOverloaded = receivedContext.changes.some(
              ({ path, previous, next }) =>
                path === "generator.overloaded" &&
                previous === false &&
                next === true,
            );
            const pumpStopped = receivedContext.changes.some(
              ({ path, previous, next }) =>
                path === "waterPump.running" &&
                previous === true &&
                next === false,
            );
            return generatorOverloaded && pumpStopped
              ? { id: "cascading-power-failure" }
              : undefined;
          },
        },
      ],
    };
    const file: NarrationFile = {
      id: "cascading-power-failure",
      lines: [
        "A metallic shriek erupts from the generator room.",
        "Moments later, the water pump falls silent.",
      ],
    };

    const narration = new NarrationEngine(module, [file]).narrate(context);

    expect(narration).toEqual([
      {
        id: "cascading-power-failure",
        lines: [
          "A metallic shriek erupts from the generator room.",
          "Moments later, the water pump falls silent.",
        ],
      },
    ]);
  });

  it("does not return a composite passage for an incomplete transition", () => {
    type GameState = {
      generator: { overloaded: boolean };
      waterPump: { running: boolean };
    };
    const context: NarrationContext<GameState> = {
      state: {
        generator: { overloaded: true },
        waterPump: { running: true },
      },
      changes: [{ path: "generator.overloaded", previous: false, next: true }],
      outcomes: [],
    };
    const module: NarrationModule<GameState> = {
      id: "station",
      rules: [
        {
          id: "cascading-power-failure",
          evaluate(receivedContext) {
            const generatorOverloaded = receivedContext.changes.some(
              ({ path, previous, next }) =>
                path === "generator.overloaded" &&
                previous === false &&
                next === true,
            );
            const pumpStopped = receivedContext.changes.some(
              ({ path, previous, next }) =>
                path === "waterPump.running" &&
                previous === true &&
                next === false,
            );
            return generatorOverloaded && pumpStopped
              ? { id: "cascading-power-failure" }
              : undefined;
          },
        },
      ],
    };

    expect(new NarrationEngine(module, []).narrate(context)).toEqual([]);
  });

  it("does not satisfy a composite transition with unrelated changes", () => {
    type GameState = {
      generator: { overloaded: boolean };
      waterPump: { pressure: number; running: boolean };
    };
    const context: NarrationContext<GameState> = {
      state: {
        generator: { overloaded: false },
        waterPump: { pressure: 42, running: true },
      },
      changes: [
        { path: "generator.overloaded", previous: false, next: false },
        { path: "waterPump.pressure", previous: 0, next: 42 },
      ],
      outcomes: [],
    };
    const module: NarrationModule<GameState> = {
      id: "station",
      rules: [
        {
          id: "cascading-power-failure",
          evaluate(receivedContext) {
            const generatorOverloaded = receivedContext.changes.some(
              ({ path, previous, next }) =>
                path === "generator.overloaded" &&
                previous === false &&
                next === true,
            );
            const pumpStopped = receivedContext.changes.some(
              ({ path, previous, next }) =>
                path === "waterPump.running" &&
                previous === true &&
                next === false,
            );
            return generatorOverloaded && pumpStopped
              ? { id: "cascading-power-failure" }
              : undefined;
          },
        },
      ],
    };

    expect(new NarrationEngine(module, []).narrate(context)).toEqual([]);
  });

  it("returns matching passages in narration rule registration order", () => {
    type GameState = {
      hydroponics: { lightsOn: boolean };
      generator: { overloaded: boolean };
      waterPump: { running: boolean };
    };
    const context: NarrationContext<GameState> = {
      state: {
        hydroponics: { lightsOn: true },
        generator: { overloaded: true },
        waterPump: { running: false },
      },
      changes: [
        { path: "hydroponics.lightsOn", previous: false, next: true },
        { path: "generator.overloaded", previous: false, next: true },
        { path: "waterPump.running", previous: true, next: false },
      ],
      outcomes: [],
    };
    const module: NarrationModule<GameState> = {
      id: "station",
      rules: [
        {
          id: "hydroponics-started",
          evaluate: () => ({ id: "hydroponics-started" }),
        },
        {
          id: "generator-overloaded",
          evaluate: () => ({ id: "generator-overloaded" }),
        },
        {
          id: "cascading-power-failure",
          evaluate: () => ({ id: "cascading-power-failure" }),
        },
      ],
    };
    const files: NarrationFile[] = [
      { id: "hydroponics-started", lines: ["Lights on."] },
      { id: "generator-overloaded", lines: ["Generator overloaded."] },
      {
        id: "cascading-power-failure",
        lines: ["The cascade begins."],
      },
    ];

    const narration = new NarrationEngine(module, files).narrate(context);

    expect(narration.map(({ id }) => id)).toEqual([
      "hydroponics-started",
      "generator-overloaded",
      "cascading-power-failure",
    ]);
  });

  it("skips nonmatching rules without changing matching passage order", () => {
    type GameState = {
      generator: { overloaded: boolean };
      waterPump: { running: boolean };
    };
    const context: NarrationContext<GameState> = {
      state: {
        generator: { overloaded: true },
        waterPump: { running: false },
      },
      changes: [
        { path: "generator.overloaded", previous: false, next: true },
        { path: "waterPump.running", previous: true, next: false },
      ],
      outcomes: [],
    };
    const module: NarrationModule<GameState> = {
      id: "station",
      rules: [
        {
          id: "generator-overloaded",
          evaluate: () => ({ id: "generator-overloaded" }),
        },
        {
          id: "hydroponics-started",
          evaluate: () => undefined,
        },
        {
          id: "pump-stopped",
          evaluate: () => ({ id: "pump-stopped" }),
        },
      ],
    };
    const files: NarrationFile[] = [
      { id: "generator-overloaded", lines: ["Generator overloaded."] },
      { id: "pump-stopped", lines: ["Pump stopped."] },
    ];

    const narration = new NarrationEngine(module, files).narrate(context);

    expect(narration.map(({ id }) => id)).toEqual([
      "generator-overloaded",
      "pump-stopped",
    ]);
  });

  it("leaves missing placeholders unresolved", () => {
    type PumpState = {
      waterPump: { pressure: number };
    };
    const context: NarrationContext<PumpState> = {
      state: { waterPump: { pressure: 42 } },
      changes: [],
      outcomes: [],
    };
    const module: NarrationModule<PumpState> = {
      id: "water-pump",
      rules: [
        {
          id: "pump-status",
          evaluate: () => ({ id: "pump-status" }),
        },
      ],
    };
    const file: NarrationFile = {
      id: "pump-status",
      lines: [
        "Pressure is {waterPump.pressure} PSI; status is {waterPump.status}.",
      ],
    };

    const narration = new NarrationEngine(module, [file]).narrate(context);

    expect(narration[0]?.lines).toEqual([
      "Pressure is 42 PSI; status is {waterPump.status}.",
    ]);
  });

  it("throws when a narration file is missing", () => {
    type GameState = { value: number };
    const context: NarrationContext<GameState> = {
      state: { value: 1 },
      changes: [],
      outcomes: [],
    };
    const module: NarrationModule<GameState> = {
      id: "station",
      rules: [
        {
          id: "missing-file",
          evaluate: () => ({ id: "missing-file" }),
        },
      ],
    };

    expect(() => new NarrationEngine(module, []).narrate(context)).toThrow(
      "No narration file for outcome: missing-file",
    );
  });

  it("skips rules that return undefined", () => {
    type GameState = { value: number };
    const context: NarrationContext<GameState> = {
      state: { value: 1 },
      changes: [],
      outcomes: [],
    };
    const module: NarrationModule<GameState> = {
      id: "station",
      rules: [
        {
          id: "no-match",
          evaluate: () => undefined,
        },
      ],
    };

    expect(new NarrationEngine(module, []).narrate(context)).toEqual([]);
  });

  it("interpolates multiple placeholders from the resulting state", () => {
    type PumpState = {
      waterPump: { running: boolean; pressure: number };
    };
    const context: NarrationContext<PumpState> = {
      state: { waterPump: { running: true, pressure: 42 } },
      changes: [],
      outcomes: [],
    };
    const module: NarrationModule<PumpState> = {
      id: "water-pump",
      rules: [
        {
          id: "pump-status",
          evaluate: () => ({ id: "pump-status" }),
        },
      ],
    };
    const file: NarrationFile = {
      id: "pump-status",
      lines: [
        "Pump running: {waterPump.running}; pressure: {waterPump.pressure} PSI.",
      ],
    };

    const narration = new NarrationEngine(module, [file]).narrate(context);

    expect(narration).toEqual([
      {
        id: "pump-status",
        lines: ["Pump running: true; pressure: 42 PSI."],
      },
    ]);
  });

  it("passes the same complete context to every matching rule", () => {
    type GameState = {
      generator: { overloaded: boolean };
      waterPump: { running: boolean };
    };
    const context: NarrationContext<GameState> = {
      state: {
        generator: { overloaded: true },
        waterPump: { running: false },
      },
      changes: [
        { path: "generator.overloaded", previous: false, next: true },
        { path: "waterPump.running", previous: true, next: false },
      ],
      outcomes: [{ id: "generator.overloaded" }],
    };
    const receivedContexts: NarrationContext<GameState>[] = [];
    const module: NarrationModule<GameState> = {
      id: "station",
      rules: [
        {
          id: "generator-overloaded",
          evaluate(receivedContext) {
            receivedContexts.push(receivedContext);
            return { id: "generator-overloaded" };
          },
        },
        {
          id: "pump-stopped",
          evaluate(receivedContext) {
            receivedContexts.push(receivedContext);
            return { id: "pump-stopped" };
          },
        },
      ],
    };
    const files: NarrationFile[] = [
      { id: "generator-overloaded", lines: ["Generator overloaded."] },
      { id: "pump-stopped", lines: ["Pump stopped."] },
    ];

    const narration = new NarrationEngine(module, files).narrate(context);

    expect(receivedContexts).toEqual([context, context]);
    expect(receivedContexts[0]).toBe(context);
    expect(receivedContexts[1]).toBe(context);
    expect(narration.map(({ id }) => id)).toEqual([
      "generator-overloaded",
      "pump-stopped",
    ]);
  });

  it("does not mutate the complete simulation result", () => {
    type GameState = {
      generator: { overloaded: boolean };
      waterPump: { running: boolean };
    };
    const context: NarrationContext<GameState> = {
      state: {
        generator: { overloaded: true },
        waterPump: { running: false },
      },
      changes: [
        { path: "generator.overloaded", previous: false, next: true },
        { path: "waterPump.running", previous: true, next: false },
      ],
      outcomes: [{ id: "generator.overloaded" }],
    };
    const stateBefore = context.state;
    const changesBefore = context.changes;
    const outcomesBefore = context.outcomes;
    const module: NarrationModule<GameState> = {
      id: "station",
      rules: [
        {
          id: "generator-overloaded",
          evaluate: () => ({ id: "generator-overloaded" }),
        },
      ],
    };
    const file: NarrationFile = {
      id: "generator-overloaded",
      lines: ["Generator overloaded."],
    };

    new NarrationEngine(module, [file]).narrate(context);

    expect(context.state).toBe(stateBefore);
    expect(context.changes).toBe(changesBefore);
    expect(context.outcomes).toBe(outcomesBefore);
    expect(context).toEqual({
      state: {
        generator: { overloaded: true },
        waterPump: { running: false },
      },
      changes: [
        { path: "generator.overloaded", previous: false, next: true },
        { path: "waterPump.running", previous: true, next: false },
      ],
      outcomes: [{ id: "generator.overloaded" }],
    });
  });

  it("uses a bundled JSON narration file", () => {
    type PumpState = {
      waterPump: { pressure: number; running: boolean };
    };
    const context: NarrationContext<PumpState> = {
      state: { waterPump: { pressure: 42, running: true } },
      changes: [{ path: "waterPump.running", previous: false, next: true }],
      outcomes: [],
    };
    const module: NarrationModule<PumpState> = {
      id: "water-pump",
      rules: [
        {
          id: "pump-started",
          evaluate(receivedContext) {
            const change = receivedContext.changes.find(
              ({ path }) => path === "waterPump.running",
            );
            return change?.previous === false && change.next === true
              ? { id: "pump-started" }
              : undefined;
          },
        },
      ],
    };

    const narration = new NarrationEngine(module, narrationFiles).narrate(
      context,
    );

    expect(narration).toEqual([
      {
        id: "pump-started",
        lines: [
          "The aging pump groans to life.",
          "Water pressure climbs to 42 PSI.",
        ],
      },
    ]);
  });
});
