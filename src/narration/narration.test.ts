import {
  NarrationEngine,
  type ActionNarrationContext,
  type NarrationModule,
} from "./narration";

const pressureFact = {
  id: "waterPump.pressure",
  label: "Water pressure",
  value: 42,
  unit: "PSI",
  context: "Pressure is within the normal operating range.",
} as const;

describe("NarrationEngine", () => {
  test("narrates actions from observable facts and visible changes", () => {
    const receivedContexts: ActionNarrationContext[] = [];
    const module: NarrationModule = {
      id: "water-pump",
      actionRules: [
        {
          id: "pressure-restored",
          evaluate(context) {
            receivedContexts.push(context);
            return context.changes.some(
              ({ factId, previous, next }) =>
                factId === "waterPump.pressure" &&
                previous?.value === 0 &&
                next?.value === 42,
            )
              ? { id: "pressure-restored" }
              : undefined;
          },
        },
      ],
    };
    const engine = new NarrationEngine(module, [
      {
        id: "pressure-restored",
        lines: ["{waterPump.pressure.label} is back to {waterPump.pressure}. {waterPump.pressure.context}"],
      },
    ]);
    const context: ActionNarrationContext = {
      facts: [pressureFact],
      changes: [
        {
          systemId: "waterPump",
          factId: "waterPump.pressure",
          previous: { ...pressureFact, value: 0 },
          next: pressureFact,
        },
      ],
    };

    expect(engine.narrateAction(context)).toEqual([
      {
        id: "pressure-restored",
        lines: [
          "Water pressure is back to 42 PSI. Pressure is within the normal operating range.",
        ],
      },
    ]);
    expect(receivedContexts).toEqual([context]);
    expect(JSON.stringify(receivedContexts)).not.toContain("internalFaultCode");
  });

  test("inspection evaluates only rules for the requested system", () => {
    const evaluatedSystems: string[] = [];
    const module: NarrationModule = {
      id: "station",
      inspectionRules: [
        {
          id: "reactor-view",
          systemId: "reactor",
          evaluate: () => {
            evaluatedSystems.push("reactor");
            return { id: "reactor-view" };
          },
        },
        {
          id: "pump-view",
          systemId: "waterPump",
          evaluate: (context) => {
            evaluatedSystems.push(context.systemId);
            return { id: "pump-view" };
          },
        },
      ],
    };
    const engine = new NarrationEngine(module, [
      { id: "reactor-view", lines: ["Reactor output is available."] },
      {
        id: "pump-view",
        lines: ["{waterPump.pressure} — {waterPump.pressure.context}"],
      },
    ]);

    expect(
      engine.inspect({ systemId: "waterPump", facts: [pressureFact] }),
    ).toEqual([
      {
        id: "pump-view",
        lines: ["42 PSI — Pressure is within the normal operating range."],
      },
    ]);
    expect(evaluatedSystems).toEqual(["waterPump"]);
  });

  test("returns matching passages in rule registration order", () => {
    const module: NarrationModule = {
      id: "station",
      actionRules: [
        { id: "first", evaluate: () => ({ id: "first" }) },
        { id: "skip", evaluate: () => undefined },
        { id: "second", evaluate: () => ({ id: "second" }) },
      ],
    };
    const engine = new NarrationEngine(module, [
      { id: "first", lines: ["First event."] },
      { id: "second", lines: ["Second event."] },
    ]);

    expect(engine.narrateAction({ facts: [], changes: [] }).map(({ id }) => id)).toEqual([
      "first",
      "second",
    ]);
  });

  test("leaves placeholders unresolved when no observable fact matches", () => {
    const module: NarrationModule = {
      id: "water-pump",
      inspectionRules: [
        {
          id: "pump-view",
          systemId: "waterPump",
          evaluate: () => ({ id: "pump-view" }),
        },
      ],
    };
    const engine = new NarrationEngine(module, [
      { id: "pump-view", lines: ["Status: {waterPump.status}"] },
    ]);

    expect(
      engine.inspect({ systemId: "waterPump", facts: [pressureFact] })[0]?.lines,
    ).toEqual(["Status: {waterPump.status}"]);
  });

  test("throws when a selected outcome has no narration file", () => {
    const module: NarrationModule = {
      id: "water-pump",
      inspectionRules: [
        {
          id: "pump-view",
          systemId: "waterPump",
          evaluate: () => ({ id: "missing-file" }),
        },
      ],
    };

    expect(() =>
      new NarrationEngine(module, []).inspect({
        systemId: "waterPump",
        facts: [pressureFact],
      }),
    ).toThrow("No narration file for outcome: missing-file");
  });
});
