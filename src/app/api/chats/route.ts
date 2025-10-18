import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { connectDB } from '@/db/mongodb';
import { Chat } from '@/db/models/Chat';
import { User } from '@/db/models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

async function authenticateUser(request: NextRequest): Promise<string | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded.userId;
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await authenticateUser(request);
    if (!userId) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get all messages where user is sender or receiver
    const userMessages = await Chat.find({
      $or: [
        { senderId: userId },
        { receiverId: userId }
      ]
    }).populate('senderId', 'name email')
      .populate('receiverId', 'name email')
      .sort({ timestamp: -1 });

    // Group messages by conversation
    const conversationsMap = new Map();

    for (const message of userMessages) {
      const otherUserId = message.senderId._id.toString() === userId 
        ? message.receiverId._id.toString() 
        : message.senderId._id.toString();

      if (!conversationsMap.has(otherUserId)) {
        const otherUser = message.senderId._id.toString() === userId 
          ? message.receiverId 
          : message.senderId;

        // Count unread messages for authenticated user
        const unreadCount = await Chat.countDocuments({
          senderId: otherUserId,
          receiverId: userId,
          isRead: false
        });

        conversationsMap.set(otherUserId, {
          otherUser: {
            id: otherUser._id,
            name: otherUser.name,
            email: otherUser.email
          },
          lastMessage: {
            id: message._id,
            message: message.message,
            timestamp: message.timestamp,
            isRead: message.isRead,
            senderId: message.senderId._id,
            receiverId: message.receiverId._id,
            attachments: message.attachments
          },
          unreadCount,
          latestTimestamp: message.timestamp
        });
      }
    }

    // Convert map to array and sort by latest timestamp
    const conversations = Array.from(conversationsMap.values())
      .sort((a, b) => new Date(b.latestTimestamp).getTime() - new Date(a.latestTimestamp).getTime())
      .slice(offset, offset + limit);

    return NextResponse.json(conversations, { status: 200 });

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await authenticateUser(request);
    if (!userId) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    await connectDB();

    const body = await request.json();

    // Security check: reject if senderId provided in body
    if ('senderId' in body || 'sender_id' in body) {
      return NextResponse.json({ 
        error: "Sender ID cannot be provided in request body",
        code: "SENDER_ID_NOT_ALLOWED" 
      }, { status: 400 });
    }

    const { receiverId, message, attachments } = body;

    // Validate required fields
    if (!receiverId) {
      return NextResponse.json({ 
        error: "Receiver ID is required",
        code: "MISSING_RECEIVER_ID" 
      }, { status: 400 });
    }

    if (!message || message.trim() === '') {
      return NextResponse.json({ 
        error: "Message is required",
        code: "MISSING_MESSAGE" 
      }, { status: 400 });
    }

    // Validate receiver exists
    const receiverExists = await User.findById(receiverId);
    if (!receiverExists) {
      return NextResponse.json({ 
        error: "Receiver not found",
        code: "RECEIVER_NOT_FOUND" 
      }, { status: 404 });
    }

    // Validate user is not sending message to themselves
    if (receiverId === userId) {
      return NextResponse.json({ 
        error: "Cannot send message to yourself",
        code: "INVALID_RECEIVER" 
      }, { status: 400 });
    }

    // Create new chat message
    const newMessage = new Chat({
      senderId: userId,
      receiverId: receiverId.trim(),
      message: message.trim(),
      timestamp: new Date(),
      isRead: false,
      attachments: attachments || [],
      createdAt: new Date()
    });

    await newMessage.save();

    // Populate user details before returning
    const populatedMessage = await Chat.findById(newMessage._id)
      .populate('senderId', 'name email')
      .populate('receiverId', 'name email');

    return NextResponse.json(populatedMessage, { status: 201 });

  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await authenticateUser(request);
    if (!userId) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ 
        error: "Message ID is required",
        code: "MISSING_ID" 
      }, { status: 400 });
    }

    // Find the message
    const message = await Chat.findById(id);

    if (!message) {
      return NextResponse.json({ 
        error: 'Message not found',
        code: 'MESSAGE_NOT_FOUND' 
      }, { status: 404 });
    }

    // Validate authenticated user is the receiver
    if (message.receiverId.toString() !== userId) {
      return NextResponse.json({ 
        error: 'You are not authorized to mark this message as read',
        code: 'FORBIDDEN' 
      }, { status: 403 });
    }

    // Update message as read
    message.isRead = true;
    message.updatedAt = new Date();
    await message.save();

    // Populate user details
    const updatedMessage = await Chat.findById(message._id)
      .populate('senderId', 'name email')
      .populate('receiverId', 'name email');

    return NextResponse.json(updatedMessage, { status: 200 });

  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await authenticateUser(request);
    if (!userId) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ 
        error: "Message ID is required",
        code: "MISSING_ID" 
      }, { status: 400 });
    }

    // Find the message
    const message = await Chat.findById(id)
      .populate('senderId', 'name email')
      .populate('receiverId', 'name email');

    if (!message) {
      return NextResponse.json({ 
        error: 'Message not found',
        code: 'MESSAGE_NOT_FOUND' 
      }, { status: 404 });
    }

    // Validate authenticated user is sender or receiver
    if (message.senderId._id.toString() !== userId && message.receiverId._id.toString() !== userId) {
      return NextResponse.json({ 
        error: 'You are not authorized to delete this message',
        code: 'FORBIDDEN' 
      }, { status: 403 });
    }

    // Delete the message
    await Chat.findByIdAndDelete(id);

    return NextResponse.json({ 
      message: 'Message deleted successfully',
      deletedMessage: message 
    }, { status: 200 });

  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}