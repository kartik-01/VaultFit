import {NativeModules, Platform} from 'react-native';

export type HeartRateSample = {timestamp: number; value: number};
export type SleepSegment = {start: number; end: number; stage: string};
export type WorkoutSample = {
  id: string;
  type: string;
  durationMinutes: number;
  calories: number;
  distance: number;
};

export interface HealthCollectorPayload {
  heartRate: HeartRateSample[];
  steps: number;
  distance: number;
  activeEnergyBurned: number;
  basalEnergyBurned: number;
  restingHeartRate: number;
  heartRateVariability: number;
  vo2Max: number;
  mindfulMinutes: number;
  sleepAnalysis: SleepSegment[];
  hydration: number;
  respiratoryRate: number;
  bloodOxygen: number;
  workouts: WorkoutSample[];
  route: Array<{latitude: number; longitude: number; timestamp: number}>;
  lastSync: number;
}

export interface HealthCollectorModule {
  requestPermissions(): Promise<boolean>;
  startTracking(activityType: string): Promise<void>;
  stopTracking(): Promise<HealthCollectorPayload>;
  fetchLatestMetrics(): Promise<HealthCollectorPayload>;
}

const nativeModule = NativeModules.HealthCollectorModule as
  | HealthCollectorModule
  | undefined;

const fallback: HealthCollectorModule = {
  async requestPermissions() {
    if (__DEV__) {
      console.warn('[HealthCollector] Native module missing, returning mock permission value.');
    }
    return Platform.OS === 'ios';
  },
  async startTracking(activityType: string) {
    if (__DEV__) {
      console.warn(`[HealthCollector] startTracking(${activityType}) stub.`);
    }
  },
  async stopTracking() {
    if (__DEV__) {
      console.warn('[HealthCollector] stopTracking() stub metrics.');
    }
    return {
      heartRate: [],
      steps: 0,
      distance: 0,
      activeEnergyBurned: 0,
      basalEnergyBurned: 0,
      restingHeartRate: 0,
      heartRateVariability: 0,
      vo2Max: 0,
      mindfulMinutes: 0,
      sleepAnalysis: [],
      hydration: 0,
      respiratoryRate: 0,
      bloodOxygen: 0,
      workouts: [],
      route: [],
      lastSync: Date.now(),
    };
  },
  async fetchLatestMetrics() {
    return this.stopTracking();
  },
};

const HealthCollector: HealthCollectorModule = nativeModule ?? fallback;

export default HealthCollector;
