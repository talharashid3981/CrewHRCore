import axios from "axios";

const api = axios.create({
  // baseURL: import.meta.env.BACKEND_API_URL || "http://localhost:8000/api",
    baseURL: import.meta.env.BACKEND_API_URL || "https://crewhrcore.onrender.com/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

export default api;
