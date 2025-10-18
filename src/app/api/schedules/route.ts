import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/db/mongodb';
import { Schedule } from '@/db/models/Schedule';
import { User } from '@/db/models/User';
import { Course } from '@/db/models/Course';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

async function authenticateRequest(request: NextRequest): Promise<{ userId: string } | null> {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return { userId: decoded.userId };
  } catch (error) {
    return null;
  }
}

function validateTimeFormat(time: string): boolean {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
}

function isTimeAfter(endTime: string, startTime: string): boolean {
  const [endHour, endMinute] = endTime.split(':').map(Number);
  const [startHour, startMinute] = startTime.split(':').map(Number);
  
  if (endHour > startHour) return true;
  if (endHour === startHour && endMinute > startMinute) return true;
  return false;
}

function timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const [s1Hour, s1Minute] = start1.split(':').map(Number);
  const [e1Hour, e1Minute] = end1.split(':').map(Number);
  const [s2Hour, s2Minute] = start2.split(':').map(Number);
  const [e2Hour, e2Minute] = end2.split(':').map(Number);
  
  const s1Minutes = s1Hour * 60 + s1Minute;
  const e1Minutes = e1Hour * 60 + e1Minute;
  const s2Minutes = s2Hour * 60 + s2Minute;
  const e2Minutes = e2Hour * 60 + e2Minute;
  
  return (s1Minutes < e2Minutes && e1Minutes > s2Minutes);
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_ORDER: { [key: string]: number } = {
  'Monday': 1,
  'Tuesday': 2,
  'Wednesday': 3,
  'Thursday': 4,
  'Friday': 5,
  'Saturday': 6,
  'Sunday': 7
};

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const dayOfWeek = searchParams.get('dayOfWeek');

    // Get specific schedule entry by ID
    if (id) {
      const schedule = await Schedule.findOne({ _id: id, userId: auth.userId })
        .populate('courseId', 'name code instructor')
        .lean();

      if (!schedule) {
        return NextResponse.json({ 
          error: 'Schedule entry not found',
          code: 'NOT_FOUND' 
        }, { status: 404 });
      }

      return NextResponse.json(schedule, { status: 200 });
    }

    // Get user's schedule
    let query: any = { userId: auth.userId };
    
    if (dayOfWeek) {
      if (!DAYS_OF_WEEK.includes(dayOfWeek)) {
        return NextResponse.json({ 
          error: 'Invalid day of week',
          code: 'INVALID_DAY' 
        }, { status: 400 });
      }
      query.dayOfWeek = dayOfWeek;
    }

    const schedules = await Schedule.find(query)
      .populate('courseId', 'name code instructor')
      .lean();

    // Sort by day of week, then by start time
    schedules.sort((a, b) => {
      const dayCompare = DAY_ORDER[a.dayOfWeek] - DAY_ORDER[b.dayOfWeek];
      if (dayCompare !== 0) return dayCompare;
      
      const [aHour, aMinute] = a.startTime.split(':').map(Number);
      const [bHour, bMinute] = b.startTime.split(':').map(Number);
      const aMinutes = aHour * 60 + aMinute;
      const bMinutes = bHour * 60 + bMinute;
      return aMinutes - bMinutes;
    });

    // Group by day of week
    const groupedSchedule: { [key: string]: any[] } = {};
    DAYS_OF_WEEK.forEach(day => {
      groupedSchedule[day] = [];
    });

    schedules.forEach(schedule => {
      groupedSchedule[schedule.dayOfWeek].push(schedule);
    });

    return NextResponse.json({
      schedules: schedules,
      groupedByDay: groupedSchedule
    }, { status: 200 });

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    await connectDB();

    const body = await request.json();
    const { courseId, dayOfWeek, startTime, endTime, room, building } = body;

    // Security check: reject if userId provided in body
    if ('userId' in body || 'user_id' in body) {
      return NextResponse.json({ 
        error: "User ID cannot be provided in request body",
        code: "USER_ID_NOT_ALLOWED" 
      }, { status: 400 });
    }

    // Validate required fields
    if (!courseId) {
      return NextResponse.json({ 
        error: 'Course ID is required',
        code: 'MISSING_COURSE_ID' 
      }, { status: 400 });
    }

    if (!dayOfWeek) {
      return NextResponse.json({ 
        error: 'Day of week is required',
        code: 'MISSING_DAY_OF_WEEK' 
      }, { status: 400 });
    }

    if (!startTime) {
      return NextResponse.json({ 
        error: 'Start time is required',
        code: 'MISSING_START_TIME' 
      }, { status: 400 });
    }

    if (!endTime) {
      return NextResponse.json({ 
        error: 'End time is required',
        code: 'MISSING_END_TIME' 
      }, { status: 400 });
    }

    if (!room) {
      return NextResponse.json({ 
        error: 'Room is required',
        code: 'MISSING_ROOM' 
      }, { status: 400 });
    }

    if (!building) {
      return NextResponse.json({ 
        error: 'Building is required',
        code: 'MISSING_BUILDING' 
      }, { status: 400 });
    }

    // Validate dayOfWeek
    if (!DAYS_OF_WEEK.includes(dayOfWeek)) {
      return NextResponse.json({ 
        error: 'Invalid day of week. Must be one of: ' + DAYS_OF_WEEK.join(', '),
        code: 'INVALID_DAY_OF_WEEK' 
      }, { status: 400 });
    }

    // Validate time format
    if (!validateTimeFormat(startTime)) {
      return NextResponse.json({ 
        error: 'Invalid start time format. Use HH:MM format (e.g., 09:30)',
        code: 'INVALID_START_TIME_FORMAT' 
      }, { status: 400 });
    }

    if (!validateTimeFormat(endTime)) {
      return NextResponse.json({ 
        error: 'Invalid end time format. Use HH:MM format (e.g., 10:30)',
        code: 'INVALID_END_TIME_FORMAT' 
      }, { status: 400 });
    }

    // Validate endTime is after startTime
    if (!isTimeAfter(endTime, startTime)) {
      return NextResponse.json({ 
        error: 'End time must be after start time',
        code: 'INVALID_TIME_RANGE' 
      }, { status: 400 });
    }

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return NextResponse.json({ 
        error: 'Course not found',
        code: 'COURSE_NOT_FOUND' 
      }, { status: 404 });
    }

    // Check for time conflicts
    const conflictingSchedules = await Schedule.find({
      userId: auth.userId,
      dayOfWeek: dayOfWeek,
      _id: { $exists: true }
    }).lean();

    for (const existing of conflictingSchedules) {
      if (timesOverlap(startTime, endTime, existing.startTime, existing.endTime)) {
        return NextResponse.json({ 
          error: `Time conflict detected with existing schedule on ${dayOfWeek} from ${existing.startTime} to ${existing.endTime}`,
          code: 'TIME_CONFLICT' 
        }, { status: 400 });
      }
    }

    // Create new schedule entry
    const newSchedule = await Schedule.create({
      userId: auth.userId,
      courseId,
      dayOfWeek,
      startTime,
      endTime,
      room: room.trim(),
      building: building.trim(),
      createdAt: new Date().toISOString()
    });

    const populatedSchedule = await Schedule.findById(newSchedule._id)
      .populate('courseId', 'name code instructor')
      .lean();

    return NextResponse.json(populatedSchedule, { status: 201 });

  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ 
        error: 'Schedule ID is required',
        code: 'MISSING_ID' 
      }, { status: 400 });
    }

    const body = await request.json();

    // Security check: reject if userId provided in body
    if ('userId' in body || 'user_id' in body) {
      return NextResponse.json({ 
        error: "User ID cannot be provided in request body",
        code: "USER_ID_NOT_ALLOWED" 
      }, { status: 400 });
    }

    // Check if schedule exists and belongs to user
    const existingSchedule = await Schedule.findOne({ 
      _id: id, 
      userId: auth.userId 
    }).lean();

    if (!existingSchedule) {
      return NextResponse.json({ 
        error: 'Schedule entry not found',
        code: 'NOT_FOUND' 
      }, { status: 404 });
    }

    const updates: any = {};

    // Validate and prepare updates
    if (body.courseId !== undefined) {
      const course = await Course.findById(body.courseId);
      if (!course) {
        return NextResponse.json({ 
          error: 'Course not found',
          code: 'COURSE_NOT_FOUND' 
        }, { status: 404 });
      }
      updates.courseId = body.courseId;
    }

    if (body.dayOfWeek !== undefined) {
      if (!DAYS_OF_WEEK.includes(body.dayOfWeek)) {
        return NextResponse.json({ 
          error: 'Invalid day of week. Must be one of: ' + DAYS_OF_WEEK.join(', '),
          code: 'INVALID_DAY_OF_WEEK' 
        }, { status: 400 });
      }
      updates.dayOfWeek = body.dayOfWeek;
    }

    if (body.startTime !== undefined) {
      if (!validateTimeFormat(body.startTime)) {
        return NextResponse.json({ 
          error: 'Invalid start time format. Use HH:MM format (e.g., 09:30)',
          code: 'INVALID_START_TIME_FORMAT' 
        }, { status: 400 });
      }
      updates.startTime = body.startTime;
    }

    if (body.endTime !== undefined) {
      if (!validateTimeFormat(body.endTime)) {
        return NextResponse.json({ 
          error: 'Invalid end time format. Use HH:MM format (e.g., 10:30)',
          code: 'INVALID_END_TIME_FORMAT' 
        }, { status: 400 });
      }
      updates.endTime = body.endTime;
    }

    // Validate time range if both times are being updated or if one is updated
    const finalStartTime = updates.startTime || existingSchedule.startTime;
    const finalEndTime = updates.endTime || existingSchedule.endTime;

    if (!isTimeAfter(finalEndTime, finalStartTime)) {
      return NextResponse.json({ 
        error: 'End time must be after start time',
        code: 'INVALID_TIME_RANGE' 
      }, { status: 400 });
    }

    if (body.room !== undefined) {
      updates.room = body.room.trim();
    }

    if (body.building !== undefined) {
      updates.building = body.building.trim();
    }

    // Check for time conflicts if day or time changed
    if (updates.dayOfWeek !== undefined || updates.startTime !== undefined || updates.endTime !== undefined) {
      const checkDay = updates.dayOfWeek || existingSchedule.dayOfWeek;
      
      const conflictingSchedules = await Schedule.find({
        userId: auth.userId,
        dayOfWeek: checkDay,
        _id: { $ne: id }
      }).lean();

      for (const existing of conflictingSchedules) {
        if (timesOverlap(finalStartTime, finalEndTime, existing.startTime, existing.endTime)) {
          return NextResponse.json({ 
            error: `Time conflict detected with existing schedule on ${checkDay} from ${existing.startTime} to ${existing.endTime}`,
            code: 'TIME_CONFLICT' 
          }, { status: 400 });
        }
      }
    }

    // Update schedule
    updates.updatedAt = new Date().toISOString();

    const updatedSchedule = await Schedule.findOneAndUpdate(
      { _id: id, userId: auth.userId },
      { $set: updates },
      { new: true }
    ).populate('courseId', 'name code instructor').lean();

    if (!updatedSchedule) {
      return NextResponse.json({ 
        error: 'Schedule entry not found',
        code: 'NOT_FOUND' 
      }, { status: 404 });
    }

    return NextResponse.json(updatedSchedule, { status: 200 });

  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ 
        error: 'Schedule ID is required',
        code: 'MISSING_ID' 
      }, { status: 400 });
    }

    // Find and delete schedule
    const deletedSchedule = await Schedule.findOneAndDelete({ 
      _id: id, 
      userId: auth.userId 
    }).populate('courseId', 'name code instructor').lean();

    if (!deletedSchedule) {
      return NextResponse.json({ 
        error: 'Schedule entry not found',
        code: 'NOT_FOUND' 
      }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Schedule entry deleted successfully',
      deletedSchedule
    }, { status: 200 });

  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}