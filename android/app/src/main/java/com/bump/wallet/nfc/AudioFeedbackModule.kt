package com.bump.wallet.nfc

import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AudioFeedbackModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    private val mainHandler = Handler(Looper.getMainLooper())
    private val loudToneGenerator = ToneGenerator(AudioManager.STREAM_ALARM, 100)
    private val softToneGenerator = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 50)

    override fun getName(): String = "AudioFeedbackModule"

    @ReactMethod
    fun playNfcComplete(promise: Promise) {
        playToneSequence(
            listOf(
                ToneStep(ToneGenerator.TONE_PROP_ACK, 180, 0L),
                ToneStep(ToneGenerator.TONE_PROP_ACK, 180, 220L),
            ),
            loudToneGenerator,
            "NFC completion tone",
            promise
        )
    }

    @ReactMethod
    fun playNfcDone(promise: Promise) {
        playToneSequence(
            listOf(
                ToneStep(ToneGenerator.TONE_PROP_ACK, 150, 0L),
                ToneStep(ToneGenerator.TONE_PROP_ACK, 150, 200L),
            ),
            loudToneGenerator,
            "NFC done tone",
            promise
        )
    }

    @ReactMethod
    fun playDisconnectBeep(promise: Promise) {
        playToneSequence(
            listOf(ToneStep(ToneGenerator.TONE_PROP_BEEP, 200, 0L)),
            softToneGenerator,
            "Disconnect beep",
            promise
        )
    }

    @ReactMethod
    fun playPaymentSuccess(promise: Promise) {
        playToneSequence(
            listOf(ToneStep(ToneGenerator.TONE_CDMA_CONFIRM, 400, 0L)),
            loudToneGenerator,
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

    @Suppress("OVERRIDE_DEPRECATION", "DEPRECATION")
    override fun onCatalystInstanceDestroy() {
        mainHandler.removeCallbacksAndMessages(null)
        loudToneGenerator.release()
        softToneGenerator.release()
        super.onCatalystInstanceDestroy()
    }

    private fun playToneSequence(
        steps: List<ToneStep>,
        generator: ToneGenerator,
        label: String,
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

    private data class ToneStep(
        val tone: Int,
        val durationMs: Int,
        val delayMs: Long,
    )
}
