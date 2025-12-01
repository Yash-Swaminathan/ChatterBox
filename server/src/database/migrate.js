require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { pool, testConnection } = require('../config/database');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Create migrations tracking table if it doesn't exist
const createMigrationsTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(query);
    console.log('Tracking table ready');
  } catch (err) {
    console.error('Error creating tracking table:', err.message);
    throw err;
  }
};

// Get list of executed migrations
const getExecutedMigrations = async () => {
  try {
    const result = await pool.query(
      'SELECT migration_name FROM schema_migrations ORDER BY migration_name'
    );
    return result.rows.map((row) => row.migration_name);
  } catch (err) {
    console.error('Error fetching executed migrations:', err.message);
    throw err;
  }
};

// Get list of migration files
const getMigrationFiles = async () => {
  try {
    const files = await fs.readdir(MIGRATIONS_DIR);
    return files
      .filter((file) => file.endsWith('.sql'))
      .sort(); // Sort alphabetically (001, 002, etc.)
  } catch (err) {
    console.error('Error reading migrations directory:', err.message);
    throw err;
  }
};

// Execute a single migration
const executeMigration = async (filename) => {
  const filePath = path.join(MIGRATIONS_DIR, filename);

  try {
    // Read migration file
    const sql = await fs.readFile(filePath, 'utf8');

    console.log(`Executing migration: ${filename}`);

    // Execute migration in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Execute the migration SQL
      await client.query(sql);

      // Record migration as executed
      await client.query(
        'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
        [filename]
      );

      await client.query('COMMIT');
      console.log(`Migration ${filename} completed successfully`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(`Error executing migration ${filename}:`, err.message);
    throw err;
  }
};

// Run all pending migrations
const runMigrations = async () => {
  try {
    console.log('Starting Database Migrations');

    // Test connection first
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Database connection failed');
    }

    // Create migrations tracking table
    await createMigrationsTable();

    // Get executed and available migrations
    const executedMigrations = await getExecutedMigrations();
    const migrationFiles = await getMigrationFiles();

    console.log(`Found ${migrationFiles.length} migration files`);
    console.log(`Already executed: ${executedMigrations.length}`);

    // Find pending migrations
    const pendingMigrations = migrationFiles.filter(
      (file) => !executedMigrations.includes(file)
    );

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations. Database is up to date!');
      return;
    }

    console.log(`Pending migrations: ${pendingMigrations.length}`);

    // Execute each pending migration
    for (const migration of pendingMigrations) {
      await executeMigration(migration);
    }

    console.log('All migrations completed successfully!');
  } catch (err) {
    console.error('Migration failed!');
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

// Show migration status
const showStatus = async () => {
  try {
    console.log('Migration Status');

    await testConnection();
    await createMigrationsTable();

    const executedMigrations = await getExecutedMigrations();
    const migrationFiles = await getMigrationFiles();

    console.log('Executed migrations:');
    if (executedMigrations.length === 0) {
      console.log('No executed migrations');
    } else {
      executedMigrations.forEach((m) => console.log(m));
    }

    console.log('Pending migrations:');
    const pendingMigrations = migrationFiles.filter(
      (file) => !executedMigrations.includes(file)
    );
    if (pendingMigrations.length === 0) {
      console.log('No pending migrations');
    } else {
      pendingMigrations.forEach((m) => console.log(m));
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

// CLI interface
const command = process.argv[2];

if (command === 'status') {
  showStatus();
} else if (command === 'run' || !command) {
  runMigrations();
} else {
  console.log('Invalid command');
  process.exit(1);
}
/*
Usage:
  node migrate.js         - Run all pending migrations
  node migrate.js run     - Run all pending migrations
  node migrate.js status  - Show migration status
*/
