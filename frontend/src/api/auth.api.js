import api from "./axios";

export const registerUser = (data) =>
  api.post("/auth/register", data).then((res) => res.data);

export const loginUser = (data) =>
  api.post("/auth/login", data).then((res) => res.data);

export const logoutUser = () =>
  api.post("/auth/logout").then((res) => res.data);

export const getMe = () => api.get("/auth/me").then((res) => res.data);

export const forgotPassword = (email) =>
  api.post("/auth/forgot-password", { email }).then((res) => res.data);

export const resetPassword = ({ token, password }) =>
  api.post("/auth/reset-password", { token, password }).then((res) => res.data);

export const submitOnboarding = (data) =>
  api.post("/users/me/onboarding", data).then((res) => res.data);

export const getOnboardingShiftTimes = () =>
  api.get("/settings/onboarding-shifts").then((res) => res.data);

export const updateMyProfile = (data) =>
  api.patch("/users/me", data).then((res) => res.data);

export const updateMyNotificationPreferences = (preferences) =>
  api.patch("/users/me/notification-preferences", preferences).then((res) => res.data);

export const uploadMyProfileImage = (image) =>
  api.put("/users/me/profile-image", image, {
    headers: { "Content-Type": image.type },
  }).then((res) => res.data);

export const changeMyPassword = (data) =>
  api.patch("/users/me/password", data).then((res) => res.data);

export const getEmployeeSummary = () =>
  api.get("/users/summary").then((res) => res.data);

export const listEmployees = (params = {}) =>
  api.get("/users", { params }).then((res) => res.data);

export const exportEmployees = (params = {}) =>
  api.get("/users/export", { params, responseType: "blob" }).then((res) => res);

export const inviteEmployee = (data) =>
  api.post("/users/invite", data).then((res) => res.data);

export const remindEmployee = (id) =>
  api.post(`/users/${id}/remind`).then((res) => res.data);

export const approveEmployee = (id, data = {}) =>
  api.patch(`/users/${id}/approve`, data).then((res) => res.data);

export const rejectEmployee = (id, note) =>
  api.patch(`/users/${id}/reject`, { note }).then((res) => res.data);

export const setEmployeeStatus = (id, isActive) =>
  api.patch(`/users/${id}/status`, { isActive }).then((res) => res.data);

export const updateEmployee = (id, data) =>
  api.patch(`/users/${id}`, data).then((res) => res.data);

export const repairEmployeeOnboardingStatus = (id) =>
  api.post(`/users/${id}/repair-status`).then((res) => res.data);

export const getOfficeSettings = () =>
  api.get("/settings/office").then((res) => res.data);

export const updateOfficeSettings = (data) =>
  api.put("/settings/office", data).then((res) => res.data);

export const listHolidays = (params = {}) =>
  api.get("/settings/holidays", { params }).then((res) => res.data);

export const createHoliday = (data) =>
  api.post("/settings/holidays", data).then((res) => res.data);

export const updateHoliday = (id, data) =>
  api.patch(`/settings/holidays/${id}`, data).then((res) => res.data);

export const deleteHoliday = (id) =>
  api.delete(`/settings/holidays/${id}`).then((res) => res.data);

export const getAttendanceToday = () =>
  api.get("/attendance/today").then((res) => res.data);

export const checkInAttendance = (location) =>
  api.post("/attendance/check-in", location).then((res) => res.data);

export const checkOutAttendance = (location) =>
  api.post("/attendance/check-out", location).then((res) => res.data);

export const getAttendanceHistory = (params = {}) =>
  api.get("/attendance/history", { params }).then((res) => res.data);

export const listLeaveTypes = (params = {}) =>
  api.get("/leave-types", { params }).then((res) => res.data);

export const createLeaveType = (data) =>
  api.post("/leave-types", data).then((res) => res.data);

export const updateLeaveType = (id, data) =>
  api.patch(`/leave-types/${id}`, data).then((res) => res.data);

export const getLeavePolicy = () =>
  api.get("/leave-types/policy").then((res) => res.data);

export const updateLeavePolicy = (data) =>
  api.put("/leave-types/policy", data).then((res) => res.data);

export const previewLeave = (params) =>
  api.get("/leaves/preview", { params }).then((res) => res.data);

export const getMyLeaveBalance = (year) =>
  api.get("/leaves/balance", { params: { year } }).then((res) => res.data);

export const applyLeave = (data) =>
  api.post("/leaves", data).then((res) => res.data);

export const getMyLeaves = (params = {}) =>
  api.get("/leaves/me", { params }).then((res) => res.data);

export const cancelLeave = (id) =>
  api.patch(`/leaves/${id}/cancel`).then((res) => res.data);

export const listLeaveRequests = (params = {}) =>
  api.get("/leaves", { params }).then((res) => res.data);

export const getAdminLeaveDetail = (id) =>
  api.get(`/leaves/detail/${id}`).then((res) => res.data);

export const exportLeaveRequests = (params = {}) =>
  api.get("/leaves/export", { params, responseType: "blob" }).then((res) => res);

export const approveLeave = (id) =>
  api.patch(`/leaves/${id}/approve`).then((res) => res.data);

export const rejectLeave = (id, note) =>
  api.patch(`/leaves/${id}/reject`, { note }).then((res) => res.data);

export const recomputeAttendance = (data) =>
  api.post("/admin/attendance/recompute", data).then((res) => res.data);

export const runAttendanceAutomation = () =>
  api.post("/admin/attendance/run-now").then((res) => res.data);

export const getAdminAttendanceDay = (params = {}) =>
  api.get("/admin/attendance/day", { params }).then((res) => res.data);

export const exportAdminAttendanceDay = (params = {}) =>
  api.get("/admin/attendance/export", { params, responseType: "blob" }).then((res) => res);

export const correctMissingCheckOut = (attendanceId, data) =>
  api.post(`/admin/attendance/${attendanceId}/correct-checkout`, data).then((res) => res.data);

export const resolveAttendanceRange = (employeeId, params) =>
  api.get(`/admin/attendance/resolve/${employeeId}`, { params }).then((res) => res.data);

export const getMonthlyReport = (params = {}) =>
  api.get("/reports/monthly", { params }).then((res) => res.data);

export const getEmployeeMonthlyReport = (employeeId, params = {}) =>
  api.get(`/reports/monthly/${employeeId}`, { params }).then((res) => res.data);

export const exportMonthlyReport = (params = {}) =>
  api.get("/reports/monthly/export", { params, responseType: "blob" }).then((res) => res);

export const getDashboardToday = () =>
  api.get("/dashboard/today").then((res) => res.data);

export const getAdminDashboard = () =>
  api.get("/dashboard/admin").then((res) => res.data);

export const getDashboardCalendar = (month) =>
  api.get("/dashboard/calendar", { params: { month } }).then((res) => res.data);

export const getDashboardMe = () =>
  api.get("/dashboard/me").then((res) => res.data);
