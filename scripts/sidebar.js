import { entries as entriesApi } from './db.js';
import { router } from './app.js';
import { openEditor } from './editor.js';

export const TYPE_LABELS = { dx: 'Diagnoses', proc: 'Procedures', ma: 'MA Protocols' };
export const TYPE_HEADINGS = { dx: 'DIAGNOSES', proc: 'PROCEDURES', ma: 'MA PROTOCOLS' };
export const TYPE_PILL = { dx: 'DX', proc: 'PROC', ma: 'MA' };
export const REGION_LABELS = { nose: 'Nose', ear: 'Ear', general: 'General' };
export const REGION_ORDER = ['nose', 'ear', 'general'];
export const TYPE_ORDER = ['dx', 'proc', 'ma'];
const ADD_LABEL = { dx: '+ Add Diagnosis', proc: '+ Add Procedure', ma: '+ Add Protocol' };

let cachedList = [];

export function getCachedEntries() { return cachedList; }

export function getDisplayTitle(entry) {
  if (entry.type !== 'ma') return entry.title;
  return entry.title
    .replace(/^MA Protocol:\s*/i, '')
    .replace(/^MA Protocol\s*[—–-]\s*/i, '');
}

function regionOf(entry) {
  return REGION_LABELS[entry.region] ? entry.region : 'general';
}

function storageKey(type) { return `sidebar_open_${type}`; }

function isSectionOpen(type) {
  const v = sessionStorage.getItem(storageKey(type));
  if (v === null) return true;
  return v === '1';
}

function setSectionOpen(type, open) {
  sessionStorage.setItem(storageKey(type), open ? '1' : '0');
}

export async function buildSidebar() {
  const sb = document.getElementById('sidebar');
  sb.innerHTML = '<div class="sidebar-loading" style="padding:14px;font-size:12px;color:var(--text3)">Loading…</div>';
  try {
    cachedList = await entriesApi.list();
  } catch (e) {
    sb.innerHTML = `<div style="padding:14px;font-size:12px;color:var(--red)">Failed to load: ${e.message}</div>`;
    return;
  }
  renderSidebar();
}

function renderSidebar() {
  const sb = document.getElementById('sidebar');
  sb.innerHTML = '';

  for (const type of TYPE_ORDER) {
    const typeEntries = cachedList.filter(e => e.type === type);

    const section = document.createElement('div');
    section.className = 'nav-type-section';
    section.dataset.type = type;
    const open = isSectionOpen(type);
    if (!open) section.classList.add('collapsed');

    const heading = document.createElement('div');
    heading.className = 'nav-type-heading';
    heading.addEventListener('click', () => toggleSection(type));

    const label = document.createElement('span');
    label.className = 'nav-type-label';
    label.textContent = TYPE_HEADINGS[type];
    heading.appendChild(label);

    const chevron = document.createElement('span');
    chevron.className = 'nav-type-chevron';
    chevron.textContent = open ? '▾' : '▸';
    heading.appendChild(chevron);

    section.appendChild(heading);

    const body = document.createElement('div');
    body.className = 'nav-type-body';

    for (const region of REGION_ORDER) {
      const items = typeEntries
        .filter(e => regionOf(e) === region)
        .sort((a, b) => a.title.localeCompare(b.title));
      if (items.length === 0) continue;

      const group = document.createElement('div');
      group.className = 'nav-region-group';
      group.dataset.region = region;

      const sub = document.createElement('div');
      sub.className = 'nav-region-subhead';
      sub.textContent = `— ${REGION_LABELS[region]} —`;
      group.appendChild(sub);

      for (const entry of items) {
        const item = document.createElement('div');
        item.className = 'nav-item';
        item.dataset.id = entry.id;
        item.dataset.type = entry.type;

        const dot = document.createElement('span');
        dot.className = `nav-dot dot-${type}`;
        item.appendChild(dot);

        const lbl = document.createElement('span');
        lbl.className = 'nav-label';
        lbl.textContent = getDisplayTitle(entry);
        item.appendChild(lbl);

        const editBtn = document.createElement('button');
        editBtn.className = 'nav-edit-btn';
        editBtn.title = 'Edit';
        editBtn.textContent = '✏';
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openEditor(entry.id);
        });
        item.appendChild(editBtn);

        item.addEventListener('click', () => {
          router.navigate('/entry/' + entry.id);
        });
        group.appendChild(item);
      }

      body.appendChild(group);
    }

    const addWrap = document.createElement('div');
    addWrap.className = 'nav-add-wrap';
    const addBtn = document.createElement('button');
    addBtn.className = 'nav-add-btn';
    addBtn.textContent = ADD_LABEL[type];
    addBtn.addEventListener('click', () => openEditor(null, type));
    addWrap.appendChild(addBtn);
    body.appendChild(addWrap);

    section.appendChild(body);
    sb.appendChild(section);
  }
}

function toggleSection(type) {
  const section = document.querySelector(`.nav-type-section[data-type="${type}"]`);
  if (!section) return;
  const willCollapse = !section.classList.contains('collapsed');
  section.classList.toggle('collapsed', willCollapse);
  const chevron = section.querySelector('.nav-type-chevron');
  if (chevron) chevron.textContent = willCollapse ? '▸' : '▾';
  setSectionOpen(type, !willCollapse);
}

export function setActiveNav(id) {
  for (const item of document.querySelectorAll('.nav-item')) {
    item.classList.toggle('active', item.dataset.id === id);
  }
}
