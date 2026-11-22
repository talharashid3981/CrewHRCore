# Crew HRCore

Crew HRCore is a role-based SaaS Human Resource Management System (HRMS) for managing employee onboarding, attendance, leave, office policies, reporting, and administrative workflows.

**Live application:** <https://crew-hr-core.vercel.app>  
**Live API health check:** <https://crewhrcore.onrender.com/api/health>

## Senior Project Submission Summary

| Item | Details |
| --- | --- |
| **1. Project Name** | Crew HRCore |
| **2. Department** | Web Development / MERN Stack |
| **3. Brief Description** | A secure HRMS that enables administrators to manage employees, departments, attendance rules, leave policies, holidays, reports, and office settings. Employees can complete onboarding, record attendance using geofencing, submit leave requests, view their work records, and share attendance details through WhatsApp. |
| **4. Technologies Used** | React, Vite, Tailwind CSS, React Router, Axios, Node.js, Express.js, MongoDB, Mongoose, JWT, bcrypt, Helmet, Express Rate Limit, Zod, node-cron, ExcelJS, Brevo email API, and WhatsApp Web Share / Web Share API. |
| **5. Work Completed** | Authentication, employee onboarding, approval workflow, department configuration, location-based attendance, leave management, office settings, holiday calendar, automation, reports, CSV/XLSX export, email flows, WhatsApp attendance sharing, validation, access control, and deployment configuration. |
| **6. Current Status** | Deployed and functionally complete. Final user-acceptance testing is recommended with real employee/admin accounts, location permission, email delivery, and WhatsApp group selection. |
| **7. Project URL / Live Demo** | <https://crew-hr-core.vercel.app> |
| **8. Localhost Access** | Frontend: `http://localhost:5173`; Backend: `http://localhost:8000/api/health` |

## Project Status

**Status: Fully functional core HRMS, deployed, and ready for demonstration.**

The production frontend and API health endpoint were verified as reachable. Frontend unit tests, linting, production build, and backend JavaScript syntax validation also passed.

Some real-world actions require user-controlled external services and should be demonstrated manually:

- Browser location permission and physical geofence validation for check-in/check-out
- Email delivery through the configured Brevo account
- WhatsApp Web/mobile app opening and manual group selection before sending
- MongoDB Atlas connectivity and allowed network access

## Key Features

### Employee Features

- Secure registration, login, logout, password reset, and profile/password management
- Guided onboarding with administrator-configured departments and shift selection
- Attendance check-in and check-out with office geofence, GPS accuracy checks, shift rules, lateness calculation, and attendance history
- WhatsApp attendance sharing after successful check-in or check-out
- Leave balance, leave request, cancellation, and request-status tracking
- Holiday and personal calendar views
- Dashboard with monthly attendance, leave, and recent work information

### Administrator Features

- Employee invitation, onboarding approval/rejection, reminders, account activation, editing, and export
- Central office settings for office location, geofence radius, grace period, weekend days, shifts, and managed departments
- Attendance administration, manual correction, recomputation, daily automation, and export
- Leave type and leave policy configuration with request approval/rejection
- Holiday calendar management
- Department-level dashboard insights and employee reports
- Monthly attendance reports with Excel export

### WhatsApp Attendance Sharing

After a successful check-in or check-out, Crew HRCore prepares a saved attendance report containing the date, employee name, role, department, entry/exit time, worked hours, and attendance status.

- On supported mobile browsers, the native share sheet is opened.
- On desktop, WhatsApp Web opens with the report prefilled.
- The employee manually selects the intended WhatsApp group/contact and presses **Send**. This is intentional: web applications cannot silently send messages to a WhatsApp group without user confirmation.

## Security and Production Controls

- Passwords are hashed with bcrypt.
- JWT authentication uses HTTP-only cookies.
- Session versioning invalidates previous sessions after password changes or resets.
- CSRF tokens protect state-changing browser requests.
- Role-based authorization protects employee and administrator APIs.
- Zod validates incoming request payloads.
- Helmet security headers, CORS allowlisting, request-size limits, and rate limits are enabled.
- Password-reset responses do not reveal whether an account exists.
- Environment variables and credentials are excluded from Git.
- Production API URL and Content Security Policy support are configured separately from local development.

## Validation Completed

| Check | Result |
| --- | --- |
| Frontend utility tests | Passed: 7/7 |
| Frontend lint | Passed |
| Frontend production build | Passed |
| Backend JavaScript syntax validation | Passed: 42 files |
| Deployed frontend availability | Passed: HTTP 200 |
| Deployed API health endpoint | Passed: HTTP 200 |

## Local Development

### Prerequisites

- Node.js 20+ (Node.js 22 is also supported)
- MongoDB Atlas database or local MongoDB
- A MongoDB Atlas IP allowlist entry when using Atlas

### Backend

Create `backend/.env`:

```env
NODE_ENV=development
PORT=8000
CLIENT_URL=http://localhost:5173
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=use_a_long_random_secret
JWT_EXPIRES_IN=7d
BREVO_API_KEY=your_brevo_key
BREVO_SENDER_EMAIL=your_sender_email
BREVO_SENDER_NAME=Crew HRCore
```

Run:

```bash
cd backend
npm install
npm run dev
```

### Frontend

Create `frontend/.env.local`:

```env
VITE_API_URL=http://localhost:8000/api
VITE_CSP_CONNECT_SRC=http://localhost:8000
```

Run:

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173> and confirm the API is available at <http://localhost:8000/api/health>.

## Production Deployment Configuration

### Backend environment variables

```env
NODE_ENV=production
PORT=8000
CLIENT_URL=https://crew-hr-core.vercel.app
MONGO_URI=your_production_mongodb_connection_string
JWT_SECRET=use_a_unique_long_random_secret
JWT_EXPIRES_IN=7d
BREVO_API_KEY=your_brevo_key
BREVO_SENDER_EMAIL=your_sender_email
BREVO_SENDER_NAME=Crew HRCore
CRON_SECRET=use_a_separate_long_random_secret
```

### Frontend environment variables

```env
VITE_API_URL=https://crewhrcore.onrender.com/api
VITE_CSP_CONNECT_SRC=https://crewhrcore.onrender.com
```

After setting frontend variables, create a fresh production build:

```bash
cd frontend
npm run build
```

## Known Production Consideration

The dependency audit reports two moderate upstream advisories through `exceljs` and its `uuid` dependency. There is currently no safe compatible automatic upgrade. The dependency is used for report export and should be monitored for an upstream release or replaced in a future maintenance update.

## Project Scope Conclusion

Crew HRCore delivers the core workflows of a modern HRMS: secure user management, onboarding, department administration, attendance, leave, reporting, and operational automation. The project is appropriate for live demonstration and senior review, with final acceptance testing recommended using real authorized accounts and external-service credentials.
