const API_BASE = window.API_BASE || 'https://qoupons-github-io.onrender.com/api';

async function api(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const config = {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  };
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }
  const res = await fetch(url, config);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const CouponAPI = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api(`/coupons${qs ? '?' + qs : ''}`);
  },
  get: (id) => api(`/coupons/${id}`),
  create: (data) => api('/coupons', { method: 'POST', body: data }),
  update: (id, data) => api(`/coupons/${id}`, { method: 'PUT', body: data }),
  delete: (id) => api(`/coupons/${id}`, { method: 'DELETE' }),
  click: (id) => api(`/coupons/${id}/click`, { method: 'POST' }),
  categories: () => api('/coupons/categories')
};

const SubmissionAPI = {
  submit: (data) => api('/submissions', { method: 'POST', body: data }),
  list: () => api('/submissions'),
  approve: (id) => api(`/submissions/${id}/approve`, { method: 'PUT' }),
  reject: (id) => api(`/submissions/${id}/reject`, { method: 'PUT' })
};

const AdminAPI = {
  login: (email, password) => api('/admin/login', { method: 'POST', body: { email, password } }),
  logout: () => api('/admin/logout', { method: 'POST' }),
  me: () => api('/admin/me')
};

const AnalyticsAPI = {
  track: (data) => api('/analytics/track', { method: 'POST', body: data }),
  stats: () => api('/analytics/stats'),
  daily: (days = 7) => api(`/analytics/daily?days=${days}`)
};
