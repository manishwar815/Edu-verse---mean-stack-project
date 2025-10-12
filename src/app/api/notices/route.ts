import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { notices, users } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface JWTPayload {
  userId: number;
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
    const searchParams = request.nextUrl.searchParams;
    const department = searchParams.get('department');
    const year = searchParams.get('year');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = db
      .select({
        id: notices.id,
        title: notices.title,
        content: notices.content,
        department: notices.department,
        year: notices.year,
        createdBy: notices.createdBy,
        createdAt: notices.createdAt,
        creator: {
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
        },
      })
      .from(notices)
      .leftJoin(users, eq(notices.createdBy, users.id))
      .orderBy(desc(notices.createdAt));

    const conditions = [];
    if (department) {
      conditions.push(eq(notices.department, department));
    }
    if (year) {
      conditions.push(eq(notices.year, year));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query.limit(limit).offset(offset);

    return NextResponse.json(results, { status: 200 });
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

    const newNotice = await db
      .insert(notices)
      .values({
        title: title.trim(),
        content: content.trim(),
        department: department.trim(),
        year: year.trim(),
        createdBy: user.userId,
        createdAt: new Date().toISOString(),
      })
      .returning();

    const createdNoticeWithCreator = await db
      .select({
        id: notices.id,
        title: notices.title,
        content: notices.content,
        department: notices.department,
        year: notices.year,
        createdBy: notices.createdBy,
        createdAt: notices.createdAt,
        creator: {
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
        },
      })
      .from(notices)
      .leftJoin(users, eq(notices.createdBy, users.id))
      .where(eq(notices.id, newNotice[0].id))
      .limit(1);

    return NextResponse.json(createdNoticeWithCreator[0], { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}