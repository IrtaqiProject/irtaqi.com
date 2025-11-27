const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  console.error("[migrate] POSTGRES_URL atau DATABASE_URL belum diset.");
  process.exit(1);
}

const migrationsDir = path.join(process.cwd(), "migrations");

function loadMigrations() {
  if (!fs.existsSync(migrationsDir)) {
    console.error(`[migrate] Folder migrations tidak ditemukan: ${migrationsDir}`);
    process.exit(1);
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

const pool = new Pool({
  connectionString,
  max: 1,
  ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

async function run() {
  const migrations = loadMigrations();
  if (migrations.length === 0) {
    console.log("[migrate] Tidak ada migration yang dijalankan.");
    await pool.end();
    return;
  }

  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    for (const file of migrations) {
      const id = file.replace(/\.sql$/, "");

      const seen = await client.query("SELECT 1 FROM _migrations WHERE id = $1", [id]);
      if (seen.rowCount > 0) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _migrations (id) VALUES ($1)", [id]);
        await client.query("COMMIT");
        console.log(`[migrate] Applied ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} gagal: ${err.message}`);
      }
    }

    console.log("[migrate] Selesai.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("[migrate] Gagal menjalankan migrations:", err.message);
  process.exit(1);
});
