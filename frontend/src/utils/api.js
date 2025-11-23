import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api/',
});

// Request interceptor: Attach access token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: Handle 401 errors by refreshing tokens
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post('http://127.0.0.1:8000/api/token/refresh/', { refresh: refreshToken });
          localStorage.setItem('access_token', res.data.access);
          // Optionally update refresh token if rotated
          if (res.data.refresh) {
            localStorage.setItem('refresh_token', res.data.refresh);
          }
          error.config.headers.Authorization = `Bearer ${res.data.access}`;
          return api(error.config);
        } catch (refreshError) {
          // Refresh failed: Clear tokens and redirect to login
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('username');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;