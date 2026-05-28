# SLATE

> **Scheduler for Limited Appointment Time Engine**  
> Automated student check-up scheduling using a **Greedy Interval Scheduling** algorithm.  
> University of the Philippines Visayas — Infirmary Systems

---

## Overview

This system optimizes yearly infirmary check-up scheduling by automatically assigning students to appointment slots based on their free-time intervals, infirmary operating hours, and a 2-hour safety buffer constraint.

**Algorithm:** Greedy Interval Scheduling (Earliest-Finish-Time)  
**Time Complexity:** O(n log n)  
**Stack:** Node.js · Express · SheetJS (xlsx) · Vanilla JS frontend

---

## Quick Start

### Prerequisites
- Node.js ≥ 18.0.0

### Install & Run

```bash
git clone <repo-url>
cd SLATE
npm install
npm start
```

Open http://localhost:3000 in your browser.

For development (auto-restart on file changes):
```bash
npm run dev
```

---

## Usage Workflow

1. **Open** the app at `http://localhost:3000`
2. **Download** the sample template via "Download Sample Excel Template"
3. **Fill** the template with student IDs, names, and free-time intervals
4. **Upload** the `.xlsx` file via drag-and-drop or file browser
5. **Configure** infirmary hours, slot duration, and optional daily cap
6. **Click** "Optimize Schedule"
7. **Review** results in the Scheduled and Conflicts tabs
8. **Export** the Master Schedule and Conflict Report as `.xlsx` files

---

## Input Excel Format

| Column | Description | Example |
|---|---|---|
| Student ID | Unique student identifier | `2024-001` |
| Student Name | Full name | `Juan Dela Cruz` |
| Free Start Time | Start of free interval (HH:MM) | `08:00` |
| Free End Time | End of free interval (HH:MM) | `12:00` |

**Notes:**
- Column headers are case-insensitive and flexible (e.g. `free_start`, `freestart`, `start` all work)
- Time format: `HH:MM` (24-hour) or `H:MM AM/PM`
- Multiple rows per student are allowed (different free intervals on different days — future feature)

---

## Scheduling Algorithm

### Strategy: Greedy Earliest-Finish-Time

The algorithm is a classic greedy interval scheduler with domain-specific constraints.

```
INPUT:  Students with free-time intervals
        Infirmary operating hours + slot duration
OUTPUT: Maximum subset of non-conflicting appointments

ALGORITHM:
1. Generate all appointment slots within infirmary hours
2. For each student, find all slots that fit within their free window
   AND satisfy the 2-hour minimum free-time constraint
3. Create (student, slot) candidate pairs
4. Sort candidates by slot finish time (earliest first)
5. Greedily assign:
   for each candidate in sorted order:
     if student not yet assigned AND slot not yet occupied:
       assign student to slot
       mark slot as occupied
6. Unassigned students → Conflict Report
```

### Data Structures

| Structure | Purpose |
|---|---|
| Array (sorted) | Candidate (student, slot) pairs sorted by finish time |
| Set | Occupied slot tracking — O(1) lookup |
| Set | Assigned student tracking — O(1) duplicate prevention |
| Map | Student ID → details lookup |

### Constraints Enforced

| Constraint | Description |
|---|---|
| 2-hour minimum | Free-time intervals shorter than 2 hours are excluded |
| No overlaps | Each slot assigned to exactly one student |
| No duplicates | Each student assigned to at most one slot |
| Infirmary bounds | Appointments must fit within operating hours |
| Daily capacity | Optional hard cap on daily appointments |

---

## API Reference

### `POST /api/schedule`
Accepts multipart form upload and returns schedule JSON.

**Form Fields:**
- `file` — `.xlsx` student schedule file
- `startTime` — infirmary open time (e.g. `08:00`)
- `endTime` — infirmary close time (e.g. `17:00`)
- `slotDuration` — minutes per appointment (e.g. `30`)
- `dailyCapacity` — *(optional)* max students per day

**Response:**
```json
{
  "scheduled": [
    { "appointmentTime": "08:00 AM – 08:30 AM", "studentName": "...", "studentId": "...", "status": "" }
  ],
  "unscheduled": [
    { "studentId": "...", "studentName": "...", "reason": "..." }
  ],
  "stats": { "totalStudents": 50, "scheduled": 45, "unscheduled": 5, "slotsAvailable": 16, "capacityLimit": 16 },
  "warnings": []
}
```

### `POST /api/export/schedule`
Returns Master Schedule as `.xlsx` download.  
Body: `{ "scheduled": [...], "stats": {...} }`

### `POST /api/export/conflicts`
Returns Conflict Report as `.xlsx` download.  
Body: `{ "unscheduled": [...] }`

---

## Project Structure

```
SLATE/
├── src/
│   ├── server.js               # Express server + route handlers
│   ├── engine/
│   │   └── scheduler.js        # Greedy interval scheduling algorithm
│   ├── modules/
│   │   ├── excelParser.js      # .xlsx upload parser
│   │   └── excelExporter.js    # .xlsx report generator
│   └── utils/
│       └── validator.js        # Input validation
├── public/
│   ├── index.html              # Single-page frontend
│   ├── css/styles.css
│   └── js/app.js
├── package.json
└── README.md
```

---

## Output Files

### Master Schedule (`UPV_Infirmary_MasterSchedule_YYYYMMDD.xlsx`)
| Appointment Time | Student Name | Student ID | Status |
|---|---|---|---|
| 08:00 AM – 08:30 AM | Juan Dela Cruz | 2024-001 | *(nurse check-off)* |

### Conflict Report (`UPV_Infirmary_ConflictReport_YYYYMMDD.xlsx`)
| Student ID | Student Name | Reason for Conflict |
|---|---|---|
| 2024-004 | Ana Garcia | Free-time interval is less than 2 hours |

---

## Future Improvements

- Multi-day scheduling across a week
- Priority scheduling for urgent/flagged cases
- Direct registrar system integration
- Student self-service portal
- Email/SMS notifications for appointments
- Web deployment with persistent database
