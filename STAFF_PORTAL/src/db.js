import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = await open({
  filename: join(__dirname, "../data/database.sqlite"),
  driver: sqlite3.Database,
});

await db.exec(`
  CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT ,
    classTaught TEXT,
    subject TEXT,
    contact TEXT,
    address TEXT
  );`);
await db.exec(`
  CREATE TABLE IF NOT EXISTS leaveApplications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staffId INTEGER,
    reason TEXT,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'pending'
  );`);
await db.exec(`
  CREATE TABLE IF NOT EXISTS teaching_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
  );`);

export default db;
