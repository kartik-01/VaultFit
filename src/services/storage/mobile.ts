import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import {File, Paths} from 'expo-file-system';
import {Activity, IStorageAdapter} from './index';

const DB_NAME = 'vaultfit.db';
const DB_KEY_ALIAS = 'db_key';

export class MobileStorage implements IStorageAdapter {
  private db: SQLite.SQLiteDatabase | null = null;

  private async getDatabaseKey(): Promise<string> {
    let key = await SecureStore.getItemAsync(DB_KEY_ALIAS);
    if (!key) {
      key =
        Math.random().toString(36).substring(2) +
        Math.random().toString(36).substring(2); // Simple generation for now
      await SecureStore.setItemAsync(DB_KEY_ALIAS, key);
    }
    return key;
  }

  async initialize(): Promise<void> {
    // In a real SQLCipher setup with expo-sqlite, the key might be handled differently depending on the exact version and configuration.
    // Assuming standard SQLCipher behavior where we set the key immediately after opening.
    this.db = await SQLite.openDatabaseAsync(DB_NAME);

    const key = await this.getDatabaseKey();
    // Note: expo-sqlite's new API might handle encryption configuration differently or via the openDatabase options if supported directly.
    // For now, using PRAGMA key as a standard SQLCipher approach.
    await this.db.execAsync(`PRAGMA key = '${key}';`);

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);
  }

  async saveActivity(activity: Activity): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync(
      'INSERT OR REPLACE INTO activities (id, type, data, timestamp) VALUES (?, ?, ?, ?)',
      activity.id,
      activity.type,
      activity.data,
      activity.timestamp,
    );
    // dev logging removed to avoid leaking sensitive data
  }

  async getActivities(): Promise<Activity[]> {
    if (!this.db) throw new Error('Database not initialized');
    const rows = await this.db.getAllAsync<Activity>(
      'SELECT * FROM activities ORDER BY timestamp DESC',
    );
    return rows;
  }

  async deleteActivity(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync('DELETE FROM activities WHERE id = ?', id);
  }

  /**
   * Dev helper: export all activities as a JSON file to app document directory.
   * Returns the file path.
   */
  async exportActivitiesToFile(): Promise<string> {
    if (!__DEV__) throw new Error('exportActivitiesToFile is dev-only');
    if (!this.db) throw new Error('Database not initialized');

    const rows = await this.db.getAllAsync<Activity>(
      'SELECT id, type, data, timestamp FROM activities ORDER BY timestamp DESC',
    );

    const filename = `vaultfit-activities-${Date.now()}.json`;
    const outFile = new File(Paths.document, filename);
    await outFile.create({overwrite: true});
    await outFile.write(JSON.stringify(rows, null, 2));

    const outPath = outFile.uri ?? `${Paths.document}/${filename}`;
    console.log('[MobileStorage][DEV] exported activities to', outPath);
    return outPath;
  }
}
