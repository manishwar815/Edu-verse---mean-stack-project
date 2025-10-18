import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/db/mongodb';
import { FeePayment } from '@/db/models/FeePayment';
import jwt from 'jsonwebtoken';

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

async function verifyToken(request: NextRequest): Promise<JWTPayload | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      console.error('JWT_SECRET not configured');
      return null;
    }

    const payload = jwt.verify(token, jwtSecret) as JWTPayload;
    return payload;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED' },
        { status: 401 }
      );
    }

    // Connect to MongoDB
    await connectDB();

    // Parse request body
    const body = await request.json();
    const { feeId, transactionId, amount } = body;

    // Validate required fields
    if (!feeId) {
      return NextResponse.json(
        { error: 'Fee ID is required', code: 'MISSING_FEE_ID' },
        { status: 400 }
      );
    }

    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required', code: 'MISSING_TRANSACTION_ID' },
        { status: 400 }
      );
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid amount is required', code: 'INVALID_AMOUNT' },
        { status: 400 }
      );
    }

    // Check if transactionId already exists
    const existingTransaction = await FeePayment.findOne({ transactionId });
    if (existingTransaction) {
      return NextResponse.json(
        { error: 'Transaction ID already exists', code: 'DUPLICATE_TRANSACTION_ID' },
        { status: 409 }
      );
    }

    // Find fee record and validate
    const feeRecord = await FeePayment.findById(feeId);

    if (!feeRecord) {
      return NextResponse.json(
        { error: 'Fee record not found', code: 'FEE_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Validate fee belongs to authenticated user
    if (feeRecord.userId.toString() !== user.userId) {
      return NextResponse.json(
        { error: 'Fee record not found', code: 'FEE_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Validate fee status is pending
    if (feeRecord.status !== 'pending') {
      return NextResponse.json(
        { error: 'Fee has already been paid', code: 'ALREADY_PAID' },
        { status: 400 }
      );
    }

    // Validate amount matches
    if (feeRecord.amount !== amount) {
      return NextResponse.json(
        { error: 'Amount does not match fee record', code: 'AMOUNT_MISMATCH' },
        { status: 400 }
      );
    }

    // Update fee record
    const currentDate = new Date().toISOString();
    feeRecord.status = 'paid';
    feeRecord.paidDate = currentDate;
    feeRecord.transactionId = transactionId;
    feeRecord.updatedAt = currentDate;

    await feeRecord.save();

    // Return success response with transaction details
    return NextResponse.json(
      {
        success: true,
        message: 'Payment recorded successfully',
        transaction: {
          id: feeRecord._id,
          feeId: feeRecord._id,
          transactionId: feeRecord.transactionId,
          amount: feeRecord.amount,
          status: feeRecord.status,
          paidDate: feeRecord.paidDate,
          updatedAt: feeRecord.updatedAt
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}