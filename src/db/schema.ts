import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

// Users table with role-based access
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(), // bcrypt hashed
  role: text('role').notNull(), // "student", "faculty", "admin"
  department: text('department').notNull(),
  createdAt: text('created_at').notNull(),
});

// Assignments table
export const assignments = sqliteTable('assignments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  fileUrl: text('file_url'),
  dueDate: text('due_date').notNull(),
  createdBy: integer('created_by').notNull().references(() => users.id),
  department: text('department').notNull(),
  year: text('year').notNull(),
  createdAt: text('created_at').notNull(),
});

// Assignment submissions table (separate for better normalization)
export const submissions = sqliteTable('submissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  assignmentId: integer('assignment_id').notNull().references(() => assignments.id),
  studentId: integer('student_id').notNull().references(() => users.id),
  fileUrl: text('file_url').notNull(),
  submittedAt: text('submitted_at').notNull(),
  feedback: text('feedback'),
  createdAt: text('created_at').notNull(),
});

// Notices table
export const notices = sqliteTable('notices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  department: text('department').notNull(),
  year: text('year').notNull(),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull(),
});