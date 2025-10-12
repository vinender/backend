//@ts-nocheck
import mongoose, { Document, Schema } from 'mongoose'

export interface IContactQuery extends Document {
  name: string
  email: string
  phone?: string
  subject: string
  message: string
  status: 'new' | 'in-progress' | 'resolved'
  adminNotes?: string
  createdAt: Date
  updatedAt: Date
}

const ContactQuerySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['new', 'in-progress', 'resolved'],
      default: 'new',
    },
    adminNotes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
)

// Index for faster queries
ContactQuerySchema.index({ createdAt: -1 })
ContactQuerySchema.index({ status: 1 })
ContactQuerySchema.index({ email: 1 })

export const ContactQuery = mongoose.model<IContactQuery>('ContactQuery', ContactQuerySchema)
