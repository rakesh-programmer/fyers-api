const express = require('express');
const { chartinkSellWebhookController } = require('../controllers/chartinkSellWebhookController');

const router = express.Router();

// POST /api/webhook/chartink-sell
router.post('/chartink-sell', chartinkSellWebhookController);

module.exports = router;
