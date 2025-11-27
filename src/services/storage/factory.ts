import {Platform} from 'react-native';
import type {IStorageAdapter} from './index';

let adapter: IStorageAdapter | null = null;

// Lazily require platform-specific implementations so bundlers (web)
// don't attempt to include native-only modules like `expo-sqlite`.
export const getStorageAdapter = (): IStorageAdapter => {
  if (adapter) return adapter;

  if (Platform.OS === 'web') {
    // Web implementation should be small and avoid wasm/native deps.
    // Use require to avoid static import at module-evaluation time.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {WebStorage} = require('./web');
    adapter = new WebStorage();
  } else {
    // Mobile implementation depends on expo-sqlite and other native libs.
    // Lazily require to avoid bundling in web builds.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {MobileStorage} = require('./mobile');
    adapter = new MobileStorage();
  }

  return adapter;
};
