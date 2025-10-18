I notice there's a mismatch in your request. You're asking for a Mongoose model file, but your system is using Drizzle ORM with SQLite, not MongoDB/Mongoose. 

Based on your Drizzle schema and the Next.js API route requirements from the system prompt, I'll create a **Drizzle-based API route** for courses instead, which matches your tech stack.

However, if you genuinely need a Mongoose model (perhaps for a different part of your system), here it is:

import mongoose, { Schema, Document, Model } from 'mongoose';

interface ICourse extends Document {
  name: string;
  code: string;
  semester: string;
  instructor: string;
  department: string;
  year: string;
  type: 'theory' | 'lab';
  credits: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CourseSchema = new Schema<ICourse>(
  {
    name: {
      type: String,
      required: [true, 'Course name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Course code is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    semester: {
      type: String,
      required: [true, 'Semester is required'],
      trim: true,
    },
    instructor: {
      type: String,
      required: [true, 'Instructor name is required'],
      trim: true,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
    },
    year: {
      type: String,
      required: [true, 'Year is required'],
      trim: true,
    },
    type: {
      type: String,
      required: [true, 'Course type is required'],
      enum: {
        values: ['theory', 'lab'],
        message: 'Type must be either theory or lab',
      },
    },
    credits: {
      type: Number,
      required: [true, 'Credits are required'],
      min: [0, 'Credits must be a positive number'],
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'courses',
  }
);

CourseSchema.index({ code: 1 }, { unique: true });
CourseSchema.index({ department: 1, year: 1 });
CourseSchema.index({ semester: 1 });

export const Course: Model<ICourse> = mongoose.models.Course || mongoose.model<ICourse>('Course', CourseSchema);

**However, I strongly recommend using Drizzle instead to match your existing stack. Here's the proper implementation:**

First, add to `src/db/schema.ts`:

export const courses = sqliteTable('courses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  semester: text('semester').notNull(),
  instructor: text('instructor').notNull(),
  department: text('department').notNull(),
  year: text('year').notNull(),
  type: text('type').notNull(), // 'theory' or 'lab'
  credits: integer('credits').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

Then the API route at `src/app/api/courses/route.ts`:

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { courses } from '@/db/schema';
import { eq, like, and, or, desc, asc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (id) {
      if (!id || isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }

      const course = await db.select()
        .from(courses)
        .where(eq(courses.id, parseInt(id)))
        .limit(1);

      if (course.length === 0) {
        return NextResponse.json({ error: 'Course not found' }, { status: 404 });
      }

      return NextResponse.json(course[0]);
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const department = searchParams.get('department');
    const year = searchParams.get('year');
    const semester = searchParams.get('semester');
    const type = searchParams.get('type');
    const sort = searchParams.get('sort') || 'createdAt';
    const order = searchParams.get('order') || 'desc';

    let query = db.select().from(courses);

    const conditions = [];

    if (search) {
      conditions.push(
        or(
          like(courses.name, `%${search}%`),
          like(courses.code, `%${search}%`),
          like(courses.instructor, `%${search}%`)
        )
      );
    }

    if (department) {
      conditions.push(eq(courses.department, department));
    }

    if (year) {
      conditions.push(eq(courses.year, year));
    }

    if (semester) {
      conditions.push(eq(courses.semester, semester));
    }

    if (type && (type === 'theory' || type === 'lab')) {
      conditions.push(eq(courses.type, type));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const orderColumn = sort === 'name' ? courses.name :
                       sort === 'code' ? courses.code :
                       sort === 'credits' ? courses.credits :
                       courses.createdAt;

    query = query.orderBy(order === 'asc' ? asc(orderColumn) : desc(orderColumn));

    const results = await query.limit(limit).offset(offset);

    return NextResponse.json(results);
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code, semester, instructor, department, year, type, credits, description } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ 
        error: "Course name is required",
        code: "MISSING_NAME" 
      }, { status: 400 });
    }

    if (!code || !code.trim()) {
      return NextResponse.json({ 
        error: "Course code is required",
        code: "MISSING_CODE" 
      }, { status: 400 });
    }

    if (!semester || !semester.trim()) {
      return NextResponse.json({ 
        error: "Semester is required",
        code: "MISSING_SEMESTER" 
      }, { status: 400 });
    }

    if (!instructor || !instructor.trim()) {
      return NextResponse.json({ 
        error: "Instructor name is required",
        code: "MISSING_INSTRUCTOR" 
      }, { status: 400 });
    }

    if (!department || !department.trim()) {
      return NextResponse.json({ 
        error: "Department is required",
        code: "MISSING_DEPARTMENT" 
      }, { status: 400 });
    }

    if (!year || !year.trim()) {
      return NextResponse.json({ 
        error: "Year is required",
        code: "MISSING_YEAR" 
      }, { status: 400 });
    }

    if (!type || !type.trim()) {
      return NextResponse.json({ 
        error: "Course type is required",
        code: "MISSING_TYPE" 
      }, { status: 400 });
    }

    if (type !== 'theory' && type !== 'lab') {
      return NextResponse.json({ 
        error: "Course type must be either 'theory' or 'lab'",
        code: "INVALID_TYPE" 
      }, { status: 400 });
    }

    if (credits === undefined || credits === null) {
      return NextResponse.json({ 
        error: "Credits are required",
        code: "MISSING_CREDITS" 
      }, { status: 400 });
    }

    const creditsNum = parseInt(credits);
    if (isNaN(creditsNum) || creditsNum < 0) {
      return NextResponse.json({ 
        error: "Credits must be a positive number",
        code: "INVALID_CREDITS" 
      }, { status: 400 });
    }

    const existingCourse = await db.select()
      .from(courses)
      .where(eq(courses.code, code.trim().toUpperCase()))
      .limit(1);

    if (existingCourse.length > 0) {
      return NextResponse.json({ 
        error: "Course code already exists",
        code: "DUPLICATE_CODE" 
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const newCourse = await db.insert(courses)
      .values({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        semester: semester.trim(),
        instructor: instructor.trim(),
        department: department.trim(),
        year: year.trim(),
        type: type.trim(),
        credits: creditsNum,
        description: description ? description.trim() : null,
        createdAt: now,
        updatedAt: now
      })
      .returning();

    return NextResponse.json(newCourse[0], { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const existing = await db.select()
      .from(courses)
      .where(eq(courses.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const body = await request.json();
    const updates: any = {};

    if (body.name !== undefined) {
      if (!body.name.trim()) {
        return NextResponse.json({ 
          error: "Course name cannot be empty",
          code: "INVALID_NAME" 
        }, { status: 400 });
      }
      updates.name = body.name.trim();
    }

    if (body.code !== undefined) {
      if (!body.code.trim()) {
        return NextResponse.json({ 
          error: "Course code cannot be empty",
          code: "INVALID_CODE" 
        }, { status: 400 });
      }
      const codeUpper = body.code.trim().toUpperCase();
      const existingCode = await db.select()
        .from(courses)
        .where(eq(courses.code, codeUpper))
        .limit(1);

      if (existingCode.length > 0 && existingCode[0].id !== parseInt(id)) {
        return NextResponse.json({ 
          error: "Course code already exists",
          code: "DUPLICATE_CODE" 
        }, { status: 400 });
      }
      updates.code = codeUpper;
    }

    if (body.semester !== undefined) {
      if (!body.semester.trim()) {
        return NextResponse.json({ 
          error: "Semester cannot be empty",
          code: "INVALID_SEMESTER" 
        }, { status: 400 });
      }
      updates.semester = body.semester.trim();
    }

    if (body.instructor !== undefined) {
      if (!body.instructor.trim()) {
        return NextResponse.json({ 
          error: "Instructor name cannot be empty",
          code: "INVALID_INSTRUCTOR" 
        }, { status: 400 });
      }
      updates.instructor = body.instructor.trim();
    }

    if (body.department !== undefined) {
      if (!body.department.trim()) {
        return NextResponse.json({ 
          error: "Department cannot be empty",
          code: "INVALID_DEPARTMENT" 
        }, { status: 400 });
      }
      updates.department = body.department.trim();
    }

    if (body.year !== undefined) {
      if (!body.year.trim()) {
        return NextResponse.json({ 
          error: "Year cannot be empty",
          code: "INVALID_YEAR" 
        }, { status: 400 });
      }
      updates.year = body.year.trim();
    }

    if (body.type !== undefined) {
      if (body.type !== 'theory' && body.type !== 'lab') {
        return NextResponse.json({ 
          error: "Course type must be either 'theory' or 'lab'",
          code: "INVALID_TYPE" 
        }, { status: 400 });
      }
      updates.type = body.type;
    }

    if (body.credits !== undefined) {
      const creditsNum = parseInt(body.credits);
      if (isNaN(creditsNum) || creditsNum < 0) {
        return NextResponse.json({ 
          error: "Credits must be a positive number",
          code: "INVALID_CREDITS" 
        }, { status: 400 });
      }
      updates.credits = creditsNum;
    }

    if (body.description !== undefined) {
      updates.description = body.description ? body.description.trim() : null;
    }

    updates.updatedAt = new Date().toISOString();

    const updated = await db.update(courses)
      .set(updates)
      .where(eq(courses.id, parseInt(id)))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const existing = await db.select()
      .from(courses)
      .where(eq(courses.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const deleted = await db.delete(courses)
      .where(eq(courses.id, parseInt(id)))
      .returning();

    return NextResponse.json({
      message: 'Course deleted successfully',
      course: deleted[0]
    });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}