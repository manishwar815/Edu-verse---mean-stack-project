import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INotice extends Document {
  title: string;
  content: string;
  department: string;
  year: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const noticeSchema = new Schema<INotice>({
  title: { type: String, required: true },
  content: { type: String, required: true },
  department: { type: String, required: true },
  year: { type: String, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export const Notice: Model<INotice> = mongoose.models.Notice || mongoose.model<INotice>('Notice', noticeSchema);