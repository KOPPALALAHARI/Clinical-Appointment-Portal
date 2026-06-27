import axios from "axios";

const client = axios.create({ baseURL: "http://localhost:8000/api" });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const refreshToken = localStorage.getItem("refresh_token");

    // Only attempt refresh on 401, when we have a refresh token, and haven't retried yet
    if (err.response?.status === 401 && refreshToken && !original._retry) {
      if (isRefreshing) {
        // Queue requests that arrive while a refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            return client(original);
          })
          .catch((e) => Promise.reject(e));
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post("http://localhost:8000/api/auth/refresh", {
          refresh_token: refreshToken,
        });

        localStorage.setItem("token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);

        client.defaults.headers.common.Authorization = `Bearer ${data.access_token}`;
        original.headers.Authorization = `Bearer ${data.access_token}`;

        processQueue(null, data.access_token);
        return client(original);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem("token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
        window.location.href = "/login";
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

export default client;
