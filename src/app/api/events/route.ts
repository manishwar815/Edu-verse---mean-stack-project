import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/db/mongodb';
import { Event } from '@/db/models/Event';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface JWTPayload {
  userId: string;
  role: string;
  email?: string;
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
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const event = await Event.findById(id);
      
      if (!event) {
        return NextResponse.json(
          { error: 'Event not found', code: 'NOT_FOUND' },
          { status: 404 }
        );
      }

      return NextResponse.json(event);
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const organizer = searchParams.get('organizer');
    const upcoming = searchParams.get('upcoming') === 'true';

    let query: any = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      query.category = category;
    }

    if (organizer) {
      query.organizer = organizer;
    }

    if (upcoming) {
      query.startDate = { $gte: new Date() };
    }

    const events = await Event.find(query)
      .sort({ startDate: 1 })
      .limit(limit)
      .skip(offset);

    return NextResponse.json(events);
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
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    await connectDB();

    const body = await request.json();
    const { title, description, startDate, endDate, location, organizer, category, imageUrl } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: 'Title is required', code: 'MISSING_TITLE' },
        { status: 400 }
      );
    }

    if (!description || !description.trim()) {
      return NextResponse.json(
        { error: 'Description is required', code: 'MISSING_DESCRIPTION' },
        { status: 400 }
      );
    }

    if (!startDate) {
      return NextResponse.json(
        { error: 'Start date is required', code: 'MISSING_START_DATE' },
        { status: 400 }
      );
    }

    if (!endDate) {
      return NextResponse.json(
        { error: 'End date is required', code: 'MISSING_END_DATE' },
        { status: 400 }
      );
    }

    if (!location || !location.trim()) {
      return NextResponse.json(
        { error: 'Location is required', code: 'MISSING_LOCATION' },
        { status: 400 }
      );
    }

    if (!organizer || !organizer.trim()) {
      return NextResponse.json(
        { error: 'Organizer is required', code: 'MISSING_ORGANIZER' },
        { status: 400 }
      );
    }

    if (!category || !category.trim()) {
      return NextResponse.json(
        { error: 'Category is required', code: 'MISSING_CATEGORY' },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime())) {
      return NextResponse.json(
        { error: 'Invalid start date format', code: 'INVALID_START_DATE' },
        { status: 400 }
      );
    }

    if (isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Invalid end date format', code: 'INVALID_END_DATE' },
        { status: 400 }
      );
    }

    if (end <= start) {
      return NextResponse.json(
        { error: 'End date must be after start date', code: 'INVALID_DATE_RANGE' },
        { status: 400 }
      );
    }

    const eventData: any = {
      title: title.trim(),
      description: description.trim(),
      startDate: start,
      endDate: end,
      location: location.trim(),
      organizer: organizer.trim(),
      category: category.trim(),
      createdAt: new Date()
    };

    if (imageUrl && imageUrl.trim()) {
      eventData.imageUrl = imageUrl.trim();
    }

    const newEvent = await Event.create(eventData);

    return NextResponse.json(newEvent, { status: 201 });
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
    const user = verifyToken(request);
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
        { error: 'Event ID is required', code: 'MISSING_ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { title, description, startDate, endDate, location, organizer, category, imageUrl } = body;

    const event = await Event.findById(id);
    
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const updates: any = {
      updatedAt: new Date()
    };

    if (title !== undefined) {
      if (!title.trim()) {
        return NextResponse.json(
          { error: 'Title cannot be empty', code: 'INVALID_TITLE' },
          { status: 400 }
        );
      }
      updates.title = title.trim();
    }

    if (description !== undefined) {
      if (!description.trim()) {
        return NextResponse.json(
          { error: 'Description cannot be empty', code: 'INVALID_DESCRIPTION' },
          { status: 400 }
        );
      }
      updates.description = description.trim();
    }

    if (location !== undefined) {
      if (!location.trim()) {
        return NextResponse.json(
          { error: 'Location cannot be empty', code: 'INVALID_LOCATION' },
          { status: 400 }
        );
      }
      updates.location = location.trim();
    }

    if (organizer !== undefined) {
      if (!organizer.trim()) {
        return NextResponse.json(
          { error: 'Organizer cannot be empty', code: 'INVALID_ORGANIZER' },
          { status: 400 }
        );
      }
      updates.organizer = organizer.trim();
    }

    if (category !== undefined) {
      if (!category.trim()) {
        return NextResponse.json(
          { error: 'Category cannot be empty', code: 'INVALID_CATEGORY' },
          { status: 400 }
        );
      }
      updates.category = category.trim();
    }

    if (imageUrl !== undefined) {
      updates.imageUrl = imageUrl ? imageUrl.trim() : undefined;
    }

    let newStartDate = event.startDate;
    let newEndDate = event.endDate;

    if (startDate !== undefined) {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        return NextResponse.json(
          { error: 'Invalid start date format', code: 'INVALID_START_DATE' },
          { status: 400 }
        );
      }
      newStartDate = start;
      updates.startDate = start;
    }

    if (endDate !== undefined) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return NextResponse.json(
          { error: 'Invalid end date format', code: 'INVALID_END_DATE' },
          { status: 400 }
        );
      }
      newEndDate = end;
      updates.endDate = end;
    }

    if (newEndDate <= newStartDate) {
      return NextResponse.json(
        { error: 'End date must be after start date', code: 'INVALID_DATE_RANGE' },
        { status: 400 }
      );
    }

    const updatedEvent = await Event.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    return NextResponse.json(updatedEvent);
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
    const user = verifyToken(request);
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
        { error: 'Event ID is required', code: 'MISSING_ID' },
        { status: 400 }
      );
    }

    const deletedEvent = await Event.findByIdAndDelete(id);

    if (!deletedEvent) {
      return NextResponse.json(
        { error: 'Event not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Event deleted successfully',
      event: deletedEvent
    });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}