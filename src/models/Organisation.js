const mongoose = require('mongoose');
const crypto = require('crypto');

const organisationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Organisation name is required'],
      trim: true,
      maxlength: [120, 'Name cannot exceed 120 characters'],
    },
    inviteCode: {
      type: String,
      unique: true,
      default: () => crypto.randomBytes(3).toString('hex').toUpperCase(), // e.g. "A3F9C2"
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Organisation', organisationSchema);
