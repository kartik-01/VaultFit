export interface Activity {
  id: string;
  type: string;
  data: string; // Encrypted data
  timestamp: number;
}

export interface IStorageAdapter {
  initialize(): Promise<void>;
  saveActivity(activity: Activity): Promise<void>;
  getActivities(): Promise<Activity[]>;
  deleteActivity(id: string): Promise<void>;
}
