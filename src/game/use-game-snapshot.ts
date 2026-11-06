import { useSyncExternalStore } from "react";
import type { GameCoordinator } from "./game-coordinator";

export function useGameSnapshot<
  State extends object,
  Command extends { type: string; targetModuleId: string },
>(coordinator: Pick<GameCoordinator<State, Command>, "getSnapshot" | "subscribe">) {
  return useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
    coordinator.getSnapshot,
  );
}
