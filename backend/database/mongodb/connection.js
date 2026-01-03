import mongoose from 'mongoose';
import config from '../../config/config.js';

const connectMongoDB = async () => {
  if (!config.db.mongodb.enabled) return;

  try {
    await mongoose.connect(config.db.mongodb.uri, {
      dbName: config.db.mongodb.dbName,
    });
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error('MongoDB Connection Error:', err.message);
    // Exit process with failure if DB is required but fails
    if (config.db.mongodb.enabled) {
      process.exit(1);
    }
  }
};

export default connectMongoDB;
