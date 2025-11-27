import Foundation
import HealthKit
import React

@objc(HealthCollectorModule)
class HealthCollectorModule: NSObject {

  // MARK: - Required for React Native Module registration
  @objc static func moduleName() -> String! {
    return "HealthCollectorModule"
  }

  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }

  private let healthStore = HKHealthStore()
  private let calendar = Calendar.current

  // MARK: - Permissions

  @objc(requestPermissions:rejecter:)
  func requestPermissions(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard HKHealthStore.isHealthDataAvailable() else {
      resolve(false)
      return
    }

    var readTypes = Set<HKObjectType>()
    let quantityIdentifiers: [HKQuantityTypeIdentifier] = [
      .stepCount,
      .distanceWalkingRunning,
      .activeEnergyBurned,
      .basalEnergyBurned,
      .heartRate,
      .restingHeartRate,
      .heartRateVariabilitySDNN,
      .vo2Max,
      .dietaryWater,
      .respiratoryRate,
      .oxygenSaturation
    ]

    for identifier in quantityIdentifiers {
      if let type = HKQuantityType.quantityType(forIdentifier: identifier) {
        readTypes.insert(type)
      }
    }

    if let mindful = HKObjectType.categoryType(forIdentifier: .mindfulSession) {
      readTypes.insert(mindful)
    }

    if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
      readTypes.insert(sleep)
    }

    readTypes.insert(HKObjectType.workoutType())

    healthStore.requestAuthorization(toShare: nil, read: readTypes) { success, error in
      if let error = error {
        reject("health_permission_error", error.localizedDescription, error)
      } else {
        resolve(success)
      }
    }
  }

  // MARK: - Tracking

  @objc(startTracking:resolver:rejecter:)
  func startTracking(
    _ activityType: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(nil)
  }

  @objc(stopTracking:rejecter:)
  func stopTracking(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    fetchLatestMetrics(resolve, rejecter: reject)
  }

  // MARK: - Fetch Latest Metrics

  @objc(fetchLatestMetrics:rejecter:)
  func fetchLatestMetrics(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    collectLatestMetrics { result in
      switch result {
      case .success(let data):
        resolve(data)
      case .failure(let error):
        reject("health_metrics_error", error.localizedDescription, error)
      }
    }
  }

  // MARK: - Collect All Metrics

  private func collectLatestMetrics(
    completion: @escaping (Result<[String: Any], Error>) -> Void
  ) {
    guard HKHealthStore.isHealthDataAvailable() else {
      let error = NSError(
        domain: "HealthCollector",
        code: -1,
        userInfo: [NSLocalizedDescriptionKey: "Health data unavailable"]
      )
      completion(.failure(error))
      return
    }

    let now = Date()
    let startDate = Date.distantPast // full history

    var payload: [String: Any] = [
      "steps": 0.0,
      "distance": 0.0,
      "activeEnergyBurned": 0.0,
      "basalEnergyBurned": 0.0,
      "heartRate": [],
      "restingHeartRate": 0.0,
      "heartRateVariability": 0.0,
      "vo2Max": 0.0,
      "mindfulMinutes": 0.0,
      "sleepAnalysis": [],
      "hydration": 0.0,
      "respiratoryRate": 0.0,
      "bloodOxygen": 0.0,
      "workouts": [],
      "route": [],
      "lastSync": now.timeIntervalSince1970 * 1000.0
    ]

    let group = DispatchGroup()

    group.enter()
    sumQuantity(.stepCount, unit: HKUnit.count(), startDate: startDate) {
      payload["steps"] = $0
      group.leave()
    }

    group.enter()
    sumQuantity(.distanceWalkingRunning, unit: HKUnit.meter(), startDate: startDate) {
      payload["distance"] = $0 / 1000.0
      group.leave()
    }

    group.enter()
    sumQuantity(.activeEnergyBurned, unit: HKUnit.kilocalorie(), startDate: startDate) {
      payload["activeEnergyBurned"] = $0
      group.leave()
    }

    group.enter()
    sumQuantity(.basalEnergyBurned, unit: HKUnit.kilocalorie(), startDate: startDate) {
      payload["basalEnergyBurned"] = $0
      group.leave()
    }

    group.enter()
    latestQuantity(.restingHeartRate, unit: HKUnit.count().unitDivided(by: .minute())) {
      payload["restingHeartRate"] = $0
      group.leave()
    }

    group.enter()
    latestQuantity(.heartRateVariabilitySDNN, unit: HKUnit.secondUnit(with: .milli)) {
      payload["heartRateVariability"] = $0
      group.leave()
    }

    group.enter()
    latestQuantity(.vo2Max, unit: HKUnit(from: "ml/(kg*min)")) {
      payload["vo2Max"] = $0
      group.leave()
    }

    group.enter()
    fetchHeartRateSamples(limit: 500) { samples in
      payload["heartRate"] = samples
      group.leave()
    }

    group.enter()
    fetchMindfulMinutes(startDate: startDate) {
      payload["mindfulMinutes"] = $0
      group.leave()
    }

    group.enter()
    fetchSleepSegments(startDate: startDate) {
      payload["sleepAnalysis"] = $0
      group.leave()
    }

    group.enter()
    sumQuantity(.dietaryWater, unit: HKUnit.liter(), startDate: startDate) {
      payload["hydration"] = $0
      group.leave()
    }

    group.enter()
    latestQuantity(.respiratoryRate, unit: HKUnit.count().unitDivided(by: .minute())) {
      payload["respiratoryRate"] = $0
      group.leave()
    }

    group.enter()
    latestQuantity(.oxygenSaturation, unit: HKUnit.percent()) {
      payload["bloodOxygen"] = $0 * 100.0
      group.leave()
    }

    group.enter()
    fetchWorkouts(startDate: startDate) {
      payload["workouts"] = $0
      group.leave()
    }

    group.notify(queue: .main) {
      completion(.success(payload))
    }
  }

  // MARK: - Helper Methods (unchanged)

  private func sumQuantity(
    _ identifier: HKQuantityTypeIdentifier,
    unit: HKUnit,
    startDate: Date,
    completion: @escaping (Double) -> Void
  ) {
    guard let type = HKQuantityType.quantityType(forIdentifier: identifier) else {
      completion(0); return
    }
    let predicate = HKQuery.predicateForSamples(withStart: startDate, end: Date(), options: [])
    let query = HKStatisticsQuery(
      quantityType: type,
      quantitySamplePredicate: predicate,
      options: .cumulativeSum
    ) { _, stats, _ in
      completion(stats?.sumQuantity()?.doubleValue(for: unit) ?? 0)
    }
    healthStore.execute(query)
  }

  private func latestQuantity(
    _ identifier: HKQuantityTypeIdentifier,
    unit: HKUnit,
    completion: @escaping (Double) -> Void
  ) {
    guard let type = HKQuantityType.quantityType(forIdentifier: identifier) else {
      completion(0); return
    }

    let predicate = HKQuery.predicateForSamples(withStart: Date.distantPast, end: Date(), options: [])
    let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)

    let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: 1, sortDescriptors: [sort]) {
      _, samples, _ in
      if let sample = samples?.first as? HKQuantitySample {
        completion(sample.quantity.doubleValue(for: unit))
      } else {
        completion(0)
      }
    }
    healthStore.execute(query)
  }

  private func fetchHeartRateSamples(limit: Int, completion: @escaping ([[String: Any]]) -> Void) {
    guard let type = HKQuantityType.quantityType(forIdentifier: .heartRate) else {
      completion([]); return
    }

    let predicate = HKQuery.predicateForSamples(withStart: Date.distantPast, end: Date(), options: [])
    let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)

    let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: limit, sortDescriptors: [sort]) {
      _, samples, _ in

      let unit = HKUnit.count().unitDivided(by: .minute())

      let result = samples?
        .compactMap { $0 as? HKQuantitySample }
        .map { sample in
          [
            "timestamp": sample.endDate.timeIntervalSince1970 * 1000.0,
            "value": sample.quantity.doubleValue(for: unit)
          ]
        } ?? []

      completion(result)
    }

    healthStore.execute(query)
  }

  private func fetchMindfulMinutes(startDate: Date, completion: @escaping (Double) -> Void) {
    guard let type = HKObjectType.categoryType(forIdentifier: .mindfulSession) else {
      completion(0); return
    }

    let predicate = HKQuery.predicateForSamples(withStart: Date.distantPast, end: Date(), options: [])
    let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) {
      _, samples, _ in

      let total = samples?
        .compactMap { $0 as? HKCategorySample }
        .reduce(0.0) { $0 + $1.endDate.timeIntervalSince($1.startDate) / 60.0 }
        ?? 0.0

      completion(total)
    }

    healthStore.execute(query)
  }

  private func fetchSleepSegments(startDate: Date, completion: @escaping ([[String: Any]]) -> Void) {
    guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else {
      completion([]); return
    }

    let predicate = HKQuery.predicateForSamples(withStart: Date.distantPast, end: Date(), options: [])
    let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)

    let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: [sort]) {
      _, samples, _ in

      let mapped = samples?
        .compactMap { $0 as? HKCategorySample }
        .map { sample in
          [
            "start": sample.startDate.timeIntervalSince1970 * 1000.0,
            "end": sample.endDate.timeIntervalSince1970 * 1000.0,
            "stage": self.stageLabel(for: sample.value)
          ]
        } ?? []

      completion(mapped)
    }

    healthStore.execute(query)
  }

  private func fetchWorkouts(startDate: Date, completion: @escaping ([[String: Any]]) -> Void) {
    let predicate = HKQuery.predicateForSamples(withStart: Date.distantPast, end: Date(), options: [])
    let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)

    let query = HKSampleQuery(sampleType: HKObjectType.workoutType(), predicate: predicate, limit: 100, sortDescriptors: [sort]) {
      _, samples, _ in

      let workouts = samples?
        .compactMap { $0 as? HKWorkout }
        .map { workout in
          [
            "id": workout.uuid.uuidString,
            "type": self.workoutTypeString(for: workout.workoutActivityType),
            "durationMinutes": workout.duration / 60.0,
            "calories": workout.totalEnergyBurned?.doubleValue(for: .kilocalorie()) ?? 0,
            "distance": (workout.totalDistance?.doubleValue(for: .meter()) ?? 0) / 1000.0
          ]
        } ?? []

      completion(workouts)
    }

    healthStore.execute(query)
  }

  private func stageLabel(for value: Int) -> String {
    if #available(iOS 16.0, *) {
      switch value {
      case HKCategoryValueSleepAnalysis.awake.rawValue: return "awake"
      case HKCategoryValueSleepAnalysis.asleepREM.rawValue: return "rem"
      case HKCategoryValueSleepAnalysis.asleepDeep.rawValue: return "deep"
      default: return "core"
      }
    } else {
      switch value {
      case HKCategoryValueSleepAnalysis.awake.rawValue: return "awake"
      case HKCategoryValueSleepAnalysis.asleep.rawValue: return "core"
      default: return "core"
      }
    }
  }

  private func workoutTypeString(for type: HKWorkoutActivityType) -> String {
    switch type {
    case .running: return "run"
    case .cycling: return "cycle"
    case .walking: return "walk"
    default: return "other"
    }
  }
}
