import mongoose, { Schema, Document, Model } from 'mongoose';

// TypeScript interface for FeePayment document
export interface IFeePayment extends Document {
  userId: string;
  amount: number;
  dueDate: Date;
  paidDate?: Date;
  status: 'pending' | 'paid';
  semester: string;
  description: string;
  transactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// FeePayment Schema
const FeePaymentSchema = new Schema<IFeePayment>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount must be a positive number'],
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    paidDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      required: [true, 'Status is required'],
      enum: {
        values: ['pending', 'paid'],
        message: 'Status must be either pending or paid',
      },
      default: 'pending',
      index: true,
    },
    semester: {
      type: String,
      required: [true, 'Semester is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'feepayments',
  }
);

// Compound indexes for common queries
FeePaymentSchema.index({ userId: 1, status: 1 });
FeePaymentSchema.index({ userId: 1, dueDate: 1 });
FeePaymentSchema.index({ userId: 1, semester: 1 });

// Pre-save middleware to set paidDate when status changes to paid
FeePaymentSchema.pre('save', function (next) {
  if (this.isModified('status') && this.status === 'paid' && !this.paidDate) {
    this.paidDate = new Date();
  }
  next();
});

// Export the model
export const FeePayment: Model<IFeePayment> = 
  mongoose.models.FeePayment || mongoose.model<IFeePayment>('FeePayment', FeePaymentSchema);