const express = require('express');
const router  = express.Router();
const { submitContact, getAllContacts } = require('../controllers/contactController');
const { protect, adminOnly } = require('../middleware/auth');

router.post('/', submitContact);
router.get('/', protect, adminOnly, getAllContacts);

module.exports = router;
