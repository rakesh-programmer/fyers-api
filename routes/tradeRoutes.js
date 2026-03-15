const express = require('express');

const { enterTradeController } = require('../controllers/tradeController');

const router = express.Router();

router.post('/enter', enterTradeController);

module.exports = router;
