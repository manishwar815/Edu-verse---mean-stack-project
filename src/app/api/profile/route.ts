import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/db/mongodb';
import { ProfileDetails } from '@/db/models/ProfileDetails';
import { User } from '@/db/models/User';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

async function authenticateRequest(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    return {
      userId: decoded.userId,
      role: decoded.role
    };
  } catch (error) {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('userId');

    let targetUserId = auth.userId;

    // If requesting another user's profile, check authorization
    if (requestedUserId && requestedUserId !== auth.userId) {
      if (auth.role !== 'admin' && auth.role !== 'faculty') {
        return NextResponse.json({ 
          error: 'Not authorized to view other profiles',
          code: 'FORBIDDEN'
        }, { status: 403 });
      }
      targetUserId = requestedUserId;
    }

    // Get user details
    const user = await User.findById(targetUserId).select('-password');
    if (!user) {
      return NextResponse.json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      }, { status: 404 });
    }

    // Get profile details
    const profileDetails = await ProfileDetails.findOne({ userId: targetUserId });

    // Merge user and profile data
    const completeProfile = {
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      createdAt: user.createdAt,
      // Profile details (if exist)
      ...(profileDetails && {
        gender: profileDetails.gender,
        dateOfBirth: profileDetails.dateOfBirth,
        mobile: profileDetails.mobile,
        fatherName: profileDetails.fatherName,
        motherName: profileDetails.motherName,
        parentMobile: profileDetails.parentMobile,
        bloodGroup: profileDetails.bloodGroup,
        rollNumber: profileDetails.rollNumber,
        admissionNumber: profileDetails.admissionNumber,
        batch: profileDetails.batch,
        degree: profileDetails.degree,
        programCode: profileDetails.programCode,
        semesterNumber: profileDetails.semesterNumber,
        section: profileDetails.section,
        profileImage: profileDetails.profileImage,
        profileDetailsCreatedAt: profileDetails.createdAt,
        profileDetailsUpdatedAt: profileDetails.updatedAt
      })
    };

    return NextResponse.json(completeProfile, { status: 200 });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      }, { status: 401 });
    }

    const body = await request.json();

    // Security check: reject if userId provided in body
    if ('userId' in body || 'user_id' in body) {
      return NextResponse.json({ 
        error: 'User ID cannot be provided in request body',
        code: 'USER_ID_NOT_ALLOWED'
      }, { status: 400 });
    }

    // Check if profile already exists
    const existingProfile = await ProfileDetails.findOne({ userId: auth.userId });
    if (existingProfile) {
      return NextResponse.json({ 
        error: 'Profile details already exist for this user',
        code: 'PROFILE_ALREADY_EXISTS'
      }, { status: 400 });
    }

    // Validate gender if provided
    if (body.gender && !['male', 'female', 'other'].includes(body.gender)) {
      return NextResponse.json({ 
        error: 'Gender must be male, female, or other',
        code: 'INVALID_GENDER'
      }, { status: 400 });
    }

    // Validate dateOfBirth if provided
    if (body.dateOfBirth) {
      const date = new Date(body.dateOfBirth);
      if (isNaN(date.getTime())) {
        return NextResponse.json({ 
          error: 'Invalid date of birth',
          code: 'INVALID_DATE_OF_BIRTH'
        }, { status: 400 });
      }
    }

    // Validate semesterNumber if provided
    if (body.semesterNumber !== undefined) {
      const semester = parseInt(body.semesterNumber);
      if (isNaN(semester) || semester < 1) {
        return NextResponse.json({ 
          error: 'Semester number must be a positive number',
          code: 'INVALID_SEMESTER_NUMBER'
        }, { status: 400 });
      }
    }

    // Check rollNumber uniqueness if provided
    if (body.rollNumber) {
      const existingRollNumber = await ProfileDetails.findOne({ 
        rollNumber: body.rollNumber 
      });
      if (existingRollNumber) {
        return NextResponse.json({ 
          error: 'Roll number already exists',
          code: 'DUPLICATE_ROLL_NUMBER'
        }, { status: 409 });
      }
    }

    // Check admissionNumber uniqueness if provided
    if (body.admissionNumber) {
      const existingAdmissionNumber = await ProfileDetails.findOne({ 
        admissionNumber: body.admissionNumber 
      });
      if (existingAdmissionNumber) {
        return NextResponse.json({ 
          error: 'Admission number already exists',
          code: 'DUPLICATE_ADMISSION_NUMBER'
        }, { status: 409 });
      }
    }

    // Create profile details
    const profileData = {
      userId: auth.userId,
      gender: body.gender,
      dateOfBirth: body.dateOfBirth,
      mobile: body.mobile,
      fatherName: body.fatherName,
      motherName: body.motherName,
      parentMobile: body.parentMobile,
      bloodGroup: body.bloodGroup,
      rollNumber: body.rollNumber,
      admissionNumber: body.admissionNumber,
      batch: body.batch,
      degree: body.degree,
      programCode: body.programCode,
      semesterNumber: body.semesterNumber,
      section: body.section,
      profileImage: body.profileImage,
      createdAt: new Date()
    };

    const newProfile = await ProfileDetails.create(profileData);

    // Get user details to merge
    const user = await User.findById(auth.userId).select('-password');

    const completeProfile = {
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      gender: newProfile.gender,
      dateOfBirth: newProfile.dateOfBirth,
      mobile: newProfile.mobile,
      fatherName: newProfile.fatherName,
      motherName: newProfile.motherName,
      parentMobile: newProfile.parentMobile,
      bloodGroup: newProfile.bloodGroup,
      rollNumber: newProfile.rollNumber,
      admissionNumber: newProfile.admissionNumber,
      batch: newProfile.batch,
      degree: newProfile.degree,
      programCode: newProfile.programCode,
      semesterNumber: newProfile.semesterNumber,
      section: newProfile.section,
      profileImage: newProfile.profileImage,
      createdAt: newProfile.createdAt
    };

    return NextResponse.json(completeProfile, { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await connectDB();

    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      }, { status: 401 });
    }

    const body = await request.json();

    // Security check: reject if userId provided in body
    if ('userId' in body || 'user_id' in body) {
      return NextResponse.json({ 
        error: 'User ID cannot be provided in request body',
        code: 'USER_ID_NOT_ALLOWED'
      }, { status: 400 });
    }

    // Check if profile exists
    const existingProfile = await ProfileDetails.findOne({ userId: auth.userId });
    if (!existingProfile) {
      return NextResponse.json({ 
        error: 'Profile details not found',
        code: 'PROFILE_NOT_FOUND'
      }, { status: 404 });
    }

    // Validate gender if provided
    if (body.gender && !['male', 'female', 'other'].includes(body.gender)) {
      return NextResponse.json({ 
        error: 'Gender must be male, female, or other',
        code: 'INVALID_GENDER'
      }, { status: 400 });
    }

    // Validate dateOfBirth if provided
    if (body.dateOfBirth) {
      const date = new Date(body.dateOfBirth);
      if (isNaN(date.getTime())) {
        return NextResponse.json({ 
          error: 'Invalid date of birth',
          code: 'INVALID_DATE_OF_BIRTH'
        }, { status: 400 });
      }
    }

    // Validate semesterNumber if provided
    if (body.semesterNumber !== undefined) {
      const semester = parseInt(body.semesterNumber);
      if (isNaN(semester) || semester < 1) {
        return NextResponse.json({ 
          error: 'Semester number must be a positive number',
          code: 'INVALID_SEMESTER_NUMBER'
        }, { status: 400 });
      }
    }

    // Check rollNumber uniqueness if changed
    if (body.rollNumber && body.rollNumber !== existingProfile.rollNumber) {
      const duplicateRollNumber = await ProfileDetails.findOne({ 
        rollNumber: body.rollNumber,
        userId: { $ne: auth.userId }
      });
      if (duplicateRollNumber) {
        return NextResponse.json({ 
          error: 'Roll number already exists',
          code: 'DUPLICATE_ROLL_NUMBER'
        }, { status: 409 });
      }
    }

    // Check admissionNumber uniqueness if changed
    if (body.admissionNumber && body.admissionNumber !== existingProfile.admissionNumber) {
      const duplicateAdmissionNumber = await ProfileDetails.findOne({ 
        admissionNumber: body.admissionNumber,
        userId: { $ne: auth.userId }
      });
      if (duplicateAdmissionNumber) {
        return NextResponse.json({ 
          error: 'Admission number already exists',
          code: 'DUPLICATE_ADMISSION_NUMBER'
        }, { status: 409 });
      }
    }

    // Update profile
    const updateData = {
      ...body,
      updatedAt: new Date()
    };

    const updatedProfile = await ProfileDetails.findOneAndUpdate(
      { userId: auth.userId },
      updateData,
      { new: true }
    );

    // Get user details to merge
    const user = await User.findById(auth.userId).select('-password');

    const completeProfile = {
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      gender: updatedProfile.gender,
      dateOfBirth: updatedProfile.dateOfBirth,
      mobile: updatedProfile.mobile,
      fatherName: updatedProfile.fatherName,
      motherName: updatedProfile.motherName,
      parentMobile: updatedProfile.parentMobile,
      bloodGroup: updatedProfile.bloodGroup,
      rollNumber: updatedProfile.rollNumber,
      admissionNumber: updatedProfile.admissionNumber,
      batch: updatedProfile.batch,
      degree: updatedProfile.degree,
      programCode: updatedProfile.programCode,
      semesterNumber: updatedProfile.semesterNumber,
      section: updatedProfile.section,
      profileImage: updatedProfile.profileImage,
      createdAt: updatedProfile.createdAt,
      updatedAt: updatedProfile.updatedAt
    };

    return NextResponse.json(completeProfile, { status: 200 });
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await connectDB();

    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      }, { status: 401 });
    }

    // Check if profile exists
    const existingProfile = await ProfileDetails.findOne({ userId: auth.userId });
    if (!existingProfile) {
      return NextResponse.json({ 
        error: 'Profile details not found',
        code: 'PROFILE_NOT_FOUND'
      }, { status: 404 });
    }

    // Delete profile details (not user account)
    await ProfileDetails.findOneAndDelete({ userId: auth.userId });

    return NextResponse.json({ 
      message: 'Profile details deleted successfully',
      deletedProfile: {
        userId: existingProfile.userId,
        rollNumber: existingProfile.rollNumber,
        admissionNumber: existingProfile.admissionNumber
      }
    }, { status: 200 });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}