import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { Button, Text, View } from "react-native";
import { NarrationEngine, type NarrationModule } from "../narration/narration";
import {
  SimulationEngine,
  type SimulationModule,
} from "../simulation/simulation";
import { useGameSnapshot } from "./use-game-snapshot";
import { GameCoordinator } from "./game-coordinator";

type GameState = {
  temperature: { value: number };
};

type Command = {
  targetModuleId: "engine";
  type: "SET_TEMPERATURE";
  value: number;
};

function makeCoordinator() {
  const initialState: GameState = { temperature: { value: 100 } };
  const simulationModule: SimulationModule<GameState, Command> = {
    id: "engine",
    rules: [
      {
        id: "temperature.set",
        commands: ["SET_TEMPERATURE"],
        dependsOn: [],
        produces: ["temperature.value"],
        apply(_state, context) {
          return {
            changes: { "temperature.value": context.command.value },
            outcomes: [{ id: "temperature.updated" }],
          };
        },
      },
    ],
  };
  const narrationModule: NarrationModule<GameState> = {
    id: "engine",
    rules: [
      {
        id: "temperature.updated",
        evaluate(context) {
          return context.outcomes.some(({ id }) => id === "temperature.updated")
            ? { id: "temperature.updated" }
            : undefined;
        },
      },
    ],
  };
  const narrationEngine = new NarrationEngine(narrationModule, [
    {
      id: "temperature.updated",
      lines: ["Temperature is now {temperature.value} degrees."],
    },
  ]);

  return new GameCoordinator(
    initialState,
    new SimulationEngine([simulationModule]),
    narrationEngine,
  );
}

test("React component renders coordinator state and feed after a command", () => {
  const coordinator = makeCoordinator();
  function GamePanel() {
    const snapshot = useGameSnapshot(coordinator);
    return (
      <View>
        <Text testID="temperature">
          Temperature: {snapshot.state.temperature.value}
        </Text>
        <Text testID="feed-count">Feed entries: {snapshot.feed.length}</Text>
        {snapshot.feed.map(({ id, result }) => (
          <Text key={id} testID="feed-entry">
            {result.narration.flatMap(({ lines }) => lines).join(" ")}
          </Text>
        ))}
        <Button
          title="Raise temperature"
          onPress={() =>
            coordinator.dispatch({
              targetModuleId: "engine",
              type: "SET_TEMPERATURE",
              value: 120,
            })
          }
        />
      </View>
    );
  }

  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<GamePanel />);
  });

  expect(renderer.root.findByProps({ testID: "temperature" }).props.children).toEqual([
    "Temperature: ",
    100,
  ]);
  expect(renderer.root.findByProps({ testID: "feed-count" }).props.children).toEqual([
    "Feed entries: ",
    0,
  ]);

  act(() => {
    renderer.root.findByType(Button).props.onPress();
  });

  expect(renderer.root.findByProps({ testID: "temperature" }).props.children).toEqual([
    "Temperature: ",
    120,
  ]);
  expect(renderer.root.findByProps({ testID: "feed-count" }).props.children).toEqual([
    "Feed entries: ",
    1,
  ]);
  expect(renderer.root.findByProps({ testID: "feed-entry" }).props.children).toBe(
    "Temperature is now 120 degrees.",
  );

  act(() => renderer.unmount());
});
