export interface ScriptToken {
  index: number;
  original: string;
  normalized: string;
  paragraphIndex: number;
}

export type TrackerEvent = "advance" | "retake" | "skip" | "adlib" | "no-change";

export interface VoiceTrackerOptions {
  backwardWindow?: number;
  forwardWindow?: number;
  matchThreshold?: number;
  retakeTolerance?: number;
  skipTolerance?: number;
}

export interface VoiceTrackerResult {
  event: TrackerEvent;
  activeIndex: number;
  previousIndex: number;
  matchedStartIndex: number | null;
  matchedEndIndex: number | null;
  confidence: number;
}

export interface TranscriptChunk {
  text: string;
  timestamp: number;
  isFinal?: boolean;
}

export interface TranscriptionResult {
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export type STTMode = "local" | "cloud" | "mock";

export interface SpeechToTextService {
  initialize(options: { initialPrompt?: string }): Promise<void>;
  start(onResult: (result: TranscriptionResult) => void): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}
