import { DeviceEventEmitter } from "react-native";

import { ScriptToken } from "../types";

export interface PrompterState {
  tokens: ScriptToken[];
  activeIndex: number;
  mirrored: boolean;
}

const CHANNEL = "creatorprompter:prompter-state";

/**
 * The main screen and the floating overlay run as two ReactRootViews
 * sharing one JS instance (see OverlayService.kt), so state can cross
 * between them with a plain in-process event emitter instead of a native
 * bridge round trip.
 */
export function publishPrompterState(state: PrompterState): void {
  DeviceEventEmitter.emit(CHANNEL, state);
}

export function subscribePrompterState(listener: (state: PrompterState) => void): () => void {
  const subscription = DeviceEventEmitter.addListener(CHANNEL, listener);
  return () => subscription.remove();
}
