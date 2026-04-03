const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5006/api';

function getHeaders() {
  const token = localStorage.getItem('stai_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: getHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('stai_token');
    }
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.response = { status: res.status, data };
    throw err;
  }
  return { data };
}

function getAuthHeadersOnly() {
  const token = localStorage.getItem('stai_token');
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function requestMultipart(method, path, formData) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: getAuthHeadersOnly(),
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) localStorage.removeItem('stai_token');
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.response = { status: res.status, data };
    throw err;
  }
  return { data };
}

const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  delete: (path)        => request('DELETE', path),
  postMultipart: (path, formData) => requestMultipart('POST', path, formData),
};

export default api;
