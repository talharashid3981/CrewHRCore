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

export const updateMyProfile = (data) =>
  api.patch("/users/me", data).then((res) => res.data);

export const changeMyPassword = (data) =>
  api.patch("/users/me/password", data).then((res) => res.data);

export const getEmployeeSummary = () =>
  api.get("/users/summary").then((res) => res.data);

export const listEmployees = (params = {}) =>
  api.get("/users", { params }).then((res) => res.data);

export const approveEmployee = (id, data = {}) =>
  api.patch(`/users/${id}/approve`, data).then((res) => res.data);

export const rejectEmployee = (id, note) =>
  api.patch(`/users/${id}/reject`, { note }).then((res) => res.data);

export const setEmployeeStatus = (id, isActive) =>
  api.patch(`/users/${id}/status`, { isActive }).then((res) => res.data);

export const updateEmployee = (id, data) =>
  api.patch(`/users/${id}`, data).then((res) => res.data);

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
