import Foundation

@objc public class ActivityRecognition: NSObject {
    @objc public func echo(_ value: String) -> String {
        print(value)
        return value
    }
}
