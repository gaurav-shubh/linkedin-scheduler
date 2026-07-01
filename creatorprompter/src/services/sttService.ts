import { STTMode, SpeechToTextService } from "../types";
import { CloudSTTService } from "./cloudSTTService";
import { LocalWhisperSTTService } from "./localWhisperSTTService";
import { MockSTTService } from "./mockSTTService";

export { CloudSTTService } from "./cloudSTTService";
export { LocalWhisperSTTService } from "./localWhisperSTTService";
export { MockSTTService } from "./mockSTTService";

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
