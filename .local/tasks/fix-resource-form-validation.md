# Fix Resource Form Field Validation

## What & Why
When a teacher adds a resource without selecting a "Form", the browser sends an empty string to the backend. The backend validates the form field against a strict enum and rejects empty string, so the resource fails to save. Teachers who want a resource to be visible to all forms have no way to do that.

## Done looks like
- Teachers can add a resource without selecting a specific form and it saves successfully
- A resource with no form selected is visible to students of all forms
- Adding a resource with a specific form (e.g. Form 1) still works as before
- An "All Forms" option is present in the Form dropdown for clarity

## Out of scope
- Changing any other validation behaviour on resources

## Tasks
1. **Backend fix** — In the `createResourceSchema` in the resources POST route, preprocess the `form` field so an empty string is treated as `undefined` before enum validation. Also preprocess `subject` the same way so empty string becomes `undefined` rather than being stored as an empty string.

2. **Frontend fix** — Add an explicit "All Forms" option to the Form Select in the Add Resource dialog so teachers can deliberately choose "all forms". Map that selection to an empty/undefined value before submitting.

## Relevant files
- `server/routes.ts:842-852`
- `client/src/pages/teacher/resources.tsx:266-291`
