import axios from "axios";

export const DEFAULT_PRODUCTION_API_URL = "https://civitas-backend-adjg.onrender.com/api/v1";

export const getApiBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;

  // 1. If explicit valid remote URL is provided in NEXT_PUBLIC_API_URL (not localhost)
  if (envUrl && typeof envUrl === "string" && envUrl.trim() && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    let cleanUrl = envUrl.trim().replace(/\/+$/, "");
    if (!cleanUrl.endsWith("/api/v1")) {
      cleanUrl = `${cleanUrl}/api/v1`;
    }
    return cleanUrl;
  }

  // 2. If running on client/browser:
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    // If not running on localhost/127.0.0.1 (e.g. *.onrender.com, custom domain, tunnel):
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return DEFAULT_PRODUCTION_API_URL;
    }
  } else if (process.env.NODE_ENV === "production") {
    // 3. During production build or SSR:
    return DEFAULT_PRODUCTION_API_URL;
  }

  // 4. Local development environment fallback
  if (envUrl && typeof envUrl === "string" && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  return "/api/v1";
};

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Automatic Request Interceptor to inject Authorization Bearer token and ensure production base URL
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      const currentBase = config.baseURL || "";
      if (!currentBase || currentBase.startsWith("/") || currentBase.includes("localhost") || currentBase.includes("127.0.0.1")) {
        config.baseURL = DEFAULT_PRODUCTION_API_URL;
      } else if (!currentBase.endsWith("/api/v1")) {
        config.baseURL = `${currentBase.replace(/\/+$/, "")}/api/v1`;
      }
    }

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
      return "Unable to connect to the election server. This may be a network issue, a CORS error, or the backend may be unreachable.";
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Request failed. Please try again.";
}
