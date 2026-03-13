package com.bump.wallet.nfc

import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AudioFeedbackModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val mainHandler = Handler(Looper.getMainLooper())
    private val toneGenerator = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100)

    override fun getName(): String = "AudioFeedbackModule"

    @ReactMethod
    fun playNfcComplete(promise: Promise) {
        playTone(ToneGenerator.TONE_PROP_BEEP2, 120, promise)
    }

    @ReactMethod
    fun playPaymentSuccess(promise: Promise) {
        try {
            toneGenerator.startTone(ToneGenerator.TONE_PROP_ACK, 140)
            mainHandler.postDelayed(
                { toneGenerator.startTone(ToneGenerator.TONE_PROP_ACK, 180) },
                160
            )
            promise.resolve("Payment success tone played")
        } catch (error: Exception) {
            promise.reject("AUDIO_ERROR", "Failed to play payment success tone: ${error.message}")
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
    }

    @ReactMethod
    fun removeListeners(count: Int) {
    }

    private fun playTone(tone: Int, durationMs: Int, promise: Promise) {
        try {
            toneGenerator.startTone(tone, durationMs)
            promise.resolve("Tone played")
        } catch (error: Exception) {
            promise.reject("AUDIO_ERROR", "Failed to play tone: ${error.message}")
        }
    }
}
