I notice there's a mismatch in the requirements. You're asking for a Mongoose model (MongoDB), but your database schema is using Drizzle ORM with SQLite. Additionally, the requirements mention a "courseId" field that doesn't exist in your current schema, and there's no "courses" table defined.

Since you're using Drizzle ORM with SQLite (not MongoDB/Mongoose), I'll create the appropriate Drizzle schema table definition instead. However, I need to address the missing "courses" table first.

Here's the complete solution:

import { sqliteTable, integer, text, real, index } from 'drizzle-orm/sqlite-core';

// Courses table (required for attendance tracking)
export const courses = sqliteTable('courses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  department: text('department').notNull(),
  year: text('year').notNull(),
  facultyId: integer('faculty_id').notNull().references(() => users.id),
  createdAt: text('created_at').notNull(),
});

// Attendance table
export const attendance = sqliteTable('attendance', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  courseId: integer('course_id').notNull().references(() => courses.id),
  date: text('date').notNull(),
  status: text('status').notNull(), // 'present', 'absent'
  totalClasses: integer('total_classes').notNull().default(0),
  attendedClasses: integer('attended_classes').notNull().default(0),
  percentage: real('percentage').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  userCourseIdx: index('user_course_idx').on(table.userId, table.courseId),
}));

If you specifically need a Mongoose model despite using Drizzle/SQLite, here's that version (though it won't work with your current database setup):

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAttendance extends Document {
  userId: string;
  courseId: mongoose.Types.ObjectId;
  date: Date;
  status: 'present' | 'absent';
  totalClasses: number;
  attendedClasses: number;
  percentage: number;
  createdAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>({
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  courseId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Course'
  },
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['present', 'absent']
  },
  totalClasses: {
    type: Number,
    required: true,
    default: 0
  },
  attendedClasses: {
    type: Number,
    required: true,
    default: 0
  },
  percentage: {
    type: Number,
    required: true,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

AttendanceSchema.index({ userId: 1, courseId: 1 });

export const Attendance: Model<IAttendance> = mongoose.models.Attendance || mongoose.model<IAttendance>('Attendance', AttendanceSchema);

Please clarify which database system you're actually using (SQLite with Drizzle or MongoDB with Mongoose) so I can provide the correct implementation.