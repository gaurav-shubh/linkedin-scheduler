import { Audio } from "expo-av";
import { Platform } from "react-native";

/** Requests RECORD_AUDIO via the standard runtime permission dialog. */
export async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  const { status } = await Audio.requestPermissionsAsync();
  return status === "granted";
}

export async function hasMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  const { status } = await Audio.getPermissionsAsync();
  return status === "granted";
}
