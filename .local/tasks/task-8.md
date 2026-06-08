---
title: Data science homework CSV export
---
# Data Science Homework CSV Export

## What & Why
Add a new `/api/export/homework-datasci` endpoint that generates a comprehensive, flat CSV file of every student × assignment combination — including non-submissions — with all fields needed for data science modelling (participation rates, score prediction, late-submission effects, effort proxies, etc.).

A "Data Science Export" download link is added to the teacher dashboard alongside the existing "Export Grades" button.

## Done looks like
- Teacher clicks "Data Science Export" on the dashboard and downloads a CSV
- Every student × assignment pair produces one row (including students who did NOT submit)
- The CSV has 25 columns covering student profile, assignment metadata, participation, effort, and grade details
- Non-submissions have blank score/date fields and `submitted = 0`
- File is named `homework-datasci-{YYYY-MM-DD}.csv`

## CSV columns (in order)

| Column | Description |
|---|---|
| `student_id` | e.g. F1-001 |
| `student_name` | Full name |
| `form` | Form 1 / Form 2 / Stage 3 … |
| `gender` | Male / Female |
| `assignment_id` | Numeric ID |
| `assignment_title` | Full title |
| `subject` | MATHS, ENGLISH … |
| `topic` | Optional sub-topic |
| `due_date` | YYYY-MM-DD |
| `assigned_to_all` | 1 = whole class, 0 = targeted |
| `assignment_archived` | 0/1 |
| `status` | NOT_SUBMITTED / SUBMITTED / MARKED |
| `submitted` | 0 or 1 |
| `submitted_at` | ISO datetime or blank |
| `days_late` | Integer — 0 if on-time or not submitted |
| `was_late` | 0 or 1 |
| `num_questions` | Total questions in the assignment |
| `questions_answered` | Count of answers with non-empty text |
| `total_answer_words` | Word count across all text answers (effort proxy) |
| `raw_score` | Integer or blank if not yet marked |
| `max_score` | Total marks for the assignment |
| `late_penalty` | `days_late × 2`, capped at raw_score (0 if not marked) |
| `effective_score` | `raw_score − late_penalty`, min 0; blank if not marked |
| `score_pct` | `effective_score / max_score × 100`, blank if not marked |
| `teacher_feedback` | Overall feedback text or blank |

## Out of scope
- Per-question breakdowns (keep consistent column width)
- Filtering UI (the download is always the full dataset; analysts filter in their tools)
- Student-facing access

## Tasks
1. **Backend export endpoint** — Add `GET /api/export/homework-datasci` to `server/routes.ts`. Fetch all students, all assignments (active + archived), and all submissions + marks. For each student × assignment pair (respecting `targetStudentIds`), emit one CSV row with all 25 columns. Stream the response with correct `Content-Disposition` and `Content-Type: text/csv` headers.

2. **Dashboard download button** — In the teacher dashboard, add an "Data Science Export" card/link next to the existing "Export Grades" card. It points to `/api/export/homework-datasci` with `download` attribute, naming the file `homework-datasci-YYYY-MM-DD.csv`.

## Relevant files
- `server/routes.ts:1244-1333`
- `client/src/pages/teacher/dashboard.tsx:489-501`