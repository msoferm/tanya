import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// צירוף טוקן ההזדהות לכל בקשה
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('tanya_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ניתוק אוטומטי כשפג תוקף ההזדהות
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem('tanya_token')) {
      localStorage.removeItem('tanya_token');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

/** מחלץ הודעת שגיאה קריאה מתשובת השרת */
export function errMsg(err, fallback = 'אירעה שגיאה') {
  return err?.response?.data?.error || err?.message || fallback;
}

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

export const leadsAPI = {
  list: (params) => api.get('/leads', { params }),
  get: (id) => api.get(`/leads/${id}`),
  create: (data) => api.post('/leads', data),
  update: (id, data) => api.put(`/leads/${id}`, data),
  bulk: (data) => api.patch('/leads/bulk', data),
  remove: (id) => api.delete(`/leads/${id}`),
};

export const remindersAPI = {
  list: (params) => api.get('/reminders', { params }),
  create: (data) => api.post('/reminders', data),
  update: (id, data) => api.put(`/reminders/${id}`, data),
  remove: (id) => api.delete(`/reminders/${id}`),
};

export const statusesAPI = {
  list: () => api.get('/statuses'),
  create: (data) => api.post('/statuses', data),
  update: (id, data) => api.put(`/statuses/${id}`, data),
  remove: (id) => api.delete(`/statuses/${id}`),
};

export const usersAPI = {
  list: (params) => api.get('/users', { params }),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  remove: (id) => api.delete(`/users/${id}`),
};

export const dashboardAPI = {
  stats: () => api.get('/dashboard/stats'),
};

export const importExportAPI = {
  fields: () => api.get('/import-export/fields'),
  logs: () => api.get('/import-export/logs'),
  importFile: (formData) =>
    api.post('/import-export/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  exportFile: (params) =>
    api.get('/import-export/export', { params, responseType: 'blob' }),
  templateFile: () =>
    api.get('/import-export/template', { responseType: 'blob' }),
};

/** מוריד blob כקובץ בדפדפן */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const integrationsAPI = {
  status: () => api.get('/integrations/status'),
  wcTest: () => api.post('/integrations/woocommerce/test'),
  wcSync: (days) => api.post('/integrations/woocommerce/sync', { days }),
  createAccount: (leadId, courseName) =>
    api.post(`/integrations/leads/${leadId}/create-account`, { courseName }),
  getDistribution: () => api.get('/integrations/distribution'),
  setDistribution: (enabled) => api.put('/integrations/distribution', { enabled }),
};

export default api;
