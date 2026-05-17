import { search as searchApi } from './db.js';
import { router, setBreadcrumb, showHome } from './app.js';
import { TYPE_PILL } from './sidebar.js';

let debounceTimer = null;
let lastQuery = '';

export function attachSearchInput(value) {
  const q = (value || '').trim();
  if (debounceTimer) clearTimeout(debounceTimer);
  if (q === '') {
    if (lastQuery !== '') {
      lastQuery = '';
      router.navigate('/');
    }
    return;
  }
  debounceTimer = setTimeout(() => {
    lastQuery = q;
    doSearch(q);
  }, 250);
}

function highlight(text, q) {
  if (!q) return text;
  const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return String(text || '').replace(re, '<mark>$1</mark>');
}

export async function doSearch(query) {
  const q = String(query || '').trim();
  setBreadcrumb([
    { label: 'Home', onClick: () => router.navigate('/') },
    { label: 'Search' },
    { label: q ? `“${q}”` : '' },
  ]);
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Searching…</div>';
  if (!q) return showHome();

  let results = [];
  try {
    results = await searchApi.query(q);
  } catch (e) {
    content.innerHTML = `<div class="empty-state">Search failed: ${e.message}</div>`;
    return;
  }

  content.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'search-results fade-in';

  const meta = document.createElement('div');
  meta.className = 'search-meta';
  meta.textContent = `${results.length} result${results.length === 1 ? '' : 's'} for “${q}”`;
  wrap.appendChild(meta);

  if (results.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = `No results for “${q}”`;
    wrap.appendChild(empty);
  } else {
    for (const r of results) {
      const row = document.createElement('div');
      row.className = 'search-result';
      const head = document.createElement('div');
      head.className = 'search-result-row';
      head.innerHTML = `
        <span class="search-result-pill ${r.type}">${TYPE_PILL[r.type] || r.type}</span>
        <span class="search-result-title">${highlight(r.title, q)}</span>
      `;
      row.appendChild(head);
      if (r.desc) {
        const d = document.createElement('div');
        d.className = 'search-result-desc';
        d.innerHTML = highlight(r.desc, q);
        row.appendChild(d);
      }
      if (r.excerpt && r.excerpt !== r.desc) {
        const ex = document.createElement('div');
        ex.className = 'search-result-excerpt';
        ex.innerHTML = highlight(r.excerpt, q);
        row.appendChild(ex);
      }
      row.addEventListener('click', () => router.navigate('/entry/' + r.id));
      wrap.appendChild(row);
    }
  }
  content.appendChild(wrap);
}
