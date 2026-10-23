import UIKit
import Capacitor

/// NXTFRM's bridge: registers the app's own native plugin, which lives in this target rather than an npm package.
class NxtBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NxtNativePlugin())
    }
}
