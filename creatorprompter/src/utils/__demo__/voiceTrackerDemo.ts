import { VoiceTracker } from "../VoiceTracker";

const SCRIPT = `Welcome back to the channel. Today we are talking about the new React Native
architecture called Fabric. Fabric replaces the old bridge with a synchronous
JSI layer. That means less latency between JavaScript and native UI code.
Before we get into benchmarks, make sure you have subscribed and hit the bell icon.
Okay, let's look at the first benchmark result on a Pixel 8 device.`;

// Each entry simulates one STT chunk arriving from the transcriber, with a
// short note on what real-world behavior it's meant to exercise.
const MOCK_TRANSCRIPT_CHUNKS: { text: string; scenario: string }[] = [
  { text: "welcome back to the channel", scenario: "normal advance" },
  { text: "today we are talking about the new React Native architecture called Fabric", scenario: "normal advance" },
  { text: "so anyway my dog just walked into the room", scenario: "ad-lib, should pause" },
  { text: "fabric replaces the old bridge with a synchronous JSI layer", scenario: "resumes after ad-lib" },
  { text: "talking about the new React Native architecture called Fabric", scenario: "retake, should jump backward" },
  { text: "before we get into benchmarks make sure you have subscribed", scenario: "skip ahead, should warp forward" },
];

export function runVoiceTrackerDemo(): void {
  const tracker = new VoiceTracker(SCRIPT);

  console.log("Glossary extracted:", tracker.glossary);
  console.log("Whisper initial_prompt:", tracker.getInitialPrompt());
  console.log("---");

  for (const chunk of MOCK_TRANSCRIPT_CHUNKS) {
    const result = tracker.processTranscript(chunk.text);
    console.log(`[${chunk.scenario}]`);
    console.log(`  chunk: "${chunk.text}"`);
    console.log(
      `  event=${result.event} activeIndex=${result.previousIndex}->${result.activeIndex} ` +
        `confidence=${result.confidence.toFixed(2)}`
    );
  }
}

if (require.main === module) {
  runVoiceTrackerDemo();
}
