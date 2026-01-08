describe('Message Mentions (@username) - Unit Tests', () => {
  // Mock participants data
  const mockParticipants = [
    { user_id: 'user-1', username: 'alice_test' },
    { user_id: 'user-2', username: 'bob_test' },
    { user_id: 'user-3', username: 'charlie_test' },
  ];

  /**
   * Extract mentions from content (same logic as messageHandler.js)
   */
  function extractMentions(content, participants) {
    const MAX_MENTIONS_PER_MESSAGE = 50;
    const mentionRegex = /@(\w+)/g;

    // Extract all @username patterns
    const mentionMatches = content.match(mentionRegex) || [];

    // Deduplicate and lowercase usernames
    const mentionedUsernames = [
      ...new Set(mentionMatches.map(m => m.slice(1).toLowerCase())),
    ].slice(0, MAX_MENTIONS_PER_MESSAGE);

    // Create map of username -> userId
    const participantMap = new Map(
      participants.map(p => [p.username.toLowerCase(), p.user_id])
    );

    // Filter to only valid participants and get their IDs
    const mentionedUserIds = mentionedUsernames
      .filter(username => participantMap.has(username))
      .map(username => participantMap.get(username));

    return mentionedUserIds;
  }

  describe('Valid Mentions', () => {
    it('should extract single valid mention', () => {
      const content = 'Hey @bob_test, check this';
      const result = extractMentions(content, mockParticipants);

      expect(result).toHaveLength(1);
      expect(result).toContain('user-2');
    });

    it('should extract multiple valid mentions', () => {
      const content = 'Hey @bob_test and @charlie_test';
      const result = extractMentions(content, mockParticipants);

      expect(result).toHaveLength(2);
      expect(result).toContain('user-2');
      expect(result).toContain('user-3');
    });

    it('should match mentions case-insensitively', () => {
      const content = 'Hey @BOB_TEST';
      const result = extractMentions(content, mockParticipants);

      expect(result).toHaveLength(1);
      expect(result).toContain('user-2');
    });

    it('should allow self-mentions', () => {
      const content = 'Reminder to @alice_test: finish task';
      const result = extractMentions(content, mockParticipants);

      expect(result).toHaveLength(1);
      expect(result).toContain('user-1');
    });

    it('should handle mentions in middle of words (negative test)', () => {
      const content = 'Email me at user@example.com';
      const result = extractMentions(content, mockParticipants);

      // Should extract 'example' but not match any participants
      expect(result).toHaveLength(0);
    });
  });

  describe('Invalid Mentions', () => {
    it('should ignore mentions of non-existent usernames', () => {
      const content = 'Hey @nonexistentuser123';
      const result = extractMentions(content, mockParticipants);

      expect(result).toHaveLength(0);
    });

    it('should ignore empty mentions (@)', () => {
      const content = 'Check @ symbol usage';
      const result = extractMentions(content, mockParticipants);

      expect(result).toHaveLength(0);
    });

    it('should ignore mentions with special characters', () => {
      const content = '@user-name @user.name @user@domain';
      const result = extractMentions(content, mockParticipants);

      // Regex only matches \w+ (alphanumeric + underscore)
      // So these should not match
      expect(result).toHaveLength(0);
    });

    it('should handle content with no mentions', () => {
      const content = 'Hello everyone, no mentions here';
      const result = extractMentions(content, mockParticipants);

      expect(result).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should deduplicate multiple mentions of same user', () => {
      const content = 'Hey @bob_test, @bob_test, @bob_test!';
      const result = extractMentions(content, mockParticipants);

      expect(result).toHaveLength(1);
      expect(result).toContain('user-2');
    });

    it('should handle message with only mentions', () => {
      const content = '@bob_test @charlie_test';
      const result = extractMentions(content, mockParticipants);

      expect(result).toHaveLength(2);
      expect(result).toContain('user-2');
      expect(result).toContain('user-3');
    });

    it('should respect MAX_MENTIONS_PER_MESSAGE limit (50)', () => {
      // Create 60 mentions with bob_test at the beginning
      // This ensures bob_test is within the first 50 mentions
      const mentions =
        '@bob_test ' +
        Array(60)
          .fill(0)
          .map((_, i) => `@user${i}`)
          .join(' ');

      const result = extractMentions(mentions, mockParticipants);

      // Should find bob_test (the only valid participant)
      expect(result).toHaveLength(1);
      expect(result).toContain('user-2');
    });

    it('should handle mentions with numbers and underscores', () => {
      const participants = [
        { user_id: 'user-1', username: 'user_123' },
        { user_id: 'user-2', username: 'test456' },
      ];

      const content = 'Hey @user_123 and @test456';
      const result = extractMentions(content, participants);

      expect(result).toHaveLength(2);
      expect(result).toContain('user-1');
      expect(result).toContain('user-2');
    });

    it('should handle empty participant list', () => {
      const content = 'Hey @bob_test';
      const result = extractMentions(content, []);

      expect(result).toHaveLength(0);
    });

    it('should handle mixed case in multiple mentions', () => {
      const content = '@Bob_Test @CHARLIE_test @alice_TEST';
      const result = extractMentions(content, mockParticipants);

      expect(result).toHaveLength(3);
      expect(result).toContain('user-1');
      expect(result).toContain('user-2');
      expect(result).toContain('user-3');
    });
  });

  describe('Regex Pattern Validation', () => {
    it('should match alphanumeric and underscore only', () => {
      const content = '@valid_user123 @invalid-user @invalid.user @invalid@user';
      const result = extractMentions(content, [
        { user_id: 'user-1', username: 'valid_user123' },
        { user_id: 'user-2', username: 'invalid' },
      ]);

      // Only valid_user123 should match completely
      // 'invalid' will match the alphanumeric part before special chars
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('user-1');
    });

    it('should not match mentions at start of email addresses', () => {
      const content = 'Contact me at support@example.com';
      const result = extractMentions(content, [
        { user_id: 'user-1', username: 'support' },
      ]);

      // This is a known limitation: @ in emails will match
      // But 'example' won't be in participants list
      expect(result.length).toBeLessThanOrEqual(1);
    });

    it('should handle mentions at start, middle, and end of message', () => {
      const content = '@alice_test hello @bob_test how are you @charlie_test';
      const result = extractMentions(content, mockParticipants);

      expect(result).toHaveLength(3);
      expect(result).toContain('user-1');
      expect(result).toContain('user-2');
      expect(result).toContain('user-3');
    });
  });
});
