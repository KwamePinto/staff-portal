import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../db.js";

const router = express.Router();

// Staff signup/login
router.post("/staff/signup", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existing = await db.get(`SELECT * FROM staff WHERE email = ?`, [
      email,
    ]);
    if (existing) return res.status(400).json({ message: "User exists" });
    const hashed = await bcrypt.hash(password, 10);
    const result = await db.run(
      `INSERT INTO staff (name, email, password, role) VALUES (?, ?, ?, ?)`,
      [name, email, hashed, "staff"]
    );
    res.status(201).json({ message: "staff added successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/staff/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await db.get(
      `SELECT id,name, email, password, role FROM staff WHERE email = ?`,
      [email]
    );
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: "Invalid credentials" });
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET
    );
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Admin signup/login
router.post("/admin/signup", async (req, res) => {
  const { name, email, password, role } = req.body;
  if (role !== "admin")
    return res.status(400).json({ message: "Invalid role" });
  try {
    const existing = await db.get(`SELECT * FROM staff WHERE email = ?`, [
      email,
    ]);
    if (existing) return res.status(400).json({ message: "User exists" });
    const hashed = await bcrypt.hash(password, 10);
    const result = await db.run(
      `INSERT INTO staff (name, email, password, role) VALUES (?, ?, ?, ?)`,
      [name, email, hashed, "admin"]
    );
    const token = jwt.sign(
      { id: result.lastID, role: "admin" },
      process.env.JWT_SECRET
    );
    res.status(201).json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const u = await db.get(
      `SELECT * FROM staff WHERE email = ? AND role = 'admin'`,
      [email]
    );
    if (!u || !(await bcrypt.compare(password, u.password)))
      return res.status(401).json({ message: "Invalid credentials" });
    const token = jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET);
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
