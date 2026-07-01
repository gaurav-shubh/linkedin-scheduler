import { registerRootComponent } from "expo";

import App from "./App";
// Registers the "FloatingPrompterOverlay" component alongside the main
// app's root — both run in this same JS instance, and OverlayService
// mounts the overlay one into its own system-overlay window on demand.
import "./src/overlay/FloatingPrompterOverlayRoot";

registerRootComponent(App);
