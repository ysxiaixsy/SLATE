/**
 * Greedy Interval Scheduling Engine
 *
 * Algorithm:
 *  1. For each student, collect all valid free-time intervals
 *     (must overlap with infirmary hours AND be >= MIN_FREE_DURATION)
 *  2. Flatten all (student, interval) pairs into a single list
 *  3. Sort by interval finish time (earliest-finish-time greedy strategy)
 *  4. Iterate: if a student has not yet been assigned AND the slot is free, assign it
 *  5. Track occupied slots and unscheduled students
 *
 * Time Complexity: O(n log n) — dominated by the sort step
 * Space Complexity: O(n) — slot occupation map + assignment map
 */

"use strict";

const MIN_FREE_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours in ms

/**
 * Parses a "HH:MM" or "H:MM AM/PM" string into minutes-since-midnight.
 * @param {string} timeStr
 * @returns {number} minutes since midnight
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr) throw new Error(`Invalid time value: "${timeStr}"`);

  const str = String(timeStr).trim();

  // Handle Excel serial time numbers (fraction of a day)
  if (!isNaN(str) && str !== "") {
    const fraction = parseFloat(str);
    return Math.round(fraction * 24 * 60);
  }

  // HH:MM 24-hour
  const match24 = str.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return parseInt(match24[1]) * 60 + parseInt(match24[2]);
  }

  // H:MM AM/PM
  const match12 = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1]);
    const mins = parseInt(match12[2]);
    const period = match12[3].toUpperCase();
    if (period === "AM" && hours === 12) hours = 0;
    if (period === "PM" && hours !== 12) hours += 12;
    return hours * 60 + mins;
  }

  throw new Error(`Cannot parse time string: "${str}"`);
}

/**
 * Formats minutes-since-midnight to "HH:MM AM/PM".
 * @param {number} minutes
 * @returns {string}
 */
function formatMinutes(minutes) {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * Generates appointment slot start times within infirmary hours.
 * @param {number} infirmaryStart - minutes since midnight
 * @param {number} infirmaryEnd   - minutes since midnight
 * @param {number} slotDuration   - minutes
 * @returns {number[]} array of slot start times (minutes since midnight)
 */
function generateSlots(infirmaryStart, infirmaryEnd, slotDuration) {
  const slots = [];
  let current = infirmaryStart;
  while (current + slotDuration <= infirmaryEnd) {
    slots.push(current);
    current += slotDuration;
  }
  return slots;
}

/**
 * Core greedy scheduling function.
 *
 * @param {Array<{id: string, name: string, freeStart: string, freeEnd: string}>} students
 * @param {{startTime: string, endTime: string, slotDuration: number, dailyCapacity: number|null}} infirmaryConfig
 * @returns {{scheduled: Array, unscheduled: Array, stats: object}}
 */
function runGreedyScheduler(students, infirmaryConfig) {
  const { startTime, endTime, slotDuration, dailyCapacity } = infirmaryConfig;

  const infStart = parseTimeToMinutes(startTime);
  const infEnd = parseTimeToMinutes(endTime);
  const slotMins = Number(slotDuration);
  const minFreeMins = MIN_FREE_DURATION_MS / 60000; // 120 minutes

  if (infEnd <= infStart) {
    throw new Error("Infirmary end time must be after start time.");
  }
  if (slotMins <= 0 || slotMins > infEnd - infStart) {
    throw new Error("Invalid slot duration.");
  }

  // Step 1: Generate all available slots
  const availableSlots = generateSlots(infStart, infEnd, slotMins);
  const maxCapacity = dailyCapacity
    ? Math.min(dailyCapacity, availableSlots.length)
    : availableSlots.length;

  // Slot occupation set (key = slot start minutes)
  const occupiedSlots = new Set();

  // Step 2: Build candidate list — (student, compatibleSlotStart, slotEnd)
  // A slot is compatible if:
  //   a) student's free window covers the entire slot
  //   b) student's free window is >= minFreeMins
  //   c) slot overlaps with infirmary hours (guaranteed by generateSlots)
  const candidates = [];

  const scheduledStudentIds = new Set();
  const studentMap = new Map(); // id -> {id, name}

  for (const student of students) {
    const { id, name, freeStart, freeEnd } = student;

    let freeStartMins, freeEndMins;
    try {
      freeStartMins = parseTimeToMinutes(freeStart);
      freeEndMins = parseTimeToMinutes(freeEnd);
    } catch (err) {
      // Unparseable time — will land in unscheduled with a reason
      candidates.push({
        studentId: id,
        slotStart: Infinity,
        slotEnd: Infinity,
        parseError: `Unparseable time: ${err.message}`,
      });
      studentMap.set(id, { id, name });
      continue;
    }

    const freeDuration = freeEndMins - freeStartMins;
    studentMap.set(id, { id, name });

    if (freeDuration < minFreeMins) {
      // Will surface in unscheduled — tag with reason but still add a
      // sentinel so the student appears in the report
      candidates.push({
        studentId: id,
        slotStart: Infinity,
        slotEnd: Infinity,
        reason: "insufficient_free_time",
      });
      continue;
    }

    // Find all slots this student can attend
    for (const slotStart of availableSlots) {
      const slotEnd = slotStart + slotMins;
      // Student must be free for the entire slot
      if (freeStartMins <= slotStart && slotEnd <= freeEndMins) {
        candidates.push({ studentId: id, slotStart, slotEnd });
      }
    }

    // If no slot matched, add sentinel
    if (!candidates.some((c) => c.studentId === id && c.slotStart !== Infinity)) {
      candidates.push({
        studentId: id,
        slotStart: Infinity,
        slotEnd: Infinity,
        reason: "no_overlap",
      });
    }
  }

  // Step 3: Sort by earliest finish time (greedy criterion)
  // Sentinels (Infinity) naturally sort to the end
  candidates.sort((a, b) => a.slotEnd - b.slotEnd);

  // Step 4: Greedy assignment
  const scheduled = [];
  const unscheduled = [];
  const unscheduledReasons = new Map(); // studentId -> reason string

  // Pre-collect non-candidate reasons
  for (const c of candidates) {
    if (c.slotStart === Infinity && !unscheduledReasons.has(c.studentId)) {
      unscheduledReasons.set(
        c.studentId,
        c.parseError || (c.reason === "insufficient_free_time"
          ? "Free-time interval is less than 2 hours"
          : "No free interval overlaps with infirmary hours")
      );
    }
  }

  for (const candidate of candidates) {
    if (scheduled.length >= maxCapacity) break;
    const { studentId, slotStart, slotEnd } = candidate;

    // Skip sentinels and already-scheduled students
    if (slotStart === Infinity) continue;
    if (scheduledStudentIds.has(studentId)) continue;
    if (occupiedSlots.has(slotStart)) continue;

    // Assign
    occupiedSlots.add(slotStart);
    scheduledStudentIds.add(studentId);

    const student = studentMap.get(studentId);
    scheduled.push({
      appointmentTime: `${formatMinutes(slotStart)} – ${formatMinutes(slotEnd)}`,
      studentName: student.name,
      studentId: studentId,
      status: "",
    });
  }

  // Step 5: Collect unscheduled students
  for (const [id, student] of studentMap) {
    if (!scheduledStudentIds.has(id)) {
      unscheduled.push({
        studentId: id,
        studentName: student.name,
        reason: unscheduledReasons.get(id) || "Capacity limit reached or no available slot",
      });
    }
  }

  const stats = {
    totalStudents: studentMap.size,
    scheduled: scheduled.length,
    unscheduled: unscheduled.length,
    slotsAvailable: availableSlots.length,
    capacityLimit: maxCapacity,
  };

  return { scheduled, unscheduled, stats };
}

module.exports = { runGreedyScheduler, parseTimeToMinutes, formatMinutes };
