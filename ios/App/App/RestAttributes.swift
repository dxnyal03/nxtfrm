import Foundation
#if canImport(ActivityKit)
import ActivityKit

/// The rest timer as a Live Activity (lock screen + Dynamic Island). Compiled into the app and the RestActivity extension.
@available(iOS 16.1, *)
struct RestAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// When the rest ends; the widget counts down to it on its own, so the app does not need to run.
        var endAt: Date
        /// e.g. "Set 2 of 3 next"
        var subtitle: String
    }
    /// The exercise, e.g. "Leg Press"
    var title: String
}
#endif
