import React, { useRef, useState } from "react";
import { Alert, Button, SafeAreaView, StyleSheet, Switch, Text, View } from "react-native";

import { FloatingPrompterView } from "../components/FloatingPrompterView";
import { ScriptEditor } from "../components/ScriptEditor";
import { requestMicrophonePermission } from "../services/audioService";
import { hasOverlayPermission, hideFloatingPrompter, requestOverlayPermission, showFloatingPrompter } from "../services/overlayService";
import { publishPrompterState } from "../services/prompterChannel";
import { createSTTService } from "../services/sttService";
import { SpeechToTextService, STTMode } from "../types";
import { VoiceTracker } from "../utils/VoiceTracker";

const SAMPLE_SCRIPT =
  "Welcome back to the channel. Today we are talking about the new React Native architecture called Fabric.";

// Stands in for a live transcript stream when sttMode is "mock" — the only
// mode that doesn't need a real device, model, or API key to try out.
const MOCK_TRANSCRIPT_CHUNKS = ["welcome back to the channel", "today we are talking about the new React Native architecture"];

const STT_MODES: STTMode[] = ["mock", "local", "cloud"];

export default function MainScreen() {
  const [script, setScript] = useState(SAMPLE_SCRIPT);
  const [isPrompting, setIsPrompting] = useState(false);
  const [mirrored, setMirrored] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [sttMode, setSttMode] = useState<STTMode>("mock");
  const [overlayActive, setOverlayActive] = useState(false);

  const trackerRef = useRef<VoiceTracker | null>(null);
  const sttRef = useRef<SpeechToTextService | null>(null);

  const publishState = (tracker: VoiceTracker, index: number, mirroredValue: boolean) => {
    publishPrompterState({ tokens: tracker.tokens, activeIndex: index, mirrored: mirroredValue });
  };

  const startPrompter = async () => {
    if (sttMode !== "mock" && !(await requestMicrophonePermission())) {
      Alert.alert("Microphone permission required", "CreatorPrompter needs microphone access to track your speech.");
      return;
    }

    const tracker = new VoiceTracker(script);
    trackerRef.current = tracker;
    setActiveIndex(tracker.activeIndex);
    publishState(tracker, tracker.activeIndex, mirrored);

    const stt = createSTTService(sttMode, MOCK_TRANSCRIPT_CHUNKS);
    sttRef.current = stt;

    try {
      await stt.initialize({ initialPrompt: tracker.getInitialPrompt() });
      await stt.start((result) => {
        const trackerResult = trackerRef.current?.processTranscript(result.text);
        if (trackerResult) {
          setActiveIndex(trackerResult.activeIndex);
          publishState(tracker, trackerResult.activeIndex, mirrored);
        }
      });
    } catch (error) {
      Alert.alert("Couldn't start transcription", error instanceof Error ? error.message : String(error));
      return;
    }

    setIsPrompting(true);

    if (await hasOverlayPermission()) {
      showFloatingPrompter();
      setOverlayActive(true);
    }
  };

  const stopPrompter = async () => {
    await sttRef.current?.stop();
    if (overlayActive) {
      hideFloatingPrompter();
      setOverlayActive(false);
    }
    setIsPrompting(false);
  };

  const cycleSttMode = () => {
    setSttMode(STT_MODES[(STT_MODES.indexOf(sttMode) + 1) % STT_MODES.length]);
  };

  const toggleMirrored = (value: boolean) => {
    setMirrored(value);
    if (trackerRef.current) publishState(trackerRef.current, activeIndex, value);
  };

  if (isPrompting && trackerRef.current) {
    return (
      <SafeAreaView style={styles.flex}>
        <FloatingPrompterView tokens={trackerRef.current.tokens} activeIndex={activeIndex} mirrored={mirrored} />
        <View style={styles.controls}>
          {overlayActive && (
            <Text style={styles.overlayNotice}>Floating overlay is active over other apps — this view mirrors it.</Text>
          )}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Mirror text</Text>
            <Switch value={mirrored} onValueChange={toggleMirrored} />
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
        <View style={styles.row}>
          <Text style={styles.rowLabel}>STT source: {sttMode}</Text>
          <Button title="Switch" onPress={cycleSttMode} />
        </View>
        <Button title="Grant floating overlay permission" onPress={requestOverlayPermission} />
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLabel: {
    fontSize: 16,
    color: "#111",
  },
  overlayNotice: {
    fontSize: 13,
    color: "#666",
  },
});
