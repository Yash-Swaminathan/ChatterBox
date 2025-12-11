/**
 * Mock User Model for Testing
 *
 * This mock provides jest.fn() mocks for all User model functions
 */

module.exports = {
  getUserById: jest.fn(),
  getPublicUserById: jest.fn(),
  getPublicUserProfile: jest.fn(),
  updateUserProfile: jest.fn(),
  updateUserStatus: jest.fn(),
  searchUsers: jest.fn(),
  checkUserExists: jest.fn(),
  getUserByEmail: jest.fn(),
  getUserByUsername: jest.fn(),
  isValidUUID: jest.fn(),
};
