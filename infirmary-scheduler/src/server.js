/**
 * UPV Infirmary Scheduler — Express Server
 *
 * Routes:
 *   GET  /                    — Serves the frontend SPA
 *   POST /api/schedule        — Accepts Excel upload + config, returns schedule JSON
 *   POST /api/export/schedule — Returns Master Schedule .xlsx download
 *   POST /api/export/conflicts — Returns Conflict Report .xlsx download
 */

"use strict";

const express = require("express");
const multer = require("multer");
const path = require("path");

const { parseStudentExcel } = require("./modules/excelParser");
const { runGreedyScheduler } = require("./engine/scheduler");
const { validateInfirmaryConfig } = require("./utils/validator");
const { generateMasterSchedule, generateConflictReport } = require("./modules/excelExporter");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));

// Multer: memory storage, 10MB limit, xlsx only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".xlsx") {
      return cb(new Error("Only .xlsx files are accepted."));
    }
    cb(null, true);
  },
});

// --- Routes ---

/**
 * POST /api/schedule
 * Body (multipart/form-data):
 *   file        — .xlsx student schedule file
 *   startTime   — infirmary start (e.g. "08:00")
 *   endTime     — infirmary end   (e.g. "17:00")
 *   slotDuration — minutes per appointment (e.g. 30)
 *   dailyCapacity — optional max students per day
 *
 * Response: JSON { scheduled, unscheduled, stats, warnings }
 */
app.post("/api/schedule", upload.single("file"), (req, res) => {
  try {
    // 1. Validate file upload
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded. Please attach an .xlsx file." });
    }

    // 2. Validate infirmary config
    const { valid, config, errors } = validateInfirmaryConfig(req.body);
    if (!valid) {
      return res.status(400).json({ error: "Invalid configuration.", details: errors });
    }

    // 3. Parse Excel
    const { students, warnings } = parseStudentExcel(req.file.buffer);

    // 4. Run scheduler
    const { scheduled, unscheduled, stats } = runGreedyScheduler(students, config);

    return res.json({ scheduled, unscheduled, stats, warnings });
  } catch (err) {
    console.error("[/api/schedule]", err.message);
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/export/schedule
 * Body: JSON { scheduled: [...], stats: {...} }
 * Response: .xlsx file download
 */
app.post("/api/export/schedule", (req, res) => {
  try {
    const { scheduled, stats } = req.body;
    if (!Array.isArray(scheduled)) {
      return res.status(400).json({ error: "Invalid payload: expected { scheduled, stats }." });
    }
    const buffer = generateMasterSchedule(scheduled, stats || {});
    const filename = `UPV_Infirmary_MasterSchedule_${dateSuffix()}.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buffer);
  } catch (err) {
    console.error("[/api/export/schedule]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/export/conflicts
 * Body: JSON { unscheduled: [...] }
 * Response: .xlsx file download
 */
app.post("/api/export/conflicts", (req, res) => {
  try {
    const { unscheduled } = req.body;
    if (!Array.isArray(unscheduled)) {
      return res.status(400).json({ error: "Invalid payload: expected { unscheduled }." });
    }
    const buffer = generateConflictReport(unscheduled);
    const filename = `UPV_Infirmary_ConflictReport_${dateSuffix()}.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buffer);
  } catch (err) {
    console.error("[/api/export/conflicts]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Multer error handler
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: "Internal server error." });
});

// --- Helpers ---
function dateSuffix() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

// --- Start ---
app.listen(PORT, () => {
  console.log(`\n🏥  UPV Infirmary Scheduler running at http://localhost:${PORT}\n`);
});

module.exports = app; // for testing
