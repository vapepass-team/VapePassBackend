import mongoose from 'mongoose';
import { CONTACT_LEAD_STATUS } from '../utils/constants.js';

const contactLeadSchema = new mongoose.Schema(
  {
    storeName: {
      type: String,
      required: [true, 'Store name is required'],
      trim: true,
      maxlength: [120, 'Store name cannot exceed 120 characters'],
    },
    ownerName: {
      type: String,
      required: [true, "Owner's name is required"],
      trim: true,
      maxlength: [120, "Owner's name cannot exceed 120 characters"],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      maxlength: [254, 'Email cannot exceed 254 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      maxlength: [40, 'Phone number cannot exceed 40 characters'],
    },
    startDate: {
      type: Date,
      default: null,
    },
    message: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },
    status: {
      type: String,
      enum: Object.values(CONTACT_LEAD_STATUS),
      default: CONTACT_LEAD_STATUS.NEW,
      index: true,
    },
    source: {
      type: String,
      default: 'pricing',
      trim: true,
      maxlength: [40],
    },
    customerEmailSentAt: {
      type: Date,
      default: null,
    },
    adminEmailSentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

contactLeadSchema.index({ email: 1, createdAt: -1 });
contactLeadSchema.index({ phone: 1, createdAt: -1 });
contactLeadSchema.index({ status: 1, createdAt: -1 });

const ContactLead = mongoose.model('ContactLead', contactLeadSchema);

export default ContactLead;
