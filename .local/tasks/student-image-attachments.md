# Image Attachments in Student Answers

## What & Why
Students need to be able to attach photos of handwritten work, drawings, or diagrams as part of their answers to assignment questions. The database schema already supports `imageUrls` in the answers array — the submission page just needs the upload UI added per question.

## Done looks like
- Each question on the student submission page has an "Attach Image" button below the answer text area
- Students can upload one or more images per question (photos of drawings, handwritten work, diagrams)
- Uploaded images show as thumbnails below the answer before submission
- Images are stored in object storage and their URLs saved in the `imageUrls` field per answer
- Teachers can see the attached images when viewing/marking a submission
- Students can also see their own attached images when viewing results

## Out of scope
- Camera capture directly in-browser (file upload from device is sufficient)
- Image annotations or editing

## Tasks
1. **Upload UI per question on submit page** — Add an image upload control (reusing the existing SimpleUploader component or the `/api/upload` endpoint) below each answer textarea on the student submission page. Show thumbnails of uploaded images with a remove button. Store image URLs in the answer's `imageUrls` array when submitting or updating.

2. **Display images in teacher mark page** — Ensure the teacher marking page already renders any `imageUrls` in student answers (check if already handled; if not, add image display per answer).

3. **Display images in student results page** — Ensure images are shown when a student views their submitted/marked work on the results page.

## Relevant files
- `client/src/pages/student/submit-assignment.tsx`
- `client/src/pages/teacher/mark.tsx`
- `client/src/pages/student/results.tsx`
- `client/src/components/SimpleUploader.tsx`
