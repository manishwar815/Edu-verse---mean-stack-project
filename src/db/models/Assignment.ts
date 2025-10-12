import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAssignment extends Document {
  title: string;
  description: string;
  fileUrl?: string | null;
  dueDate: string;
  department: string;
  year: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const assignmentSchema = new Schema<IAssignment>({
  title: { type: String, required: true },
  description: { type: String, required: true },
  fileUrl: { type: String },
  dueDate: { type: String, required: true },
  department: { type: String, required: true },
  year: { type: String, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export const Assignment: Model<IAssignment> = mongoose.models.Assignment || mongoose.model<IAssignment>('Assignment', assignmentSchema);