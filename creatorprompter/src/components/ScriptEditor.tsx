import React from "react";
import { StyleSheet, TextInput } from "react-native";

interface ScriptEditorProps {
  value: string;
  onChangeText: (text: string) => void;
  editable?: boolean;
}

export function ScriptEditor({ value, onChangeText, editable = true }: ScriptEditorProps) {
  return (
    <TextInput
      style={styles.input}
      multiline
      editable={editable}
      value={value}
      onChangeText={onChangeText}
      placeholder="Paste your script here…"
      placeholderTextColor="#888"
      textAlignVertical="top"
    />
  );
}

const styles = StyleSheet.create({
  input: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
    color: "#111",
    backgroundColor: "#fafafa",
  },
});
