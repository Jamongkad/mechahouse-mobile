export type StatePath = string;
export type StateChanges = Readonly<Record<StatePath, unknown>>;

export type DeepReadonly<T> = T extends object
  ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
  : T;

export type SimulationContext = Readonly<Record<string, unknown>>;
export type SimulationEvent = Readonly<{
  type: string;
  [key: string]: unknown;
}>;

export type RuleResult = {
  changes: StateChanges;
  events?: readonly SimulationEvent[];
};

export type SimulationRule<State extends object> = {
  id: string;
  dependsOn: readonly StatePath[];
  produces: readonly StatePath[];
  apply(state: DeepReadonly<State>, context: SimulationContext): RuleResult;
};

export type SimulationResult<State extends object> = {
  state: State;
  events: readonly SimulationEvent[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pathSegments(state: object, path: StatePath): string[] {
  const segments = path.split(".");
  let current: unknown = state;

  for (const segment of segments) {
    if (!segment || !isRecord(current) || !Object.hasOwn(current, segment)) {
      throw new Error(`Invalid state path: ${path}`);
    }
    current = current[segment];
  }

  if (isRecord(current) || Array.isArray(current)) {
    throw new Error(`Invalid state path (expected a leaf): ${path}`);
  }

  return segments;
}

function setLeaf(
  current: Record<string, unknown>,
  segments: readonly string[],
  value: unknown,
): Record<string, unknown> {
  const [head, ...tail] = segments;
  if (tail.length === 0) return { ...current, [head]: value };
  return {
    ...current,
    [head]: setLeaf(current[head] as Record<string, unknown>, tail, value),
  };
}

function applyChanges<State extends object>(
  state: State,
  changes: StateChanges,
) {
  let next = state;
  const changedPaths = new Set<StatePath>();

  for (const [path, value] of Object.entries(changes)) {
    const segments = pathSegments(next, path);
    let current: unknown = next;
    for (const segment of segments)
      current = (current as Record<string, unknown>)[segment];

    if (!Object.is(current, value)) {
      next = setLeaf(next as Record<string, unknown>, segments, value) as State;
      changedPaths.add(path);
    }
  }

  return { state: next, changedPaths };
}

function orderedRules<State extends object>(
  state: State,
  rules: readonly SimulationRule<State>[],
) {
  const byId = new Map<string, SimulationRule<State>>();
  const producers = new Map<StatePath, string>();

  for (const rule of rules) {
    if (!rule.id || byId.has(rule.id))
      throw new Error(`Duplicate rule ID: ${rule.id}`);
    byId.set(rule.id, rule);

    for (const path of [...rule.dependsOn, ...rule.produces])
      pathSegments(state, path);
    for (const path of rule.produces) {
      if (producers.has(path))
        throw new Error(`Multiple producers for state path: ${path}`);
      producers.set(path, rule.id);
    }
  }

  const consumers = new Map<string, Set<string>>(
    rules.map((rule) => [rule.id, new Set()]),
  );
  const indegree = new Map<string, number>(rules.map((rule) => [rule.id, 0]));

  for (const rule of rules) {
    for (const path of rule.dependsOn) {
      const producer = producers.get(path);
      if (producer && !consumers.get(producer)!.has(rule.id)) {
        consumers.get(producer)!.add(rule.id);
        indegree.set(rule.id, indegree.get(rule.id)! + 1);
      }
    }
  }

  const ready = rules
    .filter((rule) => indegree.get(rule.id) === 0)
    .map((rule) => rule.id)
    .sort();
  const ordered: SimulationRule<State>[] = [];

  while (ready.length > 0) {
    const id = ready.shift()!;
    ordered.push(byId.get(id)!);
    for (const consumer of consumers.get(id)!) {
      const remaining = indegree.get(consumer)! - 1;
      indegree.set(consumer, remaining);
      if (remaining === 0) ready.push(consumer);
    }
    ready.sort();
  }

  if (ordered.length !== rules.length)
    throw new Error("Rule dependency cycle detected");
  return ordered;
}

export function simulate<State extends object>(
  state: State,
  initialChanges: StateChanges,
  rules: readonly SimulationRule<State>[],
  context: SimulationContext = {},
): SimulationResult<State> {
  const order = orderedRules(state, rules);
  const initial = applyChanges(state, initialChanges);
  let current = initial.state;
  const changedPaths = initial.changedPaths;
  const events: SimulationEvent[] = [];

  for (const rule of order) {
    if (!rule.dependsOn.some((path) => changedPaths.has(path))) continue;

    const result = rule.apply(current as DeepReadonly<State>, context);
    for (const path of Object.keys(result.changes)) {
      if (!rule.produces.includes(path))
        throw new Error(`Undeclared output from ${rule.id}: ${path}`);
    }

    const applied = applyChanges(current, result.changes);
    current = applied.state;
    for (const path of applied.changedPaths) changedPaths.add(path);
    if (result.events) events.push(...result.events);
  }

  return { state: current, events };
}
