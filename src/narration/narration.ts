import type {
  DeepReadonly,
  SimulationOutcome,
  StateChange,
} from "../simulation/simulation";

export type NarrationOutcome = Readonly<{
  id: string;
}>;

export type NarrationFile = Readonly<{
  id: string;
  lines: readonly string[];
}>;

export type NarrationContext<State extends object> = Readonly<{
  state: DeepReadonly<State>;
  changes: readonly StateChange[];
  outcomes: readonly SimulationOutcome[];
}>;

export type NarrationRule<State extends object> = Readonly<{
  id: string;
  evaluate(context: NarrationContext<State>): NarrationOutcome | undefined;
}>;

export type NarrationModule<State extends object> = Readonly<{
  id: string;
  rules: readonly NarrationRule<State>[];
}>;

export type NarrationPassage = Readonly<{
  id: string;
  lines: readonly string[];
}>;

function readStatePath(state: object, path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (typeof value !== "object" || value === null) return undefined;
    return (value as Record<string, unknown>)[segment];
  }, state);
}

export class NarrationEngine<State extends object> {
  public constructor(
    private readonly module: NarrationModule<State>,
    private readonly files: readonly NarrationFile[],
  ) {}

  public narrate(context: NarrationContext<State>): NarrationPassage[] {
    return this.module.rules.flatMap((rule) => {
      const outcome = rule.evaluate(context);
      if (!outcome) return [];

      const file = this.files.find((candidate) => candidate.id === outcome.id);
      if (!file) {
        throw new Error(`No narration file for outcome: ${outcome.id}`);
      }

      return [
        {
          id: outcome.id,
          lines: file.lines.map((line) =>
            line.replace(/\{([^}]+)\}/g, (placeholder, key: string) => {
              const value = readStatePath(context.state, key);
              return value === undefined ? placeholder : String(value);
            }),
          ),
        },
      ];
    });
  }
}
