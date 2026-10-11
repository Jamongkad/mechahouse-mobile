# Mechahouse Mobile

Checkpoint A contains an Expo 57 app shell and a pure TypeScript simulation kernel. The shell only displays the project name. Jotai is installed for later application state integration but is not used by the kernel.

## Run and check

Use Node 22.13 or newer and npm. `package-lock.json` is committed; use `npm ci` for a clean install.

```sh
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test
npx expo start
```

Metro reaching its ready state verifies Expo startup. iOS Simulator or device launch is a later integration check.

## Simulation contract

`simulate(state, initialChanges, rules, context)` returns `{ state, events }`. `state` can be any object with existing scalar leaf paths. `initialChanges` and rule outputs are maps from dotted paths to replacement values, for example `{ 'a.value': 2 }`. The kernel compares values with `Object.is`, copies only changed branches, and leaves the input state untouched. An unchanged patch returns the original state reference and does not run rules.

Each `SimulationRule` has an `id`, `dependsOn`, `produces`, and `apply`. The rule receives a deeply readonly view of the current state and an explicit context object. It returns changes and may return domain events. The context is empty for this checkpoint; elapsed time enters in a later milestone. Events are collected in rule execution order and are not created for ordinary state changes.

The rules array is the registry. The kernel validates it before applying changes: IDs and output paths must be unique, declared paths must exist, and dependency cycles are rejected. A rule may write only paths it declares in `produces`. A rule runs at most once per call if one of its dependencies actually changed. The kernel orders rules by producer-to-consumer dependencies, using rule ID to break ties. A rule output activates downstream rules only when its value changes. These constraints prevent uncontrolled feedback within one call; physical feedback can evolve over future ticks.

The tests use artificial A → B → C → D rules to exercise the kernel without introducing Mechahouse physics. Real `MechState`, commands, time progression, Jotai integration, and game UI begin only after architecture review.
