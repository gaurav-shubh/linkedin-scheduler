import { Platform } from "react-native";

/**
 * Requests RECORD_AUDIO. Phase 2: back this with expo-av / expo-audio
 * permission APIs; the manifest entry already exists in app.json.
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  throw new Error("requestMicrophonePermission not yet implemented — Phase 2 (expo-av integration).");
}

/**
 * Requests SYSTEM_ALERT_WINDOW ("draw over other apps"). This can't be
 * granted via the normal runtime permission dialog on Android — it opens
 * the system settings screen for the user to toggle manually.
 * Phase 2: implement via a native module (react-native-android-overlay-permission
 * or a small custom module) since Expo has no built-in API for it.
 */
export async function requestOverlayPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  throw new Error("requestOverlayPermission not yet implemented — Phase 2 (native overlay module).");
}
