// ══════════════════════════════════════════════
// middleware/auth.js
// JWT authentication middleware
//
// ⚠️  THIS REPLACES YOUR EXISTING middleware/auth.js
//     It adds one new function: adminOnly
//     The "protect" function is IDENTICAL to what you had
//
// Used by:
//   - legalRoutes.js → protect, adminOnly (for admin-only routes)
//   - (your authRoutes don't use middleware — they create the token)
// ══════════════════════════════════════════════

const jwt  = require('jsonwebtoken');
const User = require('../models/User');  // your EXISTING User model — unchanged

/**
 * protect
 * Middleware that checks if the request has a valid JWT token.
 * If valid → attaches user to req.user and calls next()
 * If missing or invalid → returns 401 Unauthorized
 *
 * Usage: router.get('/route', protect, controllerFunction)
 *
 * Frontend must send: Authorization: Bearer <token>
 */
exports.protect = async (req, res, next) => {
  let token;

  // Check Authorization header for "Bearer <token>"
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized — no token' });
  }

  try {
    // Verify token using JWT_SECRET from .env
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the user object to req so controllers can use req.user
    req.user = await User.findById(decoded.id).select('-password');

    next();  // token is valid → proceed to the route handler
  } catch (err) {
    res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

/**
 * optionalProtect
 * If a valid Bearer token is present, sets req.user; otherwise continues without user.
 * Use for routes that work for guests but attach data when logged in (e.g. submit case).
 */
exports.optionalProtect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (user) req.user = user;
  } catch (_) {
    /* ignore invalid token for optional auth */
  }
  next();
};

/**
 * adminOnly
 * Middleware that allows access ONLY to users with role = "admin"
 * MUST be used AFTER protect (needs req.user to be set)
 *
 * Usage: router.get('/route', protect, adminOnly, controllerFunction)
 *
 * To make a user admin: set role: "admin" in your User model
 * (you may need to add a "role" field to your User schema — see note below)
 */
exports.adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

// ── NOTE: Adding "role" to your User model ───
// Your current User.js doesn't have a "role" field.
// For adminOnly to work, add this to your User schema:
//
//   role: { type: String, enum: ['user', 'admin'], default: 'user' }
//
// This won't break your existing signup/login — new users default to "user"
// To make someone admin, update their record in MongoDB directly:
//   db.users.updateOne({ email: "admin@example.com" }, { $set: { role: "admin" } })