module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|expo-modules-core|expo-asset|expo-font|expo-constants)',
  ],
  moduleNameMapper: {
    '^expo$': '<rootDir>/__mocks__/expo.js',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
};
