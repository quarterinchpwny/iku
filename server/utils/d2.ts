import { D1Database } from '@cloudflare/workers-types';

// Define the structure of our tables
interface Route {
  id: string; // Changed to string for D1
  userId: string;
  timestamp: number;
  // Add other route properties here
}

interface Point {
  id: string; // Changed to string for D1
  routeId: string;
  userId: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  // Add other point properties here
}

// This class will wrap the D1Database object and provide
// type-safe methods for interacting with our tables.
class D1Store {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  // Generic method to create a record
  async create<T>(table: string, data: Omit<T, 'id'>): Promise<void> {
    const id = crypto.randomUUID();
    const record = { ...data, id };

    const fields = Object.keys(record).join(', ');
    const placeholders = Object.keys(record).map(() => '?').join(', ');
    const values = Object.values(record);

    const stmt = `INSERT INTO ${table} (${fields}) VALUES (${placeholders});`;
    await this.db.prepare(stmt).bind(...values).run();
  }

  // Generic method to update a record
  async update<T>(table: string, where: Partial<T>, data: Partial<T>): Promise<void> {
    const setClauses = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const whereClauses = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
    const values = [...Object.values(data), ...Object.values(where)];

    const stmt = `UPDATE ${table} SET ${setClauses} WHERE ${whereClauses};`;
    await this.db.prepare(stmt).bind(...values).run();
  }

  // Generic method to delete a record
  async delete<T>(table: string, where: Partial<T>): Promise<void> {
    const whereClauses = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
    const values = Object.values(where);

    const stmt = `DELETE FROM ${table} WHERE ${whereClauses};`;
    await this.db.prepare(stmt).bind(...values).run();
  }

  // Method to get changes since a certain timestamp
  async getChangesSince(table: string, userId: string, lastSyncedAt: number): Promise<any[]> {
    const stmt = `SELECT * FROM ${table} WHERE userId = ? AND timestamp > ?;`;
    const { results } = await this.db.prepare(stmt).bind(userId, lastSyncedAt).all();
    return results || [];
  }
}

// This is our main database client, initialized with the D1 binding
// The binding 'DB' must be configured in your wrangler.toml or via the Cloudflare dashboard
export const useDB = (event) => {
  if (!event.context.cloudflare.env.DB) {
    throw new Error('D1 database binding not found');
  }
  return new D1Store(event.context.cloudflare.env.DB);
};
