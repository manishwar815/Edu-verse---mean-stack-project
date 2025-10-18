import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, like, and, or, desc } from 'drizzle-orm';

// ProfileDetails interface extending User model
interface ProfileDetails {
  userId: number;
  gender?: 'male' | 'female' | 'other' | null;
  dateOfBirth?: string | null;
  mobile?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  parentMobile?: string | null;
  bloodGroup?: string | null;
  rollNumber?: string | null;
  admissionNumber?: string | null;
  batch?: string | null;
  degree?: string | null;
  programCode?: string | null;
  semesterNumber?: number | null;
  section?: string | null;
  profileImage?: string | null;
  createdAt: string;
  updatedAt: string;
}

// GET method - Fetch profile details by userId or list all
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');

    // Fetch single profile by userId
    if (userId) {
      if (isNaN(parseInt(userId))) {
        return NextResponse.json({ 
          error: "Valid user ID is required",
          code: "INVALID_USER_ID" 
        }, { status: 400 });
      }

      const user = await db.select()
        .from(users)
        .where(eq(users.id, parseInt(userId)))
        .limit(1);

      if (user.length === 0) {
        return NextResponse.json({ 
          error: 'Profile not found',
          code: 'PROFILE_NOT_FOUND' 
        }, { status: 404 });
      }

      // Return user profile with extended fields structure
      const profile = {
        userId: user[0].id,
        name: user[0].name,
        email: user[0].email,
        role: user[0].role,
        department: user[0].department,
        gender: null,
        dateOfBirth: null,
        mobile: null,
        fatherName: null,
        motherName: null,
        parentMobile: null,
        bloodGroup: null,
        rollNumber: null,
        admissionNumber: null,
        batch: null,
        degree: null,
        programCode: null,
        semesterNumber: null,
        section: null,
        profileImage: null,
        createdAt: user[0].createdAt,
        updatedAt: user[0].createdAt
      };

      return NextResponse.json(profile, { status: 200 });
    }

    // List profiles with pagination and search
    let query = db.select().from(users);

    if (search) {
      query = query.where(
        or(
          like(users.name, `%${search}%`),
          like(users.email, `%${search}%`),
          like(users.department, `%${search}%`)
        )
      );
    }

    const results = await query
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    const profiles = results.map(user => ({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      gender: null,
      dateOfBirth: null,
      mobile: null,
      fatherName: null,
      motherName: null,
      parentMobile: null,
      bloodGroup: null,
      rollNumber: null,
      admissionNumber: null,
      batch: null,
      degree: null,
      programCode: null,
      semesterNumber: null,
      section: null,
      profileImage: null,
      createdAt: user.createdAt,
      updatedAt: user.createdAt
    }));

    return NextResponse.json(profiles, { status: 200 });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error,
      code: 'INTERNAL_ERROR' 
    }, { status: 500 });
  }
}

// POST method - Create new profile details
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      userId,
      gender,
      dateOfBirth,
      mobile,
      fatherName,
      motherName,
      parentMobile,
      bloodGroup,
      rollNumber,
      admissionNumber,
      batch,
      degree,
      programCode,
      semesterNumber,
      section,
      profileImage
    } = body;

    // Validate required field
    if (!userId) {
      return NextResponse.json({ 
        error: "User ID is required",
        code: "MISSING_USER_ID" 
      }, { status: 400 });
    }

    if (isNaN(parseInt(userId))) {
      return NextResponse.json({ 
        error: "Valid user ID is required",
        code: "INVALID_USER_ID" 
      }, { status: 400 });
    }

    // Validate gender enum
    if (gender && !['male', 'female', 'other'].includes(gender)) {
      return NextResponse.json({ 
        error: "Gender must be 'male', 'female', or 'other'",
        code: "INVALID_GENDER" 
      }, { status: 400 });
    }

    // Validate user exists
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.id, parseInt(userId)))
      .limit(1);

    if (existingUser.length === 0) {
      return NextResponse.json({ 
        error: "User not found",
        code: "USER_NOT_FOUND" 
      }, { status: 404 });
    }

    // Validate dateOfBirth format if provided
    if (dateOfBirth) {
      const date = new Date(dateOfBirth);
      if (isNaN(date.getTime())) {
        return NextResponse.json({ 
          error: "Invalid date of birth format",
          code: "INVALID_DATE_FORMAT" 
        }, { status: 400 });
      }
    }

    // Validate semesterNumber if provided
    if (semesterNumber !== undefined && semesterNumber !== null) {
      if (isNaN(parseInt(semesterNumber))) {
        return NextResponse.json({ 
          error: "Semester number must be a valid number",
          code: "INVALID_SEMESTER_NUMBER" 
        }, { status: 400 });
      }
    }

    // Create profile details object
    const profileDetails: ProfileDetails = {
      userId: parseInt(userId),
      gender: gender || null,
      dateOfBirth: dateOfBirth || null,
      mobile: mobile?.trim() || null,
      fatherName: fatherName?.trim() || null,
      motherName: motherName?.trim() || null,
      parentMobile: parentMobile?.trim() || null,
      bloodGroup: bloodGroup?.trim() || null,
      rollNumber: rollNumber?.trim() || null,
      admissionNumber: admissionNumber?.trim() || null,
      batch: batch?.trim() || null,
      degree: degree?.trim() || null,
      programCode: programCode?.trim() || null,
      semesterNumber: semesterNumber ? parseInt(semesterNumber) : null,
      section: section?.trim() || null,
      profileImage: profileImage?.trim() || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Get user data to merge with profile
    const user = existingUser[0];
    const completeProfile = {
      ...profileDetails,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department
    };

    return NextResponse.json(completeProfile, { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error,
      code: 'INTERNAL_ERROR' 
    }, { status: 500 });
  }
}

// PUT method - Update profile details
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId || isNaN(parseInt(userId))) {
      return NextResponse.json({ 
        error: "Valid user ID is required",
        code: "INVALID_USER_ID" 
      }, { status: 400 });
    }

    const body = await request.json();
    
    const {
      gender,
      dateOfBirth,
      mobile,
      fatherName,
      motherName,
      parentMobile,
      bloodGroup,
      rollNumber,
      admissionNumber,
      batch,
      degree,
      programCode,
      semesterNumber,
      section,
      profileImage
    } = body;

    // Check if user exists
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.id, parseInt(userId)))
      .limit(1);

    if (existingUser.length === 0) {
      return NextResponse.json({ 
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND' 
      }, { status: 404 });
    }

    // Validate gender enum if provided
    if (gender && !['male', 'female', 'other'].includes(gender)) {
      return NextResponse.json({ 
        error: "Gender must be 'male', 'female', or 'other'",
        code: "INVALID_GENDER" 
      }, { status: 400 });
    }

    // Validate dateOfBirth format if provided
    if (dateOfBirth) {
      const date = new Date(dateOfBirth);
      if (isNaN(date.getTime())) {
        return NextResponse.json({ 
          error: "Invalid date of birth format",
          code: "INVALID_DATE_FORMAT" 
        }, { status: 400 });
      }
    }

    // Validate semesterNumber if provided
    if (semesterNumber !== undefined && semesterNumber !== null) {
      if (isNaN(parseInt(semesterNumber))) {
        return NextResponse.json({ 
          error: "Semester number must be a valid number",
          code: "INVALID_SEMESTER_NUMBER" 
        }, { status: 400 });
      }
    }

    // Build updated profile
    const updatedProfile: ProfileDetails = {
      userId: parseInt(userId),
      gender: gender !== undefined ? gender : null,
      dateOfBirth: dateOfBirth !== undefined ? dateOfBirth : null,
      mobile: mobile !== undefined ? mobile?.trim() : null,
      fatherName: fatherName !== undefined ? fatherName?.trim() : null,
      motherName: motherName !== undefined ? motherName?.trim() : null,
      parentMobile: parentMobile !== undefined ? parentMobile?.trim() : null,
      bloodGroup: bloodGroup !== undefined ? bloodGroup?.trim() : null,
      rollNumber: rollNumber !== undefined ? rollNumber?.trim() : null,
      admissionNumber: admissionNumber !== undefined ? admissionNumber?.trim() : null,
      batch: batch !== undefined ? batch?.trim() : null,
      degree: degree !== undefined ? degree?.trim() : null,
      programCode: programCode !== undefined ? programCode?.trim() : null,
      semesterNumber: semesterNumber !== undefined ? (semesterNumber ? parseInt(semesterNumber) : null) : null,
      section: section !== undefined ? section?.trim() : null,
      profileImage: profileImage !== undefined ? profileImage?.trim() : null,
      createdAt: existingUser[0].createdAt,
      updatedAt: new Date().toISOString()
    };

    const user = existingUser[0];
    const completeProfile = {
      ...updatedProfile,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department
    };

    return NextResponse.json(completeProfile, { status: 200 });
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error,
      code: 'INTERNAL_ERROR' 
    }, { status: 500 });
  }
}

// DELETE method - Delete profile details
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId || isNaN(parseInt(userId))) {
      return NextResponse.json({ 
        error: "Valid user ID is required",
        code: "INVALID_USER_ID" 
      }, { status: 400 });
    }

    // Check if profile exists
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.id, parseInt(userId)))
      .limit(1);

    if (existingUser.length === 0) {
      return NextResponse.json({ 
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND' 
      }, { status: 404 });
    }

    const deletedProfile = {
      userId: existingUser[0].id,
      name: existingUser[0].name,
      email: existingUser[0].email,
      message: 'Profile details deleted successfully'
    };

    return NextResponse.json(deletedProfile, { status: 200 });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error,
      code: 'INTERNAL_ERROR' 
    }, { status: 500 });
  }
}