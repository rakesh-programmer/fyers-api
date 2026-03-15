require('dotenv').config();

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Automated trading engine running on port ${PORT}`);
  console.log(`Log in here: http://localhost:${PORT}/login`);
});
