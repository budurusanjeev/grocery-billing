// AsyncStorage's native module isn't available under plain Jest — this is
// the library's own official mock, swapped in for every test file so
// anything importing src/lib/db.ts (which touches AsyncStorage at import
// time) doesn't crash before a single test even runs.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
