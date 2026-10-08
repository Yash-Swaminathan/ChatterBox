const { Pool } = require('pg');
require('dotenv').config();

// Hosting platforms provide a single DATABASE_URL; local development uses the DB_* variables
const connection = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'chatterbox',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    };

// PostgreSQL connection pool configuration
const pool = new Pool({
  ...connection,
  // Managed databases reached over the public internet require TLS, usually with a
  // certificate that is not in Node's trust store
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: 20, // 20 clients in the pool
  idleTimeoutMillis: 30000, // 30 seconds
  connectionTimeoutMillis: 10000, // 10 seconds
});

// Handle pool errors
pool.on('error', (err, _client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('PostgreSQL connected successfully at:', result.rows[0].now);
    client.release();
    return true;
  } catch (err) {
    console.error('PostgreSQL connection error:', err.message);
    return false;
  }
};

// Execute a query
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    // Query text can contain personal data, so it is only logged on request
    if (process.env.LOG_SQL === 'true') {
      console.log('Executed query', { text, duration: Date.now() - start, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Query error:', error.message);
    throw error;
  }
};

// Get client from pool for transactions
const getClient = async () => {
  return await pool.connect();
};

const closePool = async () => {
  try {
    await pool.end();
    console.log('PostgreSQL pool closed');
  } catch (err) {
    console.error('Error closing PostgreSQL pool:', err.message);
  }
};

module.exports = {
  pool,
  query,
  getClient,
  testConnection,
  closePool,
};
