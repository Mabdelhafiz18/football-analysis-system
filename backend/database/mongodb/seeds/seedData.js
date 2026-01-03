import mongoose from 'mongoose';
import connectMongoDB from '../connection.js';

const seedData = async () => {
  console.log('Seeding MongoDB data...');
  
  await connectMongoDB();
  
  try {
    // Implement seeding logic here
    // Example: Tactical.create({...})
    
    console.log('Seeding completed successfully.');
  } catch (err) {
    console.error('Seeding failed:', err.message);
  } finally {
    mongoose.connection.close();
    process.exit();
  }
};

seedData();

