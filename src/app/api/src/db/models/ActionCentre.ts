I notice there's a mismatch in your request. You're asking for a Mongoose model file, but your system is built with Next.js, Drizzle ORM, and SQLite/Turso - not MongoDB/Mongoose.

I'll create the correct implementation using Drizzle ORM to match your existing schema structure:

**OPTION 1: Add to existing schema file (@/db/schema.ts)**

export const actionCentre = sqliteTable('action_centre', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  status: text('status').notNull().default('active'),
  category: text('category').notNull(),
  link: text('link'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

**OPTION 2: Complete API route file (src/app/api/action-centre/route.ts)**

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { actionCentre } from '@/db/schema';
import { eq, like, and, or, desc, asc, gte, lte } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      if (!id || isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }

      const record = await db.select()
        .from(actionCentre)
        .where(eq(actionCentre.id, parseInt(id)))
        .limit(1);

      if (record.length === 0) {
        return NextResponse.json({ error: 'Action centre record not found' }, { status: 404 });
      }

      return NextResponse.json(record[0]);
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const startDateFrom = searchParams.get('startDateFrom');
    const startDateTo = searchParams.get('startDateTo');
    const sort = searchParams.get('sort') || 'createdAt';
    const order = searchParams.get('order') || 'desc';

    let query = db.select().from(actionCentre);

    const conditions = [];

    if (search) {
      conditions.push(
        or(
          like(actionCentre.title, `%${search}%`),
          like(actionCentre.description, `%${search}%`),
          like(actionCentre.category, `%${search}%`)
        )
      );
    }

    if (status && (status === 'active' || status === 'completed')) {
      conditions.push(eq(actionCentre.status, status));
    }

    if (category) {
      conditions.push(eq(actionCentre.category, category));
    }

    if (startDateFrom) {
      conditions.push(gte(actionCentre.startDate, startDateFrom));
    }

    if (startDateTo) {
      conditions.push(lte(actionCentre.startDate, startDateTo));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const sortColumn = sort === 'title' ? actionCentre.title :
                      sort === 'startDate' ? actionCentre.startDate :
                      sort === 'endDate' ? actionCentre.endDate :
                      sort === 'status' ? actionCentre.status :
                      actionCentre.createdAt;

    query = query.orderBy(order === 'asc' ? asc(sortColumn) : desc(sortColumn));
    query = query.limit(limit).offset(offset);

    const results = await query;
    return NextResponse.json(results);

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, startDate, endDate, status, category, link } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ 
        error: "Title is required",
        code: "MISSING_TITLE" 
      }, { status: 400 });
    }

    if (!description || !description.trim()) {
      return NextResponse.json({ 
        error: "Description is required",
        code: "MISSING_DESCRIPTION" 
      }, { status: 400 });
    }

    if (!startDate) {
      return NextResponse.json({ 
        error: "Start date is required",
        code: "MISSING_START_DATE" 
      }, { status: 400 });
    }

    if (!endDate) {
      return NextResponse.json({ 
        error: "End date is required",
        code: "MISSING_END_DATE" 
      }, { status: 400 });
    }

    if (!category || !category.trim()) {
      return NextResponse.json({ 
        error: "Category is required",
        code: "MISSING_CATEGORY" 
      }, { status: 400 });
    }

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (isNaN(startDateObj.getTime())) {
      return NextResponse.json({ 
        error: "Invalid start date format",
        code: "INVALID_START_DATE" 
      }, { status: 400 });
    }

    if (isNaN(endDateObj.getTime())) {
      return NextResponse.json({ 
        error: "Invalid end date format",
        code: "INVALID_END_DATE" 
      }, { status: 400 });
    }

    if (endDateObj < startDateObj) {
      return NextResponse.json({ 
        error: "End date must be after start date",
        code: "INVALID_DATE_RANGE" 
      }, { status: 400 });
    }

    const validStatus = status && (status === 'active' || status === 'completed') ? status : 'active';

    if (status && status !== 'active' && status !== 'completed') {
      return NextResponse.json({ 
        error: "Status must be either 'active' or 'completed'",
        code: "INVALID_STATUS" 
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    const newRecord = await db.insert(actionCentre)
      .values({
        title: title.trim(),
        description: description.trim(),
        startDate: startDateObj.toISOString(),
        endDate: endDateObj.toISOString(),
        status: validStatus,
        category: category.trim(),
        link: link ? link.trim() : null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json(newRecord[0], { status: 201 });

  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const existing = await db.select()
      .from(actionCentre)
      .where(eq(actionCentre.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ 
        error: 'Action centre record not found',
        code: "RECORD_NOT_FOUND" 
      }, { status: 404 });
    }

    const body = await request.json();
    const updates: any = {};

    if (body.title !== undefined) {
      if (!body.title.trim()) {
        return NextResponse.json({ 
          error: "Title cannot be empty",
          code: "INVALID_TITLE" 
        }, { status: 400 });
      }
      updates.title = body.title.trim();
    }

    if (body.description !== undefined) {
      if (!body.description.trim()) {
        return NextResponse.json({ 
          error: "Description cannot be empty",
          code: "INVALID_DESCRIPTION" 
        }, { status: 400 });
      }
      updates.description = body.description.trim();
    }

    if (body.startDate !== undefined) {
      const startDateObj = new Date(body.startDate);
      if (isNaN(startDateObj.getTime())) {
        return NextResponse.json({ 
          error: "Invalid start date format",
          code: "INVALID_START_DATE" 
        }, { status: 400 });
      }
      updates.startDate = startDateObj.toISOString();
    }

    if (body.endDate !== undefined) {
      const endDateObj = new Date(body.endDate);
      if (isNaN(endDateObj.getTime())) {
        return NextResponse.json({ 
          error: "Invalid end date format",
          code: "INVALID_END_DATE" 
        }, { status: 400 });
      }
      updates.endDate = endDateObj.toISOString();
    }

    if (updates.startDate && updates.endDate) {
      if (new Date(updates.endDate) < new Date(updates.startDate)) {
        return NextResponse.json({ 
          error: "End date must be after start date",
          code: "INVALID_DATE_RANGE" 
        }, { status: 400 });
      }
    } else if (updates.startDate && existing[0].endDate) {
      if (new Date(existing[0].endDate) < new Date(updates.startDate)) {
        return NextResponse.json({ 
          error: "End date must be after start date",
          code: "INVALID_DATE_RANGE" 
        }, { status: 400 });
      }
    } else if (updates.endDate && existing[0].startDate) {
      if (new Date(updates.endDate) < new Date(existing[0].startDate)) {
        return NextResponse.json({ 
          error: "End date must be after start date",
          code: "INVALID_DATE_RANGE" 
        }, { status: 400 });
      }
    }

    if (body.status !== undefined) {
      if (body.status !== 'active' && body.status !== 'completed') {
        return NextResponse.json({ 
          error: "Status must be either 'active' or 'completed'",
          code: "INVALID_STATUS" 
        }, { status: 400 });
      }
      updates.status = body.status;
    }

    if (body.category !== undefined) {
      if (!body.category.trim()) {
        return NextResponse.json({ 
          error: "Category cannot be empty",
          code: "INVALID_CATEGORY" 
        }, { status: 400 });
      }
      updates.category = body.category.trim();
    }

    if (body.link !== undefined) {
      updates.link = body.link ? body.link.trim() : null;
    }

    updates.updatedAt = new Date().toISOString();

    const updated = await db.update(actionCentre)
      .set(updates)
      .where(eq(actionCentre.id, parseInt(id)))
      .returning();

    return NextResponse.json(updated[0]);

  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const existing = await db.select()
      .from(actionCentre)
      .where(eq(actionCentre.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ 
        error: 'Action centre record not found',
        code: "RECORD_NOT_FOUND" 
      }, { status: 404 });
    }

    const deleted = await db.delete(actionCentre)
      .where(eq(actionCentre.id, parseInt(id)))
      .returning();

    return NextResponse.json({
      message: 'Action centre record deleted successfully',
      deleted: deleted[0]
    });

  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

Note: You need to add the schema definition (Option 1) to your `@/db/schema.ts` file first, then create the API route file at `src/app/api/action-centre/route.ts`.