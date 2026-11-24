import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 45000, // 45 seconds to accommodate initial container spin-up
});

// Request interceptor to automatically attach JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('tallyup_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to auto-retry on 502/503/504 cold-boot recovery & handle 401s
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as any;
    const status = error.response?.status;

    // If Render returns 502/503/504 or network timeout while a service is cold-booting, retry automatically
    if (config && (status === 502 || status === 503 || status === 504 || error.code === 'ECONNABORTED' || !error.response)) {
      config.__retryCount = config.__retryCount || 0;
      if (config.__retryCount < 4) {
        config.__retryCount += 1;
        const delayMs = config.__retryCount * 2500; // 2.5s, 5s, 7.5s, 10s
        console.warn(`[TallyUp] Service waking up (${status || error.code}). Retrying ${config.url} (attempt ${config.__retryCount}/4) in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return apiClient(config);
      }
    }

    if (error.response && error.response.status === 401) {
      // Clear token if expired/invalid on protected routes
      const path = error.config?.url || '';
      if (!path.includes('/auth/')) {
        localStorage.removeItem('tallyup_token');
        localStorage.removeItem('tallyup_user');
      }
    }
    return Promise.reject(error);
  }
);
