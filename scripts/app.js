import { Router } from './router.js';
import { buildSidebar, setActiveNav, getCachedEntries, TYPE_LABELS, TYPE_HEADINGS, TYPE_PILL, REGION_LABELS, REGION_ORDER, TYPE_ORDER } from './sidebar.js';
import { showEntry } from './viewer.js';
import { doSearch, attachSearchInput } from './search.js';
import { showPasswordModal, disableEditMode, restoreEditModeSilently } from './auth.js';
import { exportAll, openImport } from './ioutils.js';

export const router = new Router();

export function showToast(message, type = 'info') {
  const root = document.getElementById('toast-root');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  root.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 600);
  }, 2800);
}

export function setBreadcrumb(parts) {
  const bc = document.getElementById('breadcrumb');
  bc.innerHTML = '';
  parts.forEach((p, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'crumb-sep';
      sep.textContent = '/';
      bc.appendChild(sep);
    }
    const isLast = i === parts.length - 1;
    if (p.onClick && !isLast) {
      const a = document.createElement('a');
      a.textContent = p.label;
      a.addEventListener('click', p.onClick);
      bc.appendChild(a);
    } else {
      const span = document.createElement('span');
      span.className = isLast ? 'crumb-current' : '';
      span.textContent = p.label;
      bc.appendChild(span);
    }
  });
}

function buildTopbar() {
  const tb = document.getElementById('topbar');
  tb.innerHTML = `
    <button class="hamburger" id="hamburger" aria-label="Menu">☰</button>
    <span class="topbar-logo">ENT REFERENCE</span>
    <span class="topbar-divider"></span>
    <input class="topbar-search" id="topbar-search" type="search" placeholder="Search…" />
    <div class="topbar-filters">
      <button class="filter-pill dx" data-type="dx">Diagnoses</button>
      <button class="filter-pill proc" data-type="proc">Procedures</button>
      <button class="filter-pill ma" data-type="ma">MA</button>
    </div>
    <div class="topbar-spacer"></div>
    <div class="topbar-right">
      <span class="edit-badge">● Edit Mode</span>
      <div style="position:relative">
        <button class="menu-btn" id="menu-btn" title="More">⋯</button>
      </div>
      <button class="lock-toggle" id="lock-toggle">✏ Edit</button>
    </div>
  `;

  document.getElementById('hamburger').addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
  });

  document.getElementById('topbar-search').addEventListener('input', (e) => {
    attachSearchInput(e.target.value);
  });

  for (const pill of document.querySelectorAll('.filter-pill')) {
    pill.addEventListener('click', () => {
      const t = pill.dataset.type;
      router.navigate('/cat/' + t);
    });
  }

  document.getElementById('lock-toggle').addEventListener('click', () => {
    if (document.body.classList.contains('edit-mode')) {
      disableEditMode();
    } else {
      showPasswordModal();
    }
  });

  const menuBtn = document.getElementById('menu-btn');
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });
  document.addEventListener('click', () => closeMenu());
}

function toggleMenu() {
  const existing = document.getElementById('menu-dropdown');
  if (existing) { existing.remove(); return; }
  const btn = document.getElementById('menu-btn');
  const wrap = btn.parentElement;
  const dd = document.createElement('div');
  dd.id = 'menu-dropdown';
  dd.className = 'menu-dropdown';
  dd.addEventListener('click', (e) => e.stopPropagation());

  const exportBtn = document.createElement('button');
  exportBtn.className = 'menu-item';
  exportBtn.textContent = 'Export all (JSON)';
  exportBtn.addEventListener('click', async () => {
    closeMenu();
    await exportAll();
  });
  dd.appendChild(exportBtn);

  const importBtn = document.createElement('button');
  importBtn.className = 'menu-item';
  importBtn.textContent = 'Import JSON…';
  importBtn.addEventListener('click', () => {
    closeMenu();
    openImport();
  });
  dd.appendChild(importBtn);

  wrap.appendChild(dd);
}
function closeMenu() {
  const existing = document.getElementById('menu-dropdown');
  if (existing) existing.remove();
}

function showHome() {
  setActiveNav(null);
  setBreadcrumb([{ label: 'Home' }]);
  const list = getCachedEntries();

  // Group by type, then region
  const byType = {};
  for (const t of TYPE_ORDER) {
    byType[t] = {};
    for (const r of REGION_ORDER) byType[t][r] = [];
  }
  for (const e of list) {
    const r = REGION_LABELS[e.region] ? e.region : 'general';
    if (byType[e.type] && byType[e.type][r]) byType[e.type][r].push(e);
  }
  for (const t of TYPE_ORDER) {
    for (const r of REGION_ORDER) {
      byType[t][r].sort((a, b) => a.title.localeCompare(b.title));
    }
  }

  const content = document.getElementById('content');
  content.innerHTML = '';
  content.classList.remove('fade-in');
  void content.offsetWidth;

  const wrap = document.createElement('div');
  wrap.className = 'fade-in';

  const hero = document.createElement('div');
  hero.className = 'home-hero';
  hero.innerHTML = `
    <h1>ENT Clinical Reference</h1>
    <p>Quick-reference for diagnoses, procedures, and MA workflows. Click any entry, search, or browse a category.</p>
  `;
  wrap.appendChild(hero);

  // Three category cards across the top
  const cards = document.createElement('div');
  cards.className = 'home-cards';
  for (const t of TYPE_ORDER) {
    const total = REGION_ORDER.reduce((sum, r) => sum + byType[t][r].length, 0);
    const card = document.createElement('div');
    card.className = `home-card ${t}`;
    card.innerHTML = `
      <div class="home-card-label">${TYPE_PILL[t]}</div>
      <div class="home-card-title">${TYPE_LABELS[t]}</div>
      <div class="home-card-count">${total} ${total === 1 ? 'entry' : 'entries'}</div>
    `;
    card.addEventListener('click', () => router.navigate('/cat/' + t));
    cards.appendChild(card);
  }
  wrap.appendChild(cards);

  // Type sections, each subgrouped by region
  for (const t of TYPE_ORDER) {
    const total = REGION_ORDER.reduce((sum, r) => sum + byType[t][r].length, 0);
    if (total === 0) continue;

    const typeWrap = document.createElement('div');
    typeWrap.className = `home-type home-type-${t}`;

    const typeHeader = document.createElement('div');
    typeHeader.className = `home-type-header home-type-header-${t}`;
    typeHeader.textContent = TYPE_HEADINGS[t];
    typeWrap.appendChild(typeHeader);

    for (const region of REGION_ORDER) {
      const items = byType[t][region];
      if (items.length === 0) continue;

      const sub = document.createElement('div');
      sub.className = 'home-region-subhead';
      sub.textContent = `— ${REGION_LABELS[region]} —`;
      typeWrap.appendChild(sub);

      const bubbles = document.createElement('div');
      bubbles.className = 'related-bubbles';
      for (const e of items) {
        const b = document.createElement('span');
        b.className = `related-bubble ${t}`;
        b.textContent = e.title;
        b.addEventListener('click', () => router.navigate('/entry/' + e.id));
        bubbles.appendChild(b);
      }
      typeWrap.appendChild(bubbles);
    }

    wrap.appendChild(typeWrap);
  }

  content.appendChild(wrap);
}

function showCategory(type) {
  if (!TYPE_LABELS[type]) return showHome();
  setActiveNav(null);
  setBreadcrumb([
    { label: 'Home', onClick: () => router.navigate('/') },
    { label: TYPE_LABELS[type] },
  ]);
  const list = getCachedEntries().filter(e => e.type === type);
  const byRegion = {};
  for (const r of REGION_ORDER) byRegion[r] = [];
  for (const e of list) {
    const r = REGION_LABELS[e.region] ? e.region : 'general';
    byRegion[r].push(e);
  }
  for (const r of REGION_ORDER) byRegion[r].sort((a, b) => a.title.localeCompare(b.title));

  const content = document.getElementById('content');
  content.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'fade-in';
  const head = document.createElement('div');
  head.className = 'home-hero';
  head.innerHTML = `<h1>${TYPE_LABELS[type]}</h1><p>${list.length} ${list.length === 1 ? 'entry' : 'entries'}</p>`;
  wrap.appendChild(head);

  for (const region of REGION_ORDER) {
    const items = byRegion[region];
    if (items.length === 0) continue;

    const sub = document.createElement('div');
    sub.className = 'home-region-subhead';
    sub.textContent = `— ${REGION_LABELS[region]} —`;
    wrap.appendChild(sub);

    const bubbles = document.createElement('div');
    bubbles.className = 'related-bubbles';
    for (const e of items) {
      const b = document.createElement('span');
      b.className = `related-bubble ${type}`;
      b.textContent = e.title;
      b.addEventListener('click', () => router.navigate('/entry/' + e.id));
      bubbles.appendChild(b);
    }
    wrap.appendChild(bubbles);
  }
  content.appendChild(wrap);
}

document.addEventListener('DOMContentLoaded', async () => {
  // backdrop for mobile sidebar
  const bd = document.createElement('div');
  bd.id = 'sidebar-backdrop';
  bd.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
  document.body.appendChild(bd);

  buildTopbar();
  await buildSidebar();

  router.on('/', showHome);
  router.on('/entry/:id', (id) => showEntry(id));
  router.on('/cat/:type', (t) => showCategory(t));
  router.on('/search', () => doSearch(document.getElementById('topbar-search').value));
  router.start();

  restoreEditModeSilently();
});

export { showHome, showCategory };
