import ActivityKit
import WidgetKit
import SwiftUI

/// The rest timer on the lock screen and in the Dynamic Island. It counts down to `endAt` by itself,
/// so it stays right while NXTFRM is in the background.
struct RestActivityWidget: Widget {
    private let ink = Color(red: 0.957, green: 0.949, blue: 0.980)       // --st-ink
    private let muted = Color(red: 0.596, green: 0.576, blue: 0.667)     // --st-ink-3
    private let accent = Color(red: 0.706, green: 0.604, blue: 1.0)      // --st-accent-lift
    private let canvas = Color(red: 0.08, green: 0.075, blue: 0.118)     // --st-tile-bg, opaque

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestAttributes.self) { context in
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Rest").font(.caption).foregroundStyle(muted)
                    Text(context.attributes.title).font(.headline).foregroundStyle(ink)
                        .lineLimit(2).minimumScaleFactor(0.85) /* long names ("Machine Shoulder Press") wrap instead of truncating beside the timer */
                    if !context.state.subtitle.isEmpty {
                        Text(context.state.subtitle).font(.caption).foregroundStyle(muted).lineLimit(1)
                    }
                }
                Spacer(minLength: 8)
                countdown(context.state.endAt, stale: context.isStale)
                    .font(.system(size: 38, weight: .light, design: .rounded))
                    .foregroundStyle(context.isStale ? accent : ink)
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 14)
            .activityBackgroundTint(canvas)
            .activitySystemActionForegroundColor(ink)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Rest").font(.caption2).foregroundStyle(muted)
                        Text(context.attributes.title).font(.subheadline).foregroundStyle(ink).lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    countdown(context.state.endAt, stale: context.isStale)
                        .font(.system(size: 30, weight: .light, design: .rounded))
                        .foregroundStyle(ink)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if !context.state.subtitle.isEmpty {
                        Text(context.state.subtitle).font(.caption).foregroundStyle(muted)
                    }
                }
            } compactLeading: {
                Image(systemName: "timer").foregroundStyle(accent)
            } compactTrailing: {
                countdown(context.state.endAt, stale: context.isStale)
                    .foregroundStyle(ink)
                    .frame(maxWidth: 44)
            } minimal: {
                Image(systemName: "timer").foregroundStyle(accent)
            }
        }
    }

    /// A live countdown to `end`; "Done" once it has passed (the activity is stale from `endAt`).
    @ViewBuilder
    private func countdown(_ end: Date, stale: Bool) -> some View {
        if stale || end <= Date() {
            Text("Done")
        } else {
            /* Counts down to a fixed end time; nothing is captured at render time, so every redraw agrees. */
            Text(end, style: .timer)
                .monospacedDigit()
                .multilineTextAlignment(.trailing)
        }
    }
}
