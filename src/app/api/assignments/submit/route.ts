import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { connectDB } from '@/db/mongodb';
import { Submission } from '@/db/models/Submission';
import { Assignment } from '@/db/models/Assignment';
import { User } from '@/db/models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export async function POST(request: NextRequest) {
  try {
    // Connect to MongoDB
    await connectDB();

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

    // Verify assignment exists using Mongoose
    const assignment = await Assignment.findById(assignmentId).exec();

    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found', code: 'ASSIGNMENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check if student has already submitted this assignment
    const existingSubmission = await Submission.findOne({
      assignmentId: assignmentId,
      studentId: decoded.userId
    }).exec();

    if (existingSubmission) {
      return NextResponse.json(
        { error: 'You have already submitted this assignment', code: 'SUBMISSION_EXISTS' },
        { status: 409 }
      );
    }

    // Get authenticated user's department
    const user = await User.findById(decoded.userId).exec();

    if (!user) {
      return NextResponse.json(
        { error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify assignment is from student's department
    if (assignment.department !== user.department) {
      return NextResponse.json(
        { error: 'You can only submit assignments from your department', code: 'DEPARTMENT_MISMATCH' },
        { status: 403 }
      );
    }

    // Create submission using Mongoose
    const currentTimestamp = new Date().toISOString();
    const newSubmission = await Submission.create({
      assignmentId: assignmentId,
      studentId: decoded.userId,
      fileUrl: fileUrl.trim(),
      submittedAt: currentTimestamp,
      feedback: null,
    });

    // Return created submission with assignment details
    return NextResponse.json(
      {
        id: newSubmission._id.toString(),
        assignmentId: newSubmission.assignmentId,
        studentId: newSubmission.studentId,
        fileUrl: newSubmission.fileUrl,
        submittedAt: newSubmission.submittedAt,
        feedback: newSubmission.feedback,
        createdAt: newSubmission.createdAt,
        assignment: {
          title: assignment.title,
          dueDate: assignment.dueDate,
          department: assignment.department,
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