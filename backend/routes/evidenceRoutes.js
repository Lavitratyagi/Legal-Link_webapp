const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/auth');
const evidenceController = require('../controllers/evidenceController');

// Memory storage keeps file as Buffer in req.file.buffer
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', protect, upload.single('file'), evidenceController.uploadEvidence);
router.post('/verify', protect, evidenceController.verifyEvidence);
router.post('/log-view', protect, evidenceController.logViewEvidence);
router.get('/activity/:id', protect, evidenceController.getActivityLog);
router.get('/:caseId', protect, evidenceController.getEvidenceByCase);

module.exports = router;
