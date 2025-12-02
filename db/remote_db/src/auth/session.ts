// db/remote_db/src/auth/session.ts
import type { D1Database } from '@cloudflare/workers-types';

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export interface Session {
  id: string;
  user_id: number;
  expires_at: Date;
}

/**
 * Creates a new session for a user.
 * @param db The D1 database instance.
 * @param userId The ID of the user.
 * @returns The session ID (token).
 */
export async function createSession(db: D1Database, userId: number): Promise<string> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db
    .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(sessionId, userId, expiresAt.toISOString())
    .run();

  return sessionId;
}

/**
 * Retrieves a session by its ID.
 * @param db The D1 database instance.
 * @param sessionId The session ID to look up.
 * @returns The session object if found and not expired, otherwise null.
 */
export async function getSession(db: D1Database, sessionId: string): Promise<Session | null> {
  const { results } = await db
    .prepare('SELECT * FROM sessions WHERE id = ?')
    .bind(sessionId)
    .all<Session>();

  const session = results[0];

  if (!session || new Date(session.expires_at) < new Date()) {
    if (session) {
      // Clean up expired session
      await deleteSession(db, sessionId);
    }
    return null;
  }

  return {
    ...session,
    expires_at: new Date(session.expires_at),
  };
}

/**
 * Deletes a session.
 * @param db The D1 database instance.
 * @param sessionId The ID of the session to delete.
 */
export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}
