import mongoose, { Document, Schema } from 'mongoose';

// TypeScript interface for Chat document
export interface IChat extends Document {
  senderId: string;
  receiverId: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  attachments: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Chat schema definition
const ChatSchema = new Schema<IChat>(
  {
    senderId: {
      type: String,
      required: [true, 'Sender ID is required'],
      ref: 'User',
      index: true,
    },
    receiverId: {
      type: String,
      required: [true, 'Receiver ID is required'],
      ref: 'User',
      index: true,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    isRead: {
      type: Boolean,
      required: true,
      default: false,
    },
    attachments: {
      type: [String],
      default: [],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for optimized queries
ChatSchema.index({ senderId: 1, receiverId: 1 });
ChatSchema.index({ senderId: 1, timestamp: -1 });
ChatSchema.index({ receiverId: 1, timestamp: -1 });
ChatSchema.index({ timestamp: -1 });

// Export the Chat model
export const Chat = mongoose.models.Chat || mongoose.model<IChat>('Chat', ChatSchema);