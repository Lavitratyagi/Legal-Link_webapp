const express = require('express');
const router = express.Router();
const casesController = require('../controllers/casesController');
const { protect } = require('../middleware/auth');

router.post('/create', protect, casesController.createCase);
router.get('/my', protect, casesController.getMyCases);

module.exports = router;
