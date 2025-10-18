import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/db/mongodb';
import { Attendance } from '@/db/models/Attendance';
import { User } from '@/db/models/User';
import { Course } from '@/db/models/Course';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface JWTPayload {
  userId: string;
  role: string;
}

async function verifyAuth(request: NextRequest): Promise<JWTPayload | null> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    if (courseId) {
      const attendanceRecords = await Attendance.find({
        userId: auth.userId,
        courseId: courseId
      })
        .populate('userId', 'name email department')
        .populate('courseId', 'name code department')
        .sort({ date: -1 })
        .skip(offset)
        .limit(limit);

      return NextResponse.json(attendanceRecords, { status: 200 });
    }

    const attendanceRecords = await Attendance.find({
      userId: auth.userId
    })
      .populate('userId', 'name email department')
      .populate('courseId', 'name code department')
      .sort({ date: -1 })
      .skip(offset)
      .limit(limit);

    const totalRecords = attendanceRecords.length;
    let totalClasses = 0;
    let totalAttended = 0;

    attendanceRecords.forEach(record => {
      totalClasses += record.totalClasses || 0;
      totalAttended += record.attendedClasses || 0;
    });

    const overallPercentage = totalClasses > 0 
      ? Math.round((totalAttended / totalClasses) * 100) 
      : 0;

    return NextResponse.json({
      records: attendanceRecords,
      summary: {
        totalRecords,
        totalClasses,
        totalAttended,
        overallPercentage
      }
    }, { status: 200 });

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
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    await connectDB();

    const body = await request.json();
    const { userId, courseId, date, status } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required', code: 'MISSING_USER_ID' },
        { status: 400 }
      );
    }

    if (!courseId) {
      return NextResponse.json(
        { error: 'courseId is required', code: 'MISSING_COURSE_ID' },
        { status: 400 }
      );
    }

    if (!date) {
      return NextResponse.json(
        { error: 'date is required', code: 'MISSING_DATE' },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { error: 'status is required', code: 'MISSING_STATUS' },
        { status: 400 }
      );
    }

    if (status !== 'present' && status !== 'absent') {
      return NextResponse.json(
        { error: 'status must be either "present" or "absent"', code: 'INVALID_STATUS' },
        { status: 400 }
      );
    }

    const userExists = await User.findById(userId);
    if (!userExists) {
      return NextResponse.json(
        { error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 400 }
      );
    }

    const courseExists = await Course.findById(courseId);
    if (!courseExists) {
      return NextResponse.json(
        { error: 'Course not found', code: 'COURSE_NOT_FOUND' },
        { status: 400 }
      );
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO string format', code: 'INVALID_DATE' },
        { status: 400 }
      );
    }

    let existingAttendance = await Attendance.findOne({
      userId,
      courseId
    });

    let totalClasses = 1;
    let attendedClasses = status === 'present' ? 1 : 0;
    let percentage = 0;

    if (existingAttendance) {
      totalClasses = (existingAttendance.totalClasses || 0) + 1;
      attendedClasses = (existingAttendance.attendedClasses || 0) + (status === 'present' ? 1 : 0);
      percentage = Math.round((attendedClasses / totalClasses) * 100);

      existingAttendance.totalClasses = totalClasses;
      existingAttendance.attendedClasses = attendedClasses;
      existingAttendance.percentage = percentage;
      existingAttendance.date = parsedDate;
      existingAttendance.status = status;
      await existingAttendance.save();

      const populated = await Attendance.findById(existingAttendance._id)
        .populate('userId', 'name email department')
        .populate('courseId', 'name code department');

      return NextResponse.json(populated, { status: 201 });
    }

    percentage = status === 'present' ? 100 : 0;

    const newAttendance = new Attendance({
      userId,
      courseId,
      date: parsedDate,
      status,
      totalClasses,
      attendedClasses,
      percentage,
      createdAt: new Date()
    });

    await newAttendance.save();

    const populated = await Attendance.findById(newAttendance._id)
      .populate('userId', 'name email department')
      .populate('courseId', 'name code department');

    return NextResponse.json(populated, { status: 201 });

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
    const auth = await verifyAuth(request);
    if (!auth) {
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
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const updates: any = {};

    if (body.date !== undefined) {
      const parsedDate = new Date(body.date);
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format. Use ISO string format', code: 'INVALID_DATE' },
          { status: 400 }
        );
      }
      updates.date = parsedDate;
    }

    if (body.status !== undefined) {
      if (body.status !== 'present' && body.status !== 'absent') {
        return NextResponse.json(
          { error: 'status must be either "present" or "absent"', code: 'INVALID_STATUS' },
          { status: 400 }
        );
      }
      updates.status = body.status;
    }

    const existingRecord = await Attendance.findById(id);
    if (!existingRecord) {
      return NextResponse.json(
        { error: 'Attendance record not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    if (body.status && body.status !== existingRecord.status) {
      const statusDifference = body.status === 'present' ? 1 : -1;
      const previousStatus = existingRecord.status === 'present' ? -1 : 1;
      const netChange = statusDifference + previousStatus;

      const newAttendedClasses = (existingRecord.attendedClasses || 0) + netChange;
      const totalClasses = existingRecord.totalClasses || 1;
      const newPercentage = totalClasses > 0 
        ? Math.round((newAttendedClasses / totalClasses) * 100) 
        : 0;

      updates.attendedClasses = newAttendedClasses;
      updates.percentage = newPercentage;
    }

    updates.updatedAt = new Date();

    const updatedRecord = await Attendance.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('userId', 'name email department')
      .populate('courseId', 'name code department');

    if (!updatedRecord) {
      return NextResponse.json(
        { error: 'Attendance record not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedRecord, { status: 200 });

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
    const auth = await verifyAuth(request);
    if (!auth) {
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
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const deletedRecord = await Attendance.findByIdAndDelete(id)
      .populate('userId', 'name email department')
      .populate('courseId', 'name code department');

    if (!deletedRecord) {
      return NextResponse.json(
        { error: 'Attendance record not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: 'Attendance record deleted successfully',
        deletedRecord
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