import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/db/mongodb';
import { FeePayment } from '@/db/models/FeePayment';
import { User } from '@/db/models/User';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface JWTPayload {
  userId: string;
  role: string;
  email: string;
}

async function authenticateRequest(request: NextRequest): Promise<{ user: JWTPayload | null; error: NextResponse | null }> {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Authentication required. Please provide a valid Bearer token.', code: 'MISSING_AUTH_TOKEN' },
          { status: 401 }
        )
      };
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      return { user: decoded, error: null };
    } catch (jwtError) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Invalid or expired authentication token', code: 'INVALID_AUTH_TOKEN' },
          { status: 401 }
        )
      };
    }
  } catch (error) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Authentication error', code: 'AUTH_ERROR' },
        { status: 401 }
      )
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error) return error;
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    await connectDB();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return NextResponse.json(
          { error: 'Invalid ID format', code: 'INVALID_ID' },
          { status: 400 }
        );
      }

      const feeRecord = await FeePayment.findOne({ _id: id, userId: user.userId })
        .populate('userId', 'name email department role')
        .lean();

      if (!feeRecord) {
        return NextResponse.json(
          { error: 'Fee record not found', code: 'RECORD_NOT_FOUND' },
          { status: 404 }
        );
      }

      return NextResponse.json(feeRecord, { status: 200 });
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');
    const semester = searchParams.get('semester');

    const query: any = { userId: user.userId };

    if (status && ['pending', 'paid'].includes(status)) {
      query.status = status;
    }

    if (semester) {
      query.semester = semester;
    }

    const feeRecords = await FeePayment.find(query)
      .populate('userId', 'name email department role')
      .sort({ dueDate: 1 })
      .skip(offset)
      .limit(limit)
      .lean();

    return NextResponse.json(feeRecords, { status: 200 });

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
    const { user, error } = await authenticateRequest(request);
    if (error) return error;
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    await connectDB();

    const body = await request.json();
    const { userId, amount, dueDate, semester, description, status, paidDate, transactionId } = body;

    if (!userId || !amount || !dueDate || !semester || !description) {
      return NextResponse.json(
        { 
          error: 'Missing required fields: userId, amount, dueDate, semester, description are required',
          code: 'MISSING_REQUIRED_FIELDS'
        },
        { status: 400 }
      );
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number', code: 'INVALID_AMOUNT' },
        { status: 400 }
      );
    }

    const dueDateParsed = new Date(dueDate);
    if (isNaN(dueDateParsed.getTime())) {
      return NextResponse.json(
        { error: 'Invalid due date format', code: 'INVALID_DUE_DATE' },
        { status: 400 }
      );
    }

    const userExists = await User.findById(userId);
    if (!userExists) {
      return NextResponse.json(
        { error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 400 }
      );
    }

    if (transactionId) {
      const existingTransaction = await FeePayment.findOne({ transactionId });
      if (existingTransaction) {
        return NextResponse.json(
          { error: 'Transaction ID already exists', code: 'DUPLICATE_TRANSACTION_ID' },
          { status: 400 }
        );
      }
    }

    const feePaymentData: any = {
      userId,
      amount,
      dueDate: dueDateParsed,
      semester: semester.trim(),
      description: description.trim(),
      status: status || 'pending',
      createdAt: new Date()
    };

    if (paidDate) {
      const paidDateParsed = new Date(paidDate);
      if (!isNaN(paidDateParsed.getTime())) {
        feePaymentData.paidDate = paidDateParsed;
      }
    }

    if (transactionId) {
      feePaymentData.transactionId = transactionId.trim();
    }

    const newFeePayment = await FeePayment.create(feePaymentData);
    
    const populatedFeePayment = await FeePayment.findById(newFeePayment._id)
      .populate('userId', 'name email department role')
      .lean();

    return NextResponse.json(populatedFeePayment, { status: 201 });

  } catch (error: any) {
    console.error('POST error:', error);
    
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Duplicate transaction ID', code: 'DUPLICATE_TRANSACTION_ID' },
        { status: 400 }
      );
    }

    if (error.name === 'ValidationError') {
      return NextResponse.json(
        { error: 'Validation error: ' + error.message, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error) return error;
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    await connectDB();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID parameter is required', code: 'MISSING_ID' },
        { status: 400 }
      );
    }

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return NextResponse.json(
        { error: 'Invalid ID format', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const existingRecord = await FeePayment.findOne({ _id: id, userId: user.userId });
    if (!existingRecord) {
      return NextResponse.json(
        { error: 'Fee record not found', code: 'RECORD_NOT_FOUND' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { amount, dueDate, paidDate, status, semester, description, transactionId } = body;

    const updateData: any = {
      updatedAt: new Date()
    };

    if (amount !== undefined) {
      if (typeof amount !== 'number' || amount <= 0) {
        return NextResponse.json(
          { error: 'Amount must be a positive number', code: 'INVALID_AMOUNT' },
          { status: 400 }
        );
      }
      updateData.amount = amount;
    }

    if (dueDate !== undefined) {
      const dueDateParsed = new Date(dueDate);
      if (isNaN(dueDateParsed.getTime())) {
        return NextResponse.json(
          { error: 'Invalid due date format', code: 'INVALID_DUE_DATE' },
          { status: 400 }
        );
      }
      updateData.dueDate = dueDateParsed;
    }

    if (paidDate !== undefined) {
      if (paidDate === null) {
        updateData.paidDate = null;
      } else {
        const paidDateParsed = new Date(paidDate);
        if (isNaN(paidDateParsed.getTime())) {
          return NextResponse.json(
            { error: 'Invalid paid date format', code: 'INVALID_PAID_DATE' },
            { status: 400 }
          );
        }
        updateData.paidDate = paidDateParsed;
      }
    }

    if (status !== undefined) {
      if (!['pending', 'paid'].includes(status)) {
        return NextResponse.json(
          { error: 'Status must be either "pending" or "paid"', code: 'INVALID_STATUS' },
          { status: 400 }
        );
      }
      updateData.status = status;
    }

    if (semester !== undefined) {
      updateData.semester = semester.trim();
    }

    if (description !== undefined) {
      updateData.description = description.trim();
    }

    if (transactionId !== undefined) {
      if (transactionId) {
        const existingTransaction = await FeePayment.findOne({ 
          transactionId: transactionId.trim(),
          _id: { $ne: id }
        });
        if (existingTransaction) {
          return NextResponse.json(
            { error: 'Transaction ID already exists', code: 'DUPLICATE_TRANSACTION_ID' },
            { status: 400 }
          );
        }
        updateData.transactionId = transactionId.trim();
      } else {
        updateData.transactionId = null;
      }
    }

    const updatedRecord = await FeePayment.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('userId', 'name email department role').lean();

    return NextResponse.json(updatedRecord, { status: 200 });

  } catch (error: any) {
    console.error('PUT error:', error);

    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Duplicate transaction ID', code: 'DUPLICATE_TRANSACTION_ID' },
        { status: 400 }
      );
    }

    if (error.name === 'ValidationError') {
      return NextResponse.json(
        { error: 'Validation error: ' + error.message, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error) return error;
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    await connectDB();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID parameter is required', code: 'MISSING_ID' },
        { status: 400 }
      );
    }

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return NextResponse.json(
        { error: 'Invalid ID format', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const deletedRecord = await FeePayment.findOneAndDelete({ 
      _id: id, 
      userId: user.userId 
    }).populate('userId', 'name email department role').lean();

    if (!deletedRecord) {
      return NextResponse.json(
        { error: 'Fee record not found', code: 'RECORD_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: 'Fee record deleted successfully',
        deletedRecord
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}