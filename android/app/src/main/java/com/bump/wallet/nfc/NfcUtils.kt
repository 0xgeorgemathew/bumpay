package com.bump.wallet.nfc

object NfcUtils {
    fun bytesToHex(bytes: ByteArray): String {
        return bytes.joinToString("") { "%02X".format(it) }
    }
}
