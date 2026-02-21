import Foundation
import Capacitor

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitorjs.com/docs/plugins/ios
 */
@objc(ActivityRecognitionPlugin)
public class ActivityRecognitionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ActivityRecognitionPlugin"
    public let jsName = "ActivityRecognition"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "echo", returnType: CAPPluginReturnPromise)
    ]
    private let implementation = ActivityRecognition()

    @objc func echo(_ call: CAPPluginCall) {
        let value = call.getString("value") ?? ""
        call.resolve([
            "value": implementation.echo(value)
        ])
    }
}
