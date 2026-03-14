package com.bump.wallet.nfc

import android.app.Activity
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONException
import org.json.JSONObject

/**
 * NFC Reader module for payer-side discovery.
 */
class NfcReaderModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), NfcAdapter.ReaderCallback {

    private var nfcAdapter: NfcAdapter? = null
    private var currentSessionId: String = ""
    private var activeIsoDep: IsoDep? = null

    companion object {
        const val EVENT_PAYMENT_REQUEST = "onPaymentRequest"
        const val EVENT_ERROR = "onError"

        private val AID_BYTES = byteArrayOf(
            0xA0.toByte(), 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        )
    }

    override fun getName(): String = "NfcReaderModule"

    @ReactMethod
    fun setScanSession(sessionId: String, promise: Promise) {
        currentSessionId = sessionId
        promise.resolve("Scan session set")
    }

    @ReactMethod
    fun clearScanSession(promise: Promise) {
        clearActiveSession()
        promise.resolve("Scan session cleared")
    }

    @ReactMethod
    fun sendPaymentIntent(payload: String, promise: Promise) {
        val iso = activeIsoDep
        if (iso == null || !iso.isConnected) {
            promise.reject("NO_ACTIVE_TAG", "No active NFC session available")
            return
        }

        sendIntent(iso, payload, promise)
    }

    @ReactMethod
    fun sendMerchantAuthorization(payload: String, promise: Promise) {
        val iso = activeIsoDep
        if (iso == null || !iso.isConnected) {
            promise.reject("NO_ACTIVE_TAG", "No active NFC session available")
            return
        }

        sendAuthorization(iso, payload, promise)
    }

    override fun onTagDiscovered(tag: Tag?) {
        val iso = tag?.let { IsoDep.get(it) } ?: return

        try {
            iso.connect()
            if (!selectAid(iso)) {
                closeQuietly(iso)
                return
            }

            val paymentRequest = fetchPaymentRequest(iso)
            if (paymentRequest == null) {
                closeQuietly(iso)
                return
            }

            clearActiveSession(clearSessionId = false)
            activeIsoDep = iso
            sendEvent(EVENT_PAYMENT_REQUEST, paymentRequest.toString())
        } catch (e: Exception) {
            closeQuietly(iso)
            clearActiveSession()
            emitReaderError("Payment discovery failed: ${e.message}")
        }
    }

    private fun selectAid(iso: IsoDep): Boolean {
        val selectResponse = iso.transceive(buildSelectApdu())
        if (!validateSuccessResponse(selectResponse)) {
            val statusWord = extractStatusWord(selectResponse) ?: "Unknown"
            emitReaderError("AID selection failed: status $statusWord")
            return false
        }

        return true
    }

    private fun fetchPaymentRequest(iso: IsoDep): JSONObject? {
        val response = iso.transceive(buildGetPaymentRequestCommand())
        if (!validateSuccessResponse(response)) {
            val statusWord = extractStatusWord(response) ?: "Unknown"
            val message = extractErrorMessage(response)
            val suffix = if (message != null) ": $message" else ""
            emitReaderError("Failed to fetch payment request: $statusWord$suffix")
            return null
        }

        val responseData = extractResponseData(response)
        val responseJson = try {
            JSONObject(responseData)
        } catch (_: JSONException) {
            emitReaderError("Invalid payment request response")
            return null
        }

        val kind = decodeResponseKind(responseJson)
        if (kind != "PAYMENT_REQUEST" && kind != "MERCHANT_PAYMENT_REQUEST") {
            emitReaderError("Unexpected response: $kind")
            return null
        }

        val sessionId = extractSessionId(responseJson)
        if (sessionId.isEmpty()) {
            emitReaderError("Payment request missing session ID")
            return null
        }

        if (currentSessionId.isNotEmpty() && currentSessionId != sessionId) {
            emitReaderError("Session ID mismatch: expected $currentSessionId got $sessionId")
            return null
        }

        currentSessionId = sessionId
        return responseJson
    }

    private fun sendIntent(iso: IsoDep, payload: String, promise: Promise) {
        try {
            val response = iso.transceive(payload.toByteArray(Charsets.UTF_8))
            if (!validateSuccessResponse(response)) {
                val statusWord = extractStatusWord(response) ?: "Unknown"
                val responseMessage = extractErrorMessage(response)
                val suffix = if (responseMessage != null) ": $responseMessage" else ""
                promise.reject("INTENT_FAILED", "Payment intent rejected: $statusWord$suffix")
                return
            }

            promise.resolve("Payment intent sent")
        } catch (e: Exception) {
            promise.reject("INTENT_FAILED", "Failed to send payment intent: ${e.message}")
        } finally {
            clearActiveSession()
        }
    }

    private fun sendAuthorization(iso: IsoDep, payload: String, promise: Promise) {
        try {
            val response = iso.transceive(payload.toByteArray(Charsets.UTF_8))
            if (!validateSuccessResponse(response)) {
                val statusWord = extractStatusWord(response) ?: "Unknown"
                val responseMessage = extractErrorMessage(response)
                val suffix = if (responseMessage != null) ": $responseMessage" else ""
                promise.reject("AUTH_FAILED", "Authorization rejected: $statusWord$suffix")
                return
            }

            promise.resolve("Authorization sent")
        } catch (e: Exception) {
            promise.reject("AUTH_FAILED", "Failed to send authorization: ${e.message}")
        } finally {
            clearActiveSession()
        }
    }

    private fun emitReaderError(message: String) {
        clearActiveSession()
        sendEvent(EVENT_ERROR, message)
    }

    private fun clearActiveSession(clearSessionId: Boolean = true) {
        try {
            activeIsoDep?.close()
        } catch (_: Exception) {
        } finally {
            activeIsoDep = null
            if (clearSessionId) {
                currentSessionId = ""
            }
        }
    }

    private fun buildSelectApdu(): ByteArray = byteArrayOf(
        0x00,
        0xA4.toByte(),
        0x04,
        0x00,
        0x07,
        *AID_BYTES,
        0x00
    )

    private fun buildGetPaymentRequestCommand(): ByteArray {
        val json = JSONObject().apply {
            put("version", CardEmulationState.PROTOCOL_VERSION)
            put("v", CardEmulationState.PROTOCOL_VERSION)
            put("sessionId", currentSessionId)
            put("s", currentSessionId)
            put("kind", "GET_PAYMENT_REQUEST")
            put("k", "Q")
        }

        return json.toString().toByteArray(Charsets.UTF_8)
    }

    private fun validateSuccessResponse(response: ByteArray): Boolean {
        return response.size >= 2 &&
            response[response.size - 2] == 0x90.toByte() &&
            response[response.size - 1] == 0x00.toByte()
    }

    private fun extractStatusWord(response: ByteArray): String? {
        return if (response.size >= 2) {
            NfcUtils.bytesToHex(
                byteArrayOf(
                    response[response.size - 2],
                    response[response.size - 1]
                )
            )
        } else {
            null
        }
    }

    private fun extractResponseData(response: ByteArray): String {
        return if (response.size > 2) {
            response.dropLast(2).toByteArray().toString(Charsets.UTF_8)
        } else {
            ""
        }
    }

    private fun extractErrorMessage(response: ByteArray): String? {
        val responseData = extractResponseData(response)
        if (responseData.isEmpty()) {
            return null
        }

        return try {
            val json = JSONObject(responseData)
            val message = json.optString("message", json.optString("m", ""))
            if (message.isEmpty()) null else message
        } catch (_: JSONException) {
            null
        }
    }

    private fun extractSessionId(json: JSONObject): String {
        return json.optString("sessionId", json.optString("s", ""))
    }

    private fun decodeResponseKind(json: JSONObject): String {
        return when (json.optString("kind", json.optString("k", ""))) {
            "R", "PAYMENT_REQUEST" -> "PAYMENT_REQUEST"
            "M", "MERCHANT_PAYMENT_REQUEST" -> "MERCHANT_PAYMENT_REQUEST"
            "E", "ERROR" -> "ERROR"
            else -> ""
        }
    }

    private fun closeQuietly(iso: IsoDep) {
        try {
            iso.close()
        } catch (_: Exception) {
        }
    }

    @ReactMethod
    fun startReader(promise: Promise) {
        try {
            val activity: Activity? = reactApplicationContext.currentActivity
            if (activity == null) {
                promise.reject("NO_ACTIVITY", "Current activity is null")
                return
            }

            nfcAdapter = NfcAdapter.getDefaultAdapter(reactApplicationContext)
            if (nfcAdapter == null) {
                promise.reject("NO_NFC", "NFC is not available on this device")
                return
            }

            val flags = NfcAdapter.FLAG_READER_NFC_A or
                NfcAdapter.FLAG_READER_NFC_B or
                NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK

            nfcAdapter!!.enableReaderMode(activity, this, flags, null)
            promise.resolve("Reader mode enabled")
        } catch (e: Exception) {
            promise.reject("READER_ERROR", "Failed to enable reader mode: ${e.message}")
        }
    }

    @ReactMethod
    fun stopReader(promise: Promise) {
        try {
            val activity: Activity? = reactApplicationContext.currentActivity
            if (activity == null) {
                clearActiveSession()
                promise.resolve("Reader mode disabled (no activity)")
                return
            }

            nfcAdapter?.disableReaderMode(activity)
            clearActiveSession()
            promise.resolve("Reader mode disabled")
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", "Failed to disable reader mode: ${e.message}")
        }
    }

    @ReactMethod
    fun isNfcSupported(promise: Promise) {
        val adapter = NfcAdapter.getDefaultAdapter(reactApplicationContext)
        promise.resolve(adapter != null)
    }

    @ReactMethod
    fun isNfcEnabled(promise: Promise) {
        val adapter = NfcAdapter.getDefaultAdapter(reactApplicationContext)
        promise.resolve(adapter?.isEnabled == true)
    }

    @ReactMethod
    fun addListener(eventName: String) {
    }

    @ReactMethod
    fun removeListeners(count: Int) {
    }

    private fun sendEvent(eventName: String, params: String) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
}
