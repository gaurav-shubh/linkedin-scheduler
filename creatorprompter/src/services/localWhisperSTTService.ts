import { initWhisper, WhisperContext } from "whisper.rn";

import { SpeechToTextInitOptions, SpeechToTextService, TranscriptionResult } from "../types";
import { resolveModelPath, WhisperModelSize } from "./whisperModelManager";

/**
 * Local on-device transcription via whisper.rn (Whisper.cpp bindings),
 * running fully offline against the Whisper Tiny/Base ggml model.
 */
export class LocalWhisperSTTService implements SpeechToTextService {
  private whisperContext: WhisperContext | null = null;
  private stopRealtime: (() => void) | null = null;
  private initialPrompt: string | undefined;
  private running = false;

  constructor(private readonly modelSize: WhisperModelSize = "tiny") {}

  async initialize(options: SpeechToTextInitOptions): Promise<void> {
    const modelPath = await resolveModelPath(this.modelSize, options.onModelDownloadProgress);
    this.whisperContext = await initWhisper({ filePath: modelPath });
    this.initialPrompt = options.initialPrompt;
  }

  async start(onResult: (result: TranscriptionResult) => void): Promise<void> {
    if (!this.whisperContext) {
      throw new Error("LocalWhisperSTTService.initialize() must be called before start().");
    }

    this.running = true;
    const { stop, subscribe } = await this.whisperContext.transcribeRealtime({
      language: "en",
      // whisper.cpp processes audio in <=30s chunks; slicing shorter than
      // that keeps per-chunk latency low enough for live scroll tracking.
      realtimeAudioSec: 30,
      realtimeAudioSliceSec: 10,
      initialPrompt: this.initialPrompt,
    });

    this.stopRealtime = stop;

    subscribe((event) => {
      const text = event.data?.result?.trim();
      if (text) {
        onResult({ text, isFinal: !event.isCapturing, timestamp: Date.now() });
      }
      if (!event.isCapturing) this.running = false;
    });
  }

  async stop(): Promise<void> {
    this.stopRealtime?.();
    this.stopRealtime = null;
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  async release(): Promise<void> {
    await this.stop();
    await this.whisperContext?.release();
    this.whisperContext = null;
  }
}
