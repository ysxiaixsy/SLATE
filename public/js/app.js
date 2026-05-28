/**
 * UPV Infirmary Scheduler — Frontend Application
 *
 * Responsibilities:
 *  - File drag-and-drop / browse handling
 *  - Form validation and submit to /api/schedule
 *  - Render scheduled + conflict tables
 *  - Trigger Excel export downloads
 *  - Generate sample template Excel client-side (via SheetJS CDN)
 */

"use strict";

// ---- State ----
let lastResult = null; // { scheduled, unscheduled, stats, warnings }
let activeTab = "scheduled";

// ---- DOM Refs ----
const dropzone      = document.getElementById("dropzone");
const fileInput     = document.getElementById("fileInput");
const fileChip      = document.getElementById("fileChip");
const fileChipName  = document.getElementById("fileChipName");
const removeFileBtn = document.getElementById("removeFile");
const btnOptimize   = document.getElementById("btnOptimize");
const btnTemplate   = document.getElementById("btnTemplate");

const emptyState    = document.getElementById("emptyState");
const loadingState  = document.getElementById("loadingState");
const statsBar      = document.getElementById("statsBar");
const warningsBox   = document.getElementById("warningsBox");
const warningsList  = document.getElementById("warningsList");
const tabBar        = document.getElementById("tabBar");
const tableScheduled = document.getElementById("tableScheduled");
const tableConflicts = document.getElementById("tableConflicts");
const exportBar     = document.getElementById("exportBar");

const scheduledBody = document.getElementById("scheduledBody");
const conflictsBody = document.getElementById("conflictsBody");

const statTotal       = document.getElementById("statTotal");
const statScheduled   = document.getElementById("statScheduled");
const statUnscheduled = document.getElementById("statUnscheduled");
const statSlots       = document.getElementById("statSlots");

const tabCountScheduled = document.getElementById("tabCountScheduled");
const tabCountConflicts = document.getElementById("tabCountConflicts");

const btnExportSchedule  = document.getElementById("btnExportSchedule");
const btnExportConflicts = document.getElementById("btnExportConflicts");

// ---- File Handling ----

dropzone.addEventListener("click", (e) => {
  if (e.target === removeFileBtn) return;
  fileInput.click();
});

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("drag-over");
});

dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));

dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
});

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

removeFileBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  clearFile();
});

function setFile(file) {
  if (!file.name.endsWith(".xlsx")) {
    showToast("Only .xlsx files are accepted.", "error");
    return;
  }
  fileInput._selectedFile = file;
  fileChipName.textContent = file.name;
  fileChip.removeAttribute("hidden");
  checkReady();
}

function clearFile() {
  fileInput.value = "";
  fileInput._selectedFile = null;
  fileChip.setAttribute("hidden", "");
  checkReady();
}

function checkReady() {
  const hasFile = !!fileInput._selectedFile;
  btnOptimize.disabled = !hasFile;
}

// ---- Schedule Optimization ----

btnOptimize.addEventListener("click", async () => {
  const file = fileInput._selectedFile;
  if (!file) return;

  const startTime    = document.getElementById("startTime").value;
  const endTime      = document.getElementById("endTime").value;
  const slotDuration = document.getElementById("slotDuration").value;
  const dailyCapacity = document.getElementById("dailyCapacity").value;

  if (!startTime || !endTime) {
    showToast("Please set infirmary open and close times.", "error");
    return;
  }
  if (!slotDuration || Number(slotDuration) < 5) {
    showToast("Slot duration must be at least 5 minutes.", "error");
    return;
  }
  if (startTime >= endTime) {
    showToast("Close time must be after open time.", "error");
    return;
  }

  setUIState("loading");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("startTime", startTime);
  formData.append("endTime", endTime);
  formData.append("slotDuration", slotDuration);
  if (dailyCapacity) formData.append("dailyCapacity", dailyCapacity);

  try {
    const res = await fetch("/api/schedule", { method: "POST", body: formData });
    const data = await res.json();

    if (!res.ok) {
      const msg = data.details ? data.details.join(" | ") : data.error;
      showToast(msg, "error");
      setUIState("empty");
      return;
    }

    lastResult = data;
    renderResults(data);
    setUIState("results");
  } catch (err) {
    showToast("Network error. Is the server running?", "error");
    setUIState("empty");
  }
});

// ---- Render Results ----

function renderResults({ scheduled, unscheduled, stats, warnings }) {
  // Stats
  statTotal.textContent       = stats.totalStudents;
  statScheduled.textContent   = stats.scheduled;
  statUnscheduled.textContent = stats.unscheduled;
  statSlots.textContent       = stats.slotsAvailable;

  tabCountScheduled.textContent = stats.scheduled;
  tabCountConflicts.textContent = stats.unscheduled;

  // Warnings
  if (warnings && warnings.length > 0) {
    warningsList.innerHTML = "";
    warnings.forEach((w) => {
      const li = document.createElement("li");
      li.textContent = w;
      warningsList.appendChild(li);
    });
    warningsBox.removeAttribute("hidden");
  } else {
    warningsBox.setAttribute("hidden", "");
  }

  // Scheduled table
  scheduledBody.innerHTML = "";
  scheduled.forEach((s, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="row-num">${i + 1}</td>
      <td><span class="time-badge">${esc(s.appointmentTime)}</span></td>
      <td>${esc(s.studentName)}</td>
      <td><span class="id-badge">${esc(s.studentId)}</span></td>
      <td class="status-cell">—</td>
    `;
    scheduledBody.appendChild(tr);
  });

  // Conflicts table
  conflictsBody.innerHTML = "";
  unscheduled.forEach((u, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="row-num">${i + 1}</td>
      <td>${esc(u.studentName)}</td>
      <td><span class="id-badge">${esc(u.studentId)}</span></td>
      <td><span class="conflict-badge">${esc(u.reason)}</span></td>
    `;
    conflictsBody.appendChild(tr);
  });

  // Default tab
  switchTab("scheduled");
}

// ---- Tabs ----

document.getElementById("tabScheduled").addEventListener("click", () => switchTab("scheduled"));
document.getElementById("tabConflicts").addEventListener("click", () => switchTab("conflicts"));

function switchTab(tab) {
  activeTab = tab;
  document.getElementById("tabScheduled").classList.toggle("tab-btn--active", tab === "scheduled");
  document.getElementById("tabConflicts").classList.toggle("tab-btn--active", tab === "conflicts");
  tableScheduled.toggleAttribute("hidden", tab !== "scheduled");
  tableConflicts.toggleAttribute("hidden", tab !== "conflicts");
}

// ---- UI States ----

function setUIState(state) {
  emptyState.toggleAttribute("hidden",    state !== "empty");
  loadingState.toggleAttribute("hidden",  state !== "loading");
  statsBar.toggleAttribute("hidden",      state !== "results");
  tabBar.toggleAttribute("hidden",        state !== "results");
  tableScheduled.toggleAttribute("hidden", state !== "results" || activeTab !== "scheduled");
  tableConflicts.toggleAttribute("hidden", state !== "results" || activeTab !== "conflicts");
  exportBar.toggleAttribute("hidden",     state !== "results");

  if (state !== "results") warningsBox.setAttribute("hidden", "");
}

// ---- Exports ----

btnExportSchedule.addEventListener("click", async () => {
  if (!lastResult) return;
  await triggerExport("/api/export/schedule", {
    scheduled: lastResult.scheduled,
    stats: lastResult.stats,
  });
});

btnExportConflicts.addEventListener("click", async () => {
  if (!lastResult) return;
  await triggerExport("/api/export/conflicts", {
    unscheduled: lastResult.unscheduled,
  });
});

async function triggerExport(url, payload) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      showToast("Export failed. Please try again.", "error");
      return;
    }

    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="(.+?)"/);
    const filename = match ? match[1] : "export.xlsx";
    downloadBlob(blob, filename);
  } catch {
    showToast("Network error during export.", "error");
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---- Sample Template ----

btnTemplate.addEventListener("click", generateTemplate);

function generateTemplate() {
  // Build a simple template as CSV-like data and encode as a data URL
  // Uses a minimal approach without external libraries (pure client-side)
  const rows = [
    ["Student ID", "Student Name", "Free Start Time", "Free End Time"],
    ["2024-001", "Juan Dela Cruz",     "08:00", "12:00"],
    ["2024-002", "Maria Santos",       "13:00", "17:00"],
    ["2024-003", "Jose Reyes",         "09:30", "14:00"],
    ["2024-004", "Ana Garcia",         "07:00", "09:00"],
    ["2024-005", "Carlos Mendoza",     "10:00", "16:00"],
  ];

  // Encode as CSV (for maximum compatibility without SheetJS on client)
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv" });
  downloadBlob(blob, "UPV_Infirmary_StudentTemplate.csv");

  showToast(
    "Template downloaded as CSV. Rename to .xlsx or open in Excel and save as .xlsx.",
    "info"
  );
}

// ---- Toast ----

function showToast(message, type = "info") {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = message;

  const colors = { error: "#e05252", info: "#0e9e8a", success: "#3cbc8a" };
  Object.assign(toast.style, {
    position: "fixed",
    bottom: "1.5rem",
    right: "1.5rem",
    background: colors[type] || colors.info,
    color: "#fff",
    padding: "0.85rem 1.4rem",
    borderRadius: "10px",
    fontFamily: "'Sora', sans-serif",
    fontSize: "0.83rem",
    fontWeight: "600",
    boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
    zIndex: "9999",
    maxWidth: "360px",
    lineHeight: "1.5",
    animation: "slideUp 0.25s ease",
  });

  if (!document.querySelector("#toastStyle")) {
    const style = document.createElement("style");
    style.id = "toastStyle";
    style.textContent = `@keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ---- Utils ----

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---- Init ----
setUIState("empty");
