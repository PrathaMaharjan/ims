import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

let currentAccessToken: string | null = null;

export function setAccessToken(token: string | null) {
  currentAccessToken = token;
}

export function getAccessToken(): string | null {
  return currentAccessToken;
}

export const api = axios.create({
  baseURL: process.env.BASE_URL,
  withCredentials: true, // sends the httpOnly refresh cookie automatically
});

api.interceptors.request.use((config) => {
  if (currentAccessToken) {
    config.headers.Authorization = `Bearer ${currentAccessToken}`;
  }
  return config;
});

// If a request fails with 401 (expired access token), try refreshing once,
// then retry the original request. If refresh also fails, give up and
// let the error propagate (AuthProvider will treat this as logged-out).
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const res = await axios.post("/api/auth/refresh", null, { withCredentials: true });
  const newToken = res.data.accessToken;
  setAccessToken(newToken);
  return newToken;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    const isAuthEndpoint = originalRequest.url?.startsWith("/auth/");
    if (error.response?.status !== 401 || originalRequest._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }
        originalRequest._retry = true;

    try {
      // De-dupe concurrent refresh calls — if 5 requests 401 at once,
      // only refresh once, not five times.
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch {
      setAccessToken(null);
      return Promise.reject(error);
    }
  }
);