/**
 * Excel Parser Module
 *
 * Reads an uploaded .xlsx file and returns structured student records.
 * Expected columns (case-insensitive, flexible header names):
 *   - Student ID   (studentid, student_id, id)
 *   - Student Name (studentname, student_name, name)
 *   - Free Start Time (freestarttime, free_start, freestart, start)
 *   - Free End Time   (freeendtime, free_end, freeend, end)
 */

"use strict";

const XLSX = require("xlsx");

const COLUMN_ALIASES = {
  studentId: ["studentid", "student_id", "id", "stud_id", "studid"],
  name: ["studentname", "student_name", "name", "fullname", "full_name"],
  freeStart: ["freestarttime", "free_start_time", "free_start", "freestart", "start_time", "start"],
  freeEnd: ["freeendtime", "free_end_time", "free_end", "freeend", "end_time", "end"],
};

/**
 * Normalizes a header string for comparison.
 * @param {string} h
 * @returns {string}
 */
function normalizeHeader(h) {
  return String(h).toLowerCase().replace(/\s+/g, "").replace(/_/g, "");
}

/**
 * Maps worksheet headers to our canonical field names.
 * @param {string[]} headers
 * @returns {Object} { studentId: colIndex, name: colIndex, freeStart: colIndex, freeEnd: colIndex }
 */
function mapHeaders(headers) {
  const normalized = headers.map(normalizeHeader);
  const mapping = {};

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx === -1) {
      throw new Error(
        `Missing required column for "${field}". ` +
        `Expected one of: ${aliases.join(", ")}`
      );
    }
    mapping[field] = idx;
  }

  return mapping;
}

/**
 * Parses an Excel file buffer into student records.
 * @param {Buffer} fileBuffer
 * @returns {{ students: Array, warnings: string[] }}
 */
function parseStudentExcel(fileBuffer) {
  let workbook;
  try {
    workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: false });
  } catch {
    throw new Error("File is corrupted or not a valid .xlsx file.");
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Excel file contains no sheets.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (rows.length < 2) {
    throw new Error("Excel file must have a header row and at least one data row.");
  }

  const [headerRow, ...dataRows] = rows;
  let colMapping;

  try {
    colMapping = mapHeaders(headerRow);
  } catch (err) {
    throw new Error(`Header validation failed: ${err.message}`);
  }

  const students = [];
  const warnings = [];

  dataRows.forEach((row, idx) => {
    const rowNum = idx + 2; // 1-indexed, offset by header row

    const id = String(row[colMapping.studentId] ?? "").trim();
    const name = String(row[colMapping.name] ?? "").trim();
    const freeStart = row[colMapping.freeStart];
    const freeEnd = row[colMapping.freeEnd];

    // Skip entirely empty rows
    if (!id && !name) return;

    if (!id) {
      warnings.push(`Row ${rowNum}: Missing Student ID — row skipped.`);
      return;
    }
    if (!name) {
      warnings.push(`Row ${rowNum}: Missing Student Name for ID "${id}" — row skipped.`);
      return;
    }
    if (freeStart === "" || freeStart === null || freeStart === undefined) {
      warnings.push(`Row ${rowNum}: Missing Free Start Time for "${name}" — row skipped.`);
      return;
    }
    if (freeEnd === "" || freeEnd === null || freeEnd === undefined) {
      warnings.push(`Row ${rowNum}: Missing Free End Time for "${name}" — row skipped.`);
      return;
    }

    students.push({ id, name, freeStart, freeEnd });
  });

  if (students.length === 0) {
    throw new Error("No valid student records found in the uploaded file.");
  }

  return { students, warnings };
}

module.exports = { parseStudentExcel };
