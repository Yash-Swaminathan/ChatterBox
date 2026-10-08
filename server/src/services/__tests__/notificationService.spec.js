const notificationService = require('../notificationService');

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('notificationService', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    delete process.env.NTFY_TOPIC;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.OWNER_EMAIL;
    process.env.APP_URL = 'https://chat.example.com/';
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  describe('escapeHtml', () => {
    it('should escape characters that are special in HTML', () => {
      expect(notificationService.escapeHtml('<img src=x onerror="a(\'b\')">&')).toBe(
        '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;'
      );
    });

    it('should turn null and undefined into an empty string', () => {
      expect(notificationService.escapeHtml(null)).toBe('');
      expect(notificationService.escapeHtml(undefined)).toBe('');
    });
  });

  describe('getAppUrl', () => {
    it('should strip trailing slashes', () => {
      expect(notificationService.getAppUrl()).toBe('https://chat.example.com');
    });
  });

  describe('sendPush', () => {
    it('should do nothing when no topic is configured', async () => {
      const sent = await notificationService.sendPush({ title: 'Hi', body: 'There' });

      expect(sent).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should post to the ntfy topic', async () => {
      process.env.NTFY_TOPIC = 'my-topic';

      const sent = await notificationService.sendPush({
        title: 'New message',
        body: 'Hello',
        clickUrl: 'https://chat.example.com/chat',
      });

      expect(sent).toBe(true);
      const [url, options] = global.fetch.mock.calls[0];
      expect(url).toBe('https://ntfy.sh/my-topic');
      expect(options.method).toBe('POST');
      expect(options.body).toBe('Hello');
      expect(options.headers.Title).toBe('New message');
      expect(options.headers.Click).toBe('https://chat.example.com/chat');
    });

    it('should keep user text out of header injection', async () => {
      process.env.NTFY_TOPIC = 'my-topic';

      await notificationService.sendPush({ title: 'Evil\r\nX-Injected: 1 ☃', body: 'x' });

      const { Title } = global.fetch.mock.calls[0][1].headers;
      expect(Title).not.toMatch(/[\r\n]/);
      expect(Title).toMatch(/^[\x20-\x7E]*$/);
    });

    it('should shorten long message bodies', async () => {
      process.env.NTFY_TOPIC = 'my-topic';

      await notificationService.sendPush({ title: 't', body: 'a'.repeat(500) });

      expect(global.fetch.mock.calls[0][1].body).toHaveLength(203);
    });

    it('should return false instead of throwing when the request fails', async () => {
      process.env.NTFY_TOPIC = 'my-topic';
      global.fetch.mockRejectedValue(new Error('network down'));

      await expect(notificationService.sendPush({ title: 't', body: 'b' })).resolves.toBe(false);
    });

    it('should return false when ntfy responds with an error', async () => {
      process.env.NTFY_TOPIC = 'my-topic';
      global.fetch.mockResolvedValue({ ok: false, status: 500 });

      await expect(notificationService.sendPush({ title: 't', body: 'b' })).resolves.toBe(false);
    });
  });

  describe('sendEmail', () => {
    const email = { to: 'a@example.com', subject: 'S', html: '<p>h</p>', text: 't' };

    it('should do nothing when email is not configured', async () => {
      const sent = await notificationService.sendEmail(email);

      expect(sent).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should do nothing when there is no recipient', async () => {
      process.env.RESEND_API_KEY = 're_test';
      process.env.EMAIL_FROM = 'ChatterBox <chat@example.com>';

      const sent = await notificationService.sendEmail({ ...email, to: undefined });

      expect(sent).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should send through Resend', async () => {
      process.env.RESEND_API_KEY = 're_test';
      process.env.EMAIL_FROM = 'ChatterBox <chat@example.com>';

      const sent = await notificationService.sendEmail(email);

      expect(sent).toBe(true);
      const [url, options] = global.fetch.mock.calls[0];
      expect(url).toBe('https://api.resend.com/emails');
      expect(options.headers.Authorization).toBe('Bearer re_test');
      expect(JSON.parse(options.body)).toEqual({
        from: 'ChatterBox <chat@example.com>',
        ...email,
      });
    });

    it('should return false instead of throwing when the request fails', async () => {
      process.env.RESEND_API_KEY = 're_test';
      process.env.EMAIL_FROM = 'chat@example.com';
      global.fetch.mockRejectedValue(new Error('timeout'));

      await expect(notificationService.sendEmail(email)).resolves.toBe(false);
    });
  });

  describe('message templates', () => {
    beforeEach(() => {
      process.env.NTFY_TOPIC = 'my-topic';
      process.env.RESEND_API_KEY = 're_test';
      process.env.EMAIL_FROM = 'chat@example.com';
      process.env.OWNER_EMAIL = 'owner@example.com';
    });

    const emailCall = () =>
      JSON.parse(
        global.fetch.mock.calls.find(([url]) => url === 'https://api.resend.com/emails')[1].body
      );

    it('should push and email the owner about a new message, escaping user content', async () => {
      await notificationService.notifyOwnerOfMessage({
        senderName: '<b>Mallory</b>',
        content: '<script>alert(1)</script>',
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      const sent = emailCall();
      expect(sent.to).toBe('owner@example.com');
      expect(sent.html).not.toContain('<script>');
      expect(sent.html).not.toContain('<b>Mallory</b>');
      expect(sent.html).toContain('&lt;script&gt;');
      expect(sent.html).toContain('https://chat.example.com/chat');
    });

    it('should remind the owner with the visitor name and waiting time', async () => {
      await notificationService.notifyOwnerReminder({ senderName: 'Sam', minutesWaiting: 90 });

      expect(emailCall().text).toContain("You haven't replied to Sam yet - they messaged 90 min ago");
    });

    it('should email a visitor about a reply with an unsubscribe link', async () => {
      await notificationService.notifyVisitorOfReply({
        to: 'visitor@example.com',
        ownerName: 'Yash',
        content: 'Thanks for reaching out',
        unsubscribeUrl: 'https://chat.example.com/api/users/unsubscribe?token=abc',
      });

      const sent = emailCall();
      expect(sent.to).toBe('visitor@example.com');
      expect(sent.subject).toBe('Yash replied to you on ChatterBox');
      expect(sent.html).toContain('unsubscribe?token=abc');
      expect(sent.text).toContain('unsubscribe?token=abc');
    });

    it('should email a password reset link', async () => {
      await notificationService.sendPasswordResetEmail({
        to: 'visitor@example.com',
        resetUrl: 'https://chat.example.com/reset-password?token=abc',
        expiresInMinutes: 30,
      });

      const sent = emailCall();
      expect(sent.to).toBe('visitor@example.com');
      expect(sent.html).toContain('reset-password?token=abc');
      expect(sent.text).toContain('30 minutes');
    });
  });
});
