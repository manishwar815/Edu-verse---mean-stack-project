I notice there's a mismatch in your request. You're asking for a Mongoose model file, but your system prompt and database schema indicate you're using Drizzle ORM with SQLite/Turso, not MongoDB/Mongoose.

Based on your Drizzle schema pattern, here's the correct Drizzle schema definition for the Events table:

import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { users } from './schema';

export const events = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  location: text('location').notNull(),
  organizer: text('organizer').notNull(),
  category: text('category').notNull(),
  imageUrl: text('image_url'),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

If you actually need a Mongoose model (which would require changing your entire database setup), please clarify. Otherwise, use the Drizzle schema above and I can generate the corresponding API routes that follow your Next.js + Drizzle ORM architecture.

Would you like me to generate the API routes for the events table using the Drizzle schema above?