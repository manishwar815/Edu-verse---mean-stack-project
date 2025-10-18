import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/db/mongodb';
import { Club } from '@/db/models/Club';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface JWTPayload {
  userId: string;
  role: string;
}

async function verifyAuth(request: NextRequest): Promise<JWTPayload | null> {
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
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const club = await Club.findById(id);
      if (!club) {
        return NextResponse.json({ 
          error: 'Club not found',
          code: 'CLUB_NOT_FOUND' 
        }, { status: 404 });
      }
      return NextResponse.json(club);
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const sortBy = searchParams.get('sort') || 'name';
    const order = searchParams.get('order') || 'asc';

    let query: any = {};

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { coordinator: { $regex: search, $options: 'i' } }
      ];
    }

    let sortOptions: any = {};
    if (sortBy === 'memberCount') {
      sortOptions.memberCount = order === 'desc' ? -1 : 1;
    } else {
      sortOptions.name = order === 'desc' ? -1 : 1;
    }

    const clubs = await Club.find(query)
      .sort(sortOptions)
      .skip(offset)
      .limit(limit);

    return NextResponse.json(clubs);
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    await connectDB();

    const body = await request.json();
    const { name, description, category, coordinator, imageUrl } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ 
        error: 'Club name is required',
        code: 'MISSING_NAME' 
      }, { status: 400 });
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json({ 
        error: 'Description is required',
        code: 'MISSING_DESCRIPTION' 
      }, { status: 400 });
    }

    if (!category || typeof category !== 'string' || category.trim().length === 0) {
      return NextResponse.json({ 
        error: 'Category is required',
        code: 'MISSING_CATEGORY' 
      }, { status: 400 });
    }

    if (!coordinator || typeof coordinator !== 'string' || coordinator.trim().length === 0) {
      return NextResponse.json({ 
        error: 'Coordinator is required',
        code: 'MISSING_COORDINATOR' 
      }, { status: 400 });
    }

    const existingClub = await Club.findOne({ name: name.trim() });
    if (existingClub) {
      return NextResponse.json({ 
        error: 'A club with this name already exists',
        code: 'DUPLICATE_NAME' 
      }, { status: 400 });
    }

    const clubData: any = {
      name: name.trim(),
      description: description.trim(),
      category: category.trim(),
      coordinator: coordinator.trim(),
      memberCount: 0,
      createdAt: new Date().toISOString()
    };

    if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim().length > 0) {
      clubData.imageUrl = imageUrl.trim();
    }

    const newClub = await Club.create(clubData);

    return NextResponse.json(newClub, { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
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
        error: 'Club ID is required',
        code: 'MISSING_ID' 
      }, { status: 400 });
    }

    const existingClub = await Club.findById(id);
    if (!existingClub) {
      return NextResponse.json({ 
        error: 'Club not found',
        code: 'CLUB_NOT_FOUND' 
      }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, category, coordinator, memberCount, imageUrl } = body;

    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ 
          error: 'Club name must be a non-empty string',
          code: 'INVALID_NAME' 
        }, { status: 400 });
      }
      
      if (name.trim() !== existingClub.name) {
        const duplicateClub = await Club.findOne({ name: name.trim(), _id: { $ne: id } });
        if (duplicateClub) {
          return NextResponse.json({ 
            error: 'A club with this name already exists',
            code: 'DUPLICATE_NAME' 
          }, { status: 400 });
        }
        updateData.name = name.trim();
      }
    }

    if (description !== undefined) {
      if (typeof description !== 'string' || description.trim().length === 0) {
        return NextResponse.json({ 
          error: 'Description must be a non-empty string',
          code: 'INVALID_DESCRIPTION' 
        }, { status: 400 });
      }
      updateData.description = description.trim();
    }

    if (category !== undefined) {
      if (typeof category !== 'string' || category.trim().length === 0) {
        return NextResponse.json({ 
          error: 'Category must be a non-empty string',
          code: 'INVALID_CATEGORY' 
        }, { status: 400 });
      }
      updateData.category = category.trim();
    }

    if (coordinator !== undefined) {
      if (typeof coordinator !== 'string' || coordinator.trim().length === 0) {
        return NextResponse.json({ 
          error: 'Coordinator must be a non-empty string',
          code: 'INVALID_COORDINATOR' 
        }, { status: 400 });
      }
      updateData.coordinator = coordinator.trim();
    }

    if (memberCount !== undefined) {
      if (typeof memberCount !== 'number' || memberCount < 0) {
        return NextResponse.json({ 
          error: 'Member count must be a non-negative number',
          code: 'INVALID_MEMBER_COUNT' 
        }, { status: 400 });
      }
      updateData.memberCount = memberCount;
    }

    if (imageUrl !== undefined) {
      if (imageUrl === null || imageUrl === '') {
        updateData.imageUrl = undefined;
      } else if (typeof imageUrl === 'string' && imageUrl.trim().length > 0) {
        updateData.imageUrl = imageUrl.trim();
      } else {
        return NextResponse.json({ 
          error: 'Image URL must be a valid string',
          code: 'INVALID_IMAGE_URL' 
        }, { status: 400 });
      }
    }

    const updatedClub = await Club.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    return NextResponse.json(updatedClub);
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
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
        error: 'Club ID is required',
        code: 'MISSING_ID' 
      }, { status: 400 });
    }

    const deletedClub = await Club.findByIdAndDelete(id);
    
    if (!deletedClub) {
      return NextResponse.json({ 
        error: 'Club not found',
        code: 'CLUB_NOT_FOUND' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      message: 'Club deleted successfully',
      club: deletedClub 
    });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}