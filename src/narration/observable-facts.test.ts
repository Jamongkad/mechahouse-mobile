import {
  projectSystemObservation,
  selectObservableFacts,
  type SystemObservableProjections,
} from "./observable-facts";

type GameState = {
  waterPump: {
    running: boolean;
    pressure: number;
    internalFaultCode: string;
  };
  reactor: {
    output: number;
  };
};

const projections = {
  waterPump: (state) => [
    {
      id: "pump.running",
      label: "Pump status",
      value: state.waterPump.running ? "running" : "stopped",
    },
    {
      id: "pump.pressure",
      label: "Water pressure",
      value: state.waterPump.pressure,
      unit: "PSI",
      context: "Pressure available to the water system.",
    },
  ],
  reactor: (state) => [
    {
      id: "reactor.output",
      label: "Reactor output",
      value: state.reactor.output,
      unit: "MW",
    },
  ],
} satisfies SystemObservableProjections<GameState>;

describe("projectSystemObservation", () => {
  test("returns only facts selected by the requested system projection", () => {
    const state: GameState = {
      waterPump: {
        running: true,
        pressure: 42,
        internalFaultCode: "P-SECRET-9",
      },
      reactor: { output: 120 },
    };

    const observation = projectSystemObservation(state, "waterPump", projections);

    expect(observation).toEqual({
      systemId: "waterPump",
      facts: [
        {
          id: "pump.running",
          label: "Pump status",
          value: "running",
        },
        {
          id: "pump.pressure",
          label: "Water pressure",
          value: 42,
          unit: "PSI",
          context: "Pressure available to the water system.",
        },
      ],
    });
    expect(JSON.stringify(observation)).not.toContain("P-SECRET-9");
    expect(JSON.stringify(observation)).not.toContain("reactor");
  });

  test("throws when a runtime system id has no projection", () => {
    expect(() =>
      projectSystemObservation(
        { waterPump: { running: true, pressure: 42, internalFaultCode: "x" }, reactor: { output: 120 } },
        "unknown" as "waterPump",
        projections,
      ),
    ).toThrow("No observable projection for system: unknown");
  });
});

describe("selectObservableFacts", () => {
  const facts = [
    { id: "pump.status", label: "Pump status", value: "running" },
    {
      id: "pump.pressure",
      label: "Pressure",
      value: 42,
      unit: "PSI",
      detailGroup: "pressure",
    },
    {
      id: "pump.pressure-trend",
      label: "Pressure trend",
      value: "falling",
      detailGroup: "pressure",
    },
    {
      id: "pump.seal-wear",
      label: "Seal wear",
      value: "moderate",
      detailGroup: "maintenance",
    },
  ] as const;

  test("selects only ungrouped salient facts for the overview", () => {
    expect(selectObservableFacts(facts)).toEqual([facts[0]]);
  });

  test("selects only facts in the requested follow-up group", () => {
    expect(selectObservableFacts(facts, "pressure")).toEqual([
      facts[1],
      facts[2],
    ]);
  });
});
