import { NativeModule, requireNativeModule } from "expo";

declare class OverlayModule extends NativeModule<{}> {
  /** Whether "draw over other apps" is currently granted. Android only. */
  hasOverlayPermission(): boolean;
  /**
   * Opens the system settings screen for granting SYSTEM_ALERT_WINDOW.
   * Android gives no runtime dialog for this permission — the user has to
   * flip it manually — so this just navigates them to the right screen.
   */
  requestOverlayPermission(): void;
  /** Starts the foreground overlay service and attaches the floating prompter window. */
  showOverlay(): void;
  /** Tears down the floating window and stops the foreground service. */
  hideOverlay(): void;
}

export default requireNativeModule<OverlayModule>("Overlay");
