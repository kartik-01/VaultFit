import {Activity, IStorageAdapter} from './index';

export class WebStorage implements IStorageAdapter {
  private activities: Map<string, Activity> = new Map();

  async initialize(): Promise<void> {
    // No initialization needed for in-memory
    console.log('WebStorage initialized (In-Memory)');
  }

  async saveActivity(activity: Activity): Promise<void> {
    this.activities.set(activity.id, activity);
  }

  async getActivities(): Promise<Activity[]> {
    return Array.from(this.activities.values()).sort(
      (a, b) => b.timestamp - a.timestamp,
    );
  }

  async deleteActivity(id: string): Promise<void> {
    this.activities.delete(id);
  }
}
