const { fyersModel } = require('fyers-api-v3');
const fs = require('fs');
const path = require('path');

const APP_ID = process.env.FYERS_APP_ID;
const SECRET_ID = process.env.FYERS_SECRET_ID;
const REDIRECT_URI = process.env.FYERS_REDIRECT_URI;

const updateEnvToken = (token) => {
  const envPath = path.join(__dirname, '..', '.env');
  let envContent = '';

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  if (envContent.includes('FYERS_ACCESS_TOKEN=')) {
    envContent = envContent.replace(/FYERS_ACCESS_TOKEN=.*/, `FYERS_ACCESS_TOKEN=${token}`);
  } else {
    envContent += `\nFYERS_ACCESS_TOKEN=${token}\n`;
  }

  fs.writeFileSync(envPath, envContent);
  process.env.FYERS_ACCESS_TOKEN = token;
};

const getAuthUrl = () => {
  const fyers = new fyersModel();

  if (APP_ID) fyers.setAppId(APP_ID);
  if (REDIRECT_URI) fyers.setRedirectUrl(REDIRECT_URI);

  return fyers.generateAuthCode();
};

const generateAccessToken = async (authCode) => {
  const fyers = new fyersModel();

  if (APP_ID) fyers.setAppId(APP_ID);
  if (REDIRECT_URI) fyers.setRedirectUrl(REDIRECT_URI);

  try {
    const response = await fyers.generate_access_token({
      client_id: APP_ID,
      secret_key: SECRET_ID,
      auth_code: authCode
    });

    if (response.s === 'ok') {
      const accessToken = response.access_token;
      updateEnvToken(accessToken);
      return { success: true, accessToken };
    }

    console.error('Error generating token:', response);
    return { success: false, message: response.message || 'Failed to generate token.' };
  } catch (error) {
    console.error('Token generation API error:', error);
    throw error;
  }
};

module.exports = {
  generateAccessToken,
  getAuthUrl
};
