// ══════════════════════════════════════════════
// models/Professional.js
// Stores lawyer/paralegal profiles with geolocation
// Used by: legalController.js → getNearbyLawyers, addLawyer
// ══════════════════════════════════════════════

const mongoose = require('mongoose');

const ProfessionalSchema = new mongoose.Schema({

  // ── Basic Info ──────────────────────────────
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true
  },

  // type: what kind of legal professional
  type: {
    type: String,
    enum: ['lawyer', 'paralegal', 'legal_aid'],
    default: 'lawyer'
  },

  // ── Specializations ─────────────────────────
  // Array so one lawyer can handle multiple case types
  // These values must match the caseType values sent from frontend
  specializations: [{
    type: String,
    enum: [
      'criminal',
      'family',
      'property',
      'consumer',
      'labour',
      'cyber',
      'immigration',
      'civil',
      'constitutional',
      'tax',
      'corporate'
    ]
  }],

  // Bar Council registration ID (optional but unique if present)
  barCouncilId: {
    type: String,
    unique: true,
    sparse: true   // sparse: allows multiple documents to have null
  },

  experience: {
    type: Number,
    default: 0   // years of experience
  },

  // ── Fees ────────────────────────────────────
  feePerHour: {
    type: Number,
    required: true  // fee in INR per hour
  },

  // feeStructure: how the lawyer charges
  feeStructure: {
    type: String,
    enum: ['fixed', 'sliding_scale', 'free_consult', 'no_win_no_fee'],
    default: 'fixed'
  },

  freeConsultation: {
    type: Boolean,
    default: false  // true = first consultation is free
  },

  languages: [{ type: String }],  // e.g. ['Hindi', 'English']

  // ── Location ────────────────────────────────
  // MongoDB needs GeoJSON format for $near queries
  location: {
    address:  { type: String },
    city:     { type: String },
    state:    { type: String },
    pincode:  { type: String },

    // GeoJSON Point — coordinates must be [longitude, latitude] (lng first!)
    coordinates: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [77.4538, 28.6692] }
      // Default: Ghaziabad, UP  →  [lng, lat]
    }
  },

  // ── Ratings ─────────────────────────────────
  rating:       { type: Number, default: 0, min: 0, max: 5 },
  totalReviews: { type: Number, default: 0 },

  // ── Profile ─────────────────────────────────
  profilePhoto: { type: String },  // URL to photo
  bio:          { type: String },
  verified:     { type: Boolean, default: false },  // manually verified by admin
  available:    { type: Boolean, default: true },   // shows up in search only if true

  createdAt: { type: Date, default: Date.now }
});

// ── Indexes ─────────────────────────────────────
// 2dsphere index is REQUIRED for $near geospatial queries to work
ProfessionalSchema.index({ 'location.coordinates': '2dsphere' });

// Compound index for common filter combinations
ProfessionalSchema.index({ specializations: 1, feePerHour: 1, rating: -1 });

module.exports = mongoose.model('Professional', ProfessionalSchema);