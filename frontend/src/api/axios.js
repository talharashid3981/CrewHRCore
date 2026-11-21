import axios from "axios";

const api = axios.create({
  // baseURL: import.meta.env.VITE_API_URL || "https://crewhrcore.onrender.com/api",
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});


let csrfToken = null;
let csrfRequest = null;

const fetchCsrfToken = async () => {
  if (!csrfRequest) {
    csrfRequest = api.get("/auth/csrf").then((response) => {
      csrfToken = response.data.csrfToken;
      return csrfToken;
    }).finally(() => {
      csrfRequest = null;
    });
  }
  return csrfRequest;
};

api.interceptors.request.use(async (config) => {
  const method = (config.method || "get").toLowerCase();
  if (!["get", "head", "options"].includes(method) && !config.headers?.["X-CSRF-Token"]) {
    config.headers = config.headers || {};
    config.headers["X-CSRF-Token"] = csrfToken || await fetchCsrfToken();
  }
  return config;
});


api.interceptors.response.use(undefined, async (error) => {
  const request = error.config;
  if (
    error.response?.status === 403
    && error.response.data?.message === "Invalid CSRF token"
    && request
    && !request.__csrfRetried
  ) {
    request.__csrfRetried = true;
    csrfToken = await fetchCsrfToken();
    request.headers = request.headers || {};
    request.headers["X-CSRF-Token"] = csrfToken;
    return api.request(request);
  }
  return Promise.reject(error);
});

export default api;
