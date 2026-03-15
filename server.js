require('dotenv').config();

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('A temporary login page has been created for testing purposes. Please log in to access the trading dashboard.');
  console.log(`Automated trading engine running on port ${PORT}`);
  console.log(`Log in here: http://static_ip:${PORT}/login`);
});
