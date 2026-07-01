package expo.modules.overlay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import com.facebook.react.ReactApplication
import com.facebook.react.ReactRootView

/**
 * Foreground service that hosts the floating teleprompter as a system
 * overlay window (TYPE_APPLICATION_OVERLAY), so it can render on top of the
 * native Camera app. The foreground service keeps the process (and the RN
 * JS thread doing STT + tracking) alive while the user backgrounds the
 * main activity.
 *
 * The overlay reuses the main app's existing ReactInstanceManager instead
 * of spinning up a second JS bundle/instance — both ReactRootViews share
 * one JS runtime, so state (script tokens, activeIndex) can be passed
 * across via a plain JS event emitter. See registerOverlayRoot.ts.
 */
class OverlayService : Service() {

  companion object {
    const val ACTION_SHOW = "expo.modules.overlay.action.SHOW"
    const val ACTION_HIDE = "expo.modules.overlay.action.HIDE"
    const val OVERLAY_COMPONENT_NAME = "FloatingPrompterOverlay"

    private const val NOTIFICATION_CHANNEL_ID = "creatorprompter_overlay"
    private const val NOTIFICATION_ID = 4210
  }

  private var windowManager: WindowManager? = null
  private var reactRootView: ReactRootView? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_SHOW -> {
        startForeground(NOTIFICATION_ID, buildNotification())
        attachOverlay()
      }
      ACTION_HIDE -> {
        detachOverlay()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
      }
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    detachOverlay()
    super.onDestroy()
  }

  private fun buildNotification(): Notification {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(NotificationManager::class.java)
      val channel = NotificationChannel(
        NOTIFICATION_CHANNEL_ID,
        "CreatorPrompter Overlay",
        NotificationManager.IMPORTANCE_LOW
      )
      manager.createNotificationChannel(channel)
    }

    return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
      .setContentTitle("CreatorPrompter is running")
      .setContentText("The teleprompter overlay is active.")
      .setSmallIcon(android.R.drawable.ic_media_play)
      .setOngoing(true)
      .build()
  }

  private fun attachOverlay() {
    if (reactRootView != null) return

    val reactApplication = application as? ReactApplication ?: return
    val reactInstanceManager = reactApplication.reactNativeHost.reactInstanceManager

    val rootView = ReactRootView(this)
    val overlayType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      @Suppress("DEPRECATION")
      WindowManager.LayoutParams.TYPE_PHONE
    }

    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      overlayType,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT
    ).apply { gravity = Gravity.TOP or Gravity.START }

    rootView.startReactApplication(reactInstanceManager, OVERLAY_COMPONENT_NAME, null)
    windowManager?.addView(rootView, params)
    reactRootView = rootView
  }

  private fun detachOverlay() {
    reactRootView?.let { view ->
      view.unmountReactApplication()
      windowManager?.removeView(view)
    }
    reactRootView = null
  }
}
