import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/db/mongodb';
import { FeePayment } from '@/db/models/FeePayment';
import jwt from 'jsonwebtoken';

interface JWTPayload {
  userId: string;
  [key: string]: any;
}

async function verifyToken(request: NextRequest): Promise<string | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded.userId;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const userId = await verifyToken(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Connect to MongoDB
    await connectDB();

    // Extract query parameters
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transactionId');
    const semester = searchParams.get('semester');
    const paidDateFrom = searchParams.get('paidDateFrom');
    const paidDateTo = searchParams.get('paidDateTo');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query filters
    const filters: any = {
      userId: userId,
      status: 'paid'
    };

    // Filter by transactionId if provided
    if (transactionId) {
      filters.transactionId = transactionId;
    }

    // Filter by semester if provided
    if (semester) {
      filters.semester = semester;
    }

    // Filter by date range if provided
    if (paidDateFrom || paidDateTo) {
      filters.paidDate = {};
      
      if (paidDateFrom) {
        filters.paidDate.$gte = new Date(paidDateFrom);
      }
      
      if (paidDateTo) {
        filters.paidDate.$lte = new Date(paidDateTo);
      }
    }

    // Execute query with pagination and sorting
    const transactions = await FeePayment.find(filters)
      .sort({ paidDate: -1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();

    // Transform MongoDB documents to clean response format
    const formattedTransactions = transactions.map(transaction => ({
      id: transaction._id.toString(),
      userId: transaction.userId,
      feeType: transaction.feeType,
      amount: transaction.amount,
      semester: transaction.semester,
      academicYear: transaction.academicYear,
      status: transaction.status,
      transactionId: transaction.transactionId,
      paidDate: transaction.paidDate,
      paymentMethod: transaction.paymentMethod,
      receiptUrl: transaction.receiptUrl,
      description: transaction.description,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt
    }));

    return NextResponse.json(formattedTransactions, { status: 200 });

  } catch (error) {
    console.error('GET payment history error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error'),
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}