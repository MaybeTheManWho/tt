require('dotenv').config();
const { MongoClient } = require('mongodb');

async function cleanup() {
  // Connect directly to MongoDB without using models
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI environment variable not set');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    // Get database name from connection string
    const dbName = uri.split('/').pop().split('?')[0];
    const db = client.db(dbName);
    
    // Update tickets collection
    const collection = db.collection('tickets');
    
    // Update all open tickets to closed
    const result = await collection.updateMany(
      { status: 'open' },
      { $set: { status: 'closed', closedAt: new Date() } }
    );

    console.log(`Updated ${result.modifiedCount} tickets to closed status`);
    console.log('Cleanup complete!');
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

cleanup();