const Conversation = require('../../models/Conversation');
const Contact = require('../../models/Contact');
const ownerService = require('../ownerService');

jest.mock('../../models/Conversation');
jest.mock('../../models/Contact');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const VISITOR_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_VISITOR_ID = '33333333-3333-4333-8333-333333333333';

describe('ownerService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OWNER_USER_ID;
    delete process.env.OWNER_ONLY_MODE;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isOwner', () => {
    it('should be false for everyone when no owner is configured', () => {
      expect(ownerService.isOwner(OWNER_ID)).toBe(false);
      expect(ownerService.isOwner(undefined)).toBe(false);
    });

    it('should only match the configured owner', () => {
      process.env.OWNER_USER_ID = OWNER_ID;

      expect(ownerService.isOwner(OWNER_ID)).toBe(true);
      expect(ownerService.isOwner(VISITOR_ID)).toBe(false);
    });
  });

  describe('canReach', () => {
    it('should allow everything when owner-only mode is off', () => {
      process.env.OWNER_USER_ID = OWNER_ID;

      expect(ownerService.canReach(VISITOR_ID, OTHER_VISITOR_ID)).toBe(true);
    });

    describe('with owner-only mode on', () => {
      beforeEach(() => {
        process.env.OWNER_USER_ID = OWNER_ID;
        process.env.OWNER_ONLY_MODE = 'true';
      });

      it('should let a visitor reach the owner', () => {
        expect(ownerService.canReach(VISITOR_ID, OWNER_ID)).toBe(true);
      });

      it('should let the owner reach a visitor', () => {
        expect(ownerService.canReach(OWNER_ID, VISITOR_ID)).toBe(true);
      });

      it('should let a user reach themselves', () => {
        expect(ownerService.canReach(VISITOR_ID, VISITOR_ID)).toBe(true);
      });

      it('should not let a visitor reach another visitor', () => {
        expect(ownerService.canReach(VISITOR_ID, OTHER_VISITOR_ID)).toBe(false);
      });
    });

    it('should fail closed when the mode is on but no owner is configured', () => {
      process.env.OWNER_ONLY_MODE = 'true';

      expect(ownerService.canReach(VISITOR_ID, OTHER_VISITOR_ID)).toBe(false);
      expect(ownerService.canReach(VISITOR_ID, VISITOR_ID)).toBe(true);
    });
  });

  describe('createAutoConversationWithOwner', () => {
    const conversation = { id: '44444444-4444-4444-8444-444444444444' };
    let io;
    let socketsJoin;
    let emit;

    beforeEach(() => {
      socketsJoin = jest.fn();
      emit = jest.fn();
      io = {
        in: jest.fn(() => ({ socketsJoin })),
        to: jest.fn(() => ({ emit })),
      };

      Conversation.getOrCreateDirect = jest.fn().mockResolvedValue({ conversation, created: true });
      Contact.create = jest.fn().mockResolvedValue({ id: 'contact-id', created: true });
    });

    it('should do nothing when no owner is configured', async () => {
      const result = await ownerService.createAutoConversationWithOwner(VISITOR_ID, io);

      expect(result).toBeNull();
      expect(Conversation.getOrCreateDirect).not.toHaveBeenCalled();
    });

    it('should do nothing when the owner registers', async () => {
      process.env.OWNER_USER_ID = OWNER_ID;

      const result = await ownerService.createAutoConversationWithOwner(OWNER_ID, io);

      expect(result).toBeNull();
      expect(Conversation.getOrCreateDirect).not.toHaveBeenCalled();
    });

    it('should create the conversation and contacts in both directions', async () => {
      process.env.OWNER_USER_ID = OWNER_ID;

      const result = await ownerService.createAutoConversationWithOwner(VISITOR_ID, io);

      expect(result).toEqual(conversation);
      expect(Conversation.getOrCreateDirect).toHaveBeenCalledWith(VISITOR_ID, OWNER_ID);
      expect(Contact.create).toHaveBeenCalledWith(VISITOR_ID, OWNER_ID);
      expect(Contact.create).toHaveBeenCalledWith(OWNER_ID, VISITOR_ID);
    });

    it('should join both users to the room and announce a new conversation', async () => {
      process.env.OWNER_USER_ID = OWNER_ID;

      await ownerService.createAutoConversationWithOwner(VISITOR_ID, io);

      const userRooms = [`user:${VISITOR_ID}`, `user:${OWNER_ID}`];
      expect(io.in).toHaveBeenCalledWith(userRooms);
      expect(socketsJoin).toHaveBeenCalledWith(`conversation:${conversation.id}`);
      expect(emit).toHaveBeenCalledWith('conversation:new', { conversationId: conversation.id });
    });

    it('should not announce a conversation that already existed', async () => {
      process.env.OWNER_USER_ID = OWNER_ID;
      Conversation.getOrCreateDirect.mockResolvedValue({ conversation, created: false });

      await ownerService.createAutoConversationWithOwner(VISITOR_ID, io);

      expect(io.in).not.toHaveBeenCalled();
    });

    it('should work without a socket server', async () => {
      process.env.OWNER_USER_ID = OWNER_ID;

      const result = await ownerService.createAutoConversationWithOwner(VISITOR_ID, undefined);

      expect(result).toEqual(conversation);
    });

    it('should return null instead of throwing when the database fails', async () => {
      process.env.OWNER_USER_ID = OWNER_ID;
      Conversation.getOrCreateDirect.mockRejectedValue(new Error('connection lost'));

      await expect(
        ownerService.createAutoConversationWithOwner(VISITOR_ID, io)
      ).resolves.toBeNull();
    });
  });
});
