import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/db/mongodb';
import { Notice } from '@/db/models/Notice';
import { User } from '@/db/models/User';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

function verifyToken(request: NextRequest): JWTPayload | null {
  try {
    const authHeader = request.headers.get('authorization');
    
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

    const searchParams = request.nextUrl.searchParams;
    const department = searchParams.get('department');
    const year = searchParams.get('year');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query filter for Mongoose
    const filter: any = {};
    if (department) {
      filter.department = department;
    }
    if (year) {
      filter.year = year;
    }

    // Query notices with populate for creator details
    const results = await Notice.find(filter)
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();

    // Transform results to match expected format
    const formattedResults = results.map((notice: any) => ({
      id: notice._id.toString(),
      title: notice.title,
      content: notice.content,
      department: notice.department,
      year: notice.year,
      createdBy: notice.createdBy._id.toString(),
      createdAt: notice.createdAt,
      creator: {
        id: notice.createdBy._id.toString(),
        name: notice.createdBy.name,
        email: notice.createdBy.email,
        role: notice.createdBy.role,
      },
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
    // Connect to MongoDB
    await connectDB();

    const user = verifyToken(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    if (user.role === 'student') {
      return NextResponse.json(
        { 
          error: 'Insufficient permissions. Only faculty and admin can create notices.',
          code: 'FORBIDDEN' 
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, content, department, year } = body;

    if (!title || !content || !department || !year) {
      return NextResponse.json(
        { 
          error: 'All fields are required: title, content, department, year',
          code: 'MISSING_REQUIRED_FIELDS' 
        },
        { status: 400 }
      );
    }

    if (typeof title !== 'string' || title.trim() === '') {
      return NextResponse.json(
        { error: 'Title must be a non-empty string', code: 'INVALID_TITLE' },
        { status: 400 }
      );
    }

    if (typeof content !== 'string' || content.trim() === '') {
      return NextResponse.json(
        { error: 'Content must be a non-empty string', code: 'INVALID_CONTENT' },
        { status: 400 }
      );
    }

    if (typeof department !== 'string' || department.trim() === '') {
      return NextResponse.json(
        { error: 'Department must be a non-empty string', code: 'INVALID_DEPARTMENT' },
        { status: 400 }
      );
    }

    if (typeof year !== 'string' || year.trim() === '') {
      return NextResponse.json(
        { error: 'Year must be a non-empty string', code: 'INVALID_YEAR' },
        { status: 400 }
      );
    }

    // Create notice using Mongoose
    const newNotice = await Notice.create({
      title: title.trim(),
      content: content.trim(),
      department: department.trim(),
      year: year.trim(),
      createdBy: user.userId,
    });

    // Populate creator info
    await newNotice.populate('createdBy', 'name email role');

    const formattedNotice = {
      id: newNotice._id.toString(),
      title: newNotice.title,
      content: newNotice.content,
      department: newNotice.department,
      year: newNotice.year,
      createdBy: (newNotice.createdBy as any)._id.toString(),
      createdAt: newNotice.createdAt,
      creator: {
        id: (newNotice.createdBy as any)._id.toString(),
        name: (newNotice.createdBy as any).name,
        email: (newNotice.createdBy as any).email,
        role: (newNotice.createdBy as any).role,
      },
    };

    return NextResponse.json(formattedNotice, { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}