const { pool } = require('../../config/database');
const Conversation = require('../Conversation');
const User = require('../User');
const { hashPassword } = require('../../utils/bcrypt');

describe('Conversation.updateGroupMetadata()', () => {
  let testUser1, testUser2, testUser3;
  let groupConversation, directConversation;

  beforeAll(async () => {
    // Create test users
    const hashedPassword = await hashPassword('password123');

    const user1 = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING *`,
      ['testuser1_groupmeta', 'testuser1_groupmeta@example.com', hashedPassword]
    );
    testUser1 = user1.rows[0];

    const user2 = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING *`,
      ['testuser2_groupmeta', 'testuser2_groupmeta@example.com', hashedPassword]
    );
    testUser2 = user2.rows[0];

    const user3 = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING *`,
      ['testuser3_groupmeta', 'testuser3_groupmeta@example.com', hashedPassword]
    );
    testUser3 = user3.rows[0];

    // Create a group conversation
    const result = await Conversation.createGroup(
      'Test Group',
      [testUser1.id, testUser2.id, testUser3.id],
      testUser1.id,
      null
    );
    groupConversation = result.conversation;

    // Create a direct conversation
    const directResult = await Conversation.create('direct', [testUser1.id, testUser2.id]);
    directConversation = directResult;
  });

  afterAll(async () => {
    // Clean up
    await pool.query('DELETE FROM users WHERE username LIKE $1', ['%_groupmeta']);
  });

  describe('Successful updates', () => {
    it('should successfully update group name only', async () => {
      const updated = await Conversation.updateGroupMetadata(groupConversation.id, {
        name: 'Updated Group Name',
      });

      expect(updated).toBeDefined();
      expect(updated.name).toBe('Updated Group Name');
      expect(updated.avatar_url).toBe(groupConversation.avatar_url);
      expect(updated.updated_at).toBeDefined();
      expect(new Date(updated.updated_at)).toBeInstanceOf(Date);
    });

    it('should successfully update avatar URL only', async () => {
      const newAvatarUrl = 'https://example.com/new-avatar.png';
      const updated = await Conversation.updateGroupMetadata(groupConversation.id, {
        avatarUrl: newAvatarUrl,
      });

      expect(updated).toBeDefined();
      expect(updated.avatar_url).toBe(newAvatarUrl);
      expect(updated.name).toBe('Updated Group Name'); // From previous test
    });

    it('should successfully update both name and avatar URL', async () => {
      const updates = {
        name: 'Brand New Group',
        avatarUrl: 'https://example.com/brand-new-avatar.jpg',
      };

      const updated = await Conversation.updateGroupMetadata(groupConversation.id, updates);

      expect(updated).toBeDefined();
      expect(updated.name).toBe(updates.name);
      expect(updated.avatar_url).toBe(updates.avatarUrl);
    });

    it('should allow null avatar URL to remove avatar', async () => {
      const updated = await Conversation.updateGroupMetadata(groupConversation.id, {
        avatarUrl: null,
      });

      expect(updated).toBeDefined();
      expect(updated.avatar_url).toBeNull();
    });

    it('should update updated_at timestamp', async () => {
      const before = new Date();

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await Conversation.updateGroupMetadata(groupConversation.id, {
        name: 'Timestamp Test Group',
      });

      expect(updated).toBeDefined();
      expect(updated.updated_at).toBeDefined();
      const updatedAt = new Date(updated.updated_at);
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('Error cases', () => {
    it('should throw error when no fields provided', async () => {
      await expect(
        Conversation.updateGroupMetadata(groupConversation.id, {})
      ).rejects.toThrow('No fields to update');
    });

    it('should throw error when conversation not found', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(
        Conversation.updateGroupMetadata(fakeId, { name: 'Test' })
      ).rejects.toThrow('Group conversation not found');
    });

    it('should throw error when conversation is not a group (direct conversation)', async () => {
      await expect(
        Conversation.updateGroupMetadata(directConversation.id, { name: 'Test' })
      ).rejects.toThrow('Group conversation not found');
    });
  });
});
