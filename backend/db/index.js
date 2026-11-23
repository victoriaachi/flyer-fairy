const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

// no DATABASE_URL means no price tracking, the rest of the app still works
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    })
  : null;

async function migrate() {
  if (!pool) return;
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);
}

module.exports = { pool, migrate };
