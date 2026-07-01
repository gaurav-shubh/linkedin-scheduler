import React, { useEffect, useState } from "react";
import { AppRegistry } from "react-native";

import { FloatingPrompterView } from "../components/FloatingPrompterView";
import { PrompterState, subscribePrompterState } from "../services/prompterChannel";

const EMPTY_STATE: PrompterState = { tokens: [], activeIndex: 0, mirrored: false };

/**
 * Root component for the floating overlay window. Registered under its own
 * AppRegistry name (OverlayService.OVERLAY_COMPONENT_NAME on the native
 * side) so OverlayService can mount it into a separate ReactRootView
 * layered on top of the Camera app, independent of the main app's root.
 */
function FloatingPrompterOverlayRoot() {
  const [state, setState] = useState<PrompterState>(EMPTY_STATE);

  useEffect(() => subscribePrompterState(setState), []);

  return <FloatingPrompterView tokens={state.tokens} activeIndex={state.activeIndex} mirrored={state.mirrored} />;
}

AppRegistry.registerComponent("FloatingPrompterOverlay", () => FloatingPrompterOverlayRoot);

export default FloatingPrompterOverlayRoot;
