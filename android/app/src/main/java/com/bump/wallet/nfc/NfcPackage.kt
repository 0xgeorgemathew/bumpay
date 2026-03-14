package com.bump.wallet.nfc

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * React Native package for NFC payment functionality.
 */
class NfcPackage : ReactPackage {
    @Suppress("OVERRIDE_DEPRECATION")
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(
            AudioFeedbackModule(reactContext),
            NfcReaderModule(reactContext),
            CardEmulationModule(reactContext)
        )
    }

    override fun createViewManagers(
        reactContext: ReactApplicationContext
    ): List<ViewManager<*, *>> {
        return emptyList()
    }
}
