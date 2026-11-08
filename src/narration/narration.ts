import type {
  ObservableFact,
  ObservableFactChange,
  SystemObservation,
} from "./observable-facts";

export type NarrationOutcome = Readonly<{
  id: string;
}>;

export type NarrationFile = Readonly<{
  id: string;
  lines: readonly string[];
}>;

export type InspectionNarrationRule = Readonly<{
  id: string;
  systemId: string;
  evaluate(context: SystemObservation): NarrationOutcome | undefined;
}>;

export type ActionNarrationContext = Readonly<{
  facts: readonly ObservableFact[];
  changes: readonly ObservableFactChange[];
}>;

export type ActionNarrationRule = Readonly<{
  id: string;
  evaluate(context: ActionNarrationContext): NarrationOutcome | undefined;
}>;

export type NarrationModule = Readonly<{
  id: string;
  actionRules?: readonly ActionNarrationRule[];
  inspectionRules?: readonly InspectionNarrationRule[];
}>;

export type NarrationPassage = Readonly<{
  id: string;
  lines: readonly string[];
}>;

function readFactPlaceholder(
  facts: readonly ObservableFact[],
  key: string,
): string | undefined {
  const contextSuffix = ".context";
  if (key.endsWith(contextSuffix)) {
    return facts.find((fact) => fact.id === key.slice(0, -contextSuffix.length))
      ?.context;
  }

  const labelSuffix = ".label";
  if (key.endsWith(labelSuffix)) {
    return facts.find((fact) => fact.id === key.slice(0, -labelSuffix.length))
      ?.label;
  }

  const fact = facts.find((candidate) => candidate.id === key);
  if (!fact) return undefined;
  return `${String(fact.value)}${fact.unit ? ` ${fact.unit}` : ""}`;
}

export class NarrationEngine {
  public constructor(
    private readonly module: NarrationModule,
    private readonly files: readonly NarrationFile[],
  ) {}

  public inspect(observation: SystemObservation): NarrationPassage[] {
    return (this.module.inspectionRules ?? []).flatMap((rule) => {
      if (rule.systemId !== observation.systemId) return [];

      const outcome = rule.evaluate(observation);
      if (!outcome) return [];

      const file = this.files.find((candidate) => candidate.id === outcome.id);
      if (!file) {
        throw new Error(`No narration file for outcome: ${outcome.id}`);
      }

      return [
        {
          id: outcome.id,
          lines: file.lines.map((line) =>
            line.replace(/\{([^}]+)\}/g, (placeholder, key: string) =>
              readFactPlaceholder(observation.facts, key) ?? placeholder,
            ),
          ),
        },
      ];
    });
  }

  public narrateAction(context: ActionNarrationContext): NarrationPassage[] {
    return (this.module.actionRules ?? []).flatMap((rule) => {
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
            line.replace(/\{([^}]+)\}/g, (placeholder, key: string) =>
              readFactPlaceholder(context.facts, key) ?? placeholder,
            ),
          ),
        },
      ];
    });
  }
}
