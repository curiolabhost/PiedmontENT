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

// Direct-to-Cloudinary upload. Vercel functions cap request bodies at 4.5MB,
// so we sign on the server and stream the file straight from browser to
// Cloudinary, then notify the server to record metadata.
export async function uploadMedia(file, { onProgress } = {}) {
  const signRes = await fetch(API + '/media/sign', {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!signRes.ok) throw new Error('Could not get upload signature');
  const { signature, timestamp, cloudName, apiKey, folder } = await signRes.json();

  const form = new FormData();
  form.append('file', file);
  form.append('signature', signature);
  form.append('timestamp', timestamp);
  form.append('api_key', apiKey);
  form.append('folder', folder);

  const uploadResult = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`);

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
          reject(new Error('Invalid Cloudinary response'));
        }
      } else {
        let msg = `Cloudinary upload failed: ${xhr.status}`;
        try {
          const err = JSON.parse(xhr.responseText || '{}');
          if (err.error && err.error.message) msg = err.error.message;
        } catch (_) {}
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(form);
  });

  const format = uploadResult.format || '';
  const baseName = String(uploadResult.public_id || '').split('/').pop();
  const filename = format ? `${baseName}.${format}` : baseName;
  const url = uploadResult.secure_url;

  let kind;
  if (uploadResult.resource_type === 'video') kind = 'video';
  else if (format === 'pdf') kind = 'pdf';
  else if (format === 'docx' || (file.type || '').includes('wordprocessingml')) kind = 'doc';
  else kind = 'image';

  const record = {
    filename,
    url,
    kind,
    mime: file.type,
    sizeBytes: file.size,
  };

  await fetch(API + '/media/record', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(record),
  });

  const response = { ...record };
  if (kind === 'doc') response.fileType = 'docx';
  return response;
}

export async function deleteMedia(filename) {
  const res = await fetch(API + `/media/${filename}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) throw new Error('Delete failed');
  return res.json();
}
