import * as FileSystem from "expo-file-system";

export type WhisperModelSize = "tiny" | "base";

// Official ggml model mirrors from the whisper.cpp project. English-only
// (.en) variants are used since CreatorPrompter scripts are English —
// swap for the multilingual files if that changes.
const MODEL_URLS: Record<WhisperModelSize, string> = {
  tiny: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin",
  base: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin",
};

const MODEL_DIR = `${FileSystem.documentDirectory}whisper-models/`;

export function getModelFilePath(size: WhisperModelSize): string {
  return `${MODEL_DIR}ggml-${size}.en.bin`;
}

export async function isModelDownloaded(size: WhisperModelSize): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(getModelFilePath(size));
  return info.exists;
}

/**
 * Downloads the requested Whisper model to app-local storage if it isn't
 * already there. Tiny is ~75MB, Base is ~140MB, so this is deliberately not
 * bundled into the app binary — it's fetched once on first run.
 */
export async function downloadModel(size: WhisperModelSize, onProgress?: (fraction: number) => void): Promise<string> {
  await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true }).catch(() => undefined);

  const destination = getModelFilePath(size);
  if (await isModelDownloaded(size)) return destination;

  const downloadResumable = FileSystem.createDownloadResumable(MODEL_URLS[size], destination, {}, (progress) => {
    if (!onProgress || progress.totalBytesExpectedToWrite <= 0) return;
    onProgress(progress.totalBytesWritten / progress.totalBytesExpectedToWrite);
  });

  const result = await downloadResumable.downloadAsync();
  if (!result) throw new Error(`Failed to download Whisper "${size}" model.`);
  return result.uri;
}

export async function resolveModelPath(size: WhisperModelSize, onProgress?: (fraction: number) => void): Promise<string> {
  if (await isModelDownloaded(size)) return getModelFilePath(size);
  return downloadModel(size, onProgress);
}
