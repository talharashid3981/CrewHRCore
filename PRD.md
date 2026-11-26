# Crew HRCore Product Requirements Document

- **Document status:** Approved baseline for current implementation
- **Version:** 1.0
- **Prepared:** 24 November 2026
- **Repository:** talharashid3981/CrewHRCore
- **Primary timezone:** Asia/Karachi
- **Deployment:** React/Vite frontend on Vercel and Express/MongoDB backend on Render

## 1. Product Summary

Crew HRCore is a role-based HRMS for small and medium organizations. It manages the employee lifecycle from invitation and onboarding through attendance, leave, holiday management, reporting, and administrative account controls.

The product has two primary workspaces:

1. **Employee workspace**: complete onboarding, check in and out with geolocation, view attendance and leave information, submit leave requests, review the calendar, manage account settings, and share attendance summaries.
2. **Administrator workspace**: manage employees and approvals, configure office and leave rules, maintain holidays, review and correct attendance, approve leave, monitor dashboards, and export operational reports.

The current system is functionally complete for core HR workflows and is designed for browser use on desktop and mobile.

## 2. Problem Statement

Organizations need a single, auditable system to:

- prevent incomplete employee records from participating in HR operations,
- record attendance consistently across shifts and office locations,
- apply holiday, weekend, leave, lateness, and grace-period rules consistently,
- give administrators efficient approval and correction workflows,
- provide employees with transparent leave balances and work records,
- support reporting and exports without maintaining separate spreadsheets,
- protect employee data and prevent unauthorized role-based actions.

Crew HRCore addresses these needs through a MERN application with server-enforced policies and scheduled automation.

## 3. Goals and Success Metrics

### 3.1 Business Goals

- Reduce manual onboarding coordination and employee record maintenance.
- Standardize attendance status calculation across employees and dates.
- Reduce spreadsheet-based leave and attendance administration.
- Improve visibility into pending approvals, absences, lateness, and leave requests.
- Provide secure, exportable operational records.

### 3.2 Product Metrics

| Metric | Target |
| --- | --- |
| Employee onboarding completion | At least 90% of invited employees complete and submit onboarding |
| Attendance self-service | Employees can check in and out without administrator intervention on normal workdays |
| Approval speed | Pending onboarding and leave requests are visible and actionable from current workspace dashboards |
| Automation reliability | Scheduled attendance close and email jobs complete without duplicate deliveries |
| Report availability | Monthly employee data and attendance data can be exported for authorized administrators |
| Security | All protected APIs reject unauthenticated, inactive, or role-mismatched access |
| Responsiveness | Core workflows remain usable on mobile and desktop viewports |

## 4. Users and Personas

### 4.1 Administrator

Responsible for organization configuration and employee operations.

Typical needs:

- invite and approve employees,
- configure departments, shifts, location, weekends, and grace periods,
- manage leave types and policies,
- manage holidays,
- approve or reject leave,
- correct missing check-outs,
- review daily attendance,
- export and analyze reports.

### 4.2 Employee

An authenticated organization member.

Typical needs:

- set up an account and submit onboarding details,
- check in and out from an approved physical location,
- track attendance history and worked hours,
- submit, preview, cancel, and review leave requests,
- view holidays and personal calendar information,
- manage profile and password,
- configure email notification preferences.

## 5. Scope

### 5.1 In Scope

- Public and protected authentication flows
- Employee invitation and password setup
- Employee onboarding and administrator approval
- Profile, department, designation, shift, joining date, and account status management
- Office location, geofence, shifts, grace period, departments, and weekends
- Holidays and employee personal calendars
- Location-verified check-in and check-out
- Shift, lateness, absence, leave, holiday, weekend, and half-day calculation
- Daily attendance automation and missing check-out correction
- Leave types, leave policy, leave preview, balances, requests, approvals, cancellation, and export
- Employee and department dashboards
- Monthly reports and CSV/XLSX exports
- Brevo email notifications and delivery deduplication
- WhatsApp attendance summary sharing
- Profile image upload and deletion through Cloudinary
- CSRF, session, role, and input protection

### 5.2 Out of Scope for the Current Release

- Native mobile applications
- Payroll processing and salary calculation
- Benefits or compensation administration
- Recruitment, applicant tracking, or performance reviews
- Direct automated WhatsApp delivery
- Single sign-on, SCIM, or external identity providers
- Multi-tenant organization isolation
- Granular custom employee roles beyond administrator and employee
- Time tracking for tasks or projects
- Full audit-log UI

## 6. System Roles and Permissions

| Capability | Employee | Administrator |
| --- | --- | --- |
| Register, log in, reset password | Yes | Yes |
| Submit onboarding | Before approval | Not applicable |
| View own profile and dashboard | Approved only | Yes |
| Check in and out | Approved only | No employee action |
| View own attendance, leave, and calendar | Approved only | Yes, through administrator views |
| Submit or cancel leave | Approved only | No self-service employee workflow |
| Configure office and leave rules | No | Yes |
| Invite, edit, activate, and approve employees | No | Yes |
| Approve or reject leave | No | Yes |
| View, correct, recompute, or export attendance | No | Yes |
| View all employee and department reports | No | Yes |

All protected employee APIs require an active authenticated account and approved onboarding unless the endpoint is specifically for onboarding or account setup. Administrative APIs require the `admin` role.

## 7. Functional Requirements

### FR-01 Authentication

- The system shall allow account registration with name, email, and password.
- Passwords shall be validated and hashed before storage.
- The system shall provide login, logout, forgot-password, and password-reset flows.
- The system shall issue an HTTP-only JWT cookie and expose a current-user endpoint.
- Password changes and resets shall invalidate existing sessions through session versioning.
- Public authentication endpoints shall have rate limiting.
- The system shall not reveal whether an email exists in password-reset responses.

### FR-02 Employee Onboarding

- Invitations shall create inactive setup accounts with an invitation setup link valid for 24 hours.
- A reminder shall generate a fresh setup link for incomplete or rejected employees.
- Onboarding shall collect department, designation, shift, and joining date.
- Department selections shall be restricted to configured departments.
- Submitted onboarding records shall enter a `pending` state.
- Administrators shall approve or reject pending records.
- Rejection shall require a review note and return the account to a rejected state.
- Approved employees shall be assigned the selected department and shift settings.
- Approved employees shall become eligible for attendance and employee features.
- Administrators shall be able to repair inconsistent onboarding status records.

### FR-03 Employee and Account Management

- Administrators shall search, filter, sort, and paginate employees by status, account state, department, and name or email.
- Administrators shall invite employees and send reminders.
- Administrators shall edit employee name, profile image, department, designation, joining date, shift, and custom shift hours.
- Administrators shall activate or deactivate employee accounts.
- Employees shall update their profile details and profile image.
- Employees shall change passwords and notification preferences.
- Employee data shall be exportable as CSV.
- Deactivated or session-invalidated users shall be unable to access protected APIs.

### FR-04 Office Settings

- Administrators shall manage one global office configuration.
- Office settings shall include name, latitude, longitude, geofence radius, grace minutes, AM/PM shift hours, weekend days, and departments.
- Geofence radius shall be constrained to a safe configurable range.
- Coordinate and department fields shall be validated before saving.
- Public onboarding shall read available departments and configured shift times.
- Attendance shall be unavailable until a valid office location is configured.

### FR-05 Geolocation Attendance

- Employees shall retrieve today's attendance, office settings, and check-in eligibility.
- Check-in shall be available only within the configured check-in window.
- The system shall require browser geolocation data and validate latitude, longitude, and accuracy.
- A check-in or check-out shall be accepted only when the employee is within the configured geofence.
- One attendance record shall exist per employee per calendar date.
- Check-in shall calculate whether the record is present or late.
- Lateness shall include configured grace minutes.
- Check-out shall calculate worked minutes and store check-out location.
- Employees shall view filtered attendance history and monthly summaries.
- Holidays, weekends, full-day leave, half-day leave, joining date, and shift end shall affect eligibility.
- WhatsApp sharing shall prepare a text summary only; sending shall remain user-confirmed.

### FR-06 Attendance Automation

- The system shall close previous days once on startup and at 00:10 Asia/Karachi time.
- Scheduled attendance shall classify eligible employees as present, late, absent, leave, holiday, or weekend.
- The automation shall not create attendance for days before an employee's joining or approval eligibility date.
- Approved full-day leave shall produce a leave record.
- Approved morning or afternoon half-day leave shall produce a half-day leave attendance record.
- An open check-in without check-out shall be identified as missing check-out.
- Administrators shall manually run catch-up automation.
- Administrators shall recompute selected date ranges.
- Administrators shall correct a missing check-out with a time, reason, and optional note.
- Corrections shall be recorded with the correcting administrator and timestamp.
- Automation runs shall be logged and run locks shall prevent concurrent starts.

### FR-07 Holidays and Calendar

- Administrators shall create, edit, and delete holidays.
- Holiday ranges shall require valid start/end dates and shall not overlap another holiday.
- Employees shall view office holidays and personal work-calendar states.
- The calendar shall reflect weekends, holidays, attendance, leave, and pending states where applicable.
- The calendar shall support date navigation and month views.

### FR-08 Leave Types

- Administrators shall create and update active leave types.
- Each type shall have a unique normalized key, display name, yearly quota, carry-forward days, minimum notice, and optional document requirement.
- Leave types shall support unlimited leave.
- Leave types shall support activation/deactivation.
- Employees shall view active leave types.

### FR-09 Leave Policy

- Administrators shall configure:
  - half-day leave allowance,
  - required reason,
  - past-dated requests allowance,
  - past-dated limit,
  - leave-year start date.
- The leave year shall be calculated from the configured leave-year boundary.
- Leave balances shall account for approved leave and carry-forward rules.
- Employees shall preview leave eligibility and working dates before submission.

### FR-10 Leave Requests

- Employees shall submit full-day or eligible half-day leave requests.
- Requests shall validate date order, policy, notice period, working days, overlap, attendance conflict, balance, and supporting document requirements.
- The system shall calculate working days while excluding weekends and holidays.
- Pending and approved overlapping requests shall be rejected.
- Leave with recorded attendance shall be rejected.
- Insufficient balance shall prevent submission.
- Employees shall view leave history and balances by leave year.
- Employees shall cancel their own pending or eligible requests.
- Administrators shall list, filter, export, and inspect leave requests.
- Administrators shall approve or reject leave requests with an optional or required review note.
- Approved leave shall immediately affect attendance resolution.
- Leave actions shall trigger leave-update email notifications where enabled.

### FR-11 Dashboards

- The employee dashboard shall show today's attendance state, leave and work summary, and navigation to core features.
- The administrator dashboard shall show onboarding, account, leave, attendance, department, and monthly operating information.
- Dashboard values shall be derived from approved employee and leave/attendance records.
- Administrators shall receive direct navigation to pending employee, leave, attendance, and report views.

### FR-12 Reports and Exports

- Administrators shall generate monthly attendance reports.
- Reports shall support department and employee filtering.
- Reports shall expose totals for present, late, absent, leave, holiday, weekend, and pending states where supported.
- Administrators shall export monthly reports as XLSX.
- Administrators shall export daily attendance as CSV.
- Administrators shall export leave requests as CSV or XLSX according to available implementation.
- Administrators shall export employee lists as CSV.

### FR-13 Notifications

- Users shall control leave updates, attendance reminders, and weekly summary preferences.
- Attendance reminder emails shall run once per employee per period.
- Check-in reminders shall account for shift start and grace period.
- Check-out reminders shall run near configured shift end.
- Weekly summaries shall run in the configured Asia/Karachi schedule.
- Email delivery attempts shall be claimed and deduplicated to avoid concurrent duplicate sends.
- Failed deliveries shall be marked and retriable.
- Notifications shall not be sent to inactive or unapproved employees.

### FR-14 Profile and Image Management

- Employees shall manage display name and profile image.
- Image uploads shall enforce size and MIME restrictions.
- Images shall be uploaded through Cloudinary and deleted from Cloudinary when replaced or removed.
- Failed image operations shall return actionable errors.

## 8. Key Business Rules

### 8.1 Onboarding State

The canonical states are `incomplete`, `pending`, `approved`, and `rejected`.

- `incomplete`: employee has not submitted onboarding details.
- `pending`: employee submitted onboarding and awaits review.
- `approved`: administrator approved the employee.
- `rejected`: administrator returned onboarding with a rejection note.

Employees who are not approved cannot use attendance or leave features.

### 8.2 Attendance Status

- `present`: checked in before or within the configured grace period.
- `late`: checked in after the grace period.
- `absent`: an eligible working day closes without check-in.
- `leave`: an approved full-day or accounted half-day leave applies.
- `holiday`: the date falls within an office holiday range.
- `weekend`: the date is configured as a weekend.
- `pending`: the date is current or not yet resolved.

### 8.3 Geofence

The server shall compare submitted coordinates using the office latitude and longitude and enforce the configured radius and browser-reported accuracy. Client-side UI distance information shall not replace server validation.

### 8.4 Time and Date Rules

- Calendar operations shall use Asia/Karachi.
- Daily closing shall operate on the previous day in Asia/Karachi.
- Leave date keys shall use `YYYY-MM-DD`.
- Work intervals shall exclude weekends and office holidays.
- Half-day leave shall be exactly one working day.

### 8.5 Leave Balance

Balances shall:

- use the configured leave-year boundary,
- include remaining quota and approved usage,
- honor carry-forward rules,
- allow unlimited leave types separately,
- update as approved or cancelled/rejected records change.

### 8.6 Account Security

- Role checks shall be enforced by the API, not only hidden navigation.
- CSRF validation shall protect state-changing browser requests.
- Password reset and setup tokens shall be stored as hashes.
- JWT cookies shall be HTTP-only and session state shall include a token version.
- Deactivation, password change, and reset shall invalidate prior sessions.

## 9. Information Architecture

### 9.1 Public Routes

- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password`
- `/setup-password`

### 9.2 Employee Routes

- `/onboarding`
- `/dashboard`
- `/dashboard?tab=attendance`
- `/dashboard?tab=leave`
- `/dashboard?tab=calendar`
- `/dashboard?tab=settings`
- `/attendance`
- `/calendar`

### 9.3 Administrator Routes

- `/admin`
- `/admin/dashboard`
- `/admin/dashboard?section=Employees`
- `/admin/dashboard?section=Attendance`
- `/admin/dashboard?section=Leaves`
- `/admin/dashboard?section=Calendar`
- `/admin/dashboard?section=Reports`
- `/admin/dashboard?section=Office%20settings`
- `/admin/dashboard?section=Account%20settings`

## 10. Data Model

| Entity | Purpose |
| --- | --- |
| User | Accounts, role, profile, onboarding status, department, designation, joining date, shift, notification preferences, session version |
| OfficeSettings | Office location, geofence, grace period, AM/PM shifts, weekends, departments |
| Holiday | Organization holiday date ranges |
| Attendance | One daily employee record, check-in/out, locations, status, lateness, worked minutes, leave period |
| AttendanceCorrection | Administrative correction details and audit fields |
| AttendanceAutomationRun | Automation execution, result, and locking metadata |
| AutomationState | Progress state for scheduled attendance closure |
| LeaveType | Leave name, quota, carry-forward, notice, document requirement, active state |
| LeavePolicy | Half-day, reason, past-dated leave, and leave-year policy |
| LeaveRequest | Employee leave range, duration, reason, supporting reference, approval status |
| EmailNotificationDelivery | Delivery claims and deduplicated email send outcomes |

## 11. API Surface

The backend exposes REST endpoints grouped by resource:

- `/api/auth`
- `/api/users`
- `/api/settings`
- `/api/attendance`
- `/api/admin/attendance`
- `/api/leave-types`
- `/api/leaves`
- `/api/jobs`
- `/api/dashboard`
- `/api/reports`
- `/api/health`

Protected routes shall use JWT cookie authentication, role authorization, and onboarding approval checks as appropriate. State-changing routes require a valid CSRF token except explicitly excluded health or automation entry points.

## 12. Architecture and Technology

### 12.1 Frontend

- React 19
- React Router 7
- Vite 8
- Tailwind CSS 4
- Axios
- Day.js
- FullCalendar
- Lucide icons
- React Toastify

### 12.2 Backend

- Node.js
- Express 5
- MongoDB and Mongoose 9
- JWT
- bcrypt
- Zod
- node-cron
- ExcelJS
- Helmet
- Express Rate Limit

### 12.3 Integrations

- MongoDB Atlas or MongoDB-compatible database
- Brevo email API
- Cloudinary image storage
- WhatsApp mobile deep links, WhatsApp Web, and Web Share API
- Vercel frontend deployment
- Render backend deployment

## 13. Security Requirements

- Password minimum length and bcrypt hashing
- HTTP-only JWT cookies
- Session invalidation after password changes and resets
- CSRF protection
- Strict role and approved-state authorization
- CORS allowlisting
- Helmet security headers
- Request body size limits
- Public route rate limiting
- Zod request validation
- Reset/setup tokens stored as hashes
- Sensitive fields excluded from normal API serialization
- No credentials or secrets committed to Git

## 14. Reliability and Data Requirements

- MongoDB should use indexed fields for employee, date, status, and leave queries.
- One attendance record shall exist per employee/date.
- Notification sends shall use delivery deduplication and retry leases.
- Automation shall use a run lock and catch-up state.
- Report and export operations shall remain bounded and handle no-result cases.
- The backend shall use explicit 400/401/403/404/409/422/500 responses.
- External email, image, and geolocation failures shall not silently report success.

## 15. Performance and Usability

- Core pages shall load with clear loading, empty, success, and error states.
- Employee and administrator lists shall be paginated.
- Search shall be debounced in the UI where used.
- Actions shall disable while an operation is in progress.
- Mobile navigation shall remain usable and expose account and sign-out actions.
- Error messages shall explain the next user or administrator action.
- Date and time displays shall use Asia/Karachi.
- The UI shall preserve filters and active sections in URL query parameters where practical.

## 16. Accessibility Requirements

- Navigation controls shall expose appropriate labels and ARIA state.
- Interactive controls shall be keyboard accessible.
- Form fields shall have associated labels or equivalent accessible names.
- Status shall not be communicated by color alone.
- Dialogs and menus shall support dismissal and focus-safe interactions.
- Loading and error states shall be perceivable to assistive technology.

## 17. Deployment and Configuration

### 17.1 Required Backend Configuration

- `NODE_ENV`
- `PORT`
- `CLIENT_URL`
- `MONGO_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CRON_SECRET` where protected automation execution is enabled

### 17.2 Required Frontend Configuration

- `VITE_API_URL`
- `VITE_CSP_CONNECT_SRC`

## 18. Acceptance Criteria

The release baseline is accepted when:

1. An employee can register, log in, configure onboarding, await approval, and gain access after approval.
2. An administrator can invite, filter, approve, reject, edit, deactivate, remind, and export employees.
3. An administrator can configure office location, geofence, departments, shifts, weekends, holidays, and leave policies.
4. An approved employee can check in and out only within the office geofence and allowed shift window.
5. Attendance history and daily/weekly status are consistent with the server timezone and configured rules.
6. Daily automation and recomputation produce consistent statuses and do not duplicate records.
7. Administrators can correct missing check-outs and export daily attendance.
8. Employees can preview and submit valid leave, while overlapping, insufficient-balance, and attendance-conflict requests are rejected.
9. Administrators can approve and reject leave and employees can observe resulting balances and status.
10. Monthly reports and exports contain authorized data in the expected format.
11. Notification preferences prevent or allow the supported email categories appropriately.
12. Unauthorized, inactive, unapproved, and cross-role API calls are rejected.
13. Frontend lint, frontend tests, frontend build, and backend syntax validation pass in CI or the release environment.

## 19. Test Coverage Guidance

### Automated

- Authentication, password reset, and session invalidation
- Role and onboarding middleware
- CSRF and public rate limiting
- Onboarding state transitions
- Office and geofence validation
- Leave validation and overlap rules
- Leave balance calculations
- Leave-year boundaries
- Attendance status resolution
- Automation catch-up and duplicate prevention
- Notification delivery deduplication
- Report summaries and exports

### Manual

- Real browser geolocation permissions and geofence checks
- Mobile and desktop responsive navigation
- Invitation and password setup emails
- Brevo production delivery
- Cloudinary image upload replacement and deletion
- Mobile WhatsApp app handoff, WhatsApp Web handoff, and manual Send confirmation
- MongoDB and cron behavior in the production environment
- CSV and XLSX opening in spreadsheet applications

## 20. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Browser denies or inaccurately reports location | Clearly explain permission and accuracy requirements; enforce server-side geofence and accuracy constraints |
| External email or image provider unavailable | Return actionable failures, allow retries, and do not mark the primary account setup as complete when an invitation email fails |
| Automation run overlap or missed schedule | Use run locks, startup catch-up, logged runs, and manual recomputation |
| Duplicate notifications | Persist delivery identities and use sending leases |
| Session or CSRF misconfiguration | Test production cookies, CORS, CSRF, and proxy settings |
| Incorrect timezone calculations | Centralize Asia/Karachi date/time helpers and test boundaries |
| Leave or attendance rule drift | Keep policy resolution in backend services and use shared helpers |
| Spreadsheet formula or encoding issues | Export plain validated values and escape CSV/XLSX text |
| Excel dependency vulnerabilities | Monitor upstream updates and replace ExcelJS if a compatible secure alternative becomes available |

## 21. Release Readiness

Before production expansion, the project should verify:

- real authorized admin and employee accounts,
- office coordinates and geofence radius,
- production CORS and CSRF cookies,
- Brevo sender and domain setup,
- Cloudinary credentials,
- MongoDB network access and backups,
- scheduled jobs and server uptime,
- timezone behavior around midnight,
- mobile geolocation and WhatsApp sharing,
- report exports and spreadsheet compatibility.

## 22. Roadmap Considerations

Potential future releases should be prioritized through usage data and stakeholder feedback:

- Multi-organization/tenant support
- Granular permissions and custom roles
- Mobile application
- Payroll integrations
- Advanced scheduling and shift rotations
- Direct notification providers and in-app notification center
- Comprehensive audit-log UI
- Automated leave carry-forward and accrual jobs
- Self-service attendance dispute workflow
- Data retention and compliance controls
- Centralized observability and delivery dashboards

