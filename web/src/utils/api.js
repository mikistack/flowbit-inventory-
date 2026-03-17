import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
});

let isRefreshing = false;
let refreshPromise = null;
const subscribers = [];

const subscribe = (callback) => {
  subscribers.push(callback);
};

const notifySubscribers = (token) => {
  subscribers.splice(0).forEach((callback) => callback(token));
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;
    if (response?.status === 401 && !config._retry) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        localStorage.removeItem('accessToken');
        return Promise.reject(error);
      }
      config._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        const refreshClient = axios.create({
          baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
        });
        refreshPromise = refreshClient
          .post('/auth/refresh', { refreshToken })
          .then((res) => {
            const { accessToken, refreshToken: newRefresh } = res.data;
            localStorage.setItem('accessToken', accessToken);
            if (newRefresh) {
              localStorage.setItem('refreshToken', newRefresh);
            }
            api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
            notifySubscribers(accessToken);
            return accessToken;
          })
          .catch((refreshErr) => {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            notifySubscribers(null);
            throw refreshErr;
          })
          .finally(() => {
            isRefreshing = false;
          });
      }

      return new Promise((resolve, reject) => {
        subscribe((token) => {
          if (!token) {
            reject(error);
            return;
          }
          config.headers.Authorization = `Bearer ${token}`;
          resolve(api(config));
        });
        refreshPromise.catch(reject);
      });
    }

    if (response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
    return Promise.reject(error);
  },
);

export default api;
