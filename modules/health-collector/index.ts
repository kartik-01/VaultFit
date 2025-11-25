// Interface for the Health Collector Native Module
export interface HealthData {
  heartRate: Array<{timestamp: number; value: number}>;
  steps: number;
  distance: number;
  route: Array<{latitude: number; longitude: number; timestamp: number}>;
}

export interface HealthCollectorModule {
  requestPermissions(): Promise<boolean>;
  startTracking(activityType: string): Promise<void>;
  stopTracking(): Promise<HealthData>;
}

// Mock implementation for now, as the native code needs to be compiled
const HealthCollector: HealthCollectorModule = {
  requestPermissions: async () => {
    console.log('HealthCollector: Requesting permissions...');
    return true;
  },
  startTracking: async (activityType: string) => {
    console.log(`HealthCollector: Started tracking ${activityType}`);
  },
  stopTracking: async () => {
    console.log('HealthCollector: Stopped tracking');
    return {
      heartRate: [],
      steps: 0,
      distance: 0,
      route: [],
    };
  },
};

export default HealthCollector;
