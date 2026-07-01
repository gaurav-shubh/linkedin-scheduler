import React, { useRef, useState } from "react";
import { Button, SafeAreaView, StyleSheet, Switch, Text, View } from "react-native";

import { FloatingPrompterView } from "../components/FloatingPrompterView";
import { ScriptEditor } from "../components/ScriptEditor";
import { MockSTTService } from "../services/sttService";
import { VoiceTracker } from "../utils/VoiceTracker";

const SAMPLE_SCRIPT =
  "Welcome back to the channel. Today we are talking about the new React Native architecture called Fabric.";

// Stands in for a live Whisper transcript stream until whisper.rn lands
// (Phase 2). Swap MockSTTService for LocalWhisperSTTService/CloudSTTService
// once that's wired up — the VoiceTracker consumption below stays the same.
const MOCK_TRANSCRIPT_CHUNKS = ["welcome back to the channel", "today we are talking about the new React Native architecture"];

export default function MainScreen() {
  const [script, setScript] = useState(SAMPLE_SCRIPT);
  const [isPrompting, setIsPrompting] = useState(false);
  const [mirrored, setMirrored] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const trackerRef = useRef<VoiceTracker | null>(null);
  const sttRef = useRef<MockSTTService | null>(null);

  const startPrompter = async () => {
    const tracker = new VoiceTracker(script);
    trackerRef.current = tracker;
    setActiveIndex(tracker.activeIndex);
    setIsPrompting(true);

    const stt = new MockSTTService(MOCK_TRANSCRIPT_CHUNKS);
    sttRef.current = stt;
    await stt.initialize({ initialPrompt: tracker.getInitialPrompt() });
    await stt.start((result) => {
      const trackerResult = trackerRef.current?.processTranscript(result.text);
      if (trackerResult) setActiveIndex(trackerResult.activeIndex);
    });
  };

  const stopPrompter = async () => {
    await sttRef.current?.stop();
    setIsPrompting(false);
  };

  if (isPrompting && trackerRef.current) {
    return (
      <SafeAreaView style={styles.flex}>
        <FloatingPrompterView tokens={trackerRef.current.tokens} activeIndex={activeIndex} mirrored={mirrored} />
        <View style={styles.controls}>
          <View style={styles.mirrorRow}>
            <Text style={styles.mirrorLabel}>Mirror text</Text>
            <Switch value={mirrored} onValueChange={setMirrored} />
          </View>
          <Button title="Stop Prompter" onPress={stopPrompter} color="#d9534f" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flex}>
      <ScriptEditor value={script} onChangeText={setScript} />
      <View style={styles.controls}>
        <Button title="Start Prompter" onPress={startPrompter} disabled={script.trim().length === 0} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: "#fff",
  },
  controls: {
    padding: 16,
    gap: 12,
  },
  mirrorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mirrorLabel: {
    fontSize: 16,
    color: "#fff",
  },
});
