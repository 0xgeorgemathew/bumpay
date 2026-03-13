package com.bump.wallet.nfc

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject

/**
 * Shared NFC state between JS and HostApduService.
 */
object CardEmulationState {
    const val PREFS_NAME = "nfc_payment_state"
    const val PROTOCOL_VERSION = 1

    private const val KEY_SESSION_ID = "session_id"
    private const val KEY_LAST_COMMAND = "last_command"
    private const val KEY_REQUEST_PAYLOAD = "request_payload"
    private const val KEY_PAYMENT_INTENT_PAYLOAD = "payment_intent_payload"
    private const val KEY_IS_READY = "is_ready"
    private const val KEY_ERROR_MESSAGE = "error_message"

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    fun getSessionId(context: Context): String {
        return getPrefs(context).getString(KEY_SESSION_ID, "")!!
    }

    fun clearSession(context: Context) {
        getPrefs(context).edit().apply {
            remove(KEY_SESSION_ID)
            remove(KEY_PAYMENT_INTENT_PAYLOAD)
            remove(KEY_ERROR_MESSAGE)
            remove(KEY_LAST_COMMAND)
            apply()
        }
    }

    fun setPaymentRequestPayload(context: Context, payload: String) {
        val json = JSONObject(payload)
        val sessionId = json.optString("sessionId", json.optString("s", ""))

        getPrefs(context).edit().apply {
            putString(KEY_REQUEST_PAYLOAD, payload)
            if (sessionId.isNotEmpty()) {
                putString(KEY_SESSION_ID, sessionId)
            } else {
                remove(KEY_SESSION_ID)
            }
            remove(KEY_PAYMENT_INTENT_PAYLOAD)
            remove(KEY_ERROR_MESSAGE)
            remove(KEY_LAST_COMMAND)
            apply()
        }
    }

    fun getPaymentRequestPayload(context: Context): String? {
        return getPrefs(context).getString(KEY_REQUEST_PAYLOAD, null)
    }

    fun hasPublishedPaymentRequest(context: Context): Boolean {
        return !getPrefs(context).getString(KEY_REQUEST_PAYLOAD, "").isNullOrEmpty()
    }

    fun clearPublishedPaymentRequest(context: Context) {
        getPrefs(context).edit().apply {
            remove(KEY_REQUEST_PAYLOAD)
            remove(KEY_LAST_COMMAND)
            apply()
        }
    }

    fun setPaymentIntentPayload(context: Context, payload: String) {
        getPrefs(context).edit().apply {
            putString(KEY_PAYMENT_INTENT_PAYLOAD, payload)
            remove(KEY_ERROR_MESSAGE)
            apply()
        }
    }

    fun getPaymentIntentPayload(context: Context): String? {
        return getPrefs(context).getString(KEY_PAYMENT_INTENT_PAYLOAD, null)
    }

    fun hasPaymentIntent(context: Context): Boolean {
        return !getPrefs(context).getString(KEY_PAYMENT_INTENT_PAYLOAD, "").isNullOrEmpty()
    }

    fun clearPaymentIntentPayload(context: Context) {
        getPrefs(context).edit().remove(KEY_PAYMENT_INTENT_PAYLOAD).apply()
    }

    fun buildPublishedPaymentRequestResponse(context: Context): ByteArray {
        val payload = getPaymentRequestPayload(context)
            ?: return buildErrorResponse(context, "No payment request published")

        return payload.toByteArray(Charsets.UTF_8) + byteArrayOf(0x90.toByte(), 0x00)
    }

    fun setReady(context: Context, ready: Boolean) {
        getPrefs(context).edit().putBoolean(KEY_IS_READY, ready).apply()
    }

    fun isReady(context: Context): Boolean {
        return getPrefs(context).getBoolean(KEY_IS_READY, false)
    }

    fun setError(context: Context, message: String) {
        getPrefs(context).edit().putString(KEY_ERROR_MESSAGE, message).apply()
    }

    fun getError(context: Context): String {
        return getPrefs(context).getString(KEY_ERROR_MESSAGE, "")!!
    }

    fun clearError(context: Context) {
        getPrefs(context).edit().remove(KEY_ERROR_MESSAGE).apply()
    }

    fun recordLastCommand(context: Context, command: String) {
        getPrefs(context).edit().putString(KEY_LAST_COMMAND, command).apply()
    }

    fun getLastCommand(context: Context): String {
        return getPrefs(context).getString(KEY_LAST_COMMAND, "")!!
    }

    fun buildAckResponse(context: Context): ByteArray {
        val payload = JSONObject().apply {
            put("version", PROTOCOL_VERSION)
            put("v", PROTOCOL_VERSION)
            put("sessionId", getSessionId(context))
            put("s", getSessionId(context))
            put("status", "ok")
        }

        return payload.toString().toByteArray(Charsets.UTF_8) + byteArrayOf(0x90.toByte(), 0x00)
    }

    fun buildErrorResponse(context: Context, message: String): ByteArray {
        val payload = JSONObject().apply {
            put("version", PROTOCOL_VERSION)
            put("v", PROTOCOL_VERSION)
            put("sessionId", getSessionId(context))
            put("s", getSessionId(context))
            put("kind", "ERROR")
            put("k", "E")
            put("message", message)
            put("m", message)
        }

        return payload.toString().toByteArray(Charsets.UTF_8) + byteArrayOf(0x6A.toByte(), 0x80.toByte())
    }
}
