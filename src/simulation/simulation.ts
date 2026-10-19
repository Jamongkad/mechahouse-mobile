export type DeepReadonly<T> = T extends object
  ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
  : T;

export type StatePath = string;
export type StateChanges = Readonly<Record<StatePath, unknown>>;
export type SimulationOutcome = Readonly<{ id: string }>;
export type StateChange = Readonly<{
  path: StatePath;
  previous: unknown;
  next: unknown;
}>;
export type SimulationContext<Command> = Readonly<{
  command: DeepReadonly<Command>;
}>;
export type RuleResult = Readonly<{
  changes: StateChanges;
  outcomes?: readonly SimulationOutcome[];
}>;

export type SimulationResult<State extends object> = Readonly<{
  state: State;
  changes: readonly StateChange[];
  outcomes: readonly SimulationOutcome[];
}>;

export type SimulationRule<
  State extends object,
  Command extends { type: string },
> = {
  id: string;
  commands?: readonly Command["type"][];
  dependsOn: readonly StatePath[];
  produces: readonly StatePath[];
  apply(
    state: DeepReadonly<State>,
    context: SimulationContext<Command>,
  ): RuleResult;
};

export type SimulationModule<
  State extends object,
  Command extends { type: string },
> = {
  id: string;
  rules: readonly SimulationRule<State, Command>[];
};

function readPath(state: object, path: StatePath): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, segment) => (value as Record<string, unknown>)[segment],
      state,
    );
}

function writePath(
  state: Record<string, unknown>,
  segments: readonly string[],
  value: unknown,
): Record<string, unknown> {
  const [head, ...tail] = segments;
  return {
    ...state,
    [head]:
      tail.length === 0
        ? value
        : writePath(state[head] as Record<string, unknown>, tail, value),
  };
}

function qualifiedRuleId(moduleId: string, ruleId: string): string {
  return `${moduleId}:${ruleId}`;
}

function compareRuleIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function commandKey(moduleId: string, commandType: string): string {
  return `${moduleId}\u0000${commandType}`;
}

function validatePathSyntax(path: StatePath): void {
  if (
    path.length === 0 ||
    path.split(".").some((segment) => segment.length === 0)
  ) {
    throw new Error(`Invalid state path: ${path}`);
  }
}

export class SimulationEngine<
  State extends object,
  Command extends { type: string; targetModuleId: string },
> {
  private readonly commandRules: ReadonlyMap<
    string,
    SimulationRule<State, Command>
  >;
  private readonly dependentsByPath: ReadonlyMap<
    StatePath,
    readonly SimulationRule<State, Command>[]
  >;
  private readonly ruleOrder: ReadonlyMap<
    SimulationRule<State, Command>,
    number
  >;

  constructor(modules: readonly SimulationModule<State, Command>[]) {
    const moduleIds = new Set<string>();
    const rules: SimulationRule<State, Command>[] = [];
    const ruleIds = new Map<SimulationRule<State, Command>, string>();
    const seenRuleIds = new Set<string>();
    const commandRules = new Map<string, SimulationRule<State, Command>>();
    const producersByPath = new Map<
      StatePath,
      SimulationRule<State, Command>
    >();

    for (const module of modules) {
      if (moduleIds.has(module.id)) {
        throw new Error(`Duplicate module ID: ${module.id}`);
      }
      moduleIds.add(module.id);

      const commandTypes = new Set<Command["type"]>();
      for (const rule of module.rules) {
        const id = qualifiedRuleId(module.id, rule.id);
        if (seenRuleIds.has(id)) {
          throw new Error(`Duplicate rule ID: ${id}`);
        }
        if (rule.id.length === 0) {
          throw new Error(`Invalid rule ID in module ${module.id}`);
        }
        seenRuleIds.add(id);
        ruleIds.set(rule, id);
        rules.push(rule);

        if (!rule.commands?.length) {
          if (rule.dependsOn.length === 0) {
            throw new Error(
              `Invalid dependent rule in module ${module.id}: ${rule.id} requires dependsOn`,
            );
          }
          if (rule.produces.length === 0) {
            throw new Error(
              `Invalid dependent rule in module ${module.id}: ${rule.id} requires produces`,
            );
          }
        }

        for (const path of [...rule.dependsOn, ...rule.produces]) {
          validatePathSyntax(path);
        }

        for (const commandType of rule.commands ?? []) {
          if (commandTypes.has(commandType)) {
            throw new Error(
              `Duplicate command in module ${module.id}: ${commandType}`,
            );
          }
          commandTypes.add(commandType);
          commandRules.set(commandKey(module.id, commandType), rule);
        }

        for (const path of rule.produces) {
          if (producersByPath.has(path)) {
            throw new Error(`Multiple producers for state path: ${path}`);
          }
          producersByPath.set(path, rule);
        }
      }
    }

    const consumersByRule = new Map<
      SimulationRule<State, Command>,
      Set<SimulationRule<State, Command>>
    >();
    const indegree = new Map<SimulationRule<State, Command>, number>();
    for (const rule of rules) {
      consumersByRule.set(rule, new Set());
      indegree.set(rule, 0);
    }

    for (const rule of rules) {
      for (const path of new Set(rule.dependsOn)) {
        const producer = producersByPath.get(path);
        if (!producer) continue;

        const consumers = consumersByRule.get(producer)!;
        if (consumers.has(rule)) continue;
        consumers.add(rule);
        indegree.set(rule, indegree.get(rule)! + 1);
      }
    }

    const ready = rules
      .filter((rule) => indegree.get(rule) === 0)
      .sort((left, right) =>
        compareRuleIds(ruleIds.get(left)!, ruleIds.get(right)!),
      );
    const orderedRules: SimulationRule<State, Command>[] = [];

    while (ready.length > 0) {
      const rule = ready.shift()!;
      orderedRules.push(rule);

      for (const consumer of consumersByRule.get(rule)!) {
        const nextIndegree = indegree.get(consumer)! - 1;
        indegree.set(consumer, nextIndegree);
        if (nextIndegree === 0) ready.push(consumer);
      }

      ready.sort((left, right) =>
        compareRuleIds(ruleIds.get(left)!, ruleIds.get(right)!),
      );
    }

    if (orderedRules.length !== rules.length) {
      throw new Error("Rule dependency cycle detected");
    }

    const dependentsByPath = new Map<
      StatePath,
      SimulationRule<State, Command>[]
    >();
    for (const rule of rules) {
      for (const path of new Set(rule.dependsOn)) {
        const dependents = dependentsByPath.get(path) ?? [];
        dependents.push(rule);
        dependentsByPath.set(path, dependents);
      }
    }
    const ruleOrder = new Map(
      orderedRules.map((rule, index) => [rule, index] as const),
    );
    for (const dependents of dependentsByPath.values()) {
      dependents.sort(
        (left, right) => ruleOrder.get(left)! - ruleOrder.get(right)!,
      );
    }

    this.commandRules = commandRules;
    this.dependentsByPath = dependentsByPath;
    this.ruleOrder = ruleOrder;
  }

  simulate(state: State, command: Command): SimulationResult<State> {
    const rule = this.commandRules.get(
      commandKey(command.targetModuleId, command.type),
    );
    if (!rule) throw new Error("No matching rule for command");

    const context: SimulationContext<Command> = {
      command: command as DeepReadonly<Command>,
    };
    let current = state;
    const executed = new Set<SimulationRule<State, Command>>();
    const pending = new Set<SimulationRule<State, Command>>([rule]);
    const changes: StateChange[] = [];
    const outcomes: SimulationOutcome[] = [];

    function execute(
      affectedRule: SimulationRule<State, Command>,
    ): readonly StatePath[] {
      const changedPaths: StatePath[] = [];
      const result = affectedRule.apply(
        current as DeepReadonly<State>,
        context,
      );
      for (const [path, value] of Object.entries(result.changes)) {
        if (!affectedRule.produces.includes(path)) {
          throw new Error(`Undeclared output from ${affectedRule.id}: ${path}`);
        }
        const previous = readPath(current, path);
        if (!Object.is(previous, value)) {
          current = writePath(
            current as Record<string, unknown>,
            path.split("."),
            value,
          ) as State;
          changedPaths.push(path);
          changes.push({ path, previous, next: value });
        }
      }
      outcomes.push(...(result.outcomes ?? []));
      executed.add(affectedRule);
      return changedPaths;
    }

    while (pending.size > 0) {
      const affectedRule = [...pending].sort(
        (left, right) => this.ruleOrder.get(left)! - this.ruleOrder.get(right)!,
      )[0];
      pending.delete(affectedRule);
      if (executed.has(affectedRule)) continue;

      const changedPaths = execute(affectedRule);
      for (const path of changedPaths) {
        for (const dependent of this.dependentsByPath.get(path) ?? []) {
          if (!executed.has(dependent)) pending.add(dependent);
        }
      }
    }

    return { state: current, changes, outcomes };
  }
}
