import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const VALID_ROLES = ['student', 'faculty', 'admin'] as const;
const MIN_PASSWORD_LENGTH = 6;
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRATION = '7d';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, role, department } = body;

    // Validate required fields
    const missingFields: string[] = [];
    if (!name) missingFields.push('name');
    if (!email) missingFields.push('email');
    if (!password) missingFields.push('password');
    if (!role) missingFields.push('role');
    if (!department) missingFields.push('department');

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required fields: ${missingFields.join(', ')}`,
          code: 'MISSING_REQUIRED_FIELDS'
        },
        { status: 400 }
      );
    }

    // Sanitize inputs
    const sanitizedName = name.trim();
    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedDepartment = department.trim();

    // Validate name
    if (!sanitizedName) {
      return NextResponse.json(
        {
          error: 'Name cannot be empty',
          code: 'INVALID_NAME'
        },
        { status: 400 }
      );
    }

    // Validate email format (basic)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedEmail)) {
      return NextResponse.json(
        {
          error: 'Invalid email format',
          code: 'INVALID_EMAIL'
        },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        {
          error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
          code: 'PASSWORD_TOO_SHORT'
        },
        { status: 400 }
      );
    }

    // Validate role
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json(
        {
          error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`,
          code: 'INVALID_ROLE'
        },
        { status: 400 }
      );
    }

    // Validate department
    if (!sanitizedDepartment) {
      return NextResponse.json(
        {
          error: 'Department cannot be empty',
          code: 'INVALID_DEPARTMENT'
        },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, sanitizedEmail))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        {
          error: 'Email already exists',
          code: 'EMAIL_ALREADY_EXISTS'
        },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const newUser = await db
      .insert(users)
      .values({
        name: sanitizedName,
        email: sanitizedEmail,
        password: hashedPassword,
        role: role,
        department: sanitizedDepartment,
        createdAt: new Date().toISOString()
      })
      .returning();

    if (!newUser || newUser.length === 0) {
      return NextResponse.json(
        {
          error: 'Failed to create user',
          code: 'USER_CREATION_FAILED'
        },
        { status: 500 }
      );
    }

    const createdUser = newUser[0];

    // Remove password from response
    const { password: _, ...userWithoutPassword } = createdUser;

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: createdUser.id,
        email: createdUser.email,
        role: createdUser.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    // Return response with user and token
    return NextResponse.json(
      {
        user: userWithoutPassword,
        token: token
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)),
        code: 'INTERNAL_SERVER_ERROR'
      },
      { status: 500 }
    );
  }
}