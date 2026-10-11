import { simulate, type SimulationRule } from "./simulation";

type TestState = {
  a: { value: number };
  b: { value: number };
  c: { value: number };
  d: { value: number };
  unrelated: { value: number };
};

const createState = (): TestState => ({
  a: { value: 1 },
  b: { value: 0 },
  c: { value: 0 },
  d: { value: 0 },
  unrelated: { value: 42 },
});

const plusOne = (
  id: string,
  input: "a" | "b" | "c",
  output: "b" | "c" | "d",
  calls?: string[],
): SimulationRule<TestState> => ({
  id,
  dependsOn: [`${input}.value`],
  produces: [`${output}.value`],
  apply(state) {
    calls?.push(id);
    return { changes: { [`${output}.value`]: state[input].value + 1 } };
  },
});

describe("simulation kernel", () => {
  test("executes a rule when a dependency changes", () => {
    const calls: string[] = [];
    const result = simulate(createState(), { "a.value": 2 }, [
      plusOne("a-to-b", "a", "b", calls),
    ]);

    expect(result.state.a.value).toBe(2);
    expect(result.state.b.value).toBe(3);
    expect(calls).toEqual(["a-to-b"]);
  });

  test("does not execute a rule for unrelated state changes", () => {
    const calls: string[] = [];
    const result = simulate(createState(), { "unrelated.value": 43 }, [
      plusOne("a-to-b", "a", "b", calls),
    ]);

    expect(calls).toEqual([]);
    expect(result.state.b.value).toBe(0);
  });

  test("propagates one rule output to a downstream rule", () => {
    const result = simulate(createState(), { "a.value": 2 }, [
      plusOne("b-to-c", "b", "c"),
      plusOne("a-to-b", "a", "b"),
    ]);

    expect(result.state.b.value).toBe(3);
    expect(result.state.c.value).toBe(4);
  });

  test("settles a multi-rule dependency chain in one call", () => {
    const result = simulate(createState(), { "a.value": 2 }, [
      plusOne("c-to-d", "c", "d"),
      plusOne("b-to-c", "b", "c"),
      plusOne("a-to-b", "a", "b"),
    ]);

    expect(result.state.d.value).toBe(5);
  });

  test("orders independent affected rules by ID, regardless of registration order", () => {
    const calls: string[] = [];
    const cRule: SimulationRule<TestState> = {
      id: "z-to-c",
      dependsOn: ["a.value"],
      produces: ["c.value"],
      apply(state) {
        calls.push("z-to-c");
        return { changes: { "c.value": state.a.value + 2 } };
      },
    };
    const bRule = plusOne("a-to-b", "a", "b", calls);

    simulate(createState(), { "a.value": 2 }, [cRule, bRule]);

    expect(calls).toEqual(["a-to-b", "z-to-c"]);
  });

  test("produces identical state and events from identical inputs", () => {
    const eventRule: SimulationRule<TestState> = {
      id: "a-to-b",
      dependsOn: ["a.value"],
      produces: ["b.value"],
      apply(state) {
        return {
          changes: { "b.value": state.a.value + 1 },
          events: [{ type: "B_CHANGED", value: state.a.value + 1 }],
        };
      },
    };
    const state = createState();

    expect(simulate(state, { "a.value": 2 }, [eventRule])).toEqual(
      simulate(state, { "a.value": 2 }, [eventRule]),
    );
  });

  test("does not mutate the original state", () => {
    const state = createState();
    const before = structuredClone(state);
    const originalA = state.a;
    const originalB = state.b;

    simulate(state, { "a.value": 2 }, [plusOne("a-to-b", "a", "b")]);

    expect(state).toEqual(before);
    expect(state.a).toBe(originalA);
    expect(state.b).toBe(originalB);
  });

  test("preserves references for unchanged branches", () => {
    const state = createState();
    const result = simulate(state, { "a.value": 2 }, [
      plusOne("a-to-b", "a", "b"),
    ]);

    expect(result.state).not.toBe(state);
    expect(result.state.a).not.toBe(state.a);
    expect(result.state.b).not.toBe(state.b);
    expect(result.state.c).toBe(state.c);
    expect(result.state.unrelated).toBe(state.unrelated);
  });

  test("collects meaningful events in deterministic rule order", () => {
    const first: SimulationRule<TestState> = {
      id: "a-to-b",
      dependsOn: ["a.value"],
      produces: ["b.value"],
      apply(state) {
        return {
          changes: { "b.value": state.a.value + 1 },
          events: [{ type: "FIRST", value: state.a.value }],
        };
      },
    };
    const second: SimulationRule<TestState> = {
      id: "b-to-c",
      dependsOn: ["b.value"],
      produces: ["c.value"],
      apply(state) {
        return {
          changes: { "c.value": state.b.value + 1 },
          events: [{ type: "SECOND", value: state.b.value }],
        };
      },
    };

    const result = simulate(createState(), { "a.value": 2 }, [second, first]);

    expect(result.events).toEqual([
      { type: "FIRST", value: 2 },
      { type: "SECOND", value: 3 },
    ]);
  });

  test("rejects dependency cycles before executing any rule", () => {
    const calls: string[] = [];
    const backwards: SimulationRule<TestState> = {
      id: "b-to-a",
      dependsOn: ["b.value"],
      produces: ["a.value"],
      apply() {
        calls.push("b-to-a");
        return { changes: { "a.value": 3 } };
      },
    };

    expect(() =>
      simulate(createState(), { "a.value": 2 }, [
        plusOne("a-to-b", "a", "b", calls),
        backwards,
      ]),
    ).toThrow(/cycle/i);
    expect(calls).toEqual([]);
  });

  test("terminates after affected rules settle and does not propagate unchanged outputs", () => {
    const calls: string[] = [];
    const unchanged: SimulationRule<TestState> = {
      id: "a-to-b",
      dependsOn: ["a.value"],
      produces: ["b.value"],
      apply() {
        calls.push("a-to-b");
        return { changes: { "b.value": 0 } };
      },
    };

    const result = simulate(createState(), { "a.value": 2 }, [
      plusOne("b-to-c", "b", "c", calls),
      unchanged,
    ]);

    expect(calls).toEqual(["a-to-b"]);
    expect(result.state.c.value).toBe(0);
  });

  test("allows a newly registered rule without changing the kernel", () => {
    const rules = [plusOne("a-to-b", "a", "b")];
    const extendedRules = [...rules, plusOne("b-to-c", "b", "c")];

    expect(
      simulate(createState(), { "a.value": 2 }, extendedRules).state.c.value,
    ).toBe(4);
  });

  test("treats an unchanged initial patch as a no-op", () => {
    const state = createState();
    const calls: string[] = [];
    const result = simulate(state, { "a.value": 1 }, [
      plusOne("a-to-b", "a", "b", calls),
    ]);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
    expect(calls).toEqual([]);
  });

  test("rejects duplicate IDs and multiple producers", () => {
    const first = plusOne("same", "a", "b");
    const duplicateId = plusOne("same", "b", "c");
    const duplicateProducer = plusOne("other", "a", "b");

    expect(() => simulate(createState(), {}, [first, duplicateId])).toThrow(
      /duplicate rule id/i,
    );
    expect(() =>
      simulate(createState(), {}, [first, duplicateProducer]),
    ).toThrow(/multiple producers/i);
  });

  test("rejects unknown paths and outputs outside a rule declaration", () => {
    const invalid: SimulationRule<TestState> = {
      id: "invalid-output",
      dependsOn: ["a.value"],
      produces: ["b.value"],
      apply() {
        return { changes: { "c.value": 5 } };
      },
    };

    expect(() => simulate(createState(), { "missing.value": 1 }, [])).toThrow(
      /invalid state path/i,
    );
    expect(() => simulate(createState(), { "a.value": 2 }, [invalid])).toThrow(
      /undeclared output/i,
    );
  });

  test("rejects a rule that directly depends on its own output", () => {
    const selfDependent: SimulationRule<TestState> = {
      id: "self-dependent",
      dependsOn: ["a.value"],
      produces: ["a.value"],
      apply() {
        return { changes: { "a.value": 3 } };
      },
    };

    expect(() =>
      simulate(createState(), { "a.value": 2 }, [selfDependent]),
    ).toThrow(/cycle/i);
  });
});
