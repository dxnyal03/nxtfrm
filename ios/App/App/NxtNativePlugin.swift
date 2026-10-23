import Foundation
import UIKit
import Capacitor
import UserNotifications
import HealthKit
#if canImport(ActivityKit)
import ActivityKit
#endif

/// NXTFRM's native features (SPEC-native-1.md): haptics, keep-awake, local notifications,
/// one-way morning weigh-ins and Evo-scan body fat to Apple Health, and the rest timer as a Live Activity. The web app drives it from native.js.
@objc(NxtNativePlugin)
public class NxtNativePlugin: CAPPlugin, CAPBridgedPlugin, UNUserNotificationCenterDelegate {
    public let identifier = "NxtNativePlugin"
    public let jsName = "NxtNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "haptic", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "keepAwake", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "notifyPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "schedule", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelPrefix", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "healthAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "healthAuthorize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "healthSaveWeight", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "healthDeleteWeight", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "healthSaveBodyFat", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "healthDeleteBodyFat", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "liveStart", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "liveUpdate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "liveEnd", returnType: CAPPluginReturnPromise)
    ]

    private let health = HKHealthStore()
    private var bodyMass: HKQuantityType { HKQuantityType.quantityType(forIdentifier: .bodyMass)! }
    private var bodyFat: HKQuantityType { HKQuantityType.quantityType(forIdentifier: .bodyFatPercentage)! }

    public override func load() {
        UNUserNotificationCenter.current().delegate = self
    }

    // In the foreground the app already toasts and vibrates at the end of a rest, so the banner is not shown twice.
    public func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                       withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([])
    }

    public func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                       withCompletionHandler completionHandler: @escaping () -> Void) {
        completionHandler()
    }

    // MARK: Haptics and keep-awake

    @objc func haptic(_ call: CAPPluginCall) {
        let style = call.getString("style") ?? "medium"
        DispatchQueue.main.async {
            switch style {
            case "light": UIImpactFeedbackGenerator(style: .light).impactOccurred()
            case "heavy": UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
            case "selection": UISelectionFeedbackGenerator().selectionChanged()
            case "success": UINotificationFeedbackGenerator().notificationOccurred(.success)
            case "warning": UINotificationFeedbackGenerator().notificationOccurred(.warning)
            case "error": UINotificationFeedbackGenerator().notificationOccurred(.error)
            default: UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            }
            call.resolve()
        }
    }

    @objc func keepAwake(_ call: CAPPluginCall) {
        let on = call.getBool("on") ?? false
        DispatchQueue.main.async {
            UIApplication.shared.isIdleTimerDisabled = on
            call.resolve()
        }
    }

    // MARK: Local notifications (rest end, weigh-in reminder)

    @objc func notifyPermission(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, _ in
            call.resolve(["granted": granted])
        }
    }

    @objc func schedule(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let at = call.getDouble("at") else { return call.reject("id and at are required") }
        let content = UNMutableNotificationContent()
        content.title = call.getString("title") ?? ""
        content.body = call.getString("body") ?? ""
        content.sound = .default
        let seconds = max(1, at / 1000 - Date().timeIntervalSince1970)
        let request = UNNotificationRequest(identifier: id, content: content,
                                            trigger: UNTimeIntervalNotificationTrigger(timeInterval: seconds, repeats: false))
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [id])
        center.add(request) { error in
            if let error = error { call.reject(error.localizedDescription) } else { call.resolve() }
        }
    }

    @objc func cancel(_ call: CAPPluginCall) {
        let ids = (call.getArray("ids") as? [String]) ?? []
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: ids)
        center.removeDeliveredNotifications(withIdentifiers: ids)
        call.resolve()
    }

    @objc func cancelPrefix(_ call: CAPPluginCall) {
        let prefix = call.getString("prefix") ?? ""
        guard !prefix.isEmpty else { return call.resolve() }
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { pending in
            center.removePendingNotificationRequests(withIdentifiers: pending.map(\.identifier).filter { $0.hasPrefix(prefix) })
            call.resolve()
        }
    }

    // MARK: Apple Health — write Body Mass (morning weigh-ins) and Body Fat Percentage (Evo scans); never read

    @objc func healthAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    @objc func healthAuthorize(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else { return call.resolve(["granted": false]) }
        health.requestAuthorization(toShare: [bodyMass, bodyFat], read: []) { _, _ in
            call.resolve(["granted": self.health.authorizationStatus(for: self.bodyMass) == .sharingAuthorized,
                          "bodyFat": self.health.authorizationStatus(for: self.bodyFat) == .sharingAuthorized])
        }
    }

    /// The sync identifier ties the Health sample to the NXTFRM weigh-in, so a later version replaces it (an edit).
    @objc func healthSaveWeight(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let kg = call.getDouble("kg"), let at = call.getDouble("at") else {
            return call.reject("id, kg and at are required")
        }
        let version = Int64(call.getDouble("version") ?? Date().timeIntervalSince1970 * 1000)
        let when = Date(timeIntervalSince1970: at / 1000)
        let sample = HKQuantitySample(type: bodyMass,
                                      quantity: HKQuantity(unit: .gramUnit(with: .kilo), doubleValue: kg),
                                      start: when, end: when,
                                      metadata: [HKMetadataKeySyncIdentifier: "nxtfrm-bw-" + id,
                                                 HKMetadataKeySyncVersion: NSNumber(value: version)])
        health.save(sample) { ok, error in
            if ok { call.resolve() } else { call.reject(error?.localizedDescription ?? "Health save failed") }
        }
    }

    @objc func healthDeleteWeight(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { return call.reject("id is required") }
        deleteSynced(bodyMass, "nxtfrm-bw-" + id, call)
    }

    /// Body fat from an Evo scan (percent, e.g. 26.2), tied to the scan by its sync identifier like weigh-ins.
    @objc func healthSaveBodyFat(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let pct = call.getDouble("pct"), let at = call.getDouble("at") else {
            return call.reject("id, pct and at are required")
        }
        let version = Int64(call.getDouble("version") ?? Date().timeIntervalSince1970 * 1000)
        let when = Date(timeIntervalSince1970: at / 1000)
        let sample = HKQuantitySample(type: bodyFat,
                                      quantity: HKQuantity(unit: .percent(), doubleValue: pct / 100),
                                      start: when, end: when,
                                      metadata: [HKMetadataKeySyncIdentifier: "nxtfrm-bf-" + id,
                                                 HKMetadataKeySyncVersion: NSNumber(value: version)])
        health.save(sample) { ok, error in
            if ok { call.resolve() } else { call.reject(error?.localizedDescription ?? "Health save failed") }
        }
    }

    @objc func healthDeleteBodyFat(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { return call.reject("id is required") }
        deleteSynced(bodyFat, "nxtfrm-bf-" + id, call)
    }

    private func deleteSynced(_ type: HKQuantityType, _ syncId: String, _ call: CAPPluginCall) {
        let match = HKQuery.predicateForObjects(withMetadataKey: HKMetadataKeySyncIdentifier, allowedValues: [syncId])
        health.deleteObjects(of: type, predicate: match) { _, _, error in
            if let error = error { call.reject(error.localizedDescription) } else { call.resolve() }
        }
    }

    // MARK: The rest timer as a Live Activity

    @objc func liveStart(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *), let endAt = call.getDouble("endAt"), ActivityAuthorizationInfo().areActivitiesEnabled else {
            return call.resolve(["ok": false])
        }
        let end = Date(timeIntervalSince1970: endAt / 1000)
        let attributes = RestAttributes(title: call.getString("title") ?? "Rest")
        let state = RestAttributes.ContentState(endAt: end, subtitle: call.getString("subtitle") ?? "")
        Task {
            for activity in Activity<RestAttributes>.activities { await activity.end(nil, dismissalPolicy: .immediate) }
            do {
                _ = try Activity.request(attributes: attributes, content: .init(state: state, staleDate: end))
                call.resolve(["ok": true])
            } catch {
                call.resolve(["ok": false])
            }
        }
        #else
        call.resolve(["ok": false])
        #endif
    }

    @objc func liveUpdate(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *), let endAt = call.getDouble("endAt"), let activity = Activity<RestAttributes>.activities.first else {
            return call.resolve(["ok": false])
        }
        let end = Date(timeIntervalSince1970: endAt / 1000)
        let state = RestAttributes.ContentState(endAt: end, subtitle: call.getString("subtitle") ?? activity.content.state.subtitle)
        Task {
            await activity.update(.init(state: state, staleDate: end))
            call.resolve(["ok": true])
        }
        #else
        call.resolve(["ok": false])
        #endif
    }

    @objc func liveEnd(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *) else { return call.resolve() }
        Task {
            for activity in Activity<RestAttributes>.activities { await activity.end(nil, dismissalPolicy: .immediate) }
            call.resolve()
        }
        #else
        call.resolve()
        #endif
    }
}
