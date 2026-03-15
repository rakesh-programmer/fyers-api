const { deployFromGithubWebhook } = require('../services/deployService');

const handleGithubWebhook = async (req, res) => {
  try {
    const result = await deployFromGithubWebhook({
      bodyBuffer: req.body,
      headers: req.headers
    });

    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('GitHub webhook failed:', error);

    return res.status(500).json({
      error: 'Webhook processing failed',
      details: error.message
    });
  }
};

module.exports = {
  handleGithubWebhook
};
