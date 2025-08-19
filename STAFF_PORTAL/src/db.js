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

await db.exec(
  `
  CREATE TABLE IF NOT EXISTS talms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER NOT NULL,
  week TEXT NOT NULL,
  topic TEXT NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
  )
  `
);

await db.exec(`
  CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  announcement_title TEXT,
  announcement TEXT,
  announcement_date DEFAULT CURRENT_TIMESTAMP
  )
  
  `);

await db.exec(`
  CREATE TABLE IF NOT EXISTS suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  suggestion_box TEXT,
  suggestion_time TEXT DEFAULT CURRENT_TIMESTAMP
  )
  
  `);

export default db;
