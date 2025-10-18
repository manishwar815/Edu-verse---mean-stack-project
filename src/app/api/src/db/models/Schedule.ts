I notice there's a mismatch in your request. You're asking for a Mongoose model (MongoDB) but your database schema shows Drizzle ORM with SQLite/Turso. Additionally, you mentioned "Better Auth uses string IDs" but your Drizzle schema shows integer IDs for users.

Let me clarify: Should I create a **Drizzle schema table definition** for schedules (to match your existing SQLite schema), or do you actually need a **Mongoose model** (which would require MongoDB)?

Based on your existing Drizzle schema, here's the **Drizzle version** that would be consistent with your current setup:

import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core';

// Courses table (referenced by schedules)
export const courses = sqliteTable('courses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  department: text('department').notNull(),
  credits: integer('credits').notNull(),
  createdAt: text('created_at').notNull(),
});

// Schedules table
export const schedules = sqliteTable('schedules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  courseId: integer('course_id').notNull().references(() => courses.id),
  dayOfWeek: text('day_of_week', { 
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] 
  }).notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  room: text('room').notNull(),
  building: text('building').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  userDayIdx: index('user_day_idx').on(table.userId, table.dayOfWeek),
}));

export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;

If you actually need MongoDB/Mongoose instead, please confirm and I'll provide that version. However, note that switching databases would require significant changes to your entire application architecture.