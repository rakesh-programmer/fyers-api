const express = require('express');

const { callback, login } = require('../controllers/authController');

const router = express.Router();

router.get('/login', login);
router.get('/callback', callback);

module.exports = router;
