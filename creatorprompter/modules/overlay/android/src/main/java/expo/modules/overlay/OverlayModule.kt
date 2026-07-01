package expo.modules.overlay

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class OverlayModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Overlay")

    Function("hasOverlayPermission") {
      val context = appContext.reactContext ?: return@Function false
      Settings.canDrawOverlays(context)
    }

    // Android has no runtime permission dialog for SYSTEM_ALERT_WINDOW —
    // this opens the system settings screen where the user grants it by hand.
    Function("requestOverlayPermission") {
      val context = appContext.reactContext ?: return@Function
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:${context.packageName}")
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    Function("showOverlay") {
      val context = appContext.reactContext ?: return@Function
      val intent = Intent(context, OverlayService::class.java).setAction(OverlayService.ACTION_SHOW)
      ContextCompat.startForegroundService(context, intent)
    }

    Function("hideOverlay") {
      val context = appContext.reactContext ?: return@Function
      val intent = Intent(context, OverlayService::class.java).setAction(OverlayService.ACTION_HIDE)
      context.startService(intent)
    }
  }
}
