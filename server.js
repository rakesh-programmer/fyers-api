require('dotenv').config();

const app = require('./app');
const { connectToDatabase } = require('./config/db');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectToDatabase();

    app.listen(PORT, () => {
      console.log('A temporary login page has been created 123');
      console.log(`Automated trading engine running on port ${PORT}`);
      console.log(`Log in here: http://static_ip:${PORT}/login`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
