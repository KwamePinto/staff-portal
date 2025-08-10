import express from "express";
import db from "../db.js";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import { verifyToken, isStaff, isAdmin } from "../middleware/authmiddleware.js";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { sendWelcomeEmail } from "../services/emailService.js";
import { log } from "console";

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

// submit suggestion/complaint
router.post("/staff/suggestions", verifyToken, isStaff, async (req, res) => {
  const { suggestion } = req.body;

  try {
    const communique = await db.run(
      `INSERT INTO suggestions (suggestion_box) VALUES (?)`,
      [suggestion]
    );
    if (communique) {
      res.status(201).json({ message: "suggestion successfully sent" });
    } else {
      res.status(500).json({ message: "suggestion submission failed" });
    }
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "there was a problem submiitting your suggeston" });
  }
});

// view announcements
router.get("/staff/announcements", verifyToken, isStaff, async (req, res) => {
  try {
    let recentAnnouncements = await db.all(
      `SELECT announcement_title, announcement, announcement_date FROM announcements WHERE announcement_date >= datetime('now', '-7 days')`
    );
    const oldAnnouncements = await db.all(
      `SELECT announcement_title, announcement, announcement_date FROM announcements WHERE announcement_date < datetime('now', '-7 days') `
    );
    if (!recentAnnouncements) {
      recentAnnouncements = "No announcements this week";
    }
    if (recentAnnouncements && oldAnnouncements) {
    }
    res.status(200).json({ recentAnnouncements, oldAnnouncements });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "there was a problem fetching announcements" });
  }
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
function generateRandomPassword(length = 10) {
  const charset = "1234567890";
  let password = "KH";
  for (let i = 0; i < length - 2; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

router.post("/admin/addStaff", verifyToken, isAdmin, async (req, res) => {
  const { name, email, role } = req.body;
  let { password } = req.body;

  try {
    const existing = await db.get(`SELECT * FROM staff WHERE email = ?`, [
      email,
    ]);
    if (existing) return res.status(400).json({ message: "User exists" });

    if (!password) {
      password = generateRandomPassword();
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.run(
      `INSERT INTO staff (name, email, password, role) VALUES (?, ?, ?, ?)`,
      [name, email, hashedPassword, role]
    );

    const sendingEmail = await sendWelcomeEmail(email, name, password);
    if (sendingEmail.success) {
      res.status(201).json({
        message: "staff created successfully and onboarding email sent",
      });
    } else {
      res.status(201).json({
        message:
          "staff created successfuly but there was a problem sending onboarding email",
        credentials: { email, password },
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "could not register staff" });
  }
});

//Communicate announcements
router.post("/admin/announcement", verifyToken, async (req, res) => {
  const { announcementTitle, announcement } = req.body;

  try {
    const communique = await db.run(
      `INSERT INTO announcements (announcement_title, announcement) VALUES (?,?)`,
      [announcementTitle, announcement]
    );
    if (communique) {
      res.status(201).json({ message: "Announcement given successfully" });
    } else {
      res.status(500).json({ message: "Annouccement broadcast failed " });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "could not broadcast announcement" });
  }
});

// get user profile
router.get("/user/profile", verifyToken, async (req, res) => {
  const user = await db.get(`SELECT * FROM staff WHERE id = ?`, [req.user.id]);
  res.json(user);
});

// get admin profile.
router.get("/admin/profile", verifyToken, isAdmin, async (req, res) => {
  const Admin = await db.get(`SELECT * FROM staff WHERE id = ?`, [req.user.id]);
  res.json(Admin);
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

// view leave application by leave id
router.get(
  "/admin/leaveApplications/:id",
  verifyToken,
  isAdmin,
  async (req, res) => {
    const leaveID = req.params.id;

    try {
      const leave = await db.get(
        `SELECT la.*, s.name, s.email FROM leaveApplications la JOIN staff s ON la.staffId = s.id WHERE la.id = ?`,
        [leaveID]
      );
      if (!leave)
        return res.status(404).json({ message: "Leave application not found" });
      res.json(leave);
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json({ message: "there was a problem getting leave apllication" });
    }
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

// view all suggestions
router.get("/admin/viewSuggestions", verifyToken, isAdmin, async (req, res) => {
  try {
    const suggestionboxItems = await db.get(
      `SELECT suggestion_box, suggestion_time From suggestions`
    );
    if (!suggestionboxItems) {
      res
        .status(400)
        .json({ message: "there are no suggestions at this time" });
    }
    res.status(200).json(suggestionboxItems);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to retrieve suggestions" });
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
