const { generateAccessToken, getAuthUrl } = require('../services/authService');

const login = (req, res) => {
  try {
    const authUrl = getAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate login URL', details: error.message });
  }
};

const callback = async (req, res) => {
  const authCode = req.query.auth_code;

  if (!authCode) {
    return res.status(400).send('Authorization code is missing. Authentication failed.');
  }

  try {
    const result = await generateAccessToken(authCode);

    if (result.success) {
      return res.status(200).send(`
        <h1>Authentication Successful!</h1>
        <p>Access Token has been generated and saved to .env.</p>
        <p>You can now use the trade endpoints.</p>
        <code>${result.accessToken}</code>
      `);
    }

    return res.status(400).json({ error: 'Token generation failed', details: result });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal Server Error during token generation',
      details: error.message
    });
  }
};

module.exports = {
  callback,
  login
};
