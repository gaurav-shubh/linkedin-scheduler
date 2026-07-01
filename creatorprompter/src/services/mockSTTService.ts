import { SpeechToTextInitOptions, SpeechToTextService, TranscriptionResult } from "../types";

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

  async initialize(_options: SpeechToTextInitOptions): Promise<void> {
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
