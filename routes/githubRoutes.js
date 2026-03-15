const express = require('express');

const { handleGithubWebhook } = require('../controllers/githubController');

const router = express.Router();

router.post(
  '/github',
  express.raw({ type: 'application/json' }),
  handleGithubWebhook
);

module.exports = router;
