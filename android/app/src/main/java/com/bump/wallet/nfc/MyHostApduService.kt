package com.bump.wallet.nfc

import android.nfc.cardemulation.HostApduService
import android.os.Bundle
import android.util.Log
import org.json.JSONException
import org.json.JSONObject

/**
 * Host Card Emulation service for receiver-side payment request publishing.
 */
class MyHostApduService : HostApduService() {

    companion object {
        private const val TAG = "BumpHceService"

        private val AID_BYTES = byteArrayOf(
            0xA0.toByte(), 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        )
    }

    private enum class CommandKind {
        GET_PAYMENT_REQUEST,
        PAYMENT_INTENT,
        MERCHANT_PAYMENT_AUTHORIZATION
    }

    private data class DecodedCommand(
        val kind: CommandKind,
        val payload: JSONObject
    )

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "HCE service created")
    }

    override fun processCommandApdu(commandApdu: ByteArray?, extras: Bundle?): ByteArray {
        commandApdu?.let { apdu ->
            if (isSelectAidCommand(apdu)) {
                return byteArrayOf(0x90.toByte(), 0x00.toByte())
            }

            val command = decodeCommand(apdu)
                ?: return CardEmulationState.buildErrorResponse(applicationContext, "Invalid command")

            return when (command.kind) {
                CommandKind.GET_PAYMENT_REQUEST -> handleGetPaymentRequest(command.payload)
                CommandKind.PAYMENT_INTENT -> handlePaymentIntent(command.payload)
                CommandKind.MERCHANT_PAYMENT_AUTHORIZATION -> handleMerchantPaymentAuthorization(command.payload)
            }
        }

        return CardEmulationState.buildErrorResponse(applicationContext, "Not ready")
    }

    private fun decodeCommand(apdu: ByteArray): DecodedCommand? {
        return try {
            val json = JSONObject(apdu.toString(Charsets.UTF_8))
            when (decodeCommandKind(json)) {
                CommandKind.GET_PAYMENT_REQUEST -> DecodedCommand(CommandKind.GET_PAYMENT_REQUEST, json)
                CommandKind.PAYMENT_INTENT -> DecodedCommand(CommandKind.PAYMENT_INTENT, json)
                CommandKind.MERCHANT_PAYMENT_AUTHORIZATION -> DecodedCommand(CommandKind.MERCHANT_PAYMENT_AUTHORIZATION, json)
                null -> null
            }
        } catch (e: JSONException) {
            Log.d(TAG, "Not a JSON command: ${e.message}")
            null
        }
    }

    private fun decodeCommandKind(json: JSONObject): CommandKind? {
        return when (json.optString("kind", json.optString("k", ""))) {
            "Q", "GET_PAYMENT_REQUEST" -> CommandKind.GET_PAYMENT_REQUEST
            "I", "PAYMENT_INTENT" -> CommandKind.PAYMENT_INTENT
            "A", "MERCHANT_PAYMENT_AUTHORIZATION" -> CommandKind.MERCHANT_PAYMENT_AUTHORIZATION
            else -> null
        }
    }

    private fun extractSessionId(json: JSONObject): String {
        return json.optString("sessionId", json.optString("s", ""))
    }

    private fun validateSession(sessionId: String, requirePresent: Boolean): ByteArray? {
        val currentSessionId = CardEmulationState.getSessionId(applicationContext)
        if (currentSessionId.isEmpty()) {
            return CardEmulationState.buildErrorResponse(applicationContext, "No active session")
        }

        if (requirePresent && sessionId.isEmpty()) {
            return CardEmulationState.buildErrorResponse(applicationContext, "Missing session ID")
        }

        if (sessionId.isNotEmpty() && sessionId != currentSessionId) {
            return CardEmulationState.buildErrorResponse(applicationContext, "Session ID mismatch")
        }

        return null
    }

    private fun handleGetPaymentRequest(json: JSONObject): ByteArray {
        if (!CardEmulationState.isReady(applicationContext)) {
            return CardEmulationState.buildErrorResponse(applicationContext, "Receiver is not ready")
        }

        if (!CardEmulationState.hasPublishedPaymentRequest(applicationContext)) {
            return CardEmulationState.buildErrorResponse(applicationContext, "No payment request available")
        }

        validateSession(extractSessionId(json), requirePresent = false)?.let { return it }

        CardEmulationState.recordLastCommand(applicationContext, "GET_PAYMENT_REQUEST")
        return CardEmulationState.buildPublishedPaymentRequestResponse(applicationContext)
    }

    private fun handlePaymentIntent(json: JSONObject): ByteArray {
        if (!CardEmulationState.hasPublishedPaymentRequest(applicationContext)) {
            return CardEmulationState.buildErrorResponse(applicationContext, "No active payment request")
        }

        validateSession(extractSessionId(json), requirePresent = true)?.let { return it }

        CardEmulationState.setPaymentIntentPayload(applicationContext, json.toString())
        CardEmulationState.recordLastCommand(applicationContext, "PAYMENT_INTENT")
        return CardEmulationState.buildAckResponse(applicationContext)
    }

    private fun handleMerchantPaymentAuthorization(json: JSONObject): ByteArray {
        // Merchant mode: we're the merchant receiving authorization from customer
        if (!CardEmulationState.isMerchantMode(applicationContext)) {
            return CardEmulationState.buildErrorResponse(applicationContext, "Not in merchant mode")
        }

        if (!CardEmulationState.hasPublishedPaymentRequest(applicationContext)) {
            return CardEmulationState.buildErrorResponse(applicationContext, "No active merchant request")
        }

        validateSession(extractSessionId(json), requirePresent = true)?.let { return it }

        // Store the authorization for the merchant to claim payment
        CardEmulationState.setPaymentAuthorizationPayload(applicationContext, json.toString())
        CardEmulationState.recordLastCommand(applicationContext, "MERCHANT_PAYMENT_AUTHORIZATION")
        return CardEmulationState.buildAckResponse(applicationContext)
    }

    private fun isSelectAidCommand(apdu: ByteArray): Boolean {
        if (apdu.size < 12) return false
        if (apdu[0] != 0x00.toByte()) return false
        if (apdu[1] != 0xA4.toByte()) return false
        if (apdu[2] != 0x04.toByte()) return false

        val aidStart = 5
        if (apdu.size < aidStart + AID_BYTES.size) return false

        for (i in AID_BYTES.indices) {
            if (apdu[aidStart + i] != AID_BYTES[i]) return false
        }

        return true
    }

    override fun onDeactivated(reason: Int) {
        Log.d(TAG, "HCE deactivated, reason: $reason")
    }
}
