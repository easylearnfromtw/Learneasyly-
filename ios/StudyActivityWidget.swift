import ActivityKit
import WidgetKit
import SwiftUI

// iOS 17 or later. Add to a Widget Extension with Live Activities enabled.
struct StudyActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: StudyActivityAttributes.self) { context in
            LockScreenTimerView(state: context.state)
                .padding(.horizontal, 16)
                .padding(.vertical, 13)
                .activityBackgroundTint(Color(red: 0.09, green: 0.13, blue: 0.19))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label("稜角", systemImage: "book.closed")
                        .font(.caption.bold())
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.subject).font(.caption).lineLimit(1)
                }
                DynamicIslandExpandedRegion(.center) {
                    StudyTimerText(state: context.state)
                        .font(.system(.title2, design: .rounded, weight: .semibold))
                        .monospacedDigit()
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.running ? context.state.kind : "已暫停")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } compactLeading: {
                Image(systemName: "book.closed")
            } compactTrailing: {
                StudyTimerText(state: context.state)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .frame(maxWidth: 54)
            } minimal: {
                Image(systemName: "timer")
            }
            .keylineTint(.cyan)
        }
    }
}

private struct StudyTimerText: View {
    let state: StudyActivityAttributes.ContentState

    var body: some View {
        Group {
            if !state.running {
                Text(displayTime(state.isCountdown ? state.remainingSeconds : state.elapsedSeconds))
            } else if state.isCountdown {
                Text(timerInterval: Date(timeIntervalSince1970: 0)...state.countDownEnd,
                     countsDown: true, showsHours: true)
            } else {
                Text(state.countUpAnchor, style: .timer)
            }
        }
        .contentTransition(.numericText())
    }

    private func displayTime(_ seconds: Int) -> String {
        let value = max(0, seconds)
        let h = value / 3600, m = (value % 3600) / 60, s = value % 60
        return h > 0
            ? String(format: "%d:%02d:%02d", h, m, s)
            : String(format: "%02d:%02d", m, s)
    }
}

private struct LockScreenTimerView: View {
    let state: StudyActivityAttributes.ContentState

    var body: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 5) {
                Label("稜角 · 讀書計時", systemImage: "book.closed")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.75))
                Text(state.subject)
                    .font(.headline)
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text(state.running ? state.kind : "已暫停")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.75))
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            StudyTimerText(state: state)
                .font(.system(size: 29, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(.white)
                .minimumScaleFactor(0.65)
                .lineLimit(1)
        }
    }
}

// The Widget Extension needs one @main widget entry point.
@main
struct LearnAngleWidgets: WidgetBundle {
    var body: some Widget {
        StudyActivityWidget()
    }
}
