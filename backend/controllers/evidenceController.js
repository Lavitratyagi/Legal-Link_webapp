const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Evidence = require('../models/Evidence');
const ActivityLog = require('../models/ActivityLog');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

exports.uploadEvidence = async (req, res) => {
  try {
    const { caseId, description } = req.body;
    if (!req.file || !caseId) {
      return res.status(400).json({ success: false, message: 'File and caseId are required' });
    }

    // 1. Generate SHA-256 hash from file buffer
    const hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

    // 2. Clean filename and save to local disk
    const uniqueName = Date.now() + '-' + req.file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    const filePath = path.join(UPLOAD_DIR, uniqueName);
    fs.writeFileSync(filePath, req.file.buffer);

    // 3. Save to database
    const evidence = new Evidence({
      caseId,
      fileUrl: '/uploads/' + uniqueName,
      description,
      hash
    });
    
    await evidence.save();
    
    // Log Activity
    await new ActivityLog({
      evidenceId: evidence._id,
      action: 'Uploaded',
      performedBy: req.user._id
    }).save();

    return res.status(201).json({ success: true, evidence });

  } catch (err) {
    console.error('Evidence upload error:', err);
    return res.status(500).json({ success: false, message: 'Server error during upload.' });
  }
};

exports.getEvidenceByCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const evidenceList = await Evidence.find({ caseId }).sort({ timestamp: -1 });
    return res.json({ success: true, evidence: evidenceList });
  } catch (err) {
    console.error('Evidence fetch error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.verifyEvidence = async (req, res) => {
  try {
    const { evidenceId } = req.body;
    if (!evidenceId) return res.status(400).json({ success: false, message: 'evidenceId is required' });

    const evidence = await Evidence.findById(evidenceId);
    if (!evidence) return res.status(404).json({ success: false, message: 'Evidence not found' });

    const filename = evidence.fileUrl.split('/uploads/')[1];
    if (!filename) return res.status(400).json({ success: false, message: 'Invalid fileUrl' });

    const filePath = path.join(UPLOAD_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Physical file missing from server' });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const activeHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const isValid = activeHash === evidence.hash;
    
    // Log Activity
    await new ActivityLog({
      evidenceId: evidence._id,
      action: 'Verified',
      performedBy: req.user._id
    }).save();

    return res.json({ success: true, status: isValid ? 'Valid' : 'Tampered' });
  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({ success: false, message: 'Server error during verification' });
  }
};

exports.logViewEvidence = async (req, res) => {
  try {
    const { evidenceId } = req.body;
    await new ActivityLog({
      evidenceId,
      action: 'Viewed',
      performedBy: req.user._id
    }).save();
    return res.json({ success: true });
  } catch (err) {
    console.error('Log View error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getActivityLog = async (req, res) => {
  try {
    const { id } = req.params;
    const logs = await ActivityLog.find({ evidenceId: id })
      .populate('performedBy', 'username role')
      .sort({ timestamp: -1 });
    return res.json({ success: true, logs });
  } catch (err) {
    console.error('Activity Log Fetch error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
