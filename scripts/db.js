const API = '/api';
let authToken = sessionStorage.getItem('auth_token') || null;

export function setToken(token) {
  authToken = token;
  sessionStorage.setItem('auth_token', token);
}

export function clearToken() {
  authToken = null;
  sessionStorage.removeItem('auth_token');
}

export function isAuthenticated() {
  return !!authToken;
}

function headers(includeAuth = false) {
  const h = { 'Content-Type': 'application/json' };
  if (includeAuth && authToken) h['Authorization'] = `Bearer ${authToken}`;
  return h;
}

async function request(method, path, body = null, auth = false) {
  const opts = { method, headers: headers(auth) };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);

  // Handle expired/invalid JWT
  if (res.status === 401 && auth) {
    clearToken();
    document.body.classList.remove('edit-mode');
    const { showToast } = await import('./app.js');
    showToast('Session expired. Please log in again.', 'info');
    return null;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const auth = {
  verify: (password) => request('POST', '/auth/verify', { password }),
};

export const entries = {
  list:   ()         => request('GET',    '/entries'),
  get:    (id)       => request('GET',    `/entries/${id}`),
  create: (data)     => request('POST',   '/entries', data, true),
  update: (id, data) => request('PUT',    `/entries/${id}`, data, true),
  delete: (id)       => request('DELETE', `/entries/${id}`, null, true),
};

export const search = {
  query: (q) => request('GET', `/search?q=${encodeURIComponent(q)}`),
};

export function uploadMedia(file, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file);

    xhr.open('POST', API + '/media/upload');
    xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          reject(new Error('Invalid server response'));
        }
      } else {
        let err = {};
        try { err = JSON.parse(xhr.responseText || '{}'); } catch (_) {}
        reject(new Error(err.error || `Upload failed: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(form);
  });
}

export async function deleteMedia(filename) {
  const res = await fetch(API + `/media/${filename}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) throw new Error('Delete failed');
  return res.json();
}
