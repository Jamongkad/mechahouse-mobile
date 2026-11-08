import type { DeepReadonly } from "../simulation/simulation";

export type ObservableFactValue = string | number | boolean;

export type ObservableFact = Readonly<{
  id: string;
  label: string;
  value: ObservableFactValue;
  unit?: string;
  context?: string;
  detailGroup?: string;
}>;

export type SystemObservableProjection<State extends object> = (
  state: DeepReadonly<State>,
) => readonly ObservableFact[];

export type SystemObservableProjections<State extends object> = Readonly<
  Record<string, SystemObservableProjection<State>>
>;

export type SystemObservation<SystemId extends string = string> = Readonly<{
  systemId: SystemId;
  facts: readonly ObservableFact[];
}>;

export type ObservableFactChange = Readonly<{
  systemId: string;
  factId: string;
  previous?: ObservableFact;
  next?: ObservableFact;
}>;

export function selectObservableFacts(
  facts: readonly ObservableFact[],
  detailGroup?: string,
): readonly ObservableFact[] {
  return facts.filter((fact) =>
    detailGroup === undefined
      ? fact.detailGroup === undefined
      : fact.detailGroup === detailGroup,
  );
}

export function projectSystemObservation<
  State extends object,
  Projections extends SystemObservableProjections<State>,
  SystemId extends keyof Projections & string,
>(
  state: State,
  systemId: SystemId,
  projections: Projections,
): SystemObservation<SystemId> {
  const project = projections[systemId];
  if (!project) {
    throw new Error(`No observable projection for system: ${systemId}`);
  }

  return {
    systemId,
    facts: project(state as DeepReadonly<State>),
  };
}

export function projectAllSystemObservations<
  State extends object,
  Projections extends SystemObservableProjections<State>,
>(
  state: State,
  projections: Projections,
): readonly SystemObservation[] {
  return Object.entries(projections).map(([systemId, project]) => ({
    systemId,
    facts: project(state as DeepReadonly<State>),
  }));
}

function factsMatch(left: ObservableFact, right: ObservableFact): boolean {
  return (
    left.label === right.label &&
    Object.is(left.value, right.value) &&
    left.unit === right.unit &&
    left.context === right.context &&
    left.detailGroup === right.detailGroup
  );
}

export function diffSystemObservations(
  previous: readonly SystemObservation[],
  next: readonly SystemObservation[],
): readonly ObservableFactChange[] {
  const previousFacts = new Map(
    previous.flatMap(({ systemId, facts }) =>
      facts.map((fact) => [`${systemId}:${fact.id}`, { systemId, fact }] as const),
    ),
  );
  const nextFacts = new Map(
    next.flatMap(({ systemId, facts }) =>
      facts.map((fact) => [`${systemId}:${fact.id}`, { systemId, fact }] as const),
    ),
  );
  const keys = new Set([...previousFacts.keys(), ...nextFacts.keys()]);

  return [...keys].flatMap((key) => {
    const before = previousFacts.get(key);
    const after = nextFacts.get(key);
    if (before && after && factsMatch(before.fact, after.fact)) return [];

    const systemId = after?.systemId ?? before!.systemId;
    const factId = after?.fact.id ?? before!.fact.id;
    return [
      {
        systemId,
        factId,
        ...(before ? { previous: before.fact } : {}),
        ...(after ? { next: after.fact } : {}),
      },
    ];
  });
}
