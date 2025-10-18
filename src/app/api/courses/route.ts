import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { connectDB } from '@/db/mongodb';
import { Course } from '@/db/models/Course';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface JWTPayload {
  userId: string;
  role: string;
  iat?: number;
  exp?: number;
}

async function authenticateRequest(request: NextRequest): Promise<JWTPayload | null> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Single course fetch by ID
    if (id) {
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return NextResponse.json(
          { error: 'Invalid course ID format', code: 'INVALID_ID' },
          { status: 400 }
        );
      }

      const course = await Course.findById(id);
      if (!course) {
        return NextResponse.json(
          { error: 'Course not found', code: 'COURSE_NOT_FOUND' },
          { status: 404 }
        );
      }

      return NextResponse.json(course);
    }

    // List courses with filters, pagination, search, and sorting
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const department = searchParams.get('department');
    const year = searchParams.get('year');
    const semester = searchParams.get('semester');
    const type = searchParams.get('type');
    const sortField = searchParams.get('sort') || 'createdAt';
    const sortOrder = searchParams.get('order') === 'asc' ? 1 : -1;

    // Build filter query
    const filter: any = {};

    if (department) filter.department = department;
    if (year) filter.year = year;
    if (semester) filter.semester = semester;
    if (type) filter.type = type;

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { instructor: { $regex: search, $options: 'i' } }
      ];
    }

    // Valid sort fields
    const validSortFields = ['name', 'code', 'credits', 'createdAt'];
    const sortBy = validSortFields.includes(sortField) ? sortField : 'createdAt';

    const courses = await Course.find(filter)
      .sort({ [sortBy]: sortOrder })
      .limit(limit)
      .skip(offset);

    return NextResponse.json(courses);
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
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    await connectDB();

    const body = await request.json();
    const {
      name,
      code,
      semester,
      instructor,
      department,
      year,
      type,
      credits,
      description
    } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Course name is required', code: 'MISSING_NAME' },
        { status: 400 }
      );
    }

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return NextResponse.json(
        { error: 'Course code is required', code: 'MISSING_CODE' },
        { status: 400 }
      );
    }

    if (!semester || typeof semester !== 'string' || semester.trim().length === 0) {
      return NextResponse.json(
        { error: 'Semester is required', code: 'MISSING_SEMESTER' },
        { status: 400 }
      );
    }

    if (!instructor || typeof instructor !== 'string' || instructor.trim().length === 0) {
      return NextResponse.json(
        { error: 'Instructor is required', code: 'MISSING_INSTRUCTOR' },
        { status: 400 }
      );
    }

    if (!department || typeof department !== 'string' || department.trim().length === 0) {
      return NextResponse.json(
        { error: 'Department is required', code: 'MISSING_DEPARTMENT' },
        { status: 400 }
      );
    }

    if (!year || typeof year !== 'string' || year.trim().length === 0) {
      return NextResponse.json(
        { error: 'Year is required', code: 'MISSING_YEAR' },
        { status: 400 }
      );
    }

    if (!type || !['theory', 'lab'].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be either "theory" or "lab"', code: 'INVALID_TYPE' },
        { status: 400 }
      );
    }

    if (!credits || typeof credits !== 'number' || credits <= 0) {
      return NextResponse.json(
        { error: 'Credits must be a positive number', code: 'INVALID_CREDITS' },
        { status: 400 }
      );
    }

    // Check code uniqueness
    const existingCourse = await Course.findOne({ code: code.trim() });
    if (existingCourse) {
      return NextResponse.json(
        { error: 'Course code already exists', code: 'DUPLICATE_CODE' },
        { status: 400 }
      );
    }

    // Create new course
    const courseData: any = {
      name: name.trim(),
      code: code.trim(),
      semester: semester.trim(),
      instructor: instructor.trim(),
      department: department.trim(),
      year: year.trim(),
      type,
      credits,
      createdAt: new Date().toISOString()
    };

    if (description) {
      courseData.description = description.trim();
    }

    const newCourse = await Course.create(courseData);

    return NextResponse.json(newCourse, { status: 201 });
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
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Course ID is required', code: 'MISSING_ID' },
        { status: 400 }
      );
    }

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return NextResponse.json(
        { error: 'Invalid course ID format', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      name,
      code,
      semester,
      instructor,
      department,
      year,
      type,
      credits,
      description
    } = body;

    // Check if course exists
    const existingCourse = await Course.findById(id);
    if (!existingCourse) {
      return NextResponse.json(
        { error: 'Course not found', code: 'COURSE_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Build update object
    const updates: any = {
      updatedAt: new Date().toISOString()
    };

    // Validate and add fields to update
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Course name must be a non-empty string', code: 'INVALID_NAME' },
          { status: 400 }
        );
      }
      updates.name = name.trim();
    }

    if (code !== undefined) {
      if (typeof code !== 'string' || code.trim().length === 0) {
        return NextResponse.json(
          { error: 'Course code must be a non-empty string', code: 'INVALID_CODE' },
          { status: 400 }
        );
      }
      // Check code uniqueness if changing
      if (code.trim() !== existingCourse.code) {
        const duplicateCourse = await Course.findOne({ code: code.trim() });
        if (duplicateCourse) {
          return NextResponse.json(
            { error: 'Course code already exists', code: 'DUPLICATE_CODE' },
            { status: 400 }
          );
        }
      }
      updates.code = code.trim();
    }

    if (semester !== undefined) {
      if (typeof semester !== 'string' || semester.trim().length === 0) {
        return NextResponse.json(
          { error: 'Semester must be a non-empty string', code: 'INVALID_SEMESTER' },
          { status: 400 }
        );
      }
      updates.semester = semester.trim();
    }

    if (instructor !== undefined) {
      if (typeof instructor !== 'string' || instructor.trim().length === 0) {
        return NextResponse.json(
          { error: 'Instructor must be a non-empty string', code: 'INVALID_INSTRUCTOR' },
          { status: 400 }
        );
      }
      updates.instructor = instructor.trim();
    }

    if (department !== undefined) {
      if (typeof department !== 'string' || department.trim().length === 0) {
        return NextResponse.json(
          { error: 'Department must be a non-empty string', code: 'INVALID_DEPARTMENT' },
          { status: 400 }
        );
      }
      updates.department = department.trim();
    }

    if (year !== undefined) {
      if (typeof year !== 'string' || year.trim().length === 0) {
        return NextResponse.json(
          { error: 'Year must be a non-empty string', code: 'INVALID_YEAR' },
          { status: 400 }
        );
      }
      updates.year = year.trim();
    }

    if (type !== undefined) {
      if (!['theory', 'lab'].includes(type)) {
        return NextResponse.json(
          { error: 'Type must be either "theory" or "lab"', code: 'INVALID_TYPE' },
          { status: 400 }
        );
      }
      updates.type = type;
    }

    if (credits !== undefined) {
      if (typeof credits !== 'number' || credits <= 0) {
        return NextResponse.json(
          { error: 'Credits must be a positive number', code: 'INVALID_CREDITS' },
          { status: 400 }
        );
      }
      updates.credits = credits;
    }

    if (description !== undefined) {
      updates.description = typeof description === 'string' ? description.trim() : description;
    }

    const updatedCourse = await Course.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

    return NextResponse.json(updatedCourse);
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
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Course ID is required', code: 'MISSING_ID' },
        { status: 400 }
      );
    }

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return NextResponse.json(
        { error: 'Invalid course ID format', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const deletedCourse = await Course.findByIdAndDelete(id);

    if (!deletedCourse) {
      return NextResponse.json(
        { error: 'Course not found', code: 'COURSE_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Course deleted successfully',
      course: deletedCourse
    });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}