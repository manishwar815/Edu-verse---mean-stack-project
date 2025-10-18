import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/db/mongodb';
import { Chat } from '@/db/models/Chat';
import { User } from '@/db/models/User';
import jwt from 'jsonwebtoken';

// Helper function to verify JWT token
async function verifyToken(request: NextRequest): Promise<{ userId: string } | null> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    
    return payload;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    // Verify authentication
    const tokenPayload = await verifyToken(request);
    if (!tokenPayload) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const authenticatedUserId = tokenPayload.userId;
    const { conversationId } = params;

    // Validate conversationId
    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required', code: 'MISSING_CONVERSATION_ID' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    await connectDB();

    // Verify conversationId user exists
    const conversationUser = await User.findById(conversationId);
    if (!conversationUser) {
      return NextResponse.json(
        { error: 'Conversation user not found', code: 'INVALID_CONVERSATION_ID' },
        { status: 404 }
      );
    }

    // Get pagination parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Find messages between authenticated user and conversationId
    const messages = await Chat.find({
      $or: [
        { senderId: authenticatedUserId, receiverId: conversationId },
        { senderId: conversationId, receiverId: authenticatedUserId }
      ]
    })
      .populate('senderId', 'name email')
      .populate('receiverId', 'name email')
      .sort({ timestamp: 1 })
      .skip(offset)
      .limit(limit)
      .lean();

    // If no messages found
    if (messages.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    // Mark messages as read where authenticated user is the receiver
    const messageIdsToMarkRead = messages
      .filter(
        (msg: any) => 
          msg.receiverId._id.toString() === authenticatedUserId && 
          !msg.isRead
      )
      .map((msg: any) => msg._id);

    if (messageIdsToMarkRead.length > 0) {
      await Chat.updateMany(
        { _id: { $in: messageIdsToMarkRead } },
        { $set: { isRead: true } }
      );
    }

    // Format response
    const formattedMessages = messages.map((msg: any) => ({
      id: msg._id.toString(),
      content: msg.message,
      sender: {
        id: msg.senderId._id.toString(),
        name: msg.senderId.name,
        email: msg.senderId.email
      },
      receiver: {
        id: msg.receiverId._id.toString(),
        name: msg.receiverId.name,
        email: msg.receiverId.email
      },
      timestamp: msg.timestamp,
      isRead: msg.receiverId._id.toString() === authenticatedUserId ? true : msg.isRead,
      attachments: msg.attachments || []
    }));

    return NextResponse.json(formattedMessages, { status: 200 });

  } catch (error) {
    console.error('GET messages error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}