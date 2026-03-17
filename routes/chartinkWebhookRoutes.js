const express = require('express');
const { chartinkWebhookController } = require('../controllers/chartinkWebhookController');

const router = express.Router();

// POST /api/webhook/chartink
router.post('/chartink-buy', chartinkWebhookController);

module.exports = router;
