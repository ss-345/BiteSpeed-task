import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

function buildSSL() {
  const caPath = process.env.DB_SSL_CA;
  if (!caPath) return undefined;

  const resolvedPath = path.resolve(caPath);
  if (!fs.existsSync(resolvedPath)) {
    console.warn(`⚠️  CA cert not found at ${resolvedPath} — connecting without SSL`);
    return undefined;
  }

  console.log(`🔒 SSL enabled using: ${resolvedPath}`);
  return { ca: fs.readFileSync(resolvedPath) };
}

const pool = mysql.createPool({
  host:              process.env.DB_HOST     || 'localhost',
  port:              parseInt(process.env.DB_PORT || '3306'),
  user:              process.env.DB_USER     || 'root',
  password:          process.env.DB_PASSWORD || '',
  database:          process.env.DB_NAME     || 'defaultdb',
  waitForConnections: true,
  connectionLimit:   10,
  queueLimit:        0,
  enableKeepAlive:   true,
  keepAliveInitialDelay: 0,
  ssl: buildSSL(),
});

export async function initializeDatabase(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS Contact (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        phoneNumber    VARCHAR(20)  NULL,
        email          VARCHAR(255) NULL,
        linkedId       INT          NULL,
        linkPrecedence ENUM('primary','secondary') NOT NULL DEFAULT 'primary',
        createdAt      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deletedAt      DATETIME NULL,
        INDEX idx_email    (email),
        INDEX idx_phone    (phoneNumber),
        INDEX idx_linkedId (linkedId),
        FOREIGN KEY (linkedId) REFERENCES Contact(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Database table ready');
  } finally {
    conn.release();
  }
}

export default pool;
