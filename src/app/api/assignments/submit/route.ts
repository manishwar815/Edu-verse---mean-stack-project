import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from '@/db';
import { submissions, assignments, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface JWTPayload {
  userId: number;
  email: string;
  role: string;
}

export async function POST(request: NextRequest) {
  try {
    // Extract and verify JWT token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication token is required', code: 'MISSING_TOKEN' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    let decoded: JWTPayload;
    
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid or expired token', code: 'INVALID_TOKEN' },
        { status: 401 }
      );
    }

    // Check if user is a student
    if (decoded.role !== 'student') {
      return NextResponse.json(
        { error: 'Only students can submit assignments', code: 'UNAUTHORIZED_ROLE' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { assignmentId, fileUrl } = body;

    // Validate required fields
    if (!assignmentId) {
      return NextResponse.json(
        { error: 'Assignment ID is required', code: 'MISSING_ASSIGNMENT_ID' },
        { status: 400 }
      );
    }

    if (!fileUrl) {
      return NextResponse.json(
        { error: 'File URL is required', code: 'MISSING_FILE_URL' },
        { status: 400 }
      );
    }

    // Validate assignmentId is a valid number
    const parsedAssignmentId = parseInt(assignmentId.toString());
    if (isNaN(parsedAssignmentId)) {
      return NextResponse.json(
        { error: 'Invalid assignment ID', code: 'INVALID_ASSIGNMENT_ID' },
        { status: 400 }
      );
    }

    // Verify assignment exists
    const assignment = await db.select()
      .from(assignments)
      .where(eq(assignments.id, parsedAssignmentId))
      .limit(1);

    if (assignment.length === 0) {
      return NextResponse.json(
        { error: 'Assignment not found', code: 'ASSIGNMENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check if student has already submitted this assignment
    const existingSubmission = await db.select()
      .from(submissions)
      .where(
        and(
          eq(submissions.assignmentId, parsedAssignmentId),
          eq(submissions.studentId, decoded.userId)
        )
      )
      .limit(1);

    if (existingSubmission.length > 0) {
      return NextResponse.json(
        { error: 'You have already submitted this assignment', code: 'SUBMISSION_EXISTS' },
        { status: 409 }
      );
    }

    // Get authenticated user's department
    const user = await db.select()
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json(
        { error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify assignment is from student's department
    if (assignment[0].department !== user[0].department) {
      return NextResponse.json(
        { error: 'You can only submit assignments from your department', code: 'DEPARTMENT_MISMATCH' },
        { status: 403 }
      );
    }

    // Create submission
    const currentTimestamp = new Date().toISOString();
    const newSubmission = await db.insert(submissions)
      .values({
        assignmentId: parsedAssignmentId,
        studentId: decoded.userId,
        fileUrl: fileUrl.trim(),
        submittedAt: currentTimestamp,
        feedback: null,
        createdAt: currentTimestamp,
      })
      .returning();

    // Return created submission with assignment details
    return NextResponse.json(
      {
        id: newSubmission[0].id,
        assignmentId: newSubmission[0].assignmentId,
        studentId: newSubmission[0].studentId,
        fileUrl: newSubmission[0].fileUrl,
        submittedAt: newSubmission[0].submittedAt,
        feedback: newSubmission[0].feedback,
        createdAt: newSubmission[0].createdAt,
        assignment: {
          title: assignment[0].title,
          dueDate: assignment[0].dueDate,
          department: assignment[0].department,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}