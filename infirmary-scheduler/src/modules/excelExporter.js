/**
 * Excel Export Module
 *
 * Generates two workbooks:
 *  1. Master Schedule  — appointment time, student name, ID, status (nurse check-off)
 *  2. Conflict Report  — unscheduled students with reason
 *
 * Both are returned as Buffers ready to be sent as HTTP responses or saved to disk.
 */

"use strict";

const XLSX = require("xlsx");

/**
 * Applies basic column width auto-sizing to a worksheet.
 * @param {object} ws - XLSX worksheet
 * @param {string[][]} data - 2D array including header row
 */
function autoFitColumns(ws, data) {
  const colWidths = [];
  for (const row of data) {
    row.forEach((cell, i) => {
      const len = String(cell ?? "").length;
      colWidths[i] = Math.max(colWidths[i] || 10, len + 4);
    });
  }
  ws["!cols"] = colWidths.map((w) => ({ wch: w }));
}

/**
 * Creates a styled header row cell object.
 * @param {string} value
 * @returns {object} XLSX cell object
 */
function headerCell(value) {
  return {
    v: value,
    t: "s",
    s: {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "1B5E8A" } },
      alignment: { horizontal: "center", vertical: "center" },
    },
  };
}

/**
 * Generates the Master Schedule Excel workbook as a Buffer.
 * @param {Array<{appointmentTime: string, studentName: string, studentId: string, status: string}>} scheduled
 * @param {object} stats
 * @returns {Buffer}
 */
function generateMasterSchedule(scheduled, stats) {
  const wb = XLSX.utils.book_new();

  // --- Sheet 1: Master Schedule ---
  const schedHeaders = ["Appointment Time", "Student Name", "Student ID", "Status"];
  const schedRows = scheduled.map((s) => [
    s.appointmentTime,
    s.studentName,
    s.studentId,
    s.status || "",
  ]);

  const schedData = [schedHeaders, ...schedRows];
  const ws = XLSX.utils.aoa_to_sheet(schedData);
  autoFitColumns(ws, schedData);

  // Freeze top row
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(wb, ws, "Master Schedule");

  // --- Sheet 2: Summary ---
  const summaryData = [
    ["UPV Infirmary Scheduler — Summary Report"],
    [],
    ["Metric", "Value"],
    ["Total Students Processed", stats.totalStudents],
    ["Students Scheduled", stats.scheduled],
    ["Students Unscheduled", stats.unscheduled],
    ["Available Slots", stats.slotsAvailable],
    ["Capacity Limit Applied", stats.capacityLimit],
    [],
    ["Generated on", new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 32 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

/**
 * Generates the Conflict Report Excel workbook as a Buffer.
 * @param {Array<{studentId: string, studentName: string, reason: string}>} unscheduled
 * @returns {Buffer}
 */
function generateConflictReport(unscheduled) {
  const wb = XLSX.utils.book_new();

  const headers = ["Student ID", "Student Name", "Reason for Conflict"];
  const rows = unscheduled.map((u) => [u.studentId, u.studentName, u.reason]);

  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  autoFitColumns(ws, data);
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(wb, ws, "Conflict Report");

  // Instructions sheet
  const instructions = [
    ["Conflict Report — Action Guide"],
    [],
    ["This report lists students who could not be automatically scheduled."],
    ["Reasons may include:"],
    ["  • Free-time interval is shorter than 2 hours"],
    ["  • No free-time interval overlaps with infirmary operating hours"],
    ["  • Daily capacity limit was reached"],
    [],
    ["Recommended Actions:"],
    ["  1. Contact affected students directly"],
    ["  2. Arrange alternative appointments manually"],
    ["  3. Consider extending infirmary hours on high-demand days"],
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
  wsInstructions["!cols"] = [{ wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

module.exports = { generateMasterSchedule, generateConflictReport };
