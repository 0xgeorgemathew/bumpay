package com.bump.wallet.nfc

import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.ToneGenerator
import android.os.Handler
import android.os.Looper
import com.bump.wallet.R
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AudioFeedbackModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val mainHandler = Handler(Looper.getMainLooper())
    private val paymentToneGenerator = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100)
    private var nfcPlayer: MediaPlayer? = null

    override fun getName(): String = "AudioFeedbackModule"

    @ReactMethod
    fun playNfcComplete(promise: Promise) {
        try {
            stopNfcCompletePlayback()

            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

            val player = MediaPlayer.create(
                reactApplicationContext,
                R.raw.nfc_safe_remove,
                audioAttributes,
                0
            )
                ?: throw IllegalStateException("Unable to load NFC completion audio")

            player.setVolume(1f, 1f)
            player.setOnCompletionListener { completedPlayer ->
                completedPlayer.release()
                if (nfcPlayer === completedPlayer) {
                    nfcPlayer = null
                }
            }
            player.setOnErrorListener { erroredPlayer, _, _ ->
                erroredPlayer.release()
                if (nfcPlayer === erroredPlayer) {
                    nfcPlayer = null
                }
                true
            }

            nfcPlayer = player
            player.start()
            promise.resolve("NFC completion audio started")
        } catch (error: Exception) {
            promise.reject(
                "AUDIO_ERROR",
                "Failed to play NFC completion audio: ${error.message}"
            )
        }
    }

    @ReactMethod
    fun playPaymentSuccess(promise: Promise) {
        playToneSequence(
            listOf(
                ToneStep(ToneGenerator.TONE_PROP_ACK, 140, 0),
                ToneStep(ToneGenerator.TONE_PROP_ACK, 180, 160),
            ),
            "Payment success tone",
            promise
        )
    }

    @ReactMethod
    fun addListener(eventName: String) {
    }

    @ReactMethod
    fun removeListeners(count: Int) {
    }

    private fun playToneSequence(steps: List<ToneStep>, label: String, promise: Promise) {
        try {
            mainHandler.removeCallbacksAndMessages(null)
            paymentToneGenerator.stopTone()

            steps.forEach { step ->
                mainHandler.postDelayed(
                    { paymentToneGenerator.startTone(step.tone, step.durationMs) },
                    step.delayMs
                )
            }

            promise.resolve("$label scheduled")
        } catch (error: Exception) {
            promise.reject("AUDIO_ERROR", "Failed to play $label: ${error.message}")
        }
    }

    private fun stopNfcCompletePlayback() {
        val player = nfcPlayer ?: return

        player.setOnCompletionListener(null)
        player.setOnErrorListener(null)
        if (player.isPlaying) {
            player.stop()
        }
        player.release()
        nfcPlayer = null
    }

    private data class ToneStep(
        val tone: Int,
        val durationMs: Int,
        val delayMs: Long,
    )
}
