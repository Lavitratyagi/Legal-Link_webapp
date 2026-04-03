// ══════════════════════════════════════════════
// server.js  — updated with contact route
// ══════════════════════════════════════════════

const express  = require('express');
const mongoose = require('mongoose');
const dotenv   = require('dotenv');
const cors     = require('cors');

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Connect MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => { console.error('❌ MongoDB error:', err.message); process.exit(1); });

// ── Routes ───────────────────────────────────
app.use('/api/auth',    require('./routes/authRoutes'));
app.use('/api/legal',   require('./routes/legalRoutes'));
app.use('/api/contact', require('./routes/contactRoutes'));
app.use('/api/cases',   require('./routes/casesRoutes'));
app.use('/api/evidence',require('./routes/evidenceRoutes'));

// Health check
app.get('/api/health', (req, res) =>
  res.json({ success: true, message: 'LegalLink running ✅' })
);

// 404
app.use((req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` })
);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));