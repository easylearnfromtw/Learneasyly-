import ActivityKit
import Foundation

// Add this file to both the iOS app and its Widget extension targets.
struct StudyActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var subject: String
        var kind: String
        var detail: String
        var mode: String
        var running: Bool
        var elapsedSeconds: Int
        var remainingSeconds: Int
        var countUpAnchor: Date
        var countDownEnd: Date

        var isCountdown: Bool { mode == "25" || mode == "50" }
    }

    var sessionID: String
}
