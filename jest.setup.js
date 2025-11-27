/* eslint-disable @typescript-eslint/no-require-imports */
// jest.setup.js
// Import built-in Jest matchers from @testing-library/react-native
// This replaces the deprecated @testing-library/jest-native
const matchers = require('@testing-library/react-native/matchers');

// Extend Jest's expect with the custom matchers
expect.extend(matchers);

// Mocking libraries if needed (optional but good practice for RN)
// jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

jest.mock('expo-sqlite', () => ({
  openDatabase: jest.fn(() => ({
    transaction: jest.fn(),
  })),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  manifest: {
    extra: {},
  },
}));

jest.mock('expo-file-system', () => {
  const storage = new Map();

  class FileMock {
    constructor(...segments) {
      this.uri = segments
        .flat()
        .filter(Boolean)
        .map(segment => {
          if (typeof segment === 'string') {
            return segment;
          }
          if (segment && typeof segment === 'object' && 'uri' in segment) {
            return segment.uri;
          }
          return String(segment ?? '');
        })
        .join('');
    }

    get exists() {
      return storage.has(this.uri);
    }

    create() {
      if (!this.exists) {
        storage.set(this.uri, '');
      }
    }

    write(content) {
      storage.set(this.uri, content);
    }
  }

  const Paths = {
    document: {uri: '/tmp/'},
    cache: {uri: '/tmp/cache/'},
  };

  return {File: FileMock, Paths};
});

jest.mock('expo-font', () => ({
  loadAsync: jest.fn(),
  isLoaded: jest.fn(() => true),
}));

jest.mock('expo-asset', () => ({
  Asset: {
    loadAsync: jest.fn(),
    fromModule: jest.fn(() => ({
      downloadAsync: jest.fn(),
      localUri: 'localUri',
    })),
  },
}));

jest.mock('expo', () => ({
  registerRootComponent: jest.fn(),
}));
