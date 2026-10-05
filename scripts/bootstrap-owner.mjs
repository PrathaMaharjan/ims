import bcrypt from "bcrypt";
import pg from "pg";

const { Pool } = pg;

async function main() {
  const businessName = process.env.IMS_ORG_NAME?.trim();
  const ownerName = process.env.IMS_OWNER_NAME?.trim();
  const ownerEmail = process.env.IMS_OWNER_EMAIL?.trim().toLowerCase();

  if (!businessName || !ownerName || !ownerEmail) {
    throw new Error("IMS_ORG_NAME, IMS_OWNER_NAME, and IMS_OWNER_EMAIL are required");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    throw new Error("IMS_OWNER_EMAIL must be an email address");
  }
  if (!process.env.POSTGRES_USER || !process.env.POSTGRES_PASSWORD || !process.env.POSTGRES_DB) {
    throw new Error("PostgreSQL administrator environment is incomplete");
  }
  if (process.stdin.isTTY) {
    throw new Error("Pipe the owner password to stdin; do not pass it as an argument");
  }

  let password = "";
  for await (const chunk of process.stdin) password += chunk;
  password = password.replace(/\r?\n$/, "");
  if (password.length < 12) {
    throw new Error("Owner password must contain at least 12 characters");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const pool = new Pool({
    host: "db",
    port: 5432,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    connectionTimeoutMillis: 5_000,
  });

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(924247)");
    const existing = await client.query(
      "SELECT (SELECT count(*) FROM organizations) AS organizations, (SELECT count(*) FROM users) AS users",
    );
    if (Number(existing.rows[0].organizations) !== 0 || Number(existing.rows[0].users) !== 0) {
      throw new Error("Bootstrap refused: organizations or users already exist");
    }

    const organization = await client.query(
      "INSERT INTO organizations (business_name) VALUES ($1) RETURNING id",
      [businessName],
    );
    await client.query(
      "INSERT INTO users (organization_id, name, email, password_hash, is_owner) VALUES ($1, $2, $3, $4, true)",
      [organization.rows[0].id, ownerName, ownerEmail, passwordHash],
    );
    await client.query("COMMIT");
    console.log(`Created organization ${organization.rows[0].id} and owner ${ownerEmail}`);
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
