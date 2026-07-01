import { Platform } from "react-native";

import OverlayModule from "../../modules/overlay";

/** "Draw over other apps" — required to float the prompter above the Camera app. */
export async function hasOverlayPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  return OverlayModule.hasOverlayPermission();
}

/** Android has no runtime dialog for this; it opens system settings for the user to grant it manually. */
export function requestOverlayPermission(): void {
  if (Platform.OS !== "android") return;
  OverlayModule.requestOverlayPermission();
}

/** Starts the foreground service and attaches the floating prompter window. */
export function showFloatingPrompter(): void {
  if (Platform.OS !== "android") return;
  OverlayModule.showOverlay();
}

/** Tears down the floating window and stops the foreground service. */
export function hideFloatingPrompter(): void {
  if (Platform.OS !== "android") return;
  OverlayModule.hideOverlay();
}
