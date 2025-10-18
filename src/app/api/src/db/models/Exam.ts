I notice there's a mismatch in your request. You're asking for a Mongoose model file, but your system is built with Drizzle ORM and SQLite, not MongoDB/Mongoose. 

Let me provide the correct solution - a Drizzle schema for the Exam table and its corresponding API route:

**First, add this to your `src/db/schema.ts` file:**

// Exams table
export const exams = sqliteTable('exams', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  semester: text('semester').notNull(),
  cgpa: text('cgpa').notNull(), // Store as text for precision
  sgpa: text('sgpa').notNull(), // Store as text for precision
  subjects: text('subjects').notNull(), // JSON stringified array of subject objects
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// TypeScript interfaces for type safety
export interface Subject {
  subject: string;
  grade: string;
  credits: number;
}

export interface ExamInsert {
  userId: number;
  semester: string;
  cgpa: string;
  sgpa: string;
  subjects: Subject[];
  createdAt: string;
  updatedAt: string;
}

export interface ExamSelect {
  id: number;
  userId: number;
  semester: string;
  cgpa: string;
  sgpa: string;
  subjects: string;
  createdAt: string;
  updatedAt: string;
}

**Then create `src/app/api/exams/route.ts`:**

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { exams, users } from '@/db/schema';
import { eq, and, like, or, desc, asc } from 'drizzle-orm';

interface Subject {
  subject: string;
  grade: string;
  credits: number;
}

interface ExamRequestBody {
  userId: number;
  semester: string;
  cgpa: number;
  sgpa: number;
  subjects: Subject[];
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (id) {
      if (!id || isNaN(parseInt(id))) {
        return NextResponse.json(
          { error: 'Valid ID is required', code: 'INVALID_ID' },
          { status: 400 }
        );
      }

      const exam = await db
        .select()
        .from(exams)
        .where(eq(exams.id, parseInt(id)))
        .limit(1);

      if (exam.length === 0) {
        return NextResponse.json(
          { error: 'Exam not found', code: 'EXAM_NOT_FOUND' },
          { status: 404 }
        );
      }

      const examData = {
        ...exam[0],
        cgpa: parseFloat(exam[0].cgpa),
        sgpa: parseFloat(exam[0].sgpa),
        subjects: JSON.parse(exam[0].subjects),
      };

      return NextResponse.json(examData, { status: 200 });
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const userId = searchParams.get('userId');
    const semester = searchParams.get('semester');
    const sortField = searchParams.get('sort') || 'createdAt';
    const sortOrder = searchParams.get('order') || 'desc';

    let query = db.select().from(exams);

    const conditions = [];

    if (userId) {
      conditions.push(eq(exams.userId, parseInt(userId)));
    }

    if (semester) {
      conditions.push(eq(exams.semester, semester));
    }

    if (search) {
      conditions.push(
        or(
          like(exams.semester, `%${search}%`)
        )
      );
    }

    if (conditions.length > 0) {
      query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
    }

    if (sortField === 'createdAt') {
      query = sortOrder === 'asc' ? query.orderBy(asc(exams.createdAt)) : query.orderBy(desc(exams.createdAt));
    } else if (sortField === 'semester') {
      query = sortOrder === 'asc' ? query.orderBy(asc(exams.semester)) : query.orderBy(desc(exams.semester));
    } else if (sortField === 'cgpa') {
      query = sortOrder === 'asc' ? query.orderBy(asc(exams.cgpa)) : query.orderBy(desc(exams.cgpa));
    }

    const results = await query.limit(limit).offset(offset);

    const formattedResults = results.map(exam => ({
      ...exam,
      cgpa: parseFloat(exam.cgpa),
      sgpa: parseFloat(exam.sgpa),
      subjects: JSON.parse(exam.subjects),
    }));

    return NextResponse.json(formattedResults, { status: 200 });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ExamRequestBody = await request.json();
    const { userId, semester, cgpa, sgpa, subjects } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required', code: 'MISSING_USER_ID' },
        { status: 400 }
      );
    }

    if (!semester || semester.trim() === '') {
      return NextResponse.json(
        { error: 'Semester is required', code: 'MISSING_SEMESTER' },
        { status: 400 }
      );
    }

    if (cgpa === undefined || cgpa === null) {
      return NextResponse.json(
        { error: 'CGPA is required', code: 'MISSING_CGPA' },
        { status: 400 }
      );
    }

    if (sgpa === undefined || sgpa === null) {
      return NextResponse.json(
        { error: 'SGPA is required', code: 'MISSING_SGPA' },
        { status: 400 }
      );
    }

    if (!Array.isArray(subjects) || subjects.length === 0) {
      return NextResponse.json(
        { error: 'Subjects array is required and must not be empty', code: 'MISSING_SUBJECTS' },
        { status: 400 }
      );
    }

    for (const subject of subjects) {
      if (!subject.subject || subject.subject.trim() === '') {
        return NextResponse.json(
          { error: 'Subject name is required for all subjects', code: 'MISSING_SUBJECT_NAME' },
          { status: 400 }
        );
      }
      if (!subject.grade || subject.grade.trim() === '') {
        return NextResponse.json(
          { error: 'Grade is required for all subjects', code: 'MISSING_GRADE' },
          { status: 400 }
        );
      }
      if (subject.credits === undefined || subject.credits === null || isNaN(subject.credits)) {
        return NextResponse.json(
          { error: 'Valid credits number is required for all subjects', code: 'MISSING_CREDITS' },
          { status: 400 }
        );
      }
    }

    const userExists = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userExists.length === 0) {
      return NextResponse.json(
        { error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    const timestamp = new Date().toISOString();

    const newExam = await db
      .insert(exams)
      .values({
        userId,
        semester: semester.trim(),
        cgpa: cgpa.toString(),
        sgpa: sgpa.toString(),
        subjects: JSON.stringify(subjects),
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    const formattedExam = {
      ...newExam[0],
      cgpa: parseFloat(newExam[0].cgpa),
      sgpa: parseFloat(newExam[0].sgpa),
      subjects: JSON.parse(newExam[0].subjects),
    };

    return NextResponse.json(formattedExam, { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const existingExam = await db
      .select()
      .from(exams)
      .where(eq(exams.id, parseInt(id)))
      .limit(1);

    if (existingExam.length === 0) {
      return NextResponse.json(
        { error: 'Exam not found', code: 'EXAM_NOT_FOUND' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { semester, cgpa, sgpa, subjects } = body;

    const updates: any = {
      updatedAt: new Date().toISOString(),
    };

    if (semester !== undefined) {
      if (semester.trim() === '') {
        return NextResponse.json(
          { error: 'Semester cannot be empty', code: 'INVALID_SEMESTER' },
          { status: 400 }
        );
      }
      updates.semester = semester.trim();
    }

    if (cgpa !== undefined) {
      updates.cgpa = cgpa.toString();
    }

    if (sgpa !== undefined) {
      updates.sgpa = sgpa.toString();
    }

    if (subjects !== undefined) {
      if (!Array.isArray(subjects) || subjects.length === 0) {
        return NextResponse.json(
          { error: 'Subjects must be a non-empty array', code: 'INVALID_SUBJECTS' },
          { status: 400 }
        );
      }

      for (const subject of subjects) {
        if (!subject.subject || subject.subject.trim() === '') {
          return NextResponse.json(
            { error: 'Subject name is required for all subjects', code: 'MISSING_SUBJECT_NAME' },
            { status: 400 }
          );
        }
        if (!subject.grade || subject.grade.trim() === '') {
          return NextResponse.json(
            { error: 'Grade is required for all subjects', code: 'MISSING_GRADE' },
            { status: 400 }
          );
        }
        if (subject.credits === undefined || subject.credits === null || isNaN(subject.credits)) {
          return NextResponse.json(
            { error: 'Valid credits number is required for all subjects', code: 'MISSING_CREDITS' },
            { status: 400 }
          );
        }
      }

      updates.subjects = JSON.stringify(subjects);
    }

    const updatedExam = await db
      .update(exams)
      .set(updates)
      .where(eq(exams.id, parseInt(id)))
      .returning();

    const formattedExam = {
      ...updatedExam[0],
      cgpa: parseFloat(updatedExam[0].cgpa),
      sgpa: parseFloat(updatedExam[0].sgpa),
      subjects: JSON.parse(updatedExam[0].subjects),
    };

    return NextResponse.json(formattedExam, { status: 200 });
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const existingExam = await db
      .select()
      .from(exams)
      .where(eq(exams.id, parseInt(id)))
      .limit(1);

    if (existingExam.length === 0) {
      return NextResponse.json(
        { error: 'Exam not found', code: 'EXAM_NOT_FOUND' },
        { status: 404 }
      );
    }

    const deleted = await db
      .delete(exams)
      .where(eq(exams.id, parseInt(id)))
      .returning();

    const formattedExam = {
      ...deleted[0],
      cgpa: parseFloat(deleted[0].cgpa),
      sgpa: parseFloat(deleted[0].sgpa),
      subjects: JSON.parse(deleted[0].subjects),
    };

    return NextResponse.json(
      {
        message: 'Exam deleted successfully',
        exam: formattedExam,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}