const { testConnection: testPostgres, closePool } = require('../config/database');
const { connectRedis, testConnection: testRedis, closeRedis } = require('../config/redis');

async function testConnections() {
  let allSuccess = true;

  const pgSuccess = await testPostgres();
  if (!pgSuccess) {
    allSuccess = false;
    console.log('PostgreSQL connection failed');
  } else {
    console.log('PostgreSQL connection successful');
  }

  try {
    await connectRedis();
    const redisSuccess = await testRedis();
    if (!redisSuccess) {
      allSuccess = false;
      console.log('Redis connection failed');
    } else {
      console.log('Redis connection successful');
    }
  } catch (err) {
    allSuccess = false;
    console.log('Redis connection failed:', err.message);
  }

  if (allSuccess) {
    console.log('All connections successful!');
  } else {
    console.log('Some connections failed!');
  }

  await closeRedis();
  await closePool();

  process.exit(allSuccess ? 0 : 1);
}

testConnections();
