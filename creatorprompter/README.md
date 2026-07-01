# CreatorPrompter

An Android-first, AI-driven teleprompter for React Native (Expo) that listens
to the speaker via on-device speech-to-text and scrolls the script to follow
along — handling ad-libs, retakes, and skips without a manual scroll control.

> **Status: Phase 2.** `whisper.rn` (local) and Groq (cloud) STT, the
> permission flows, and the native Android floating overlay module are all
> implemented. **The native Kotlin/Gradle code has not been compiled or
> run on a device** — this sandbox has no Android SDK/emulator. Treat the
> `modules/overlay` native code as reviewed-but-unverified until someone
> runs `expo prebuild && expo run:android` on a real machine. See
> [Native code status](#native-code-status-unverified) below.

## Architecture

```
creatorprompter/
├── App.tsx                        # Root component
├── index.ts                       # Expo entry point; also registers the overlay root
├── app.json                       # Expo config incl. Android permissions
├── metro.config.js                # Registers .bin/.mil asset extensions for whisper.rn
├── modules/overlay/                # Local Expo native module — floating overlay window
│   ├── expo-module.config.json
│   ├── index.ts / src/OverlayModule.ts  # JS bridge (hasOverlayPermission, show/hideOverlay, ...)
│   └── android/src/main/java/expo/modules/overlay/
│       ├── OverlayModule.kt         # Exposes functions to JS via Expo Modules API
│       └── OverlayService.kt        # Foreground service + WindowManager overlay window
└── src/
    ├── components/
    │   ├── ScriptEditor.tsx        # Multiline script input
    │   └── FloatingPrompterView.tsx # Scrolling prompter display (shared by main screen + overlay)
    ├── overlay/
    │   └── FloatingPrompterOverlayRoot.tsx  # AppRegistry root mounted into the overlay window
    ├── screens/
    │   └── MainScreen.tsx          # Wires script input + tracker + STT + overlay together
    ├── services/
    │   ├── sttService.ts           # createSTTService() factory: local / cloud / mock
    │   ├── localWhisperSTTService.ts # whisper.rn real-time transcription
    │   ├── cloudSTTService.ts      # Groq /audio/transcriptions fallback
    │   ├── mockSTTService.ts       # Scripted chunk replay for dev/testing
    │   ├── whisperModelManager.ts  # Downloads/caches the ggml model file
    │   ├── audioService.ts         # RECORD_AUDIO permission (expo-av)
    │   ├── overlayService.ts       # SYSTEM_ALERT_WINDOW permission + show/hide overlay
    │   └── prompterChannel.ts      # Cross-RootView pub/sub (see below)
    ├── utils/
    │   ├── VoiceTracker.ts         # The matching engine — see below
    │   ├── textMatching.ts         # Levenshtein distance + word similarity
    │   └── __demo__/voiceTrackerDemo.ts # Mock-data walkthrough of all 4 events
    └── types/index.ts              # Shared types
```

### Data flow

```
Mic audio → SpeechToTextService (whisper.rn locally, or Groq over the network)
          → VoiceTracker.processTranscript(chunk)
          → activeIndex + event (advance | retake | skip | adlib)
          → prompterChannel.publishPrompterState(...)
          → FloatingPrompterView re-renders in both the main screen AND the
            floating overlay window, scrolled to activeIndex
```

The `SpeechToTextService` interface (`src/types/index.ts`) has three
implementations, selectable via `createSTTService()` in `sttService.ts`:

- **`LocalWhisperSTTService`** — `whisper.rn` running the Whisper Tiny/Base
  ggml model fully on-device via `transcribeRealtime()`. The model file is
  downloaded once to app storage on first use (`whisperModelManager.ts`) —
  it's not bundled into the app binary.
- **`CloudSTTService`** — fallback for devices too slow for local inference.
  Records ~4s audio segments with `expo-av` and POSTs each one to Groq's
  OpenAI-compatible `/audio/transcriptions` endpoint. This trades latency
  (one network round trip per segment) for working on any hardware.
  Requires `EXPO_PUBLIC_GROQ_API_KEY` (see `.env.example`).
- **`MockSTTService`** — replays a scripted list of transcript strings on a
  timer. Still the easiest way to exercise the UI/tracker without a real
  device, model, or API key — it's the default STT source in `MainScreen`.

### Two ReactRootViews, one JS instance

The floating overlay isn't a separate app — `OverlayService.kt` starts a
second `ReactRootView` using the **same** `ReactInstanceManager` as the main
activity, so both trees run inside one JS runtime. That means the overlay
doesn't need a native bridge round trip to receive script/tracking updates:
`MainScreen` calls `publishPrompterState()` and the overlay's root component
(`FloatingPrompterOverlayRoot.tsx`, registered as a second `AppRegistry`
component) subscribes via a plain `DeviceEventEmitter` channel
(`prompterChannel.ts`). Both push through the same `FloatingPrompterView`
component, so the in-app preview and the real system overlay always render
identically.

## Android Permissions

Declared in `app.json` under `expo.android.permissions`:

| Permission | Why |
|---|---|
| `RECORD_AUDIO` | Required to capture the speaker's voice for STT. |
| `SYSTEM_ALERT_WINDOW` | "Draw over other apps" — lets the prompter float on top of the native Camera app. Android requires the user to grant this manually via a system settings screen (`overlayService.requestOverlayPermission()` opens it); it cannot be requested through the normal runtime permission dialog. |
| `FOREGROUND_SERVICE` | Keeps audio capture + the overlay alive while the user is in another app (the camera), since Android aggressively suspends background work otherwise. |
| `FOREGROUND_SERVICE_MICROPHONE` | Required on Android 14+ (API 34) alongside `FOREGROUND_SERVICE` for any service — like `OverlayService`, declared with `foregroundServiceType="microphone"` — that keeps recording audio while backgrounded. |

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

## Native code status: unverified

`modules/overlay/android/**` (Kotlin + Gradle) was written against the
documented Expo Modules API and standard Android `WindowManager`/foreground
service patterns, and the JS-facing pieces were checked for logical
correctness against the same scenarios as `VoiceTracker`. **None of it has
been compiled or run** — this sandbox has no Android SDK, emulator, or
physical device, so `expo prebuild` / `gradle build` / `expo run:android`
were never executed here. Before relying on it:

1. Run `npm install` then `npx expo prebuild -p android` to generate the
   native `android/` project (autolinking picks up `modules/overlay`
   automatically — it's in the default `./modules` search path).
2. Run `npx expo run:android` on a real device or emulator and fix any
   Gradle/Kotlin errors that surface (dependency versions in
   `modules/overlay/android/build.gradle` in particular — `androidx.core`
   and the unversioned `com.facebook.react:react-android` coordinate are
   the most likely spots to need adjusting for whatever RN/AGP version
   ends up resolved).
3. Sanity-check `OverlayService.kt`'s `reactNativeHost.reactInstanceManager`
   access — that API assumes the Old Architecture (the SDK 51 default here).
   If New Architecture is enabled later, this needs to go through
   `reactHost` instead.
4. Grant "draw over other apps" and microphone permissions manually on
   first run, then confirm the overlay actually renders on top of the
   Camera app and that `Mirror text` flips it correctly.

## Remaining known gaps

- No settings UI for the Groq API key or Whisper model size — currently
  env var / constructor args only.
- `CloudSTTService` has ~4s latency per segment (record → upload →
  transcribe) since Groq's API is file-based, not streaming.
- No retry/backoff on transient network failures in `CloudSTTService`.
- No UI affordance yet for the model-download progress callback
  (`onModelDownloadProgress`) that `LocalWhisperSTTService` already reports.

## Getting Started

```bash
cd creatorprompter
npm install
cp .env.example .env   # only needed for the "cloud" STT mode; add your Groq key
npx expo prebuild -p android
npm run android
```
