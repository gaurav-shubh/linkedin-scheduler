import { STTMode, SpeechToTextService, TranscriptionResult } from "../types";

/**
 * Local on-device transcription via whisper.rn (Whisper.cpp bindings).
 * Phase 2: wire up the actual whisper.rn model load + streaming inference
 * here. The interface is stable now so the rest of the app can be built
 * against it before the native module lands.
 */
class LocalWhisperSTTService implements SpeechToTextService {
  private running = false;

  async initialize(_options: { initialPrompt?: string }): Promise<void> {
    throw new Error("LocalWhisperSTTService not yet implemented — Phase 2 (whisper.rn integration).");
  }

  async start(_onResult: (result: TranscriptionResult) => void): Promise<void> {
    throw new Error("LocalWhisperSTTService not yet implemented — Phase 2 (whisper.rn integration).");
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }
}

/**
 * Cloud fallback for devices too slow to run Whisper locally in real time.
 * Phase 2: stream microphone audio to a hosted transcription API (e.g. Groq)
 * over fetch/WebSocket using ANTHROPIC_/GROQ_ style keys from env config.
 */
class CloudSTTService implements SpeechToTextService {
  private running = false;

  async initialize(_options: { initialPrompt?: string }): Promise<void> {
    throw new Error("CloudSTTService not yet implemented — Phase 2 (cloud API integration).");
  }

  async start(_onResult: (result: TranscriptionResult) => void): Promise<void> {
    throw new Error("CloudSTTService not yet implemented — Phase 2 (cloud API integration).");
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }
}

/**
 * Replays a scripted sequence of transcript chunks on a timer, standing in
 * for a live STT stream during UI development and VoiceTracker testing.
 */
export class MockSTTService implements SpeechToTextService {
  private running = false;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly scriptedChunks: string[],
    private readonly chunkIntervalMs = 800
  ) {}

  async initialize(_options: { initialPrompt?: string }): Promise<void> {
    // No model to load for the mock service.
  }

  async start(onResult: (result: TranscriptionResult) => void): Promise<void> {
    this.running = true;
    let index = 0;

    const emitNext = () => {
      if (!this.running || index >= this.scriptedChunks.length) {
        this.running = false;
        return;
      }
      onResult({ text: this.scriptedChunks[index], isFinal: true, timestamp: Date.now() });
      index += 1;
      this.timeoutId = setTimeout(emitNext, this.chunkIntervalMs);
    };

    this.timeoutId = setTimeout(emitNext, this.chunkIntervalMs);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timeoutId) clearTimeout(this.timeoutId);
  }

  isRunning(): boolean {
    return this.running;
  }
}

export function createSTTService(mode: STTMode, mockChunks: string[] = []): SpeechToTextService {
  switch (mode) {
    case "local":
      return new LocalWhisperSTTService();
    case "cloud":
      return new CloudSTTService();
    case "mock":
      return new MockSTTService(mockChunks);
  }
}
