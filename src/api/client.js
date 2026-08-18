import axios from 'axios';
import toast from 'react-hot-toast';

const client = axios.create({
  baseURL: 'https://lightpink-pigeon-633801.hostingersite.com/api',
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (error) => {
    const status  = error.response?.status;
    const message = error.response?.data?.message;
    if (status === 401) { localStorage.removeItem('token'); window.location.href = '/login'; }
    else if (status === 403) toast.error('ليس لديك صلاحية لهذا الإجراء');
    else if (status >= 500) toast.error('خطأ في الخادم، يرجى المحاولة لاحقاً');
    else if (message)       toast.error(message);
    return Promise.reject(error);
  }
);

export default client;