import axios from 'axios';

const TOKEN_KEY = 'smartspend-token';

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// VITE_API_URL must contain the backend origin only.
// Example: https://smartspend-backend-9s52.onrender.com
const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, '')}/api`
  : '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = tokenStorage.get();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginCall =
      error.config?.url?.includes('/auth/login') ||
      error.config?.url?.includes('/auth/register');

    if (
      error.response?.status === 401 &&
      tokenStorage.get() &&
      !isLoginCall
    ) {
      tokenStorage.clear();
      window.dispatchEvent(new Event('auth:logout'));
    }

    return Promise.reject(error);
  }
);

export function getErrorMessage(error, fallback = 'Something went wrong.') {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }

  if (error?.code === 'ERR_NETWORK') {
    return 'Cannot reach the server. Check that the backend is running.';
  }

  return fallback;
}

export const getFieldErrors = (error) =>
  error?.response?.data?.errors || {};

export default api;