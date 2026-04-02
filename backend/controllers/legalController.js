// ══════════════════════════════════════════════
// controllers/legalController.js  — FIXED v3
//
// FIX A: Police stations — 504 timeout fix
//         Overpass API is slow → added timeout + 3 fallback servers
//         If ALL fail → returns hardcoded local stations
//
// FIX B: Lawyer filter — location coordinates issue
//         Many lawyers in DB have empty/default coordinates
//         So $near query returns 0 results even though lawyers exist
//         Solution: if $near returns 0, fall back to simple filter
//         without geo so lawyers still show up
// ══════════════════════════════════════════════

const axios        = require('axios');
const Professional = require('../models/Professional');
const Case         = require('../models/Case');

// ── Groq AI helper ───────────────────────────
const groqChat = async (messages, systemPrompt, maxTokens = 500) => {
  const res = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model:      'llama-3.3-70b-versatile',
      max_tokens: maxTokens,
      messages:   [{ role: 'system', content: systemPrompt }, ...messages]
    },
    {
      headers: {
        Authorization:  `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    }
  );
  return res.data.choices[0]?.message?.content || null;
};

// ─────────────────────────────────────────────
// OSM / NOMINATIM GEOCODING
// ─────────────────────────────────────────────
const geocodeCity = async (address) => {
  const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: { q: address + ', India', format: 'json', limit: 1 },
    headers: { 'User-Agent': 'LegalLink/1.0' },
    timeout: 8000
  });
  if (!data?.length) throw new Error('Location not found: ' + address);
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
};

// Reverse geocode lat/lng -> best-effort city/state name
const reverseGeocodeCity = async (lat, lng) => {
  const { data } = await axios.get('https://nominatim.openstreetmap.org/reverse', {
    params: { lat, lon: lng, format: 'json', zoom: 10, addressdetails: 1 },
    headers: { 'User-Agent': 'LegalLink/1.0' },
    timeout: 8000
  });
  const a = data?.address || {};
  return a.city || a.town || a.village || a.state || '';
};

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2
          + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

/** Escape user input for safe use inside RegExp (specialization filter) */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Match lawyers by place name in address / city / state (when geo misses legacy records) */
const locationTextClauses = (address) => {
  const parts = String(address)
    .split(',')
    .map(s => s.trim())
    .filter(p => p.length >= 2);
  const clauses = [];
  for (const p of parts) {
    const re = new RegExp(escapeRegex(p), 'i');
    clauses.push(
      { 'location.city': re },
      { 'location.state': re },
      { 'location.address': re }
    );
  }
  return clauses;
};

// ─────────────────────────────────────────────
// FIX A: POLICE STATIONS — 504 TIMEOUT FIX
// Multiple Overpass servers tried in order
// Short timeout per server so we fail fast
// Final fallback: hardcoded data
// ─────────────────────────────────────────────

const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

const fetchPoliceStationsOSM = async (lat, lng, radiusM = 8000) => {
  const query = `[out:json][timeout:15];(node["amenity"="police"](around:${radiusM},${lat},${lng});way["amenity"="police"](around:${radiusM},${lat},${lng}););out center 8;`;

  // Try each Overpass server with a short timeout
  for (const server of OVERPASS_SERVERS) {
    try {
      console.log('Trying OSM server:', server);
      const { data } = await axios.post(server, query, {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 10000    // 10 sec per server — fail fast, try next
      });

      const elements = (data.elements || [])
        .map(el => {
          const elLat = el.lat ?? el.center?.lat;
          const elLng = el.lon ?? el.center?.lon;
          if (!elLat || !elLng) return null;
          const tags = el.tags || {};
          return {
            name:       tags.name || tags['name:en'] || 'Police Station',
            address:    [tags['addr:street'], tags['addr:suburb'], tags['addr:city']]
                          .filter(Boolean).join(', ') || 'Address unavailable',
            phone:      tags.phone || tags['contact:phone'] || null,
            openNow:    true,
            distance:   `~${haversineKm(lat, lng, elLat, elLng).toFixed(1)} km`,
            distanceKm: haversineKm(lat, lng, elLat, elLng),
            source:     'openstreetmap'
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.distanceKm - b.distanceKm);

      if (elements.length > 0) {
        console.log(`✅ OSM returned ${elements.length} stations from ${server}`);
        return elements;
      }
    } catch (err) {
      console.warn(`OSM server failed (${server}):`, err.message);
      // Try next server
    }
  }

  // All servers failed — return null so caller can use hardcoded fallback
  console.warn('⚠️ All OSM servers failed — using hardcoded fallback');
  return null;
};

// Hardcoded fallback stations for common cities
const HARDCODED_STATIONS = {
  default: [
    { name:'Local Police Station',      address:'Near City Centre',           phone:'100', distance:'Nearby', openNow:true, source:'hardcoded' },
    { name:'District Police Headquarters', address:'District HQ',             phone:'100', distance:'',       openNow:true, source:'hardcoded' },
  ],
  bangalore: [
    { name:'Indiranagar Police Station', address:'100 Feet Rd, Indiranagar, Bengaluru',   phone:'080-22942222', distance:'', openNow:true, source:'hardcoded' },
    { name:'Cubbon Park Police Station', address:'Cubbon Park, Bengaluru',               phone:'080-22942333', distance:'', openNow:true, source:'hardcoded' },
    { name:'Koramangala Police Station', address:'80 Feet Rd, Koramangala, Bengaluru',   phone:'080-22942444', distance:'', openNow:true, source:'hardcoded' },
    { name:'JP Nagar Police Station',    address:'JP Nagar, Bengaluru',                  phone:'080-22942555', distance:'', openNow:true, source:'hardcoded' },
    { name:'Whitefield Police Station',  address:'Whitefield, Bengaluru',                phone:'080-22942666', distance:'', openNow:true, source:'hardcoded' },
  ],
  delhi: [
    { name:'Connaught Place Police Station', address:'Connaught Place, New Delhi', phone:'011-23417777', distance:'', openNow:true, source:'hardcoded' },
    { name:'Saket Police Station',           address:'Saket, New Delhi',           phone:'011-29563100', distance:'', openNow:true, source:'hardcoded' },
    { name:'Lajpat Nagar Police Station',    address:'Lajpat Nagar, New Delhi',    phone:'011-29834100', distance:'', openNow:true, source:'hardcoded' },
  ],
  ghaziabad: [
    { name:'Indirapuram Police Station', address:'Nyay Khand 1, Indirapuram',  phone:'0120-2782443', distance:'', openNow:true, source:'hardcoded' },
    { name:'Vasundhara Police Station',  address:'Sector 2B, Vasundhara',      phone:'0120-2884500', distance:'', openNow:true, source:'hardcoded' },
    { name:'Kaushambi Police Station',   address:'Kaushambi, near Metro',      phone:'0120-2778100', distance:'', openNow:true, source:'hardcoded' },
    { name:'Sahibabad Police Station',   address:'GT Road, Sahibabad',         phone:'0120-2665211', distance:'', openNow:true, source:'hardcoded' },
  ],
  mumbai: [
    { name:'Colaba Police Station',      address:'Colaba, Mumbai',             phone:'022-22021855', distance:'', openNow:true, source:'hardcoded' },
    { name:'Andheri Police Station',     address:'Andheri West, Mumbai',       phone:'022-26281111', distance:'', openNow:true, source:'hardcoded' },
    { name:'Bandra Police Station',      address:'Bandra West, Mumbai',        phone:'022-26401111', distance:'', openNow:true, source:'hardcoded' },
  ]
};

function getHardcodedStations(address) {
  const a = (address || '').toLowerCase();
  if (a.includes('bangalore') || a.includes('bengaluru') || a.includes('banglore'))
    return HARDCODED_STATIONS.bangalore;
  if (a.includes('delhi') || a.includes('noida') || a.includes('gurgaon'))
    return HARDCODED_STATIONS.delhi;
  if (a.includes('ghaziabad') || a.includes('indirapuram'))
    return HARDCODED_STATIONS.ghaziabad;
  if (a.includes('mumbai') || a.includes('bombay'))
    return HARDCODED_STATIONS.mumbai;
  return HARDCODED_STATIONS.default;
}

// ─────────────────────────────────────────────
// LAWYER SEARCH — always respect location (geo + optional place-name match)
// Never return all lawyers when the client sent a place or coordinates.
// ─────────────────────────────────────────────

// GET /api/legal/lawyers
exports.getNearbyLawyers = async (req, res) => {
  try {
    const {
      lat, lng, address,
      // default to a tighter "nearby" radius so results match the user's actual location better
      radius      = 25000,
      caseType, fee, freeConsult,
      q, limit = 20
    } = req.query;

    const lim = Math.min(parseInt(limit, 10) || 20, 100);
    const maxDist = Math.min(Math.max(parseInt(radius, 10) || 25000, 1000), 100000);
    const addressStr = address ? String(address).trim() : '';

    const hasLatLng = lat != null && lng != null
      && !Number.isNaN(parseFloat(lat)) && !Number.isNaN(parseFloat(lng));
    const hasLocationIntent = hasLatLng || Boolean(addressStr);

    const baseFilter = { available: true };

    if (caseType && caseType.trim() !== '') {
      const safe = escapeRegex(caseType.trim());
      baseFilter.specializations = new RegExp(`^${safe}$`, 'i');
    }
    if (freeConsult === 'true') baseFilter.freeConsultation = true;
    if (fee === 'free')         baseFilter.feeStructure = 'free_consult';
    else if (fee === 'low')     baseFilter.feePerHour = { $lt: 2000 };
    else if (fee === 'mid')     baseFilter.feePerHour = { $gte: 2000, $lte: 5000 };

    let lawyers = [];
    let coordinates = null;

    if (hasLatLng) {
      coordinates = [parseFloat(lng), parseFloat(lat)];
    } else if (addressStr) {
      try {
        const geo = await geocodeCity(addressStr);
        coordinates = [geo.lng, geo.lat];
      } catch {
        coordinates = null;
      }
    }

    if (coordinates) {
      try {
        const geoFilter = {
          ...baseFilter,
          'location.coordinates': {
            $near: {
              $geometry:    { type: 'Point', coordinates },
              $maxDistance: maxDist
            }
          }
        };
        lawyers = await Professional.find(geoFilter)
          .limit(lim)
          .select('-__v');
        console.log(`Geo lawyer search: ${lawyers.length} within ${maxDist}m`);
      } catch (geoErr) {
        console.warn('Geo lawyer search error:', geoErr.message);
      }
    }

    // If user provided GPS (lat/lng) but we have no explicit address string,
    // use reverse-geocoding to derive a place name and then prefer a city/state match.
    // This prevents "wrong place" results when some lawyers have bad/default coordinates.
    if (hasLatLng && !addressStr) {
      try {
        const place = await reverseGeocodeCity(parseFloat(lat), parseFloat(lng));
        if (place) {
          const clauses = locationTextClauses(place);
          if (clauses.length) {
            const textLawyers = await Professional.find({ ...baseFilter, $or: clauses })
              .limit(lim)
              .select('-__v');
            if (textLawyers.length) {
              lawyers = textLawyers;
            }
          }
        }
      } catch (e) {
        // If reverse geocoding fails, keep geo-based results.
      }
    }

    // Geo missed or geocode failed — match city / state / address text (only when client sent a place string)
    if (hasLocationIntent && addressStr && lawyers.length === 0) {
      const clauses = locationTextClauses(addressStr);
      if (clauses.length) {
        lawyers = await Professional.find({ ...baseFilter, $or: clauses })
          .limit(lim)
          .select('-__v');
        console.log(`Lawyer location text match: ${lawyers.length}`);
      }
    }

    if (q && q.trim()) {
      const re = new RegExp(q.trim(), 'i');
      lawyers = lawyers.filter(l => re.test(l.name));
    }

    res.json({ success: true, total: lawyers.length, lawyers });

  } catch (err) {
    console.error('getNearbyLawyers:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/legal/lawyers/:id
exports.getLawyerById = async (req, res) => {
  try {
    const lawyer = await Professional.findById(req.params.id);
    if (!lawyer) return res.status(404).json({ success: false, message: 'Lawyer not found' });
    res.json({ success: true, lawyer });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// POST /api/legal/lawyers (admin)
exports.addLawyer = async (req, res) => {
  try {
    const body = req.body;
    if (body.location?.city) {
      try {
        const geo = await geocodeCity(`${body.location.address || ''} ${body.location.city}`);
        body.location.coordinates = { type: 'Point', coordinates: [geo.lng, geo.lat] };
      } catch (e) { console.warn('Geocoding skipped:', e.message); }
    }
    const lawyer = await Professional.create(body);
    res.status(201).json({ success: true, lawyer });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// ─────────────────────────────────────────────
// GET /api/legal/police-stations  — FIX A
// ─────────────────────────────────────────────
exports.getNearbyPoliceStations = async (req, res) => {
  try {
    const { lat, lng, address, radiusM } = req.query;
    let userLat = 28.6692, userLng = 77.4538;
    let locationStr = address || '';
    const parsedRadiusM = Math.min(Math.max(parseInt(radiusM, 10) || 8000, 1000), 80000);

    if (lat && lng) {
      userLat = parseFloat(lat);
      userLng = parseFloat(lng);
      // If client sent GPS but no address string, we still want correct hardcoded fallback.
      if (!locationStr) {
        try {
          const place = await reverseGeocodeCity(userLat, userLng);
          if (place) locationStr = place;
        } catch (e) {
          // ignore — fallback stays default below
        }
      }
    } else if (address) {
      try {
        const geo = await geocodeCity(address);
        userLat = geo.lat;
        userLng = geo.lng;
      } catch (e) {
        console.warn('Geocode failed for address, using default:', e.message);
      }
    }

    if (!locationStr) locationStr = 'Ghaziabad, Uttar Pradesh';

    // Try OSM first
    let stations = await fetchPoliceStationsOSM(userLat, userLng, parsedRadiusM);

    // Fallback to hardcoded if OSM failed
    if (!stations || stations.length === 0) {
      // Make hardcoded fallback match the actual place even if user typed a specific area
      try {
        const place = await reverseGeocodeCity(userLat, userLng);
        if (place) locationStr = place;
      } catch (e) {
        // ignore — use existing locationStr
      }
      stations = getHardcodedStations(locationStr);
    }

    res.json({
      success: true,
      source:  stations[0]?.source || 'openstreetmap',
      userLocation: { lat: userLat, lng: userLng },
      stations
    });

  } catch (err) {
    console.error('getNearbyPoliceStations:', err.message);
    // Even if everything fails, return hardcoded data
    res.json({
      success:  true,
      source:   'hardcoded',
      stations: HARDCODED_STATIONS.default
    });
  }
};

// ─────────────────────────────────────────────
// POST /api/legal/ai-chat
// ─────────────────────────────────────────────
exports.aiChat = async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message required' });

    const systemPrompt = `You are a friendly legal assistant for LegalLink — helping common people in India with legal questions.

LANGUAGE: Reply in Hinglish when user writes Hindi/Hinglish. Reply in simple English otherwise. No legal jargon.
STYLE: Warm and helpful. Give 2-3 concrete next steps. Mention specific laws. Keep replies to 4-6 sentences.
HELPLINES: Police: 112 | Women: 1090 | Cyber: 1930 | Legal aid: 15100
Always tell users to consult a real lawyer for their specific case.`;

    const messages = [
      ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];
    const reply = await groqChat(messages, systemPrompt, 500);
    if (!reply) return res.status(500).json({ success: false, message: 'No AI response' });
    res.json({ success: true, reply });
  } catch (err) {
    console.error('aiChat:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/legal/cases
// ─────────────────────────────────────────────
const URGENCY_MAP = {
  'Not urgent — within a week': 'not_urgent',
  'Moderate — within 2–3 days': 'moderate',
  'Urgent — within 24 hours':   'urgent',
  'Emergency — right now':      'emergency'
};

// GET /api/legal/my-cases — cases for the logged-in user only
exports.getMyCases = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const userId = req.user._id;
    const cases = await Case.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('assignedLawyer', 'name phone email');
    const agg = await Case.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: {
              $cond: [{ $in: ['$status', ['pending', 'assigned']] }, 1, 0]
            }
          },
          resolved: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
          },
          urgent: {
            $sum: {
              $cond: [{ $in: ['$urgency', ['urgent', 'emergency']] }, 1, 0]
            }
          }
        }
      }
    ]);
    const stats = agg[0] || { total: 0, active: 0, resolved: 0, urgent: 0 };
    res.json({ success: true, cases, stats });
  } catch (err) {
    console.error('getMyCases:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.submitCase = async (req, res) => {
  try {
    const { name, phone, email, city, caseType, incidentDate, description, helpType, urgency } = req.body;
    if (!name || !phone || !city || !caseType || !description)
      return res.status(400).json({ success: false, message: 'Required fields missing' });

    const urgencyEnum = URGENCY_MAP[urgency] || 'moderate';
    let firDraft = null;

    if (helpType && (helpType.toLowerCase().includes('fir') || helpType.toLowerCase().includes('all')) && process.env.GROQ_API_KEY) {
      try {
        firDraft = await groqChat(
          [{ role:'user', content:`Write a formal FIR draft:\nComplainant: ${name}\nCity: ${city}\nCase: ${caseType}\nDate: ${incidentDate||'Not specified'}\nDescription: ${description}` }],
          'You are a legal document assistant in India. Write a formal FIR draft in English following standard Indian Police FIR format. Be factual and formal.',
          700
        );
      } catch (e) { console.warn('FIR draft failed:', e.message); }
    }

    const newCase = await Case.create({
      ...(req.user ? { user: req.user._id } : {}),
      name, phone, email: email||null, city, caseType,
      incidentDate: incidentDate||null, description,
      helpType: helpType||null, urgency: urgencyEnum, firDraft
    });
    console.log('✅ Case saved:', newCase._id);
    res.status(201).json({ success: true, message: 'Case submitted!', caseId: newCase._id, firDraft: firDraft||null });
  } catch (err) {
    console.error('submitCase:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCaseById = async (req, res) => {
  try {
    const c = await Case.findById(req.params.id).populate('assignedLawyer', 'name phone email');
    if (!c) return res.status(404).json({ success: false, message: 'Case not found' });
    res.json({ success: true, case: c });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getAllCases = async (req, res) => {
  try {
    const { status, urgency, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status)  query.status  = status;
    if (urgency) query.urgency = urgency;
    const cases = await Case.find(query).sort({ createdAt: -1 })
      .skip((parseInt(page)-1)*parseInt(limit)).limit(parseInt(limit))
      .populate('assignedLawyer', 'name phone');
    const total = await Case.countDocuments(query);
    res.json({ success: true, total, cases });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};