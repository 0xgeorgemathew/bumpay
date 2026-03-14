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
    // ALARM stream for maximum loudness on payment success
    private val paymentToneGenerator = ToneGenerator(AudioManager.STREAM_ALARM, 100)
    // Lower volume for disconnect indication (remove phone prompt)
    private val disconnectToneGenerator = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 50)
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
    fun playNfcDone(promise: Promise) {
        playToneSequenceWithVolume(
            listOf(
                ToneStep(ToneGenerator.TONE_PROP_ACK, 150, 0),
                ToneStep(ToneGenerator.TONE_PROP_ACK, 150, 200),
            ),
            "NFC done tone",
            paymentToneGenerator,
            promise
        )
    }

    @ReactMethod
    fun playDisconnectBeep(promise: Promise) {
        playToneSequenceWithVolume(
            listOf(
                // Short lower-volume beep to indicate "remove your phone"
                ToneStep(ToneGenerator.TONE_PROP_BEEP, 200, 0),
            ),
            "Disconnect beep",
            disconnectToneGenerator,
            promise
        )
    }

    @ReactMethod
    fun playPaymentSuccess(promise: Promise) {
        playToneSequenceWithVolume(
            listOf(
                // LOUD success confirmation tone using ALARM stream
                ToneStep(ToneGenerator.TONE_CDMA_CONFIRM, 400, 0),
            ),
            "Payment success tone",
            paymentToneGenerator,
            promise
        )
    }

    @ReactMethod
    fun addListener(eventName: String) {
    }

    @ReactMethod
    fun removeListeners(count: Int) {
    }

    private fun playToneSequenceWithVolume(
        steps: List<ToneStep>,
        label: String,
        generator: ToneGenerator,
        promise: Promise
    ) {
        try {
            mainHandler.removeCallbacksAndMessages(null)
            generator.stopTone()

            steps.forEach { step ->
                mainHandler.postDelayed(
                    { generator.startTone(step.tone, step.durationMs) },
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
