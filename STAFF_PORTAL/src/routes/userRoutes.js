import express from "express";
import db from "../db.js";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import { verifyToken, isStaff, isAdmin } from "../middleware/authmiddleware.js";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

export async function initDb() {
  const db = await open({
    filename: path.resolve("db.sqlite"), // adjust if your DB file is in a different location
    driver: sqlite3.Database,
  });
  return db;
}
const router = express.Router();

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/TLM/"); // Ensure this folder exists
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and DOCX files are allowed."));
    }
  },
});

// ==============================
//         STAFF ROUTES
// ==============================

// Get staff profile
router.get("/staff/profile", verifyToken, isStaff, async (req, res) => {
  const staff = await db.get(`SELECT * FROM staff WHERE id = ?`, [req.user.id]);
  res.json(staff);
});

// Update staff profile
router.put("/staff/profile", verifyToken, isStaff, async (req, res) => {
  const { name, email, password, classTaught, subject, contact, address } =
    req.body;
  const current = await db.get(`SELECT password FROM staff WHERE id = ?`, [
    req.user.id,
  ]);
  const hashedPassword = password
    ? await bcrypt.hash(password, 10)
    : current.password;
  await db.run(
    `UPDATE staff SET name=?, email=?, password=?, classTaught=?, subject=?, contact=?, address=? WHERE id=?`,
    [
      name,
      email,
      hashedPassword,
      classTaught,
      subject,
      contact,
      address,
      req.user.id,
    ]
  );
  res.json({ message: "Profile updated" });
});

// Delete staff profile
router.delete("/staff/profile", verifyToken, isStaff, async (req, res) => {
  await db.run(`DELETE FROM staff WHERE id = ?`, [req.user.id]);
  res.json({ message: "Profile deleted" });
});

// Submit leave application
router.post("/staff/leave", verifyToken, isStaff, async (req, res) => {
  const { reason, start_date, end_date } = req.body;
  await db.run(
    `INSERT INTO leaveApplications (staffId, reason, start_date, end_date) VALUES (?, ?, ?, ?)`,
    [req.user.id, reason, start_date, end_date]
  );
  res.json({ message: "Leave submitted" });
});

// View leave response
router.get("/staff/leaveResponce", verifyToken, isStaff, async (req, res) => {
  const applications = await db.all(
    `SELECT * FROM leaveApplications WHERE staffId = ?`,
    [req.user.id]
  );
  res.json(applications);
});

// Submit TLM
router.post(
  "/staff/submitTLMs",
  verifyToken,
  isStaff,
  upload.single("file"),
  async (req, res) => {
    const { title, description } = req.body;
    const staffId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const filePath = req.file.path;

    try {
      await db.run(
        `
        INSERT INTO tlm (staff_id, title, description, file_path)
        VALUES (?, ?, ?, ?)
      `,
        [staffId, title, description, filePath]
      );

      res.status(201).json({ message: "Teaching note uploaded successfully" });
    } catch (error) {
      console.error("Error saving teaching note:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

// ==============================
//         ADMIN ROUTES
// ==============================

// amin create staff account.
router.post("/admin/addStaff", verifyToken, isAdmin, async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    const existing = await db.get(`SELECT * FROM staff WHERE email = ?`, [
      email,
    ]);
    if (existing) return res.status(400).json({ message: "User exists" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.run(
      `INSERT INTO staff (name, email, password, role) VALUES (?, ?, ?, ?)`,
      [name, email, hashedPassword, role]
    );
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "coould not register staff" });
  }
});

// View all staff profiles
router.get("/admin/staffProfiles", verifyToken, isAdmin, async (req, res) => {
  const profiles = await db.all(
    `SELECT id, name, email, role, classTaught, subject, contact, address FROM staff`
  );
  res.json(profiles);
});

// View all leave applications
router.get(
  "/admin/leaveApplications",
  verifyToken,
  isAdmin,
  async (req, res) => {
    const applications = await db.all(`
    SELECT la.*, s.name, s.email FROM leaveApplications la
    JOIN staff s ON la.staffId = s.id
  `);
    res.json(applications);
  }
);

// Approve leave application
router.put(
  "/admin/LeaveApplication/approve",
  verifyToken,
  isAdmin,
  async (req, res) => {
    const { email } = req.body;
    const staff = await db.get(`SELECT id FROM staff WHERE email = ?`, [email]);
    if (!staff) return res.status(404).json({ message: "Staff not found" });
    await db.run(
      `UPDATE leaveApplications SET status='approved' WHERE staffId=?`,
      [staff.id]
    );
    res.json({ message: "Leave approved" });
  }
);

// Reject leave application
router.put(
  "/admin/LeaveApplication/reject",
  verifyToken,
  isAdmin,
  async (req, res) => {
    const { email } = req.body;
    const staff = await db.get(`SELECT id FROM staff WHERE email = ?`, [email]);
    if (!staff) return res.status(404).json({ message: "Staff not found" });
    await db.run(
      `UPDATE leaveApplications SET status='rejected' WHERE staffId=?`,
      [staff.id]
    );
    res.json({ message: "Leave rejected" });
  }
);

// admin view all TLM submissions
router.get("/admin/viewTLMs", verifyToken, isAdmin, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden: Admins only" });
  }

  const db = await initDb();

  try {
    const materials = await db.all(`
      SELECT 
        tlm.id,
        tlm.title,
        tlm.description,
        tlm.file_path,
        tlm.submitted_at,
        staff.name AS staff_name,
        staff.email AS staff_email
      FROM tlm
      JOIN staff ON tlm.staff_id = staff.id
      ORDER BY tlm.submitted_at DESC
    `);

    if (!materials || materials.length === 0) {
      return res.status(404).json({ message: "No teaching materials found" });
    }

    res.status(200).json(materials);
  } catch (error) {
    console.error("Failed to fetch TLMs", error);
    res.status(500).json({ message: "Failed to retrieve teaching materials" });
  }
});

// Delete a staff account
router.delete("/admin/delete", verifyToken, isAdmin, async (req, res) => {
  const { email } = req.body;
  const staff = await db.get(`SELECT id FROM staff WHERE email = ?`, [email]);
  if (!staff) return res.status(404).json({ message: "Staff not found" });
  await db.run(`DELETE FROM staff WHERE id = ?`, [staff.id]);
  await db.run(`DELETE FROM leaveApplications WHERE staffId = ?`, [staff.id]);
  await db.run(`DELETE FROM tlm WHERE staffId = ?`, [staff.id]);
  res.json({ message: "Staff and related data deleted" });
});

export default router;
