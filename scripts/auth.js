import { auth, setToken, clearToken, isAuthenticated } from './db.js';
import { showToast } from './app.js';
import { buildSidebar } from './sidebar.js';

export function showPasswordModal() {
  const root = document.getElementById('modal-root');
  root.innerHTML = '';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const card = document.createElement('div');
  card.className = 'modal-card';

  card.innerHTML = `
    <h3>🔒 Edit Mode</h3>
    <p>Enter the password to enable editing.</p>
    <input type="password" class="password-input" placeholder="Password" autofocus />
    <div class="password-error"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" data-act="cancel">Cancel</button>
      <button class="btn btn-primary" data-act="ok">Unlock</button>
    </div>
  `;

  overlay.appendChild(card);
  root.appendChild(overlay);

  const input = card.querySelector('.password-input');
  const err = card.querySelector('.password-error');
  setTimeout(() => input.focus(), 30);

  function close() {
    root.innerHTML = '';
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter' && document.activeElement === input) submit();
  }
  document.addEventListener('keydown', onKey);

  async function submit() {
    err.textContent = '';
    try {
      const res = await auth.verify(input.value);
      setToken(res.token);
      close();
      enableEditMode();
    } catch (e) {
      err.textContent = e.message || 'Incorrect password';
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
      input.select();
    }
  }

  card.querySelector('[data-act=cancel]').addEventListener('click', close);
  card.querySelector('[data-act=ok]').addEventListener('click', submit);
}

export async function enableEditMode() {
  document.body.classList.add('edit-mode');
  const lock = document.getElementById('lock-toggle');
  if (lock) lock.textContent = '🔒 Lock';
  await buildSidebar();
  showToast('Edit mode enabled', 'info');
}

export async function disableEditMode() {
  document.body.classList.remove('edit-mode');
  clearToken();
  const lock = document.getElementById('lock-toggle');
  if (lock) lock.textContent = '✏ Edit';
  await buildSidebar();
  showToast('Edit mode disabled', 'info');
}

export function restoreEditModeSilently() {
  if (isAuthenticated()) {
    document.body.classList.add('edit-mode');
    const lock = document.getElementById('lock-toggle');
    if (lock) lock.textContent = '🔒 Lock';
  }
}
