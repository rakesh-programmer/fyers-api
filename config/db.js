const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const DEFAULT_MONGODB_URI_TEMPLATE =
  'mongodb+srv://<db_username>:<db_password>@rakesh.f82ecsa.mongodb.net/?retryWrites=true&w=majority&appName=Rakesh';

const buildMongoUri = () => {
  const username = process.env.DB_USER || 'devrakeshkrishnan';
  const password = process.env.DB_PASS || 'ZEGFug9p98MBSSF3';
  const template = process.env.MONGODB_URI_TEMPLATE || DEFAULT_MONGODB_URI_TEMPLATE;

  if (!username) {
    throw new Error('DB_USER is not set in the environment.');
  }

  if (!password) {
    throw new Error('DB_PASS is not set in the environment.');
  }

  let mongoUri = template;

  if (mongoUri.includes('<db_username>')) {
    mongoUri = mongoUri.replace('<db_username>', encodeURIComponent(username));
  }

  if (mongoUri.includes('<db_password>')) {
    mongoUri = mongoUri.replace('<db_password>', encodeURIComponent(password));
  }

  return mongoUri;
};

const connectToDatabase = async () => {
  const mongoUri = buildMongoUri();
  console.log('Connecting to MongoDB with URI:', mongoUri);

 try {
   await mongoose.connect(mongoUri, {
    dbName: process.env.MONGODB_DB_NAME || 'fyers-api'
  });

  console.log('Connected to MongoDB');
 } catch (error) {
  console.error('Error connecting to MongoDB:', error.message);
 }
};

module.exports = {
  connectToDatabase
};
