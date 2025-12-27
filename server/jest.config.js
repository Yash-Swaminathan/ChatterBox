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
  // Clear mock call history between tests, but preserve implementations
  clearMocks: true,
  // Don't reset mock implementations - our __mocks__ files need to keep their mockResolvedValue
  resetMocks: false,
  restoreMocks: false,
  // Setup files to run before tests
  setupFiles: ['<rootDir>/jest.setup.js'],
};
