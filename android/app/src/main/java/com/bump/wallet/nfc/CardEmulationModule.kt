package com.bump.wallet.nfc

import android.content.Context
import android.content.SharedPreferences
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Card Emulation module for receiver-side payment request publishing.
 */
class CardEmulationModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), SharedPreferences.OnSharedPreferenceChangeListener {

    companion object {
        const val EVENT_CARD_STATE_CHANGED = "onCardStateChanged"
    }

    private var hasListeners = false

    override fun getName(): String = "CardEmulationModule"

    override fun onSharedPreferenceChanged(sharedPreferences: SharedPreferences?, key: String?) {
        if (hasListeners) {
            emitCurrentState()
        }
    }

    private fun buildStateMap(): WritableMap = Arguments.createMap().apply {
        putBoolean("isReady", CardEmulationState.isReady(reactApplicationContext))
        putString("sessionId", CardEmulationState.getSessionId(reactApplicationContext))
        putBoolean("hasPaymentRequest", CardEmulationState.hasPublishedPaymentRequest(reactApplicationContext))
        putBoolean("hasPaymentIntent", CardEmulationState.hasPaymentIntent(reactApplicationContext))
        putString("errorMessage", CardEmulationState.getError(reactApplicationContext))
        putString("lastCommand", CardEmulationState.getLastCommand(reactApplicationContext))
        putBoolean("isMerchantMode", CardEmulationState.isMerchantMode(reactApplicationContext))
        putBoolean("hasPaymentAuthorization", CardEmulationState.hasPaymentAuthorization(reactApplicationContext))
    }

    private fun emitCurrentState() {
        sendEvent(EVENT_CARD_STATE_CHANGED, buildStateMap())
    }

    @ReactMethod
    fun startListening(promise: Promise) {
        val prefs = reactApplicationContext.getSharedPreferences(
            CardEmulationState.PREFS_NAME,
            Context.MODE_PRIVATE
        )
        prefs.registerOnSharedPreferenceChangeListener(this)
        emitCurrentState()
        promise.resolve("Listening for card emulation state changes")
    }

    @ReactMethod
    fun stopListening(promise: Promise) {
        val prefs = reactApplicationContext.getSharedPreferences(
            CardEmulationState.PREFS_NAME,
            Context.MODE_PRIVATE
        )
        prefs.unregisterOnSharedPreferenceChangeListener(this)
        promise.resolve("Stopped listening")
    }

    @ReactMethod
    fun setReady(ready: Boolean, promise: Promise) {
        CardEmulationState.setReady(reactApplicationContext, ready)
        promise.resolve("Ready state set: $ready")
    }

    @ReactMethod
    fun setPaymentRequest(payload: String, promise: Promise) {
        CardEmulationState.setPaymentRequestPayload(reactApplicationContext, payload)
        promise.resolve("Payment request stored")
    }

    @ReactMethod
    fun clearPaymentRequest(promise: Promise) {
        CardEmulationState.clearPublishedPaymentRequest(reactApplicationContext)
        promise.resolve("Payment request cleared")
    }

    @ReactMethod
    fun getPaymentIntent(promise: Promise) {
        promise.resolve(CardEmulationState.getPaymentIntentPayload(reactApplicationContext))
    }

    @ReactMethod
    fun clearPaymentIntent(promise: Promise) {
        CardEmulationState.clearPaymentIntentPayload(reactApplicationContext)
        promise.resolve("Payment intent cleared")
    }

    // ============ Merchant Mode Methods ============

    @ReactMethod
    fun setMerchantMode(enabled: Boolean, promise: Promise) {
        CardEmulationState.setMerchantMode(reactApplicationContext, enabled)
        promise.resolve("Merchant mode set: $enabled")
    }

    @ReactMethod
    fun getPaymentAuthorization(promise: Promise) {
        promise.resolve(CardEmulationState.getPaymentAuthorizationPayload(reactApplicationContext))
    }

    @ReactMethod
    fun clearPaymentAuthorization(promise: Promise) {
        CardEmulationState.clearPaymentAuthorizationPayload(reactApplicationContext)
        promise.resolve("Payment authorization cleared")
    }

    @ReactMethod
    fun addListener(eventName: String) {
        hasListeners = true
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        hasListeners = false
    }

    @Suppress("OVERRIDE_DEPRECATION", "DEPRECATION")
    override fun onCatalystInstanceDestroy() {
        val prefs = reactApplicationContext.getSharedPreferences(
            CardEmulationState.PREFS_NAME,
            Context.MODE_PRIVATE
        )
        prefs.unregisterOnSharedPreferenceChangeListener(this)
        super.onCatalystInstanceDestroy()
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
}
