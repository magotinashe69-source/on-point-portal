# On Point Education Centre - Homework & Learning Portal

## Overview
A web application for On Point Education Centre that enables teachers to create homework assignments for students, and allows students to submit their work and receive feedback. The design uses the organization's brand colors (navy blue and red) from their logo.

## Features
- **Teacher Portal**: Create, edit, and delete assignments with questions, image uploads, and optional topics (e.g., Algebra under Maths), assign homework to all students or specific individuals for tailored learning, view student submissions, mark and provide feedback with AI-assisted plagiarism detection
- **Student Management**: Teachers can add, edit, delete students and reset their passwords via /teacher/students page
- **Deadline Extensions**: Teachers can extend deadlines for individual students with optional reason tracking
- **Export Grades**: Download student grades as CSV with filtering by form/subject (/api/export/grades)
- **Student Portal**: View available assignments, submit answers including photo uploads of handwritten work, edit submissions before deadline or marking, view marked results with scores and feedback, view question images attached by teachers
- **Learning Resources**: Teachers can add textbooks, YouTube videos, and lesson plans for students to access
- **Video & Audio Lessons**: Teachers can upload video/audio files or record lessons directly in-browser using MediaRecorder API; students can watch/listen with built-in media players
- **Form-based Learning**: Assignments filtered by Stage 3–6 (primary) and Form 1–2 (high school), with class-level grouping on teacher dashboard (Zimbabwe school system)
- **Subject Support**: Maths, English, Science (primary), Physics, Chemistry, Biology, Economics, Business Studies, Geography, Computer Science, History, Accounting
- **Image Viewer**: Full-screen image viewer with zoom and rotate for reviewing student photo submissions
- **Assignment Archiving**: Teachers can archive old assignments to keep the dashboard clean, with a collapsible archived section and unarchive capability
- **AI Detection**: Built-in analysis to flag suspicious patterns in student answers
- **Role-Based Access**: Admin, teacher, and student roles for access control
- **Personalized Passwords**: Students create their own password on first login (only registered students can log in)
- **Class Announcements**: Teachers can post notices to all students or specific forms with priority levels (normal, important, urgent)
- **Student Progress**: Dashboard shows average score across marked assignments

## Tech Stack
- **Frontend**: React + TypeScript + Vite
- **Backend**: Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Storage**: Replit Object Storage for file uploads
- **Styling**: Tailwind CSS with Shadcn/UI components
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter

## Project Structure
```
client/
  src/
    components/      # UI components (SimpleUploader, theme-toggle, etc.)
    pages/
      teacher/       # Teacher portal pages (login, dashboard, create, mark, resources, lessons)
      student/       # Student portal pages (login, dashboard, submit, results, resources, lessons)
    lib/             # Query client and auth context
    hooks/           # Custom hooks (toast, etc.)
server/
  routes.ts          # API endpoints
  storage.ts         # Database storage (PostgreSQL)
  db.ts              # Database connection
shared/
  schema.ts          # Drizzle schemas and TypeScript types
```

## API Endpoints
- `POST /api/auth/teacher/login` - Teacher authentication
- `POST /api/auth/student/login` - Student login with personalized password
- `GET/POST/DELETE /api/assignments` - CRUD for assignments (includes delete)
- `GET /api/assignments/:id` - Get single assignment
- `PUT /api/assignments/:id` - Update assignment (title, instructions, dueDate, topic, extendedDeadlines)
- `PATCH /api/assignments/:id/archive` - Archive or unarchive an assignment
- `GET/POST /api/submissions` - CRUD for submissions with AI analysis
- `GET /api/submissions/:id` - Get single submission
- `PUT /api/submissions/:id` - Update submission (only before deadline and marking)
- `POST /api/marks` - Mark a submission
- `GET /api/marks/:submissionId` - Get marks for a submission
- `GET/POST/DELETE /api/resources` - Learning resources management
- `GET /api/students` - List all students
- `GET /api/students/:id` - Get single student
- `POST /api/students` - Add new student
- `PUT /api/students/:id` - Update student details
- `DELETE /api/students/:id` - Delete student
- `POST /api/students/:id/reset-password` - Reset student password
- `POST /api/upload` - File upload to object storage
- `GET/POST/DELETE /api/lessons` - Video and audio lessons management
- `GET /api/export/grades` - Export grades as CSV (query params: form, subject)

## Credentials
- **Teacher**: onpointeducationcentremoza@gmail.com / onpoint123
- **Master Admin Password**: onpoint_admin_2024 (overrides any student password)
- **Students**: Enter your name (exactly as registered) and password (created on first login)

## Registered Students (login by name)
### Form 1
- Nathaniel
- Ruvarashe
- Chiedza Mago
- Anesu Ndlovu

### Form 2
- Blessing Mago
- Trish Dzvambo
- Blessed Chidavaenzi
- Brilliant Malungissa

Note: Students log in using their name (exactly as registered) and password. First names are also accepted (e.g., "Nathaniel" or "Chiedza").

## Color Scheme (from logo)
- Primary (Navy Blue): HSL 224 65% 35%
- Secondary/Accent (Red): HSL 0 75% 50%
- Clean white backgrounds with proper contrast

## Running the App
1. The app runs on port 5000
2. Use `npm run dev` to start the development server
3. Access at http://localhost:5000

## User Preferences
- Simple, user-friendly interface suitable for school settings
- Large, clear buttons and readable text
- Consistent spacing and visual hierarchy
- Form 1/Form 2 terminology (Zimbabwe school system)
