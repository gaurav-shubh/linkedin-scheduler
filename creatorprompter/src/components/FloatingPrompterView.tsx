import React, { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ScriptToken } from "../types";

interface FloatingPrompterViewProps {
  tokens: ScriptToken[];
  activeIndex: number;
  mirrored: boolean;
}

/**
 * Renders the scrolling script with the active word highlighted.
 *
 * This is currently an in-app view, not a real Android SYSTEM_ALERT_WINDOW
 * overlay — floating it above the camera app requires a native module and
 * is deferred to Phase 2. Everything here (rendering, highlight, scroll,
 * mirroring) carries over unchanged once it moves into the native overlay.
 */
export function FloatingPrompterView({ tokens, activeIndex, mirrored }: FloatingPrompterViewProps) {
  const scrollRef = useRef<ScrollView>(null);
  const activeWordY = useRef(0);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: Math.max(0, activeWordY.current - 120), animated: true });
  }, [activeIndex]);

  return (
    <View style={[styles.container, mirrored && styles.mirrored]}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        <Text style={styles.text}>
          {tokens.map((token) => (
            <Text
              key={token.index}
              onLayout={(event) => {
                if (token.index === activeIndex) {
                  activeWordY.current = event.nativeEvent.layout.y;
                }
              }}
              style={token.index === activeIndex ? styles.activeWord : styles.word}
            >
              {token.original + " "}
            </Text>
          ))}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
  },
  mirrored: {
    transform: [{ scaleX: -1 }],
  },
  content: {
    padding: 24,
  },
  text: {
    fontSize: 32,
    lineHeight: 44,
  },
  word: {
    color: "#e5e5e5",
  },
  activeWord: {
    color: "#00e0a4",
    fontWeight: "700",
  },
});
