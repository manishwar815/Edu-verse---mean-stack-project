import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/db/mongodb';
import { Exam } from '@/db/models/Exam';
import { User } from '@/db/models/User';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface JWTPayload {
  userId: string;
  role?: string;
}

async function authenticateRequest(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    if (!decoded.userId) {
      return null;
    }

    return { userId: decoded.userId, role: decoded.role || 'student' };
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
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const semester = searchParams.get('semester');

    if (id) {
      const exam = await Exam.findById(id).populate('userId', 'name email role department');
      
      if (!exam) {
        return NextResponse.json({ 
          error: 'Exam record not found',
          code: 'NOT_FOUND' 
        }, { status: 404 });
      }

      if (exam.userId._id.toString() !== auth.userId && auth.role !== 'admin' && auth.role !== 'faculty') {
        return NextResponse.json({ 
          error: 'Access denied',
          code: 'FORBIDDEN' 
        }, { status: 403 });
      }

      return NextResponse.json(exam);
    }

    let query: any = { userId: auth.userId };
    
    if (semester) {
      query.semester = semester;
    }

    const exams = await Exam.find(query)
      .populate('userId', 'name email role department')
      .sort({ semester: -1 });

    return NextResponse.json(exams);
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
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    const body = await request.json();
    const { userId, semester, cgpa, sgpa, subjects } = body;

    if (!userId || !semester || cgpa === undefined || sgpa === undefined || !subjects) {
      return NextResponse.json({ 
        error: 'Missing required fields: userId, semester, cgpa, sgpa, subjects are required',
        code: 'MISSING_REQUIRED_FIELDS' 
      }, { status: 400 });
    }

    if (userId !== auth.userId && auth.role !== 'admin' && auth.role !== 'faculty') {
      return NextResponse.json({ 
        error: 'Access denied: Cannot create exam record for another user',
        code: 'FORBIDDEN' 
      }, { status: 403 });
    }

    if (typeof cgpa !== 'number' || cgpa < 0 || cgpa > 10) {
      return NextResponse.json({ 
        error: 'CGPA must be a number between 0 and 10',
        code: 'INVALID_CGPA' 
      }, { status: 400 });
    }

    if (typeof sgpa !== 'number' || sgpa < 0 || sgpa > 10) {
      return NextResponse.json({ 
        error: 'SGPA must be a number between 0 and 10',
        code: 'INVALID_SGPA' 
      }, { status: 400 });
    }

    if (!Array.isArray(subjects) || subjects.length === 0) {
      return NextResponse.json({ 
        error: 'Subjects must be a non-empty array',
        code: 'INVALID_SUBJECTS' 
      }, { status: 400 });
    }

    for (let i = 0; i < subjects.length; i++) {
      const subject = subjects[i];
      
      if (!subject.subject || typeof subject.subject !== 'string' || subject.subject.trim() === '') {
        return NextResponse.json({ 
          error: `Subject name is required for subject at index ${i}`,
          code: 'INVALID_SUBJECT_NAME' 
        }, { status: 400 });
      }

      if (!subject.grade || typeof subject.grade !== 'string' || subject.grade.trim() === '') {
        return NextResponse.json({ 
          error: `Grade is required for subject at index ${i}`,
          code: 'INVALID_GRADE' 
        }, { status: 400 });
      }

      if (typeof subject.credits !== 'number' || subject.credits <= 0) {
        return NextResponse.json({ 
          error: `Credits must be a positive number for subject at index ${i}`,
          code: 'INVALID_CREDITS' 
        }, { status: 400 });
      }
    }

    const userExists = await User.findById(userId);
    if (!userExists) {
      return NextResponse.json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND' 
      }, { status: 400 });
    }

    const newExam = new Exam({
      userId,
      semester: semester.trim(),
      cgpa,
      sgpa,
      subjects: subjects.map(s => ({
        subject: s.subject.trim(),
        grade: s.grade.trim(),
        credits: s.credits
      })),
      createdAt: new Date().toISOString()
    });

    await newExam.save();
    
    const populatedExam = await Exam.findById(newExam._id).populate('userId', 'name email role department');

    return NextResponse.json(populatedExam, { status: 201 });
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
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ 
        error: 'Exam ID is required',
        code: 'MISSING_ID' 
      }, { status: 400 });
    }

    const exam = await Exam.findById(id);
    
    if (!exam) {
      return NextResponse.json({ 
        error: 'Exam record not found',
        code: 'NOT_FOUND' 
      }, { status: 404 });
    }

    if (exam.userId.toString() !== auth.userId && auth.role !== 'admin' && auth.role !== 'faculty') {
      return NextResponse.json({ 
        error: 'Access denied',
        code: 'FORBIDDEN' 
      }, { status: 403 });
    }

    const body = await request.json();
    const updates: any = { updatedAt: new Date().toISOString() };

    if (body.semester !== undefined) {
      if (typeof body.semester !== 'string' || body.semester.trim() === '') {
        return NextResponse.json({ 
          error: 'Semester must be a non-empty string',
          code: 'INVALID_SEMESTER' 
        }, { status: 400 });
      }
      updates.semester = body.semester.trim();
    }

    if (body.cgpa !== undefined) {
      if (typeof body.cgpa !== 'number' || body.cgpa < 0 || body.cgpa > 10) {
        return NextResponse.json({ 
          error: 'CGPA must be a number between 0 and 10',
          code: 'INVALID_CGPA' 
        }, { status: 400 });
      }
      updates.cgpa = body.cgpa;
    }

    if (body.sgpa !== undefined) {
      if (typeof body.sgpa !== 'number' || body.sgpa < 0 || body.sgpa > 10) {
        return NextResponse.json({ 
          error: 'SGPA must be a number between 0 and 10',
          code: 'INVALID_SGPA' 
        }, { status: 400 });
      }
      updates.sgpa = body.sgpa;
    }

    if (body.subjects !== undefined) {
      if (!Array.isArray(body.subjects) || body.subjects.length === 0) {
        return NextResponse.json({ 
          error: 'Subjects must be a non-empty array',
          code: 'INVALID_SUBJECTS' 
        }, { status: 400 });
      }

      for (let i = 0; i < body.subjects.length; i++) {
        const subject = body.subjects[i];
        
        if (!subject.subject || typeof subject.subject !== 'string' || subject.subject.trim() === '') {
          return NextResponse.json({ 
            error: `Subject name is required for subject at index ${i}`,
            code: 'INVALID_SUBJECT_NAME' 
          }, { status: 400 });
        }

        if (!subject.grade || typeof subject.grade !== 'string' || subject.grade.trim() === '') {
          return NextResponse.json({ 
            error: `Grade is required for subject at index ${i}`,
            code: 'INVALID_GRADE' 
          }, { status: 400 });
        }

        if (typeof subject.credits !== 'number' || subject.credits <= 0) {
          return NextResponse.json({ 
            error: `Credits must be a positive number for subject at index ${i}`,
            code: 'INVALID_CREDITS' 
          }, { status: 400 });
        }
      }

      updates.subjects = body.subjects.map((s: any) => ({
        subject: s.subject.trim(),
        grade: s.grade.trim(),
        credits: s.credits
      }));
    }

    const updatedExam = await Exam.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    ).populate('userId', 'name email role department');

    return NextResponse.json(updatedExam);
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
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ 
        error: 'Exam ID is required',
        code: 'MISSING_ID' 
      }, { status: 400 });
    }

    const exam = await Exam.findById(id);
    
    if (!exam) {
      return NextResponse.json({ 
        error: 'Exam record not found',
        code: 'NOT_FOUND' 
      }, { status: 404 });
    }

    if (exam.userId.toString() !== auth.userId && auth.role !== 'admin' && auth.role !== 'faculty') {
      return NextResponse.json({ 
        error: 'Access denied',
        code: 'FORBIDDEN' 
      }, { status: 403 });
    }

    const deletedExam = await Exam.findByIdAndDelete(id).populate('userId', 'name email role department');

    return NextResponse.json({
      message: 'Exam record deleted successfully',
      exam: deletedExam
    });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}