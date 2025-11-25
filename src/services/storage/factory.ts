import {Platform} from 'react-native';
import {IStorageAdapter} from './index';
import {MobileStorage} from './mobile';
import {WebStorage} from './web';

let adapter: IStorageAdapter | null = null;

export const getStorageAdapter = (): IStorageAdapter => {
  if (adapter) return adapter;

  if (Platform.OS === 'web') {
    adapter = new WebStorage();
  } else {
    adapter = new MobileStorage();
  }

  return adapter;
};
