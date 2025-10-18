import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/db/mongodb';
import { ActionCentre } from '@/db/models/ActionCentre';
import jwt from 'jsonwebtoken';

interface JWTPayload {
  userId: string;
  role: string;
}

// Helper function to verify JWT token
async function verifyAuth(request: NextRequest): Promise<JWTPayload | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, secret) as JWTPayload;
    
    return decoded;
  } catch (error) {
    return null;
  }
}

// GET - List action centre items or get single item by ID
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Single item fetch by ID
    if (id) {
      const item = await ActionCentre.findById(id);
      
      if (!item) {
        return NextResponse.json(
          { error: 'Action item not found', code: 'NOT_FOUND' },
          { status: 404 }
        );
      }

      return NextResponse.json(item);
    }

    // List with filters and pagination
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const category = searchParams.get('category');

    // Build filter query
    const filter: any = {};

    // Status filter - default to active only
    if (status) {
      if (status !== 'active' && status !== 'completed') {
        return NextResponse.json(
          { error: 'Invalid status. Must be "active" or "completed"', code: 'INVALID_STATUS' },
          { status: 400 }
        );
      }
      filter.status = status;
    } else {
      // Default: show only active items with endDate >= today
      filter.status = 'active';
      filter.endDate = { $gte: new Date() };
    }

    // Category filter
    if (category) {
      filter.category = category;
    }

    // Search across title and description
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination and sorting
    const items = await ActionCentre.find(filter)
      .sort({ startDate: 1 }) // Sort by startDate ascending
      .skip(offset)
      .limit(limit);

    return NextResponse.json(items);

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}

// POST - Create new action centre item
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    await connectDB();

    const body = await request.json();
    const { title, description, startDate, endDate, category, link, status } = body;

    // Validate required fields
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

    if (!category || !category.trim()) {
      return NextResponse.json(
        { error: 'Category is required', code: 'MISSING_CATEGORY' },
        { status: 400 }
      );
    }

    // Validate date formats
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (isNaN(startDateObj.getTime())) {
      return NextResponse.json(
        { error: 'Invalid start date format. Use ISO string', code: 'INVALID_START_DATE' },
        { status: 400 }
      );
    }

    if (isNaN(endDateObj.getTime())) {
      return NextResponse.json(
        { error: 'Invalid end date format. Use ISO string', code: 'INVALID_END_DATE' },
        { status: 400 }
      );
    }

    // Validate date range
    if (endDateObj <= startDateObj) {
      return NextResponse.json(
        { error: 'End date must be after start date', code: 'INVALID_DATE_RANGE' },
        { status: 400 }
      );
    }

    // Validate status if provided
    if (status && status !== 'active' && status !== 'completed') {
      return NextResponse.json(
        { error: 'Invalid status. Must be "active" or "completed"', code: 'INVALID_STATUS' },
        { status: 400 }
      );
    }

    // Create new action item
    const newItem = new ActionCentre({
      title: title.trim(),
      description: description.trim(),
      startDate: startDateObj,
      endDate: endDateObj,
      category: category.trim(),
      link: link?.trim() || undefined,
      status: status || 'active',
      createdAt: new Date()
    });

    await newItem.save();

    return NextResponse.json(newItem, { status: 201 });

  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}

// PUT - Update existing action centre item
export async function PUT(request: NextRequest) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID parameter is required', code: 'MISSING_ID' },
        { status: 400 }
      );
    }

    // Check if item exists
    const existingItem = await ActionCentre.findById(id);
    if (!existingItem) {
      return NextResponse.json(
        { error: 'Action item not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { title, description, startDate, endDate, category, link, status } = body;

    // Build update object
    const updates: any = {
      updatedAt: new Date()
    };

    // Validate and add fields to update
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

    if (category !== undefined) {
      if (!category.trim()) {
        return NextResponse.json(
          { error: 'Category cannot be empty', code: 'INVALID_CATEGORY' },
          { status: 400 }
        );
      }
      updates.category = category.trim();
    }

    if (link !== undefined) {
      updates.link = link?.trim() || undefined;
    }

    if (status !== undefined) {
      if (status !== 'active' && status !== 'completed') {
        return NextResponse.json(
          { error: 'Invalid status. Must be "active" or "completed"', code: 'INVALID_STATUS' },
          { status: 400 }
        );
      }
      updates.status = status;
    }

    // Handle date updates with validation
    let newStartDate = existingItem.startDate;
    let newEndDate = existingItem.endDate;

    if (startDate !== undefined) {
      const startDateObj = new Date(startDate);
      if (isNaN(startDateObj.getTime())) {
        return NextResponse.json(
          { error: 'Invalid start date format. Use ISO string', code: 'INVALID_START_DATE' },
          { status: 400 }
        );
      }
      newStartDate = startDateObj;
      updates.startDate = startDateObj;
    }

    if (endDate !== undefined) {
      const endDateObj = new Date(endDate);
      if (isNaN(endDateObj.getTime())) {
        return NextResponse.json(
          { error: 'Invalid end date format. Use ISO string', code: 'INVALID_END_DATE' },
          { status: 400 }
        );
      }
      newEndDate = endDateObj;
      updates.endDate = endDateObj;
    }

    // Validate date range if either date is updated
    if (startDate !== undefined || endDate !== undefined) {
      if (newEndDate <= newStartDate) {
        return NextResponse.json(
          { error: 'End date must be after start date', code: 'INVALID_DATE_RANGE' },
          { status: 400 }
        );
      }
    }

    // Update the item
    const updatedItem = await ActionCentre.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

    return NextResponse.json(updatedItem);

  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}

// DELETE - Delete action centre item
export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID parameter is required', code: 'MISSING_ID' },
        { status: 400 }
      );
    }

    // Delete the item
    const deletedItem = await ActionCentre.findByIdAndDelete(id);

    if (!deletedItem) {
      return NextResponse.json(
        { error: 'Action item not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Action item deleted successfully',
      deletedItem
    });

  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}