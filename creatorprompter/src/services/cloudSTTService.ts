import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

import { SpeechToTextInitOptions, SpeechToTextService, TranscriptionResult } from "../types";

const GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const DEFAULT_SEGMENT_MS = 4000;

/**
 * Cloud fallback for devices too slow to run Whisper locally in real time.
 * Records short audio segments and transcribes each one via Groq's
 * OpenAI-compatible /audio/transcriptions endpoint. Groq's API is
 * file-based rather than streaming, so this trades latency (one round
 * trip per segment, ~segmentMs plus network time) for running on any
 * device regardless of on-device inference speed.
 */
export class CloudSTTService implements SpeechToTextService {
  private running = false;
  private recording: Audio.Recording | null = null;
  private initialPrompt: string | undefined;
  private segmentTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly apiKey: string | undefined = process.env.EXPO_PUBLIC_GROQ_API_KEY,
    private readonly model: string = "whisper-large-v3-turbo",
    private readonly segmentMs: number = DEFAULT_SEGMENT_MS
  ) {}

  async initialize(options: SpeechToTextInitOptions): Promise<void> {
    if (!this.apiKey) {
      throw new Error("CloudSTTService requires a Groq API key — set EXPO_PUBLIC_GROQ_API_KEY or pass one to the constructor.");
    }
    this.initialPrompt = options.initialPrompt;

    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      throw new Error("Microphone permission was denied.");
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: false });
  }

  async start(onResult: (result: TranscriptionResult) => void): Promise<void> {
    this.running = true;
    void this.recordAndTranscribeLoop(onResult);
  }

  private async recordAndTranscribeLoop(onResult: (result: TranscriptionResult) => void): Promise<void> {
    while (this.running) {
      const uri = await this.recordSegment();
      if (!uri) break;

      try {
        const text = await this.transcribeSegment(uri);
        if (this.running && text) onResult({ text, isFinal: true, timestamp: Date.now() });
      } catch (error) {
        console.warn("CloudSTTService: transcription request failed", error);
      } finally {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
    }
  }

  private async recordSegment(): Promise<string | null> {
    if (!this.running) return null;

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();
    this.recording = recording;

    await new Promise<void>((resolve) => {
      this.segmentTimer = setTimeout(resolve, this.segmentMs);
    });

    if (!this.running) {
      await recording.stopAndUnloadAsync().catch(() => undefined);
      this.recording = null;
      return null;
    }

    await recording.stopAndUnloadAsync();
    this.recording = null;
    return recording.getURI();
  }

  private async transcribeSegment(uri: string): Promise<string> {
    const formData = new FormData();
    // React Native's FormData accepts { uri, name, type } file descriptors
    // in place of a Blob/File, which the DOM lib types don't model.
    formData.append("file", { uri, name: "segment.m4a", type: "audio/m4a" } as unknown as Blob);
    formData.append("model", this.model);
    if (this.initialPrompt) formData.append("prompt", this.initialPrompt);

    const response = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Groq transcription request failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as { text?: string };
    return (data.text ?? "").trim();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.segmentTimer) clearTimeout(this.segmentTimer);
    if (this.recording) {
      await this.recording.stopAndUnloadAsync().catch(() => undefined);
      this.recording = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }
}
