import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { connectDB } from '@/db/mongodb';
import { Assignment } from '@/db/models/Assignment';
import { User } from '@/db/models/User';
import { Submission } from '@/db/models/Submission';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface JWTPayload {
  userId: string;
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
    // Connect to MongoDB
    await connectDB();

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

    // Get user details to check role and department using Mongoose
    const userDetails = await User.findById(user.userId).exec();

    if (!userDetails) {
      return NextResponse.json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND' 
      }, { status: 404 });
    }

    const currentUser = userDetails;

    // Build query filter for Mongoose
    const filter: any = {};

    if (currentUser.role === 'student') {
      // Students only see assignments from their department
      filter.department = currentUser.department;
    } else {
      // Faculty/Admin can filter by department and year
      if (department) {
        filter.department = department;
      }
      if (year) {
        filter.year = year;
      }
    }

    // Query assignments with populate for creator details
    const assignments = await Assignment.find(filter)
      .populate('createdBy', 'name email')
      .sort({ dueDate: 1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();

    // Get submission counts for each assignment
    const resultsWithCounts = await Promise.all(
      assignments.map(async (assignment: any) => {
        const submissionCount = await Submission.countDocuments({ 
          assignmentId: assignment._id 
        }).exec();

        return {
          id: assignment._id.toString(),
          title: assignment.title,
          description: assignment.description,
          fileUrl: assignment.fileUrl,
          dueDate: assignment.dueDate,
          department: assignment.department,
          year: assignment.year,
          createdBy: assignment.createdBy._id.toString(),
          createdAt: assignment.createdAt,
          creator: {
            id: assignment.createdBy._id.toString(),
            name: assignment.createdBy.name,
            email: assignment.createdBy.email,
          },
          submissionCount: submissionCount,
        };
      })
    );

    return NextResponse.json(resultsWithCounts, { status: 200 });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Connect to MongoDB
    await connectDB();

    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED' 
      }, { status: 401 });
    }

    // Get user details to check role using Mongoose
    const userDetails = await User.findById(user.userId).exec();

    if (!userDetails) {
      return NextResponse.json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND' 
      }, { status: 404 });
    }

    const currentUser = userDetails;

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

    // Create assignment using Mongoose
    const newAssignment = await Assignment.create({
      title: title.trim(),
      description: description.trim(),
      fileUrl: fileUrl ? fileUrl.trim() : null,
      dueDate: dueDate,
      department: department.trim(),
      year: year.trim(),
      createdBy: user.userId,
    });

    if (!newAssignment) {
      return NextResponse.json({ 
        error: 'Failed to create assignment',
        code: 'CREATION_FAILED' 
      }, { status: 500 });
    }

    // Populate creator info
    await newAssignment.populate('createdBy', 'name email');

    const response = {
      id: newAssignment._id.toString(),
      title: newAssignment.title,
      description: newAssignment.description,
      fileUrl: newAssignment.fileUrl,
      dueDate: newAssignment.dueDate,
      department: newAssignment.department,
      year: newAssignment.year,
      createdBy: (newAssignment.createdBy as any)._id.toString(),
      createdAt: newAssignment.createdAt,
      creator: {
        id: (newAssignment.createdBy as any)._id.toString(),
        name: (newAssignment.createdBy as any).name,
        email: (newAssignment.createdBy as any).email,
      },
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