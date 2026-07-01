# CreatorPrompter

An Android-first, AI-driven teleprompter for React Native (Expo) that listens
to the speaker via on-device speech-to-text and scrolls the script to follow
along — handling ad-libs, retakes, and skips without a manual scroll control.

> **Status: Phase 1 scaffold.** The text-matching engine (`VoiceTracker`),
> folder structure, and service interfaces are in place and exercised with
> mock data. The floating overlay window and `whisper.rn` integration are
> **not implemented yet** — see [Phase 2](#phase-2-not-yet-implemented) below.

## Architecture

```
creatorprompter/
├── App.tsx                        # Root component
├── index.ts                       # Expo entry point
├── app.json                       # Expo config incl. Android permissions
└── src/
    ├── components/
    │   ├── ScriptEditor.tsx        # Multiline script input
    │   └── FloatingPrompterView.tsx # Scrolling prompter display (in-app for now)
    ├── screens/
    │   └── MainScreen.tsx          # Wires script input + tracker + STT together
    ├── services/
    │   ├── sttService.ts           # STT interface: local Whisper / cloud / mock
    │   └── audioService.ts         # Mic + overlay permission requests (stubbed)
    ├── utils/
    │   ├── VoiceTracker.ts         # The matching engine — see below
    │   ├── textMatching.ts         # Levenshtein distance + word similarity
    │   └── __demo__/voiceTrackerDemo.ts # Mock-data walkthrough of all 4 events
    └── types/index.ts              # Shared types
```

### Data flow (once Phase 2 lands)

```
Mic audio → SpeechToTextService (whisper.rn, streaming chunks)
          → VoiceTracker.processTranscript(chunk)
          → activeIndex + event (advance | retake | skip | adlib)
          → FloatingPrompterView re-renders, scrolls to activeIndex
```

The `SpeechToTextService` interface (`src/services/sttService.ts`) has three
implementations so the transcription backend can be swapped without touching
the tracker or UI:

- **`LocalWhisperSTTService`** — Phase 2: `whisper.rn` running the Whisper
  "Tiny" or "Base" model fully on-device (no network required).
- **`CloudSTTService`** — Phase 2: fallback for low-end devices, streaming
  audio to a hosted API (e.g. Groq's Whisper endpoint) over `fetch`.
- **`MockSTTService`** — replays a scripted list of transcript strings on a
  timer. Used today for building and testing the UI/tracker without a real
  audio pipeline.

## Android Permissions

Declared in `app.json` under `expo.android.permissions`:

| Permission | Why |
|---|---|
| `RECORD_AUDIO` | Required to capture the speaker's voice for STT. |
| `SYSTEM_ALERT_WINDOW` | "Draw over other apps" — lets the prompter float on top of the native Camera app. Android requires the user to grant this manually via a system settings screen; it cannot be requested through the normal runtime permission dialog. |
| `FOREGROUND_SERVICE` | Keeps audio capture + the overlay alive while the user is in another app (the camera), since Android aggressively suspends background work otherwise. |

## The Text-Matching Engine

`VoiceTracker` (`src/utils/VoiceTracker.ts`) keeps a single `activeIndex` —
the token position in the script it believes the speaker is currently at —
and updates it every time a new transcript chunk arrives.

### 1. Auto-Glossary extraction

Before tracking starts, `VoiceTracker.extractGlossary(script)` scans the
script sentence by sentence and collects:

- **Acronyms**: any word matching `/^[A-Z]{2,}$/` (e.g. `JSI`, `UI`).
- **Mid-sentence Title Case words**: any word matching `/^[A-Z][a-z]+$/`
  that is **not** the first word of its sentence (e.g. `Fabric`, `React`).

Sentence-initial capitalization is skipped deliberately — "The" or "We" at
the start of a sentence is grammar, not jargon, and including it would just
dilute the bias signal with noise. Acronyms are kept regardless of position
since they never occur "by grammar."

The resulting list is deduplicated (case-insensitively, keeping first-seen
casing) and joined into a comma-separated string via `getInitialPrompt()`,
intended to be passed as Whisper's `initial_prompt` so the model is biased
toward recognizing the script's niche terms.

### 2. Bidirectional fuzzy matching

**Similarity between two words** is computed from Levenshtein edit distance,
normalized by the longer word's length:

```
similarity(a, b) = 1 - levenshtein(a, b) / max(len(a), len(b))
```

This gives 1.0 for an exact match and degrades smoothly for STT
mis-transcriptions (e.g. `"fabric"` vs `"fabrick"` still scores high).

**Sliding window.** Rather than searching the whole script on every chunk
(expensive, and prone to false matches on repeated words), the engine only
considers a window around the current position:

```
window = tokens[activeIndex - backwardWindow .. activeIndex + forwardWindow]
```

Defaults: `backwardWindow = 20`, `forwardWindow = 30` words. This directly
encodes the PRD's requirement and bounds the cost of each match to
`O(window_size × chunk_size)` — cheap enough to run on every STT chunk in
real time on-device.

**Alignment scoring.** For an incoming transcript chunk of `N` words, the
engine slides an `N`-word frame across every position `p` in the window
(including positions that hang off either edge, so a chunk that starts
mid-window still scores fairly) and computes:

```
coverage(p) = overlapping_words(p) / N
score(p)    = average_similarity(p) × coverage(p)
```

The `coverage` multiplier is what keeps a 2-word coincidental match at the
window's edge from beating a clean 10-word match fully inside the window —
without it, short high-similarity fragments could out-score longer, more
reliable ones. The position with the highest `score` becomes the candidate
alignment; if `score < matchThreshold` (default `0.55`), no confident match
was found in the entire reachable window.

**Deciding the event.** Given the winning alignment
`[matchedStartIndex, matchedEndIndex]`:

| Condition | Event | Effect |
|---|---|---|
| `score < matchThreshold` | `adlib` | Hold `activeIndex` — the speaker went off-script; scrolling pauses until they rejoin. |
| `matchedEndIndex < activeIndex - retakeTolerance` | `retake` | Jump `activeIndex` backward to just past the match — the speaker re-read an earlier line. |
| `matchedStartIndex > activeIndex + skipTolerance` | `skip` | Warp `activeIndex` forward to just past the match — the speaker jumped ahead, skipping lines. |
| otherwise | `advance` | Normal forward progression, one line at a time. |

`retakeTolerance` and `skipTolerance` (default `3` words each) create a
dead zone around the current position so ordinary continuous reading isn't
misclassified as a retake/skip on every chunk boundary.

On a non-`adlib` result, `activeIndex` moves to `matchedEndIndex + 1` —
i.e., just past the last matched word, ready to compare against the next
chunk.

### Trying it out

`src/utils/__demo__/voiceTrackerDemo.ts` runs a fixed script through four
scenarios (normal advance, an ad-lib, a retake, and a skip) using
hand-written mock transcript chunks — no audio or `whisper.rn` required.
Run it with `ts-node` once dependencies are installed:

```bash
npx ts-node src/utils/__demo__/voiceTrackerDemo.ts
```

## Phase 2 (not yet implemented)

Deliberately deferred until this scaffold is reviewed:

1. **`whisper.rn` integration** — load the Whisper Tiny/Base GGML model and
   stream real transcript chunks into `LocalWhisperSTTService`.
2. **Cloud fallback** — implement `CloudSTTService` against a provider such
   as Groq's Whisper endpoint, with a runtime toggle for slow devices.
3. **Floating overlay window** — a native Android module to actually render
   `FloatingPrompterView` in a `TYPE_APPLICATION_OVERLAY` window (requires
   `SYSTEM_ALERT_WINDOW`), since Expo has no built-in API for this and it
   likely requires `expo-dev-client` / bare workflow + a custom native
   module or config plugin.
4. **Microphone + overlay permission flows** — `audioService.ts` currently
   throws; wire up `expo-av` for `RECORD_AUDIO` and a native settings-intent
   launcher for `SYSTEM_ALERT_WINDOW`.

## Getting Started (once Phase 2 dependencies are added)

```bash
cd creatorprompter
npm install
npm run android   # requires expo-dev-client since native modules are used
```
