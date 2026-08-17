import axios from "axios";

const getApiBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl;
  }
  return "/api/v1";
};

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Automatic Request Interceptor to inject Authorization Bearer token from localStorage/sessionStorage
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token") || sessionStorage.getItem("voting-access");
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export function setAccessToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("token", token);
    sessionStorage.setItem("voting-access", token);
  }
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
}

export function restoreAccessToken(): string | null {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token") || sessionStorage.getItem("voting-access");
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      return token;
    }
  }
  return null;
}

export function clearAccessToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
    localStorage.removeItem("userRole");
    sessionStorage.removeItem("voting-access");
  }
  delete api.defaults.headers.common.Authorization;
}

export function readable(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data?.detail === "string" && data.detail.trim()) {
      return data.detail;
    }
    if (Array.isArray(data?.detail) && data.detail[0]?.msg) {
      const field = data.detail[0].loc?.slice(-1)[0];
      return field ? `Field '${field}': ${data.detail[0].msg}` : data.detail[0].msg;
    }
    if (typeof data?.message === "string" && data.message.trim()) {
      return data.message;
    }
    if (error.response?.status === 401) {
      return "Invalid voter ID, Local Admin ID, or password.";
    }
    if (error.response?.status === 403) {
      return "Access forbidden. You are not authorized to access this election.";
    }
    if (error.response?.status === 404) {
      return "Requested resource or election not found.";
    }
    if (error.response?.status === 409) {
      return "Conflict: Record or voter ID already registered.";
    }
    if (error.response?.status === 422) {
      return "Validation error: Please check your input fields.";
    }
    if (error.response?.status === 500) {
      return data?.detail || "Server error occurred. Please verify backend logs.";
    }
    if (error.code === "ERR_NETWORK") {
      return "Unable to connect to the election server.";
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Request failed. Please try again.";
}
