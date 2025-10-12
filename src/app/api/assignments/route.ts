import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from '@/db';
import { assignments, users, submissions } from '@/db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface JWTPayload {
  userId: number;
  email: string;
  role: string;
  department?: string;
}

function verifyToken(request: NextRequest): JWTPayload | null {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');
    const year = searchParams.get('year');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get user details to check role and department
    const userDetails = await db.select()
      .from(users)
      .where(eq(users.id, user.userId))
      .limit(1);

    if (userDetails.length === 0) {
      return NextResponse.json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND' 
      }, { status: 404 });
    }

    const currentUser = userDetails[0];

    // Build base query with JOIN to get creator info and submission count
    let query = db
      .select({
        id: assignments.id,
        title: assignments.title,
        description: assignments.description,
        fileUrl: assignments.fileUrl,
        dueDate: assignments.dueDate,
        department: assignments.department,
        year: assignments.year,
        createdBy: assignments.createdBy,
        createdAt: assignments.createdAt,
        creatorId: users.id,
        creatorName: users.name,
        creatorEmail: users.email,
        submissionCount: sql<number>`CAST(COUNT(DISTINCT ${submissions.id}) AS INTEGER)`,
      })
      .from(assignments)
      .leftJoin(users, eq(assignments.createdBy, users.id))
      .leftJoin(submissions, eq(assignments.id, submissions.assignmentId))
      .groupBy(
        assignments.id,
        assignments.title,
        assignments.description,
        assignments.fileUrl,
        assignments.dueDate,
        assignments.department,
        assignments.year,
        assignments.createdBy,
        assignments.createdAt,
        users.id,
        users.name,
        users.email
      )
      .$dynamic();

    // Apply filters based on role
    const conditions = [];

    if (currentUser.role === 'student') {
      // Students only see assignments from their department
      conditions.push(eq(assignments.department, currentUser.department));
    } else {
      // Faculty/Admin can filter by department and year
      if (department) {
        conditions.push(eq(assignments.department, department));
      }
      if (year) {
        conditions.push(eq(assignments.year, year));
      }
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Order by due date (upcoming first) and apply pagination
    const results = await query
      .orderBy(asc(assignments.dueDate))
      .limit(limit)
      .offset(offset);

    // Transform results to match response format
    const formattedResults = results.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      fileUrl: row.fileUrl,
      dueDate: row.dueDate,
      department: row.department,
      year: row.year,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      creator: {
        id: row.creatorId,
        name: row.creatorName,
        email: row.creatorEmail,
      },
      submissionCount: row.submissionCount || 0,
    }));

    return NextResponse.json(formattedResults, { status: 200 });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED' 
      }, { status: 401 });
    }

    // Get user details to check role
    const userDetails = await db.select()
      .from(users)
      .where(eq(users.id, user.userId))
      .limit(1);

    if (userDetails.length === 0) {
      return NextResponse.json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND' 
      }, { status: 404 });
    }

    const currentUser = userDetails[0];

    // Authorization: Only faculty can create assignments
    if (currentUser.role !== 'faculty') {
      return NextResponse.json({ 
        error: 'Insufficient permissions. Only faculty can create assignments.',
        code: 'INSUFFICIENT_PERMISSIONS' 
      }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, fileUrl, dueDate, department, year } = body;

    // Validate required fields
    if (!title) {
      return NextResponse.json({ 
        error: 'Title is required',
        code: 'MISSING_TITLE' 
      }, { status: 400 });
    }

    if (!description) {
      return NextResponse.json({ 
        error: 'Description is required',
        code: 'MISSING_DESCRIPTION' 
      }, { status: 400 });
    }

    if (!dueDate) {
      return NextResponse.json({ 
        error: 'Due date is required',
        code: 'MISSING_DUE_DATE' 
      }, { status: 400 });
    }

    if (!department) {
      return NextResponse.json({ 
        error: 'Department is required',
        code: 'MISSING_DEPARTMENT' 
      }, { status: 400 });
    }

    if (!year) {
      return NextResponse.json({ 
        error: 'Year is required',
        code: 'MISSING_YEAR' 
      }, { status: 400 });
    }

    // Validate dueDate is valid ISO date string
    const dueDateObj = new Date(dueDate);
    if (isNaN(dueDateObj.getTime())) {
      return NextResponse.json({ 
        error: 'Invalid due date format. Expected ISO date string.',
        code: 'INVALID_DATE_FORMAT' 
      }, { status: 400 });
    }

    // Create assignment
    const newAssignment = await db.insert(assignments)
      .values({
        title: title.trim(),
        description: description.trim(),
        fileUrl: fileUrl ? fileUrl.trim() : null,
        dueDate: dueDate,
        department: department.trim(),
        year: year.trim(),
        createdBy: user.userId,
        createdAt: new Date().toISOString(),
      })
      .returning();

    if (newAssignment.length === 0) {
      return NextResponse.json({ 
        error: 'Failed to create assignment',
        code: 'CREATION_FAILED' 
      }, { status: 500 });
    }

    // Get creator details for response
    const creatorInfo = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
      .from(users)
      .where(eq(users.id, user.userId))
      .limit(1);

    const response = {
      ...newAssignment[0],
      creator: creatorInfo[0],
      submissionCount: 0,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}