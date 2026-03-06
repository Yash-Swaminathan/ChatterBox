# ChatterBox — Owner Notification System

> Get notified when someone messages **you specifically** via your portfolio link.

---

## Auto-Conversation on Registration

When a new user signs up, automatically create a direct conversation with you so your
name appears in their sidebar immediately — no searching required.

### Where to add it

In your existing `POST /api/auth/register` handler, after the user is created and
before you return the response:

```javascript
const { createAutoConversationWithOwner } = require('../services/ownerService');

// Inside your register handler, after user is created:
// Fire and forget — don't block registration if this fails
createAutoConversationWithOwner(newUser.id).catch(err =>
  console.error('[Auto-conversation] Failed:', err.message)
);
```

### The service

Create `src/services/ownerService.js`:

```javascript
const db = require('../db'); // your pg pool

/**
 * Creates a direct conversation between a new user and the owner.
 * Uses your existing idempotent POST /api/conversations/direct logic
 * so it's safe to call multiple times — won't create duplicates.
 */
async function createAutoConversationWithOwner(newUserId) {
  const ownerId = process.env.OWNER_USER_ID;

  // Don't create a conversation with yourself
  if (newUserId === ownerId) return;

  // Reuse your existing advisory lock + idempotent conversation logic
  // This mirrors what POST /api/conversations/direct already does internally
  await db.query('SELECT pg_advisory_xact_lock($1)', [hashIds(ownerId, newUserId)]);

  const existing = await db.query(
    `SELECT c.id FROM conversations c
     JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
     JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
     WHERE c.type = 'direct'`,
    [ownerId, newUserId]
  );

  if (existing.rows.length > 0) return; // Already exists

  const conv = await db.query(
    `INSERT INTO conversations (type, created_by) VALUES ('direct', $1) RETURNING id`,
    [ownerId]
  );
  const conversationId = conv.rows[0].id;

  await db.query(
    `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)`,
    [conversationId, ownerId, newUserId]
  );
}

// Same hash your existing code uses to prevent duplicate direct conversations
function hashIds(id1, id2) {
  const sorted = [id1, id2].sort();
  return parseInt(sorted.join('').replace(/-/g, '').slice(0, 15), 16);
}

module.exports = { createAutoConversationWithOwner };
```

### What the user sees

```
User registers
      │
      ▼
Account created
      │
      ▼
Auto-conversation created with owner
      │
      ▼
User lands on /chat
      │
      ▼
Sidebar already shows "[Your Name]"  ← ready to message, zero friction
```

> The search feature still works normally for finding other users they know.
> This just ensures you're always already there without them having to look you up.

---

## How It Works (Notifications)

You hardcode your user ID as `OWNER_USER_ID` in your `.env`. When a message is sent,
your message handler checks if the recipient is you. If yes — fire the notification.
Nobody else triggers it.

---

## Step 1 — Environment Variables

Add to your `.env`:

```env
OWNER_USER_ID=your-uuid-here          # Your user ID from the DB
NTFY_TOPIC=chatterbox-yourname        # Make this hard to guess (acts as a password)
RESEND_API_KEY=re_xxxxxxxxxxxx        # From resend.com (free tier)
OWNER_EMAIL=you@email.com             # Where email notifications go
```

Get your user ID:
```sql
SELECT id FROM users WHERE email = 'your@email.com';
```

---

## Step 2 — Install Dependencies

```bash
npm install resend
# ntfy needs no SDK — it's just a fetch call
```

---

## Step 3 — Notification Service

Create `src/services/notificationService.js`:

```javascript
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Sends a push notification via ntfy.sh (instant, free, no account needed)
 */
async function sendPushNotification(senderUsername, messagePreview) {
  try {
    await fetch(`https://ntfy.sh/${process.env.NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        'Title': `💬 New message from ${senderUsername}`,
        'Priority': 'high',
        'Tags': 'speech_balloon',
      },
      body: messagePreview.slice(0, 200), // ntfy body = notification text
    });
  } catch (err) {
    console.error('[Notification] Push failed:', err.message);
  }
}

/**
 * Sends an email via Resend (free tier: 3,000/month)
 */
async function sendEmailNotification(senderUsername, messagePreview) {
  try {
    await resend.emails.send({
      from: 'ChatterBox <notifications@yourdomain.com>',
      to: process.env.OWNER_EMAIL,
      subject: `New message from ${senderUsername}`,
      html: `
        <p><strong>${senderUsername}</strong> sent you a message on ChatterBox:</p>
        <blockquote style="border-left: 3px solid #7c6af7; padding-left: 12px; color: #555;">
          ${messagePreview}
        </blockquote>
        <p><a href="https://yourapp.com/chat">Reply now →</a></p>
      `,
    });
  } catch (err) {
    console.error('[Notification] Email failed:', err.message);
  }
}

/**
 * Main function — call this from your message handler
 * Only fires when the conversation recipient is the owner
 */
async function notifyOwnerIfNeeded({ recipientId, senderUsername, messageContent, isFirstMessage }) {
  const isOwner = recipientId === process.env.OWNER_USER_ID;
  if (!isOwner) return; // Not for the owner, do nothing

  // Only notify on the first message in a conversation (not every reply)
  // Remove this check if you want notifications for every message
  if (!isFirstMessage) return;

  // Fire both in parallel — if one fails the other still goes
  await Promise.allSettled([
    sendPushNotification(senderUsername, messageContent),
    sendEmailNotification(senderUsername, messageContent),
  ]);
}

module.exports = { notifyOwnerIfNeeded };
```

---

## Step 4 — Hook Into Your Message Handler

In your existing socket message handler (wherever you handle `message:send`),
add the notification check after the message is saved to the DB:

```javascript
const { notifyOwnerIfNeeded } = require('../services/notificationService');

// Inside your message:send handler, after saving to DB:

// Check if this is the first message in the conversation
const messageCount = await db.query(
  'SELECT COUNT(*) FROM messages WHERE conversation_id = $1',
  [conversationId]
);
const isFirstMessage = parseInt(messageCount.rows[0].count) === 1;

// Get the other participant (the recipient)
const participants = await db.query(
  `SELECT user_id FROM conversation_participants 
   WHERE conversation_id = $1 AND user_id != $2`,
  [conversationId, senderId]
);
const recipientId = participants.rows[0]?.user_id;

// Fire notification (no await — don't block the response)
notifyOwnerIfNeeded({
  recipientId,
  senderUsername: socket.user.username,
  messageContent: content,
  isFirstMessage,
}).catch(err => console.error('[Notification] Error:', err));
```

---

## Step 5 — Set Up ntfy on Your Phone

1. Install **ntfy** app — [iOS](https://apps.apple.com/app/ntfy/id1625396347) or [Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy)
2. Open the app → **Subscribe to topic**
3. Enter your `NTFY_TOPIC` from `.env` (e.g. `chatterbox-yourname`)
4. Done — you'll get push notifications instantly

No account needed. The topic name is the only "secret" — keep it unguessable.

---

## Step 6 — Set Up Resend (Email)

1. Go to [resend.com](https://resend.com) → free account
2. Add and verify your domain (or use their sandbox for testing)
3. Copy your API key → paste into `.env` as `RESEND_API_KEY`
4. Free tier: **3,000 emails/month** — more than enough

---

## Notification Flow Summary

```
Guest sends message
        │
        ▼
Message saved to DB
        │
        ▼
Is recipient OWNER_USER_ID?
   │              │
  NO             YES
   │              │
  skip           Is this the first message?
                   │              │
                  NO             YES
                   │              │
                  skip     Fire ntfy push  ──→  Your phone
                           Fire Resend email ──→ Your inbox
```

---

## Cost Breakdown

| Service     | Usage         | Cost        |
|-------------|---------------|-------------|
| Railway.app | Backend + DB + Redis | $5/month |
| Vercel      | Frontend      | Free        |
| ntfy.sh     | Push notifications | Free   |
| Resend      | Email (3k/month) | Free    |
| **Total**   |               | **$5/month** |

---

## Optional: Notify on Every Message (Not Just First)

If you want a notification every time someone messages you (not just the opener),
remove the `isFirstMessage` check entirely:

```javascript
// Remove this block:
if (!isFirstMessage) return;
```

Keep in mind this could get noisy in long conversations.

---

## Testing

```bash
# Test ntfy directly from terminal
curl -d "Test notification" \
  -H "Title: Test from ChatterBox" \
  https://ntfy.sh/YOUR_TOPIC_NAME

# Test the full flow
# 1. Create a guest user via your API
# 2. Start a conversation with your owner account
# 3. Send a message
# 4. Check your phone + email
```