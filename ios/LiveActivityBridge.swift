import ActivityKit
import Foundation
import WebKit

/// Receives state transitions from the Learn Angle web timer.
/// JS timestamp math remains the source of truth; the system renders timer
/// labels while WKWebView is suspended or the device is locked.
@MainActor
final class LiveActivityBridge: NSObject, WKScriptMessageHandler {
    static let messageName = "learnAngleLiveActivity"
    private let sessionID = "learn-angle-study-timer"

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard message.name == Self.messageName,
              let payload = message.body as? [String: Any],
              (payload["version"] as? Int) == 1 else { return }
        let event = payload["event"] as? String ?? "sync"
        let active = payload["active"] as? Bool ?? false
        if !active || event == "finish" || event == "reset" {
            Task { await endActivities() }
            return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let state = makeContentState(payload)
        Task { await upsert(state) }
    }

    private func makeContentState(_ info: [String: Any]) -> StudyActivityAttributes.ContentState {
        let now = Date()
        let elapsedMs = max(0, min(info["elapsedMs"] as? Double ?? 0, 86_400_000))
        let remainingMs = max(0, min(info["remainingMs"] as? Double ?? 0, 86_400_000))
        let elapsedSeconds = Int(elapsedMs / 1000)
        let remainingSeconds = Int(remainingMs / 1000)
        return StudyActivityAttributes.ContentState(
            subject: String((info["subject"] as? String ?? "讀書").prefix(40)),
            kind: String((info["kind"] as? String ?? "專注").prefix(40)),
            detail: String((info["note"] as? String ?? "").prefix(60)),
            mode: ["up", "25", "50"].contains(info["mode"] as? String ?? "")
                ? (info["mode"] as? String ?? "up") : "up",
            running: info["running"] as? Bool ?? false,
            elapsedSeconds: elapsedSeconds,
            remainingSeconds: remainingSeconds,
            countUpAnchor: now.addingTimeInterval(-Double(elapsedSeconds)),
            countDownEnd: now.addingTimeInterval(TimeInterval(remainingSeconds))
        )
    }

    private func upsert(_ state: StudyActivityAttributes.ContentState) async {
        let content = ActivityContent(state: state, staleDate: nil)
        if let existing = Activity<StudyActivityAttributes>.activities.first(
            where: { $0.attributes.sessionID == sessionID }
        ) {
            await existing.update(content)
            return
        }
        do {
            let attributes = StudyActivityAttributes(sessionID: sessionID)
            _ = try Activity.request(attributes: attributes, content: content, pushType: nil)
        } catch {
            NSLog("Learn Angle Live Activity request failed: %@", String(describing: error))
        }
    }

    private func endActivities() async {
        for activity in Activity<StudyActivityAttributes>.activities
            where activity.attributes.sessionID == sessionID {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }
}
