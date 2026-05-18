import { entries as entriesApi, uploadMedia } from './db.js';
import { router, setBreadcrumb, showToast } from './app.js';
import { buildSidebar, getCachedEntries, setActiveNav, TYPE_LABELS } from './sidebar.js';

const TYPE_ORDER = ['dx', 'proc', 'ma'];
const REGION_ORDER = ['nose', 'ear', 'general'];
const REGION_LABELS = { nose: 'Nose', ear: 'Ear', general: 'General' };
const ALERT_ICON = { 'alert-warn': '⚠', 'alert-info': '→', 'alert-note': '→' };

const SLASH_COMMANDS = [
  { type: 'p', icon: '¶', label: 'Text', meta: 'Paragraph' },
  { type: 'h3', icon: 'H2', label: 'Section heading — major section' },
  { type: 'h2', icon: 'H3', label: 'Subsection heading — subsection label' },
  { type: 'h4', icon: 'H4', label: 'Inline heading — bold label' },
  { type: 'li', icon: '—', label: 'List item', meta: 'Bullet item' },
  { type: 'alert-warn', icon: '⚠', label: 'Warning', meta: 'Warning alert' },
  { type: 'alert-info', icon: '→', label: 'Info', meta: 'Info note' },
  { type: 'alert-note', icon: '→', label: 'Note', meta: 'Callout note' },
  { type: 'step', icon: '①', label: 'Numbered step', meta: 'Numbered step' },
  { type: 'letter', icon: '✉', label: 'Letter template', meta: 'Document-style letter' },
  { type: 'image', icon: '🖼', label: 'Image', meta: 'Image' },
  { type: 'video', icon: '▶', label: 'Video', meta: 'Video or YouTube' },
  { type: 'pdf', icon: '📄', label: 'PDF document', meta: 'PDF file' },
  { type: 'doc', icon: '📝', label: 'Word document', meta: '.docx file' },
  { type: 'table', icon: '⊞', label: 'Table', meta: 'Table with rows and columns' },
];

const MEDIA_TYPES = new Set(['image', 'video', 'pdf', 'doc']);

const PLACEHOLDERS = {
  p: 'Type or press / for blocks',
  h2: 'Section heading',
  h3: 'Subsection heading',
  h4: 'Inline heading',
  li: 'List item',
  'alert-warn': 'Warning text',
  'alert-info': 'Info text',
  'alert-note': 'Note text',
  step: 'Step description',
};

let state = null;
let _editHeaderWired = false;
let _formatToolbarBound = false;
let _savedSelection = null;

// ── EDIT HEADER ───────────────────────────────────────

function wireEditHeader() {
  if (_editHeaderWired) return;
  _editHeaderWired = true;
  document.getElementById('editHeaderSave').addEventListener('click', () => saveEntry({ explicit: true }));
  document.getElementById('editHeaderCancel').addEventListener('click', () => cancelEdit());
  document.getElementById('editHeaderDelete').addEventListener('click', () => deleteCurrent());
}

function showEditHeader() {
  const eh = document.getElementById('edit-header');
  if (eh) eh.style.display = 'flex';
  updateEditHeaderTitle();
  const del = document.getElementById('editHeaderDelete');
  if (del) del.style.display = state.isNew ? 'none' : 'inline-flex';
}

function hideEditHeader() {
  const eh = document.getElementById('edit-header');
  if (eh) eh.style.display = 'none';
  const auto = document.getElementById('editAutoSave');
  if (auto) auto.textContent = '';
}

function updateEditHeaderTitle() {
  const t = document.getElementById('editHeaderTitle');
  if (t) t.textContent = state.title || (state.isNew ? 'New Entry' : '');
}

function setAutoSave(text) {
  const el = document.getElementById('editAutoSave');
  if (el) el.textContent = text || '';
}

// ── FORMAT TOOLBAR ──────────────────────────────────

function getFormatToolbar() {
  return document.getElementById('format-toolbar');
}

function showFormatToolbar(x, y) {
  const tb = getFormatToolbar();
  if (!tb) return;
  tb.style.display = 'flex';
  const tbWidth = tb.offsetWidth || 620;
  const left = Math.min(x, window.innerWidth - tbWidth - 12);
  tb.style.left = Math.max(8, left) + 'px';
  tb.style.top = Math.max(8, y - 48) + 'px';
  updateBlockTypeSelector();
}

function hideFormatToolbar() {
  const tb = getFormatToolbar();
  if (tb) tb.style.display = 'none';
}

function getBlockElFromSelection() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  let node = sel.anchorNode;
  if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  return node?.closest?.('[data-block-id]') || null;
}

function updateBlockTypeSelector() {
  const sel = document.querySelector('.ft-block-type');
  if (!sel) return;
  const block = getBlockElFromSelection();
  if (!block) return;
  const type = block.dataset.type || 'p';
  if ([...sel.options].some(o => o.value === type)) sel.value = type;
}

function saveSelection() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    _savedSelection = sel.getRangeAt(0).cloneRange();
  }
}

function restoreSelection() {
  if (_savedSelection) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(_savedSelection);
  }
}

function applyFormat(command) {
  restoreSelection();
  document.execCommand('styleWithCSS', false, false);
  document.execCommand(command, false, null);
  syncBlockFromDOM();
}

function applyTextColor(color) {
  restoreSelection();
  document.execCommand('styleWithCSS', false, true);
  document.execCommand('foreColor', false, color);
  syncBlockFromDOM();
}

function applyHighlight(color) {
  restoreSelection();
  document.execCommand('styleWithCSS', false, true);
  if (color === 'transparent') {
    document.execCommand('hiliteColor', false, 'transparent');
  } else {
    document.execCommand('hiliteColor', false, color);
  }
  syncBlockFromDOM();
}

function clearFormatting() {
  restoreSelection();
  document.execCommand('removeFormat', false, null);
  syncBlockFromDOM();
}

function changeBlockType(newType) {
  const blockEl = getBlockElFromSelection();
  if (!blockEl) return;
  const blockId = blockEl.dataset.blockId;
  const block = state?.blocks.find(b => b.id === blockId);
  if (!block) return;
  block.type = newType;
  rerenderBlocks();
  markDirty();
  setTimeout(() => focusBlock(block.id), 20);
  hideFormatToolbar();
}

function getEditableInBlock(blockEl) {
  if (!blockEl) return null;
  // step blocks: prefer .step-text or .step-note that contains selection
  const sel = window.getSelection();
  if (sel && sel.anchorNode) {
    let n = sel.anchorNode;
    if (n.nodeType === Node.TEXT_NODE) n = n.parentElement;
    const editable = n?.closest?.('[contenteditable="true"]');
    if (editable && blockEl.contains(editable)) return editable;
  }
  return blockEl.querySelector('[contenteditable="true"]');
}

function syncBlockFromDOM() {
  const blockEl = getBlockElFromSelection();
  if (!blockEl) return;
  const editable = getEditableInBlock(blockEl);
  const blockId = blockEl.dataset.blockId;
  const block = state?.blocks.find(b => b.id === blockId);
  if (!block || !editable) return;
  if (block.type === 'step' && editable.classList.contains('step-note')) {
    block.note = decodeHtmlInline(editable.innerHTML);
  } else if (block.type === 'letter') {
    block.content = editable.textContent;
  } else {
    block.content = decodeHtmlInline(editable.innerHTML);
  }
  markDirty();
}

function bindFormatToolbarOnce() {
  if (_formatToolbarBound) return;
  _formatToolbarBound = true;
  const tb = getFormatToolbar();
  if (!tb) return;

  tb.addEventListener('mousedown', (e) => e.preventDefault());

  tb.querySelectorAll('.ft-btn[data-format]').forEach(btn => {
    btn.addEventListener('click', () => applyFormat(btn.dataset.format));
  });
  tb.querySelectorAll('.ft-color[data-text-color]').forEach(c => {
    c.addEventListener('click', () => applyTextColor(c.dataset.textColor));
  });
  tb.querySelectorAll('.ft-color[data-highlight]').forEach(c => {
    c.addEventListener('click', () => applyHighlight(c.dataset.highlight));
  });
  const clearBtn = tb.querySelector('[data-action="clear"]');
  if (clearBtn) clearBtn.addEventListener('click', () => clearFormatting());
  const blockSel = tb.querySelector('.ft-block-type');
  if (blockSel) blockSel.addEventListener('change', () => changeBlockType(blockSel.value));

  document.addEventListener('mouseup', (e) => {
    if (!document.body.classList.contains('editor-active')) return;
    if (e.target.closest('#format-toolbar')) return;
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.toString().trim() === '') {
        if (!e.target.closest('#format-toolbar')) hideFormatToolbar();
        return;
      }
      const blockEl = getBlockElFromSelection();
      if (!blockEl) { hideFormatToolbar(); return; }
      saveSelection();
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      showFormatToolbar(rect.left, rect.top);
    }, 10);
  });

  document.addEventListener('mousedown', (e) => {
    if (e.target.closest('#format-toolbar')) return;
    if (e.target.closest('[data-block-id]')) return;
    hideFormatToolbar();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideFormatToolbar();
  });

  document.addEventListener('selectionchange', () => {
    if (!document.body.classList.contains('editor-active')) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      const tb = getFormatToolbar();
      if (tb && tb.style.display !== 'none' && !tb.matches(':hover')) {
        hideFormatToolbar();
      }
    }
  });
}

// ── HELPERS ─────────────────────────────────────────

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function slug(s) {
  return String(s || '').toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function extractYouTubeId(url) {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^?]+)/,
    /youtube\.com\/shorts\/([^?]+)/,
    /youtube\.com\/live\/([^?]+)/,
    /youtu\.be\/([^?]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

const INLINE_TAG_RE = /^(strong|em|b|i|u|s|strike|font|span)$/i;

function filterSafeStyle(style) {
  const decls = String(style || '').split(';').map(d => d.trim()).filter(Boolean);
  const safe = [];
  for (const d of decls) {
    const m = d.match(/^(color|background-color)\s*:\s*(.+)$/i);
    if (!m) continue;
    const val = m[2].trim();
    if (/^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-zA-Z]+)$/.test(val)) {
      safe.push(`${m[1].toLowerCase()}: ${val}`);
    }
  }
  return safe.join('; ');
}

function decodeHtmlInline(html) {
  if (!html) return '';
  let s = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?div[^>]*>/gi, ' ')
    .replace(/<\/?p[^>]*>/gi, ' ');
  s = s.replace(/<font\s+color\s*=\s*["']?([^"'>\s]+)["']?[^>]*>/gi, '<span style="color: $1">');
  s = s.replace(/<\/font>/gi, '</span>');
  s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (m, tag) => {
    if (!INLINE_TAG_RE.test(tag)) return '';
    return m;
  });
  s = s.replace(/<span\b([^>]*)>/gi, (m, attrs) => {
    const styleM = attrs.match(/style\s*=\s*"([^"]*)"/i) || attrs.match(/style\s*=\s*'([^']*)'/i);
    if (!styleM) return '';
    const safe = filterSafeStyle(styleM[1]);
    if (!safe) return '';
    return `<span style="${safe}">`;
  });
  s = s.replace(/<(strong|em|b|i|u|s|strike)\b[^>]*>/gi, '<$1>');
  s = s.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

function inlineToEditableHtml(s) {
  return String(s || '');
}

// ── OPEN EDITOR ─────────────────────────────────────

export async function openEditor(id, defaultType = 'dx') {
  document.body.classList.add('editor-active');
  bindFormatToolbarOnce();
  wireEditHeader();

  let entry;
  if (id) {
    try {
      entry = await entriesApi.get(id);
    } catch (e) {
      showToast('Failed to load: ' + e.message, 'error');
      return;
    }
  } else {
    entry = {
      id: '',
      type: defaultType,
      region: 'general',
      title: '',
      desc: '',
      blocks: [{ id: uid(), type: 'p', content: '' }],
      related: [],
    };
  }

  state = {
    isNew: !id,
    originalId: id || null,
    entry,
    blocks: entry.blocks.map(b => ({ ...b, id: b.id || uid() })),
    related: [...(entry.related || [])],
    title: entry.title || '',
    desc: entry.desc || '',
    type: entry.type || defaultType,
    region: entry.region || 'general',
    dirty: false,
    saveTimer: null,
    lastSavedAt: null,
  };

  setBreadcrumb([
    { label: 'Home', onClick: () => router.navigate('/') },
    { label: TYPE_LABELS[state.type] || state.type, onClick: () => router.navigate('/cat/' + state.type) },
    { label: state.title || (state.isNew ? 'New entry' : entry.title) },
  ]);
  setActiveNav(entry.id || null);

  showEditHeader();
  renderEditor();
}

function setupPasteUpload(rootEl) {
  rootEl.addEventListener('paste', async (e) => {
    if (!document.body.classList.contains('edit-mode')) return;

    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    if (!imageItem) return;

    e.preventDefault();

    const file = imageItem.getAsFile();
    if (!file) return;

    showToast('Uploading pasted image...', 'info');

    try {
      const result = await uploadMedia(file, {
        onProgress: (pct) => {
          if (pct < 100) setAutoSave(`Uploading ${pct}%`);
        },
      });

      const newBlock = {
        id: uid(),
        type: 'image',
        src: result.url,
        caption: '',
        filename: result.filename,
        sizeBytes: result.sizeBytes,
        isUrl: false,
        size: 'full',
        float: 'none',
      };

      const focusedBlock = document.activeElement?.closest?.('[data-block-id]');
      if (focusedBlock) {
        const blockId = focusedBlock.dataset.blockId;
        const idx = state.blocks.findIndex(b => b.id === blockId);
        if (idx !== -1) {
          state.blocks.splice(idx + 1, 0, newBlock);
        } else {
          state.blocks.push(newBlock);
        }
      } else {
        state.blocks.push(newBlock);
      }

      setAutoSave('');
      showToast('Image inserted', 'success');
      markDirty();
      rerenderBlocks();
    } catch (err) {
      showToast('Image upload failed: ' + err.message, 'error');
      setAutoSave('');
    }
  });
}

function renderEditor() {
  const content = document.getElementById('content');
  content.innerHTML = '';

  const view = document.createElement('div');
  view.className = 'entry-view fade-in';
  setupPasteUpload(view);

  // Eyebrow — same class as viewer. In edit mode, clicking it opens a popover
  // to change type and region (no extra UI on the page itself).
  const eyebrow = document.createElement('div');
  eyebrow.className = `entry-eyebrow ${state.type}`;
  eyebrow.id = 'editor-eyebrow';
  eyebrow.textContent = TYPE_LABELS[state.type] || state.type;
  eyebrow.title = 'Click to change type or region';
  eyebrow.addEventListener('click', (e) => openMetaPopover(e.currentTarget));
  view.appendChild(eyebrow);

  // Title — same element as viewer
  const h1 = document.createElement('h1');
  h1.className = 'entry-title';
  h1.id = 'editor-title';
  h1.contentEditable = 'true';
  h1.dataset.placeholder = 'Untitled';
  h1.textContent = state.title;
  h1.addEventListener('input', () => {
    state.title = h1.textContent.trim();
    updateEditHeaderTitle();
    markDirty();
  });
  h1.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('editor-desc').focus();
    }
  });
  view.appendChild(h1);

  // Description — same element as viewer
  const desc = document.createElement('p');
  desc.id = 'editor-desc';
  desc.className = 'entry-desc';
  desc.contentEditable = 'true';
  desc.dataset.placeholder = 'Short description shown in search and lists…';
  desc.textContent = state.desc;
  desc.addEventListener('input', () => {
    state.desc = desc.textContent.trim();
    markDirty();
  });
  view.appendChild(desc);

  // Divider — same as viewer
  const hr = document.createElement('hr');
  hr.className = 'entry-divider';
  view.appendChild(hr);

  // Blocks
  const blocksWrap = document.createElement('div');
  blocksWrap.className = 'entry-blocks';
  blocksWrap.id = 'editor-blocks';
  view.appendChild(blocksWrap);

  rerenderBlocks(blocksWrap);

  // Add block button
  const addBtn = document.createElement('button');
  addBtn.className = 'add-block-btn';
  addBtn.id = 'editor-add-block';
  addBtn.textContent = '+ Add block (or press / inside a block)';
  addBtn.addEventListener('click', () => {
    const nb = { id: uid(), type: 'p', content: '' };
    state.blocks.push(nb);
    rerenderBlocks();
    markDirty();
    setTimeout(() => focusBlock(nb.id), 30);
  });
  view.appendChild(addBtn);

  // Related editor
  view.appendChild(renderRelatedEditor());

  content.appendChild(view);
  setTimeout(() => h1.focus(), 50);
}

// ── BLOCK RENDERING ─────────────────────────────────

function rerenderBlocks(container) {
  const wrap = container || document.getElementById('editor-blocks');
  if (!wrap) return;
  wrap.innerHTML = '';

  let i = 0;
  while (i < state.blocks.length) {
    const b = state.blocks[i];
    if (b.type === 'li') {
      const list = document.createElement('div');
      list.className = 'block-list';
      while (i < state.blocks.length && state.blocks[i].type === 'li') {
        list.appendChild(renderLiBlock(state.blocks[i]));
        i++;
      }
      wrap.appendChild(list);
      continue;
    }
    if (b.type === 'step' || b.type === 'checklist-step') {
      const card = document.createElement('div');
      card.className = 'steps-card';
      const stepType = b.type;
      let n = 1;
      while (i < state.blocks.length && state.blocks[i].type === stepType) {
        card.appendChild(renderStepBlock(state.blocks[i], n++));
        i++;
      }
      wrap.appendChild(card);
      continue;
    }
    wrap.appendChild(renderBlock(b));
    i++;
  }
}

function renderBlock(block) {
  if (block.type === 'h2') return renderHeadingBlock(block, 'h2', 'block-h2');
  if (block.type === 'h3') return renderHeadingBlock(block, 'h3', 'block-h3');
  if (block.type === 'h4') return renderHeadingBlock(block, 'h4', 'block-h4');
  if (block.type === 'alert-warn' || block.type === 'alert-info' || block.type === 'alert-note') {
    return renderAlertBlock(block);
  }
  if (block.type === 'letter') return renderLetterBlock(block);
  if (block.type === 'image') return renderImageBlock(block);
  if (block.type === 'video') return renderVideoBlock(block);
  if (block.type === 'pdf') return renderPdfBlock(block);
  if (block.type === 'doc') return renderDocBlock(block);
  if (block.type === 'table') return renderTableBlock(block);
  return renderParaBlock(block);
}

function makeWrap(block) {
  const wrap = document.createElement('div');
  wrap.className = 'edit-block-wrap';
  wrap.dataset.blockId = block.id;
  wrap.dataset.type = block.type;
  return wrap;
}

function addHandle(wrap, block) {
  const handle = document.createElement('div');
  handle.className = 'edit-block-handle';
  handle.draggable = true;
  handle.textContent = '⠿';
  handle.contentEditable = 'false';
  handle.title = 'Drag to reorder';
  attachDrag(handle, wrap, block);
  wrap.appendChild(handle);
}

function addDelete(wrap, block) {
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'edit-block-delete';
  del.textContent = '×';
  del.title = 'Delete block';
  del.contentEditable = 'false';
  del.addEventListener('mousedown', (e) => e.preventDefault());
  del.addEventListener('click', () => deleteBlock(block));
  wrap.appendChild(del);
}

function bindEditable(el, block, opts = {}) {
  el.contentEditable = 'true';
  el.dataset.placeholder = opts.placeholder || PLACEHOLDERS[block.type] || '';
  el.innerHTML = inlineToEditableHtml(block.content || '');
  el.addEventListener('input', () => {
    block.content = decodeHtmlInline(el.innerHTML);
    markDirty();
    handleSlash(el, block);
  });
  el.addEventListener('keydown', (e) => onBlockKeydown(e, block, el, el));
}

function renderParaBlock(block) {
  const wrap = makeWrap(block);
  addHandle(wrap, block);
  const p = document.createElement('p');
  p.className = 'block-p';
  bindEditable(p, block);
  wrap.appendChild(p);
  addDelete(wrap, block);
  return wrap;
}

function renderHeadingBlock(block, tag, cls) {
  const wrap = makeWrap(block);
  addHandle(wrap, block);
  const h = document.createElement(tag);
  h.className = cls;
  bindEditable(h, block);
  wrap.appendChild(h);
  addDelete(wrap, block);
  return wrap;
}

function renderLiBlock(block) {
  const wrap = makeWrap(block);
  addHandle(wrap, block);
  const li = document.createElement('div');
  li.className = 'block-li';
  bindEditable(li, block);
  wrap.appendChild(li);
  addDelete(wrap, block);
  return wrap;
}

function renderAlertBlock(block) {
  const wrap = makeWrap(block);
  addHandle(wrap, block);
  const alert = document.createElement('div');
  alert.className = `alert ${block.type}`;
  const icon = document.createElement('span');
  icon.className = 'alert-icon';
  icon.textContent = ALERT_ICON[block.type] || '→';
  icon.contentEditable = 'false';
  alert.appendChild(icon);
  const body = document.createElement('div');
  bindEditable(body, block, { placeholder: PLACEHOLDERS[block.type] });
  alert.appendChild(body);
  wrap.appendChild(alert);
  addDelete(wrap, block);
  return wrap;
}

function renderLetterBlock(block) {
  const wrap = makeWrap(block);
  addHandle(wrap, block);
  const letter = document.createElement('div');
  letter.className = 'block-letter';
  const body = document.createElement('div');
  body.contentEditable = 'true';
  body.dataset.placeholder = 'Letter content. Use [bracketed] text for fill-in fields.';
  body.textContent = block.content || '';
  body.addEventListener('input', () => {
    block.content = body.textContent;
    markDirty();
  });
  body.addEventListener('keydown', (e) => onBlockKeydown(e, block, body, body));
  letter.appendChild(body);
  wrap.appendChild(letter);
  addDelete(wrap, block);
  return wrap;
}

function renderStepBlock(block, num) {
  const wrap = makeWrap(block);
  wrap.classList.add('step-row');
  addHandle(wrap, block);

  const isCheckStep = block.type === 'checklist-step';

  if (isCheckStep) {
    const numInput = document.createElement('input');
    numInput.className = 'cl-num-input';
    numInput.type = 'number';
    numInput.min = '1';
    numInput.value = block.number != null ? String(block.number) : '';
    numInput.placeholder = String(num);
    numInput.title = 'Override step number (leave blank for auto)';
    numInput.contentEditable = 'false';
    numInput.addEventListener('input', () => {
      const val = parseInt(numInput.value, 10);
      if (isNaN(val)) {
        delete block.number;
      } else {
        block.number = val;
      }
      markDirty();
    });
    wrap.appendChild(numInput);
  } else {
    const numEl = document.createElement('div');
    numEl.className = 'step-num';
    numEl.textContent = String(num);
    numEl.contentEditable = 'false';
    wrap.appendChild(numEl);
  }

  const body = document.createElement('div');
  body.className = 'step-body';

  const text = document.createElement('div');
  text.className = 'step-text';
  text.contentEditable = 'true';
  text.dataset.placeholder = 'Step description';
  text.innerHTML = inlineToEditableHtml(block.content || '');
  text.addEventListener('input', () => {
    block.content = decodeHtmlInline(text.innerHTML);
    markDirty();
  });
  text.addEventListener('keydown', (e) => onBlockKeydown(e, block, wrap, text));
  body.appendChild(text);

  if (block.note != null) {
    body.appendChild(buildNoteField(block));
  } else {
    const addNote = document.createElement('span');
    addNote.className = 'step-add-note';
    addNote.textContent = '+ add note';
    addNote.contentEditable = 'false';
    addNote.addEventListener('click', () => {
      block.note = '';
      addNote.replaceWith(buildNoteField(block));
      markDirty();
    });
    body.appendChild(addNote);
  }
  wrap.appendChild(body);

  if (isCheckStep) {
    const insertBtn = document.createElement('button');
    insertBtn.type = 'button';
    insertBtn.className = 'cl-insert-btn';
    insertBtn.textContent = '+ Add step below';
    insertBtn.title = 'Insert a new step after this one';
    insertBtn.contentEditable = 'false';
    insertBtn.addEventListener('mousedown', (e) => e.preventDefault());
    insertBtn.addEventListener('click', (e) => {
      e.preventDefault();
      insertChecklistStepAfter(block);
    });
    wrap.appendChild(insertBtn);
  }

  addDelete(wrap, block);
  return wrap;
}

function insertChecklistStepAfter(block) {
  const idx = state.blocks.findIndex(b => b.id === block.id);
  if (idx < 0) return;
  const newStep = { id: uid(), type: 'checklist-step', content: '', note: null };
  state.blocks.splice(idx + 1, 0, newStep);
  rerenderBlocks();
  markDirty();
  setTimeout(() => focusBlock(newStep.id), 20);
}

function buildNoteField(block) {
  const note = document.createElement('div');
  note.className = 'step-note';
  note.contentEditable = 'true';
  note.dataset.placeholder = 'Optional clarification…';
  note.innerHTML = inlineToEditableHtml(block.note || '');
  note.addEventListener('input', () => {
    block.note = decodeHtmlInline(note.innerHTML);
    markDirty();
  });
  return note;
}

// ── MEDIA BLOCKS ────────────────────────────────────

function renderMediaBlock(block, opts) {
  const wrap = makeWrap(block);
  addHandle(wrap, block);

  const container = document.createElement('div');
  container.className = 'edit-media-body';

  function mimeAllowed(fileType) {
    if (!opts.mimes || opts.mimes.length === 0) return true;
    if (opts.mimes.includes(fileType)) return true;
    return opts.mimes.some(m => m.endsWith('/*') && fileType.startsWith(m.slice(0, -1)));
  }

  function showZone() {
    container.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'upload-block-empty';
    const picker = document.createElement('div');
    picker.className = 'upload-zone';
    picker.innerHTML = `
      <p>Click or drag to upload</p>
      <span>${opts.hint || ''}</span>
      <input type="file" accept="${opts.accept || ''}" hidden />
    `;
    empty.appendChild(picker);
    const fileInput = picker.querySelector('input[type=file]');
    picker.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleFile(file);
    });
    picker.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      picker.classList.add('dragging');
    });
    picker.addEventListener('dragleave', (e) => {
      e.stopPropagation();
      picker.classList.remove('dragging');
    });
    picker.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      picker.classList.remove('dragging');
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    });

    if (opts.allowUrl) {
      const row = document.createElement('div');
      row.className = 'image-url-row';
      const urlInput = document.createElement('input');
      urlInput.placeholder = opts.urlPlaceholder || 'Or paste a URL…';
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'btn';
      addBtn.textContent = 'Add';
      addBtn.addEventListener('click', () => {
        const v = urlInput.value.trim();
        if (!v) return;
        const updates = opts.onUrl ? opts.onUrl(v) : { src: v };
        if (!updates) return;
        Object.assign(block, updates);
        markDirty();
        showRendered();
      });
      row.appendChild(urlInput);
      row.appendChild(addBtn);
      empty.appendChild(row);
    }
    container.appendChild(empty);
  }

  function showProgress() {
    container.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'upload-block-empty';
    empty.innerHTML = `
      <div class="upload-progress-wrap">
        <div class="upload-progress-label">Uploading… <span class="upload-pct">0%</span></div>
        <progress class="upload-progress-bar" value="0" max="100"></progress>
      </div>
    `;
    container.appendChild(empty);
  }

  function updateProgress(pct) {
    const bar = container.querySelector('.upload-progress-bar');
    const span = container.querySelector('.upload-pct');
    if (bar) bar.value = pct;
    if (span) span.textContent = pct + '%';
  }

  function showError(msg) {
    container.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'upload-block-empty';
    empty.innerHTML = `
      <div class="upload-error-state">
        <p class="upload-error-msg"></p>
        <button type="button" class="upload-retry-btn">Try again</button>
      </div>
    `;
    empty.querySelector('.upload-error-msg').textContent = msg;
    empty.querySelector('.upload-retry-btn').addEventListener('click', () => showZone());
    container.appendChild(empty);
  }

  function showRendered() {
    container.innerHTML = '';
    const fig = opts.renderRendered(block);
    // Replace button overlay — positioned absolute by CSS
    const replaceBtn = document.createElement('button');
    replaceBtn.type = 'button';
    replaceBtn.className = 'media-replace-btn';
    replaceBtn.title = 'Replace file';
    replaceBtn.textContent = '↑ Replace';
    replaceBtn.addEventListener('click', () => showZone());
    container.appendChild(replaceBtn);
    container.appendChild(fig);

    if (block.type === 'image') {
      const sizeLabel = document.createElement('div');
      sizeLabel.className = 'image-picker-label';
      sizeLabel.textContent = 'Size';
      container.appendChild(sizeLabel);
      container.appendChild(buildImageSizePicker(block));

      const posLabel = document.createElement('div');
      posLabel.className = 'image-picker-label';
      posLabel.textContent = 'Position';
      container.appendChild(posLabel);
      container.appendChild(buildImagePositionPicker(block, fig));
    }

    const cap = document.createElement('input');
    cap.className = 'media-caption-input';
    cap.placeholder = 'Add caption…';
    cap.value = block.caption || '';
    cap.addEventListener('input', () => {
      block.caption = cap.value;
      let fc = fig.querySelector('figcaption');
      if (cap.value) {
        if (!fc) {
          fc = document.createElement('figcaption');
          fig.appendChild(fc);
        }
        fc.textContent = cap.value;
      } else if (fc) {
        fc.remove();
      }
      markDirty();
    });
    container.appendChild(cap);
  }

  async function handleFile(file) {
    if (file.type && !mimeAllowed(file.type)) {
      showError(`Unsupported file type: ${file.type}`);
      return;
    }
    if (opts.maxMB && file.size > opts.maxMB * 1024 * 1024) {
      showError(`File too large. Max is ${opts.maxMB} MB for this file type.`);
      return;
    }
    showProgress();
    try {
      const res = await uploadMedia(file, { onProgress: updateProgress });
      block.src = res.url;
      if (res.filename) block.filename = res.filename;
      if (typeof res.sizeBytes === 'number') block.sizeBytes = res.sizeBytes;
      if (res.fileType) block.fileType = res.fileType;
      if (block.type === 'video') block.isEmbed = false;
      if (block.type === 'image') {
        block.isUrl = false;
        if (!block.size) block.size = 'full';
        if (!block.float) block.float = 'none';
      }
      markDirty();
      showRendered();
    } catch (e) {
      showError(e.message || 'Upload failed');
    }
  }

  if (block.src) showRendered();
  else showZone();

  wrap.appendChild(container);
  addDelete(wrap, block);
  return wrap;
}

function renderImageFigure(b) {
  const fig = document.createElement('figure');
  const sizeClass = `size-${b.size || 'full'}`;
  const floatClass = `float-${b.float || 'none'}`;
  fig.className = `media-figure ${sizeClass} ${floatClass}`;
  const img = document.createElement('img');
  img.src = b.src || '';
  img.alt = b.caption || '';
  fig.appendChild(img);
  if (b.caption) {
    const fc = document.createElement('figcaption');
    fc.textContent = b.caption;
    fig.appendChild(fc);
  }
  return fig;
}

function buildImageSizePicker(block) {
  const sizePicker = document.createElement('div');
  sizePicker.className = 'image-size-picker';
  ['small', 'medium', 'full'].forEach(size => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'image-size-btn' + ((block.size || 'full') === size ? ' active' : '');
    btn.textContent = size.charAt(0).toUpperCase() + size.slice(1);
    btn.title = size === 'small' ? '300px' : size === 'medium' ? '500px' : 'Full width';
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      block.size = size;
      sizePicker.querySelectorAll('.image-size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const wrap = btn.closest('[data-block-id]');
      const figure = wrap?.querySelector('.media-figure');
      if (figure) {
        figure.className = figure.className
          .replace(/\bsize-\S+/g, '')
          .replace(/\s+/g, ' ')
          .trim() + ` size-${size}`;
      }
      markDirty();
    });
    sizePicker.appendChild(btn);
  });
  return sizePicker;
}

function buildImagePositionPicker(block, figure) {
  const picker = document.createElement('div');
  picker.className = 'image-size-picker';

  const options = [
    { value: 'none',   label: 'Default',  title: 'No float — full block' },
    { value: 'left',   label: '← Left',   title: 'Float left, text wraps right' },
    { value: 'center', label: 'Center',   title: 'Centered, no text wrap' },
    { value: 'right',  label: 'Right →',  title: 'Float right, text wraps left' },
  ];

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'image-size-btn' + ((block.float || 'none') === opt.value ? ' active' : '');
    btn.textContent = opt.label;
    btn.title = opt.title;
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      block.float = opt.value;
      picker.querySelectorAll('.image-size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const wrap = btn.closest('[data-block-id]');
      const fig = figure || wrap?.querySelector('.media-figure');
      if (fig) {
        fig.className = fig.className
          .replace(/\bfloat-\S+/g, '')
          .replace(/\s+/g, ' ')
          .trim() + ` float-${opt.value}`;
      }
      markDirty();
    });
    picker.appendChild(btn);
  });

  return picker;
}

function renderVideoFigure(b) {
  const fig = document.createElement('figure');
  fig.className = 'media-figure';
  const wrapV = document.createElement('div');
  wrapV.className = 'video-wrap';
  if (b.isEmbed) {
    const f = document.createElement('iframe');
    f.src = b.src || '';
    f.setAttribute('frameborder', '0');
    f.setAttribute('allowfullscreen', 'true');
    wrapV.appendChild(f);
  } else {
    const v = document.createElement('video');
    v.src = b.src || '';
    v.controls = true;
    wrapV.appendChild(v);
  }
  fig.appendChild(wrapV);
  if (b.caption) {
    const fc = document.createElement('figcaption');
    fc.textContent = b.caption;
    fig.appendChild(fc);
  }
  return fig;
}

function renderFileCardFigure(b, kind) {
  const fig = document.createElement('figure');
  fig.className = 'media-figure media-figure-card';
  const card = document.createElement('div');
  card.className = `file-card file-card-${kind}`;
  const icon = document.createElement('div');
  icon.className = 'file-card-icon';
  icon.textContent = kind === 'pdf' ? '📄' : '📝';
  card.appendChild(icon);
  const meta = document.createElement('div');
  meta.className = 'file-card-meta';
  const name = document.createElement('div');
  name.className = 'file-card-name';
  name.textContent = b.filename || (kind === 'pdf' ? 'document.pdf' : 'document.docx');
  meta.appendChild(name);
  if (typeof b.sizeBytes === 'number') {
    const size = document.createElement('div');
    size.className = 'file-card-size';
    size.textContent = formatBytes(b.sizeBytes);
    meta.appendChild(size);
  }
  card.appendChild(meta);
  const btn = document.createElement('a');
  btn.className = 'file-card-btn';
  btn.href = b.src || '';
  if (kind === 'pdf') {
    btn.target = '_blank';
    btn.rel = 'noopener';
    btn.textContent = 'Open';
  } else {
    btn.download = b.filename || 'document.docx';
    btn.textContent = 'Download';
  }
  card.appendChild(btn);
  fig.appendChild(card);
  if (b.caption) {
    const fc = document.createElement('figcaption');
    fc.textContent = b.caption;
    fig.appendChild(fc);
  }
  return fig;
}

function renderImageBlock(block) {
  return renderMediaBlock(block, {
    accept: 'image/*',
    mimes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
    maxMB: 10,
    hint: 'PNG, JPG, GIF, WebP — up to 10 MB',
    allowUrl: true,
    urlPlaceholder: 'Or paste an image URL…',
    onUrl: (v) => ({ src: v, isUrl: true, size: 'full', float: 'none' }),
    renderRendered: renderImageFigure,
  });
}

function renderVideoBlock(block) {
  return renderMediaBlock(block, {
    accept: 'video/*',
    mimes: ['video/mp4', 'video/quicktime', 'video/webm'],
    maxMB: 100,
    hint: 'MP4, MOV, WebM — up to 100 MB',
    allowUrl: true,
    urlPlaceholder: 'Or paste a YouTube URL…',
    onUrl: (v) => {
      const ytId = extractYouTubeId(v);
      if (ytId) return { src: `https://www.youtube.com/embed/${ytId}`, isEmbed: true };
      return { src: v, isEmbed: false };
    },
    renderRendered: renderVideoFigure,
  });
}

function renderPdfBlock(block) {
  return renderMediaBlock(block, {
    accept: 'application/pdf',
    mimes: ['application/pdf'],
    maxMB: 25,
    hint: 'PDF files up to 25 MB',
    allowUrl: false,
    renderRendered: (b) => renderFileCardFigure(b, 'pdf'),
  });
}

function renderDocBlock(block) {
  return renderMediaBlock(block, {
    accept: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    maxMB: 25,
    hint: 'Word documents (.docx) up to 25 MB',
    allowUrl: false,
    renderRendered: (b) => renderFileCardFigure(b, 'doc'),
  });
}

// ── TABLE ───────────────────────────────────────────

function renderTableBlock(block) {
  if (!block.headers) block.headers = ['Column 1', 'Column 2', 'Column 3'];
  if (!block.rows) block.rows = [['', '', ''], ['', '', '']];

  const wrap = makeWrap(block);
  addHandle(wrap, block);
  wrap.appendChild(buildTableEditor(block));
  addDelete(wrap, block);
  return wrap;
}

function buildTableEditor(block) {
  const wrapper = document.createElement('div');
  wrapper.className = 'block-table-wrap';

  const table = document.createElement('table');
  table.className = 'block-table';

  const thead = document.createElement('thead');
  const headerTr = document.createElement('tr');
  block.headers.forEach((h, colIdx) => {
    const th = document.createElement('th');
    th.contentEditable = 'true';
    th.dataset.placeholder = `Column ${colIdx + 1}`;
    th.textContent = h;
    th.addEventListener('input', () => {
      block.headers[colIdx] = th.textContent;
      markDirty();
    });
    th.addEventListener('keydown', (e) => onTableCellKeydown(e, th));
    headerTr.appendChild(th);
  });
  thead.appendChild(headerTr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  block.rows.forEach((row, rowIdx) => {
    const tr = document.createElement('tr');
    row.forEach((cell, colIdx) => {
      const td = document.createElement('td');
      td.contentEditable = 'true';
      td.dataset.placeholder = '—';
      td.textContent = cell;
      td.addEventListener('input', () => {
        block.rows[rowIdx][colIdx] = td.textContent;
        markDirty();
      });
      td.addEventListener('keydown', (e) => onTableCellKeydown(e, td));
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrapper.appendChild(table);

  // Caption — same element as viewer
  const cap = document.createElement('p');
  cap.className = 'block-table-caption';
  cap.contentEditable = 'true';
  cap.dataset.placeholder = 'Table caption (optional)';
  cap.textContent = block.caption || '';
  cap.addEventListener('input', () => {
    block.caption = cap.textContent;
    markDirty();
  });
  wrapper.appendChild(cap);

  // Row controls (below)
  const bottomCtrl = document.createElement('div');
  bottomCtrl.className = 'editor-table-controls bottom';
  const addRow = document.createElement('button');
  addRow.type = 'button';
  addRow.className = 'editor-table-ctrl-btn';
  addRow.textContent = '+ Row';
  addRow.addEventListener('click', () => {
    block.rows.push(new Array(block.headers.length).fill(''));
    wrapper.replaceWith(buildTableEditor(block));
    markDirty();
  });
  bottomCtrl.appendChild(addRow);
  const delRow = document.createElement('button');
  delRow.type = 'button';
  delRow.className = 'editor-table-ctrl-btn';
  delRow.textContent = '− Row';
  delRow.addEventListener('click', () => {
    if (block.rows.length > 1) {
      block.rows.pop();
      wrapper.replaceWith(buildTableEditor(block));
      markDirty();
    }
  });
  bottomCtrl.appendChild(delRow);
  wrapper.appendChild(bottomCtrl);

  // Column controls (right)
  const rightCtrl = document.createElement('div');
  rightCtrl.className = 'editor-table-controls right';
  const addCol = document.createElement('button');
  addCol.type = 'button';
  addCol.className = 'editor-table-ctrl-btn';
  addCol.textContent = '+ Col';
  addCol.addEventListener('click', () => {
    block.headers.push(`Column ${block.headers.length + 1}`);
    block.rows.forEach(r => r.push(''));
    wrapper.replaceWith(buildTableEditor(block));
    markDirty();
  });
  rightCtrl.appendChild(addCol);
  const delCol = document.createElement('button');
  delCol.type = 'button';
  delCol.className = 'editor-table-ctrl-btn';
  delCol.textContent = '− Col';
  delCol.addEventListener('click', () => {
    if (block.headers.length > 1) {
      block.headers.pop();
      block.rows.forEach(r => r.pop());
      wrapper.replaceWith(buildTableEditor(block));
      markDirty();
    }
  });
  rightCtrl.appendChild(delCol);
  wrapper.appendChild(rightCtrl);

  return wrapper;
}

function onTableCellKeydown(e, cellEl) {
  if (e.key === 'Tab') {
    e.preventDefault();
    const all = [...cellEl.closest('table').querySelectorAll('th[contenteditable], td[contenteditable]')];
    const idx = all.indexOf(cellEl);
    const next = all[idx + (e.shiftKey ? -1 : 1)];
    if (next) {
      next.focus();
      const range = document.createRange();
      range.selectNodeContents(next);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
}

// ── DELETE / FOCUS / KEYDOWN ───────────────────────

function deleteBlock(block) {
  const idx = state.blocks.indexOf(block);
  if (idx < 0) return;
  state.blocks.splice(idx, 1);
  if (state.blocks.length === 0) {
    state.blocks.push({ id: uid(), type: 'p', content: '' });
  }
  rerenderBlocks();
  markDirty();
}

function focusBlock(id) {
  const wrap = document.querySelector(`[data-block-id="${id}"]`);
  if (!wrap) return;
  const ed = wrap.querySelector('[contenteditable="true"]');
  if (ed) {
    ed.focus();
    const range = document.createRange();
    range.selectNodeContents(ed);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

function onBlockKeydown(e, block, wrap, contentEl) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const idx = state.blocks.indexOf(block);
    const isStep = block.type === 'step';
    const isCheckStep = block.type === 'checklist-step';
    const newType = isStep ? 'step' : isCheckStep ? 'checklist-step' : 'p';
    const nb = { id: uid(), type: newType, content: '' };
    if (isStep || isCheckStep) nb.note = null;
    state.blocks.splice(idx + 1, 0, nb);
    rerenderBlocks();
    markDirty();
    setTimeout(() => focusBlock(nb.id), 20);
    return;
  }
  if (e.key === 'Backspace' && contentEl.textContent.length === 0) {
    const idx = state.blocks.indexOf(block);
    if (state.blocks.length > 1) {
      e.preventDefault();
      const prev = state.blocks[idx - 1];
      state.blocks.splice(idx, 1);
      rerenderBlocks();
      markDirty();
      if (prev) setTimeout(() => focusBlock(prev.id), 20);
    }
  }
}

// ── SLASH MENU ──────────────────────────────────────

let slashMenuEl = null;
function closeSlashMenu() {
  if (slashMenuEl) { slashMenuEl.remove(); slashMenuEl = null; }
}

function handleSlash(contentEl, block) {
  const text = contentEl.textContent;
  if (!text.startsWith('/')) { closeSlashMenu(); return; }
  const filter = text.slice(1).toLowerCase();
  const matches = SLASH_COMMANDS.filter(c => !filter || c.label.toLowerCase().includes(filter) || c.type.includes(filter));
  if (matches.length === 0) { closeSlashMenu(); return; }
  if (!slashMenuEl) {
    slashMenuEl = document.createElement('div');
    slashMenuEl.className = 'block-slash-menu';
    document.body.appendChild(slashMenuEl);
  }
  const rect = contentEl.getBoundingClientRect();
  slashMenuEl.style.left = `${rect.left}px`;
  slashMenuEl.style.top = `${rect.bottom + 4}px`;
  slashMenuEl.innerHTML = '';
  matches.forEach((cmd, i) => {
    const item = document.createElement('div');
    item.className = 'slash-item' + (i === 0 ? ' active' : '');
    item.innerHTML = `<span class="slash-icon">${cmd.icon}</span><span>${cmd.label}</span><span class="slash-meta">${cmd.meta || ''}</span>`;
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      applySlashCommand(cmd, block);
    });
    slashMenuEl.appendChild(item);
  });
}

function applySlashCommand(cmd, block) {
  closeSlashMenu();
  block.type = cmd.type;
  block.content = '';
  if (cmd.type === 'step') {
    block.note = null;
  } else {
    delete block.note;
  }
  if (MEDIA_TYPES.has(cmd.type) || cmd.type === 'table') {
    // clear media/table-specific fields when converting
    if (cmd.type !== 'table') {
      delete block.headers;
      delete block.rows;
    }
  }
  rerenderBlocks();
  markDirty();
  setTimeout(() => focusBlock(block.id), 20);
}

document.addEventListener('keydown', (e) => {
  if (slashMenuEl && (e.key === 'Escape' || e.key === 'Enter')) {
    if (e.key === 'Enter') {
      const active = slashMenuEl.querySelector('.slash-item.active');
      if (active) {
        e.preventDefault();
        active.dispatchEvent(new Event('mousedown'));
      }
    } else {
      closeSlashMenu();
    }
  }
});
document.addEventListener('click', (e) => {
  if (slashMenuEl && !slashMenuEl.contains(e.target)) closeSlashMenu();
});

// ── DRAG / DROP ─────────────────────────────────────

let dragState = null;
function attachDrag(handle, wrap, block) {
  handle.addEventListener('dragstart', (e) => {
    dragState = { id: block.id };
    e.dataTransfer.effectAllowed = 'move';
    wrap.style.opacity = '0.5';
  });
  handle.addEventListener('dragend', () => {
    wrap.style.opacity = '';
    dragState = null;
  });
  wrap.addEventListener('dragover', (e) => {
    if (!dragState) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });
  wrap.addEventListener('drop', (e) => {
    if (!dragState) return;
    e.preventDefault();
    const fromIdx = state.blocks.findIndex(b => b.id === dragState.id);
    const toIdx = state.blocks.findIndex(b => b.id === block.id);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
    const [moved] = state.blocks.splice(fromIdx, 1);
    state.blocks.splice(toIdx, 0, moved);
    rerenderBlocks();
    markDirty();
  });
}

// ── RELATED EDITOR ──────────────────────────────────

function renderRelatedEditor() {
  const all = getCachedEntries();
  const byId = new Map(all.map(e => [e.id, e]));

  const wrap = document.createElement('div');
  wrap.className = 'entry-related';
  const label = document.createElement('div');
  label.className = 'entry-related-label';
  label.textContent = 'Related Topics';
  wrap.appendChild(label);

  const pills = document.createElement('div');
  pills.className = 'related-bubbles related-pills';

  function rebuildPills() {
    pills.innerHTML = '';
    for (const id of state.related) {
      const e = byId.get(id);
      if (!e) continue;
      const pill = document.createElement('span');
      pill.className = 'related-pill';
      const bubble = document.createElement('span');
      bubble.className = `related-bubble ${e.type}`;
      bubble.textContent = e.title;
      pill.appendChild(bubble);
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'pill-x';
      x.textContent = '×';
      x.addEventListener('click', () => {
        state.related = state.related.filter(r => r !== id);
        rebuildPills();
        markDirty();
      });
      pill.appendChild(x);
      pills.appendChild(pill);
    }
  }
  rebuildPills();
  wrap.appendChild(pills);

  const search = document.createElement('div');
  search.className = 'related-search';
  const input = document.createElement('input');
  input.placeholder = 'Add a related entry…';
  search.appendChild(input);
  const suggest = document.createElement('div');
  suggest.className = 'related-suggest';
  suggest.style.display = 'none';
  search.appendChild(suggest);

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { suggest.style.display = 'none'; return; }
    const matches = all
      .filter(e => e.id !== state.entry.id && !state.related.includes(e.id))
      .filter(e => e.title.toLowerCase().includes(q) || e.id.toLowerCase().includes(q))
      .slice(0, 8);
    suggest.innerHTML = '';
    if (matches.length === 0) { suggest.style.display = 'none'; return; }
    for (const e of matches) {
      const item = document.createElement('div');
      item.className = 'related-suggest-item';
      item.innerHTML = `<span class="nav-dot dot-${e.type}"></span><span>${e.title}</span>`;
      item.addEventListener('click', () => {
        state.related.push(e.id);
        input.value = '';
        suggest.style.display = 'none';
        rebuildPills();
        markDirty();
      });
      suggest.appendChild(item);
    }
    suggest.style.display = 'block';
  });
  input.addEventListener('blur', () => setTimeout(() => suggest.style.display = 'none', 150));

  wrap.appendChild(search);
  return wrap;
}

// ── META POPOVER (type / region) ────────────────────

let _metaPopover = null;
let _metaPopoverOutsideHandler = null;

function openMetaPopover(anchor) {
  closeMetaPopover();
  const rect = anchor.getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'meta-popover';
  pop.style.left = rect.left + 'px';
  pop.style.top = (rect.bottom + 6) + 'px';

  const typeSection = document.createElement('div');
  typeSection.className = 'meta-popover-section';
  typeSection.innerHTML = '<div class="meta-popover-label">Type</div>';
  const typeOptions = document.createElement('div');
  typeOptions.className = 'meta-popover-options';
  TYPE_ORDER.forEach(t => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'meta-popover-opt' + (state.type === t ? ' active' : '');
    btn.dataset.type = t;
    btn.textContent = TYPE_LABELS[t];
    btn.addEventListener('click', () => {
      state.type = t;
      const eyebrow = document.getElementById('editor-eyebrow');
      if (eyebrow) {
        eyebrow.className = `entry-eyebrow ${t}`;
        eyebrow.textContent = TYPE_LABELS[t];
      }
      typeOptions.querySelectorAll('.meta-popover-opt').forEach(o => o.classList.remove('active'));
      btn.classList.add('active');
      setBreadcrumb([
        { label: 'Home', onClick: () => router.navigate('/') },
        { label: TYPE_LABELS[state.type], onClick: () => router.navigate('/cat/' + state.type) },
        { label: state.title || (state.isNew ? 'New entry' : '') },
      ]);
      markDirty();
    });
    typeOptions.appendChild(btn);
  });
  typeSection.appendChild(typeOptions);
  pop.appendChild(typeSection);

  const regionSection = document.createElement('div');
  regionSection.className = 'meta-popover-section';
  regionSection.innerHTML = '<div class="meta-popover-label">Region</div>';
  const regionOptions = document.createElement('div');
  regionOptions.className = 'meta-popover-options';
  REGION_ORDER.forEach(r => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'meta-popover-opt' + (state.region === r ? ' active' : '');
    btn.dataset.region = r;
    btn.textContent = REGION_LABELS[r];
    btn.addEventListener('click', () => {
      state.region = r;
      const pill = document.getElementById('editor-region-pill');
      if (pill) pill.textContent = REGION_LABELS[r];
      regionOptions.querySelectorAll('.meta-popover-opt').forEach(o => o.classList.remove('active'));
      btn.classList.add('active');
      markDirty();
    });
    regionOptions.appendChild(btn);
  });
  regionSection.appendChild(regionOptions);
  pop.appendChild(regionSection);

  document.body.appendChild(pop);
  _metaPopover = pop;

  _metaPopoverOutsideHandler = (e) => {
    if (_metaPopover && !_metaPopover.contains(e.target) && !anchor.contains(e.target)) {
      closeMetaPopover();
    }
  };
  setTimeout(() => document.addEventListener('mousedown', _metaPopoverOutsideHandler), 10);
}

function closeMetaPopover() {
  if (_metaPopover) { _metaPopover.remove(); _metaPopover = null; }
  if (_metaPopoverOutsideHandler) {
    document.removeEventListener('mousedown', _metaPopoverOutsideHandler);
    _metaPopoverOutsideHandler = null;
  }
}

// ── SAVE / CANCEL / DELETE ──────────────────────────

function markDirty() {
  if (!state) return;
  state.dirty = true;
  setAutoSave('Unsaved');
  if (state.saveTimer) clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => saveEntry({ explicit: false }), 3000);
}

async function saveEntry({ explicit } = {}) {
  if (!state) return;
  if (!state.title) {
    if (explicit) showToast('Title is required', 'error');
    setAutoSave('Untitled');
    return;
  }
  const id = state.isNew ? slug(state.title) : state.originalId;
  if (!id) {
    if (explicit) showToast('Could not generate an ID from the title', 'error');
    return;
  }

  setAutoSave('Saving…');

  // Sync any DOM-side block content
  for (const block of state.blocks) {
    const wrap = document.querySelector(`[data-block-id="${block.id}"]`);
    if (!wrap) continue;
    if (block.type === 'table') continue;
    if (MEDIA_TYPES.has(block.type)) continue;
    if (block.type === 'step' || block.type === 'checklist-step') {
      const text = wrap.querySelector('.step-text');
      if (text) block.content = decodeHtmlInline(text.innerHTML);
      const note = wrap.querySelector('.step-note');
      if (note) block.note = decodeHtmlInline(note.innerHTML);
    } else if (block.type === 'letter') {
      const body = wrap.querySelector('.block-letter > [contenteditable="true"]');
      if (body) block.content = body.textContent;
    } else if (block.type === 'alert-warn' || block.type === 'alert-info' || block.type === 'alert-note') {
      const body = wrap.querySelector('.alert > [contenteditable="true"]');
      if (body) block.content = decodeHtmlInline(body.innerHTML);
    } else {
      const editable = wrap.querySelector('[contenteditable="true"]');
      if (editable) block.content = decodeHtmlInline(editable.innerHTML);
    }
  }

  const payload = {
    id,
    type: state.type,
    region: state.region,
    title: state.title,
    desc: state.desc,
    blocks: state.blocks,
    related: state.related,
  };

  try {
    let saved;
    if (state.isNew) {
      saved = await entriesApi.create(payload);
      state.isNew = false;
      state.originalId = saved.id;
      const del = document.getElementById('editHeaderDelete');
      if (del) del.style.display = 'inline-flex';
    } else {
      saved = await entriesApi.update(state.originalId, payload);
    }
    state.entry = saved;
    state.dirty = false;
    state.lastSavedAt = new Date();
    setAutoSave('Saved');
    setTimeout(() => { if (state && !state.dirty) setAutoSave(''); }, 2000);
    await buildSidebar();
    setActiveNav(saved.id);
    if (location.hash !== '#/entry/' + saved.id) {
      history.replaceState(null, '', '#/entry/' + saved.id);
    }
    if (explicit) showToast('Saved', 'success');
  } catch (e) {
    setAutoSave('Save failed');
    showToast('Save failed: ' + e.message, 'error');
  }
}

async function deleteCurrent() {
  if (!state) return;
  if (state.isNew) return cancelEdit();
  const ok = confirm(`Delete "${state.title}"? This cannot be undone.`);
  if (!ok) return;
  try {
    await entriesApi.delete(state.originalId);
    showToast('Entry deleted', 'success');
    document.body.classList.remove('editor-active');
    hideFormatToolbar();
    hideEditHeader();
    await buildSidebar();
    router.navigate('/');
  } catch (e) {
    showToast('Delete failed: ' + e.message, 'error');
  }
}

function cancelEdit() {
  if (state && state.dirty) {
    if (!confirm('Discard unsaved changes?')) return;
  }
  document.body.classList.remove('editor-active');
  hideFormatToolbar();
  hideEditHeader();
  closeMetaPopover();
  if (!state || state.isNew || !state.originalId) {
    state = null;
    router.navigate('/');
  } else {
    const id = state.originalId;
    state = null;
    router.navigate('/entry/' + id);
  }
}
