module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/*.spec.js', '**/*.test.js'],
  transform: {},
  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)', // Transform uuid module
  ],
  // Mock MinIO client to avoid real connections during tests
  moduleNameMapper: {
    '^minio$': '<rootDir>/src/__mocks__/minio.js',
  },
  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  // Setup files to run before tests
  setupFiles: ['<rootDir>/jest.setup.js'],
};
