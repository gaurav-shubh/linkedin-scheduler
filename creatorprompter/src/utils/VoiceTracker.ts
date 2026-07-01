import { ScriptToken, TrackerEvent, VoiceTrackerOptions, VoiceTrackerResult } from "../types";
import { normalizeWord, tokenizeScript, wordSimilarity } from "./textMatching";

const DEFAULT_OPTIONS: Required<VoiceTrackerOptions> = {
  backwardWindow: 20,
  forwardWindow: 30,
  matchThreshold: 0.55,
  retakeTolerance: 3,
  skipTolerance: 3,
};

interface Alignment {
  matchedStartIndex: number;
  matchedEndIndex: number;
  score: number;
}

/**
 * Tracks a speaker's position in a script by fuzzy-matching live transcript
 * chunks against a sliding window of the script text. See README.md for the
 * full algorithm writeup.
 */
export class VoiceTracker {
  readonly tokens: ScriptToken[];
  readonly glossary: string[];
  private readonly options: Required<VoiceTrackerOptions>;
  private _activeIndex = 0;

  constructor(script: string, options: VoiceTrackerOptions = {}) {
    this.tokens = tokenizeScript(script).map((token, index) => ({ ...token, index }));
    this.glossary = VoiceTracker.extractGlossary(script);
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  get activeIndex(): number {
    return this._activeIndex;
  }

  reset(): void {
    this._activeIndex = 0;
  }

  getWindow(): { start: number; end: number } {
    const { backwardWindow, forwardWindow } = this.options;
    return {
      start: Math.max(0, this._activeIndex - backwardWindow),
      end: Math.min(this.tokens.length, this._activeIndex + forwardWindow),
    };
  }

  /** Formats the extracted glossary for Whisper's `initial_prompt` field. */
  getInitialPrompt(maxWords = 40): string {
    return this.glossary.slice(0, maxWords).join(", ");
  }

  /**
   * Pulls capitalized words and acronyms out of the script so they can bias
   * the STT model toward niche jargon before tracking starts.
   */
  static extractGlossary(script: string): string[] {
    const sentences = script.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
    const seen = new Map<string, string>();

    for (const sentence of sentences) {
      const words = sentence.trim().split(/\s+/).filter(Boolean);
      words.forEach((rawWord, wordIndex) => {
        const cleaned = rawWord.replace(/[^A-Za-z0-9'-]/g, "");
        if (!cleaned) return;

        const isAcronym = /^[A-Z]{2,}$/.test(cleaned);
        const isTitleCase = /^[A-Z][a-z]+$/.test(cleaned);
        const isSentenceStart = wordIndex === 0;

        // Sentence-initial capitalization ("The", "We") is just grammar, not
        // jargon, so it's excluded unless the word is also an acronym.
        if (isAcronym || (isTitleCase && !isSentenceStart)) {
          const key = cleaned.toLowerCase();
          if (!seen.has(key)) seen.set(key, cleaned);
        }
      });
    }

    return Array.from(seen.values());
  }

  /**
   * Feeds one STT transcript chunk into the tracker and returns how the
   * active index moved (or didn't).
   */
  processTranscript(chunkText: string): VoiceTrackerResult {
    const previousIndex = this._activeIndex;
    const transcriptTokens = chunkText
      .split(/\s+/)
      .map(normalizeWord)
      .filter((word) => word.length > 0);

    if (transcriptTokens.length === 0) {
      return this.buildResult("no-change", previousIndex, null, null, 0);
    }

    const { start, end } = this.getWindow();
    const candidates = this.tokens.slice(start, end);
    const alignment = this.findBestAlignment(transcriptTokens, candidates, start);

    if (!alignment || alignment.score < this.options.matchThreshold) {
      // No confident match anywhere in the window: treat it as an ad-lib
      // and hold the current position rather than guess.
      return this.buildResult("adlib", previousIndex, null, null, alignment?.score ?? 0);
    }

    const { matchedStartIndex, matchedEndIndex, score } = alignment;
    const nextIndex = Math.min(this.tokens.length - 1, matchedEndIndex + 1);

    let event: TrackerEvent;
    if (matchedEndIndex < previousIndex - this.options.retakeTolerance) {
      event = "retake";
    } else if (matchedStartIndex > previousIndex + this.options.skipTolerance) {
      event = "skip";
    } else {
      event = "advance";
    }

    this._activeIndex = nextIndex;
    return this.buildResult(event, previousIndex, matchedStartIndex, matchedEndIndex, score);
  }

  /**
   * Slides a window the length of the transcript chunk across the candidate
   * range and scores each position by average per-word similarity, scaled
   * by how much of the transcript chunk actually overlapped the script
   * (so a 2-word match hanging off the edge can't outscore a full match).
   */
  private findBestAlignment(
    transcriptTokens: string[],
    candidates: ScriptToken[],
    windowOffset: number
  ): Alignment | null {
    if (candidates.length === 0) return null;

    const chunkLength = transcriptTokens.length;
    let best: Alignment | null = null;

    for (let position = -chunkLength + 1; position < candidates.length; position++) {
      let similaritySum = 0;
      let overlapCount = 0;

      for (let i = 0; i < chunkLength; i++) {
        const candidateIndex = position + i;
        if (candidateIndex < 0 || candidateIndex >= candidates.length) continue;
        similaritySum += wordSimilarity(transcriptTokens[i], candidates[candidateIndex].normalized);
        overlapCount++;
      }

      if (overlapCount === 0) continue;

      const coverage = overlapCount / chunkLength;
      const score = (similaritySum / overlapCount) * coverage;

      if (!best || score > best.score) {
        const clampedStart = Math.max(0, position);
        const clampedEnd = Math.min(candidates.length - 1, position + chunkLength - 1);
        best = {
          matchedStartIndex: windowOffset + clampedStart,
          matchedEndIndex: windowOffset + clampedEnd,
          score,
        };
      }
    }

    return best;
  }

  private buildResult(
    event: TrackerEvent,
    previousIndex: number,
    matchedStartIndex: number | null,
    matchedEndIndex: number | null,
    confidence: number
  ): VoiceTrackerResult {
    return {
      event,
      activeIndex: this._activeIndex,
      previousIndex,
      matchedStartIndex,
      matchedEndIndex,
      confidence,
    };
  }
}
