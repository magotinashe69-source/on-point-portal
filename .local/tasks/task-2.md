---
title: Student count & password reveal toggle
---
# Student Portal UI Improvements

## What & Why
Two small usability improvements for the teacher and student portals:
1. Teachers want to see total student count at a glance on the dashboard.
2. Students need a show/hide password toggle when logging in so they can verify what they're typing.

## Done looks like
- Teacher dashboard stats bar includes a "Total Students" card showing the count of all registered students (e.g., "8 students")
- Student login page has a show/hide eye icon button on the password field so students can toggle password visibility
- Teacher login page also has the same password reveal toggle for consistency

## Out of scope
- Per-form student counts (just total)
- Any changes to how students are stored or managed

## Tasks
1. **Teacher dashboard student count card** — Add a "Total Students" stat card to the dashboard stats row that shows the count from the existing students query.

2. **Password reveal toggle on login pages** — Add an eye/eye-off icon button inside the password input on both the student login page and the teacher login page that toggles the input type between "password" and "text".

## Relevant files
- `client/src/pages/teacher/dashboard.tsx`
- `client/src/pages/student/login.tsx`
- `client/src/pages/teacher/login.tsx`