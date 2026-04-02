// ══════════════════════════════════════════════
// routes/legalRoutes.js
// All routes for the Legal Help section
// Base path: /api/legal  (registered in server.js)
// ══════════════════════════════════════════════

const express = require('express');
const router  = express.Router();
// Import all controller functions from legalController.js
const {
  getNearbyLawyers,
  getLawyerById,
  addLawyer,
  getNearbyPoliceStations,
  aiChat,
  submitCase,
  getCaseById,
  getAllCases,
  getMyCases
} = require('../controllers/legalController');

const { protect, adminOnly, optionalProtect } = require('../middleware/auth');


// ── LAWYER ROUTES ────────────────────────────────────────────

// GET /api/legal/lawyers
// Params: lat, lng, address, radius, caseType, fee, freeConsult, page, limit
// Public — no login needed to search lawyers
router.get('/lawyers', getNearbyLawyers);

// GET /api/legal/lawyers/:id
// Public — view a single lawyer's profile
router.get('/lawyers/:id', getLawyerById);

// POST /api/legal/lawyers
// Admin only — add a new lawyer to the database
// Protected: must be logged in AND have role = "admin"
router.post('/lawyers', protect, adminOnly, addLawyer);


// ── POLICE STATION ROUTES ────────────────────────────────────

// GET /api/legal/police-stations
// Params: lat, lng  OR  address
// Public — finds nearby stations using Google Maps API
router.get('/police-stations', getNearbyPoliceStations);


// ── AI CHAT ROUTES ───────────────────────────────────────────

// POST /api/legal/ai-chat
// Body: { message: string, history: [{role, content}] }
// Public — no login needed to use AI assistant
router.post('/ai-chat', aiChat);


// ── CASE / FIR ROUTES ────────────────────────────────────────

// GET /api/legal/my-cases — logged-in user's cases (must be before /cases/:id)
router.get('/my-cases', protect, getMyCases);

// POST /api/legal/cases
// Body: { name, phone, email, city, caseType, incidentDate, description, helpType, urgency }
// Public — optional Bearer token links the case to the logged-in user
router.post('/cases', optionalProtect, submitCase);

// GET /api/legal/cases/:id
// Public — user can check their case status if they have the ID
router.get('/cases/:id', getCaseById);

// GET /api/legal/cases
// Admin only — view all submitted cases with filters
router.get('/cases', protect, adminOnly, getAllCases);

module.exports = router;