import { entries as entriesApi, uploadMedia } from './db.js';
import { router, setBreadcrumb, showToast } from './app.js';
import { buildSidebar, getCachedEntries, setActiveNav, TYPE_LABELS } from './sidebar.js';

const SLASH_COMMANDS = [
  { type: 'p', icon: '¶', label: 'Text', meta: 'Paragraph' },
  { type: 'h2', icon: 'H2', label: 'Section heading', meta: 'Major section' },
  { type: 'h3', icon: 'H3', label: 'Subsection heading', meta: 'Subsection label' },
  { type: 'li', icon: '—', label: 'List item', meta: 'Bullet item' },
  { type: 'alert-warn', icon: '⚠', label: 'Warning', meta: 'Warning alert' },
  { type: 'alert-info', icon: '→', label: 'Info', meta: 'Info note' },
  { type: 'alert-note', icon: '→', label: 'Note', meta: 'Callout note' },
  { type: 'step', icon: '①', label: 'Numbered step', meta: 'Numbered step' },
  { type: 'letter', icon: '✉', label: 'Letter template', meta: 'Document-style letter' },
  { type: 'image', icon: '🖼', label: 'Image', meta: 'Image' },
  { type: 'video', icon: '▶', label: 'Video', meta: 'Video or YouTube' },
];

const PLACEHOLDERS = {
  p: 'Type or press / for blocks',
  h2: 'Section heading',
  h3: 'Subsection heading',
  li: 'List item',
  'alert-warn': 'Warning text',
  'alert-info': 'Info text',
  'alert-note': 'Note text',
  step: 'Step description',
};

let state = null;

// ── FORMAT TOOLBAR ──────────────────────────────────

let _savedSelection = null;
let _formatToolbarBound = false;

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
  // Use element tags (<b>, <i>, <u>, <s>) rather than CSS spans so the saved
  // HTML survives sanitization and renders consistently in the viewer.
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
  const fresh = renderBlock(block);
  blockEl.replaceWith(fresh);
  markDirty();
  setTimeout(() => focusBlock(block.id), 20);
  hideFormatToolbar();
}

function syncBlockFromDOM() {
  const blockEl = getBlockElFromSelection();
  if (!blockEl) return;
  const contentEl = blockEl.querySelector('.block-content')
    || blockEl.querySelector('.step-text-edit')
    || blockEl;
  const blockId = blockEl.dataset.blockId;
  const block = state?.blocks.find(b => b.id === blockId);
  if (block && contentEl) {
    block.content = decodeHtmlInline(contentEl.innerHTML);
    markDirty();
  }
}

function bindFormatToolbarOnce() {
  if (_formatToolbarBound) return;
  _formatToolbarBound = true;
  const tb = getFormatToolbar();
  if (!tb) return;

  // Prevent the toolbar's own clicks from clearing the selection.
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

  // Show toolbar when a non-empty selection lands inside an editable block.
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

// Allowed inline formatting tags. Keep these from contenteditable's HTML; strip everything else.
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
  // contenteditable returns inner HTML; preserve inline formatting tags, normalize <br>/<div>/<p> to text breaks.
  if (!html) return '';
  let s = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?div[^>]*>/gi, ' ')
    .replace(/<\/?p[^>]*>/gi, ' ');
  // Normalize <font color="..."> to <span style="color:...">
  s = s.replace(/<font\s+color\s*=\s*["']?([^"'>\s]+)["']?[^>]*>/gi, '<span style="color: $1">');
  s = s.replace(/<\/font>/gi, '</span>');
  // Drop tags that aren't in the allowlist
  s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (m, tag) => {
    if (!INLINE_TAG_RE.test(tag)) return '';
    return m;
  });
  // Filter span attributes — keep only style, and only safe color/background-color declarations
  s = s.replace(/<span\b([^>]*)>/gi, (m, attrs) => {
    const styleM = attrs.match(/style\s*=\s*"([^"]*)"/i) || attrs.match(/style\s*=\s*'([^']*)'/i);
    if (!styleM) return '';
    const safe = filterSafeStyle(styleM[1]);
    if (!safe) return '';
    return `<span style="${safe}">`;
  });
  // Strip attributes from the other allowed inline tags
  s = s.replace(/<(strong|em|b|i|u|s|strike)\b[^>]*>/gi, '<$1>');
  s = s.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

function inlineToEditableHtml(s) {
  // Stored content already contains safe inline HTML. Trust and pass through.
  return String(s || '');
}

export async function openEditor(id, defaultType = 'dx') {
  document.body.classList.add('editor-active');
  bindFormatToolbarOnce();

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
      blocks: [
        { id: uid(), type: 'p', content: '' },
      ],
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
    { label: 'Editing', onClick: null },
    { label: state.title || (state.isNew ? 'New entry' : entry.title) },
  ]);
  setActiveNav(entry.id || null);

  renderEditor();
}

function renderEditor() {
  const content = document.getElementById('content');
  content.innerHTML = '';

  const page = document.createElement('div');
  page.className = 'editor-page';

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'editor-toolbar';

  const status = document.createElement('span');
  status.className = 'save-status';
  status.id = 'editor-save-status';
  status.textContent = state.isNew ? 'Not saved' : 'No unsaved changes';
  toolbar.appendChild(status);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => saveEntry({ explicit: true }));
  toolbar.appendChild(saveBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-ghost';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', cancelEdit);
  toolbar.appendChild(cancelBtn);

  if (!state.isNew) {
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', deleteCurrent);
    toolbar.appendChild(delBtn);
  }

  page.appendChild(toolbar);

  // Title
  const title = document.createElement('div');
  title.className = 'editor-title';
  title.contentEditable = 'true';
  title.dataset.placeholder = 'Untitled';
  title.textContent = state.title;
  title.addEventListener('input', () => {
    state.title = title.textContent.trim();
    markDirty();
  });
  title.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('editor-desc').focus(); }
  });
  page.appendChild(title);

  // Type
  const typeRow = document.createElement('div');
  typeRow.className = 'editor-type-row';
  for (const t of ['dx', 'proc', 'ma']) {
    const btn = document.createElement('button');
    btn.className = 'editor-type-btn' + (state.type === t ? ' active' : '');
    btn.dataset.type = t;
    btn.textContent = TYPE_LABELS[t];
    btn.addEventListener('click', () => {
      state.type = t;
      for (const b of typeRow.querySelectorAll('.editor-type-btn')) b.classList.remove('active');
      btn.classList.add('active');
      markDirty();
    });
    typeRow.appendChild(btn);
  }
  page.appendChild(typeRow);

  // Region
  const regionRow = document.createElement('div');
  regionRow.className = 'editor-region-row';
  const regionLabel = document.createElement('span');
  regionLabel.className = 'editor-region-label';
  regionLabel.textContent = 'Region';
  regionRow.appendChild(regionLabel);
  for (const r of ['nose', 'ear', 'general']) {
    const btn = document.createElement('button');
    btn.className = 'editor-region-btn' + (state.region === r ? ' active' : '');
    btn.dataset.region = r;
    btn.textContent = r === 'nose' ? 'Nose' : r === 'ear' ? 'Ear' : 'General';
    btn.addEventListener('click', () => {
      state.region = r;
      for (const b of regionRow.querySelectorAll('.editor-region-btn')) b.classList.remove('active');
      btn.classList.add('active');
      markDirty();
    });
    regionRow.appendChild(btn);
  }
  page.appendChild(regionRow);

  // Description
  const desc = document.createElement('div');
  desc.id = 'editor-desc';
  desc.className = 'editor-desc';
  desc.contentEditable = 'true';
  desc.dataset.placeholder = 'Short description shown in search and lists…';
  desc.textContent = state.desc;
  desc.addEventListener('input', () => {
    state.desc = desc.textContent.trim();
    markDirty();
  });
  page.appendChild(desc);

  const div1 = document.createElement('hr');
  div1.className = 'editor-divider';
  page.appendChild(div1);

  // Blocks
  const blocksWrap = document.createElement('div');
  blocksWrap.className = 'editor-blocks';
  blocksWrap.id = 'editor-blocks';
  page.appendChild(blocksWrap);

  for (const block of state.blocks) {
    blocksWrap.appendChild(renderBlock(block));
  }

  const addBtn = document.createElement('button');
  addBtn.className = 'add-block-btn';
  addBtn.textContent = '+ Add block (or press / inside a block)';
  addBtn.addEventListener('click', () => {
    const nb = { id: uid(), type: 'p', content: '' };
    state.blocks.push(nb);
    blocksWrap.insertBefore(renderBlock(nb), addBtn);
    markDirty();
    setTimeout(() => focusBlock(nb.id), 30);
  });
  page.appendChild(addBtn);

  // Related editor
  page.appendChild(renderRelatedEditor());

  content.appendChild(page);
  setTimeout(() => title.focus(), 50);
}

function renderBlock(block) {
  if (block.type === 'step') return renderStepBlock(block);
  if (block.type === 'image') return renderImageBlock(block);
  if (block.type === 'video') return renderVideoBlock(block);
  return renderTextBlock(block);
}

function renderTextBlock(block) {
  const wrap = document.createElement('div');
  wrap.className = 'block';
  wrap.dataset.blockId = block.id;
  wrap.dataset.type = block.type;

  const handle = document.createElement('div');
  handle.className = 'block-handle';
  handle.draggable = true;
  handle.textContent = '⠿';
  attachDrag(handle, wrap, block);
  wrap.appendChild(handle);

  const content = document.createElement('div');
  content.className = 'block-content';
  content.contentEditable = 'true';
  content.dataset.type = block.type;
  content.dataset.placeholder = PLACEHOLDERS[block.type] || '';
  content.innerHTML = inlineToEditableHtml(block.content || '');
  content.addEventListener('input', () => {
    block.content = decodeHtmlInline(content.innerHTML);
    markDirty();
    handleSlash(content, block, wrap);
  });
  content.addEventListener('keydown', (e) => onBlockKeydown(e, block, wrap, content));
  wrap.appendChild(content);

  const actions = document.createElement('div');
  actions.className = 'block-actions';
  const delBtn = document.createElement('button');
  delBtn.className = 'block-delete-btn';
  delBtn.title = 'Delete block';
  delBtn.textContent = '×';
  delBtn.addEventListener('click', () => deleteBlock(block));
  actions.appendChild(delBtn);
  wrap.appendChild(actions);

  return wrap;
}

function renderStepBlock(block) {
  const wrap = document.createElement('div');
  wrap.className = 'block step-block';
  wrap.dataset.blockId = block.id;
  wrap.dataset.type = 'step';

  const handle = document.createElement('div');
  handle.className = 'block-handle';
  handle.draggable = true;
  handle.textContent = '⠿';
  attachDrag(handle, wrap, block);
  wrap.appendChild(handle);

  const numIdx = state.blocks.filter(b => b.type === 'step').indexOf(block) + 1;
  const num = document.createElement('div');
  num.className = 'step-num-edit';
  num.textContent = String(numIdx);
  wrap.appendChild(num);

  const fields = document.createElement('div');
  fields.className = 'step-fields';

  const text = document.createElement('div');
  text.className = 'step-text-edit';
  text.contentEditable = 'true';
  text.dataset.placeholder = 'Step description';
  text.innerHTML = inlineToEditableHtml(block.content || '');
  text.addEventListener('input', () => {
    block.content = decodeHtmlInline(text.innerHTML);
    markDirty();
  });
  text.addEventListener('keydown', (e) => onBlockKeydown(e, block, wrap, text));
  fields.appendChild(text);

  const showNote = !!block.note;
  if (showNote) {
    fields.appendChild(buildNoteField(block));
  } else {
    const addNote = document.createElement('span');
    addNote.className = 'step-add-note';
    addNote.textContent = '+ add note';
    addNote.addEventListener('click', () => {
      block.note = block.note || ' ';
      addNote.replaceWith(buildNoteField(block));
      markDirty();
    });
    fields.appendChild(addNote);
  }

  wrap.appendChild(fields);

  const actions = document.createElement('div');
  actions.className = 'block-actions';
  const delBtn = document.createElement('button');
  delBtn.className = 'block-delete-btn';
  delBtn.textContent = '×';
  delBtn.addEventListener('click', () => deleteBlock(block));
  actions.appendChild(delBtn);
  wrap.appendChild(actions);

  return wrap;
}

function buildNoteField(block) {
  const note = document.createElement('div');
  note.className = 'step-note-edit';
  note.contentEditable = 'true';
  note.dataset.placeholder = 'Optional clarification…';
  note.innerHTML = inlineToEditableHtml(block.note || '');
  note.addEventListener('input', () => {
    block.note = decodeHtmlInline(note.innerHTML);
    markDirty();
  });
  return note;
}

function renderImageBlock(block) {
  const wrap = document.createElement('div');
  wrap.className = 'block';
  wrap.dataset.blockId = block.id;
  wrap.dataset.type = 'image';

  const handle = document.createElement('div');
  handle.className = 'block-handle';
  handle.draggable = true;
  handle.textContent = '⠿';
  attachDrag(handle, wrap, block);
  wrap.appendChild(handle);

  const inner = document.createElement('div');
  inner.style.flex = '1';
  if (!block.src) {
    const empty = document.createElement('div');
    empty.className = 'image-block-empty';
    empty.innerHTML = `
      <div class="image-upload-zone">
        <p>Click to upload an image</p>
        <span>PNG, JPG, GIF, WebP</span>
        <input type="file" accept="image/*" hidden />
      </div>
      <div class="image-url-row">
        <input placeholder="Or paste an image URL…" />
        <button class="btn">Add</button>
      </div>
    `;
    const zone = empty.querySelector('.image-upload-zone');
    const fileInput = empty.querySelector('input[type=file]');
    zone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const res = await uploadMedia(file);
        block.src = res.url;
        wrap.replaceWith(renderImageBlock(block));
        markDirty();
      } catch (err) {
        showToast('Upload failed: ' + err.message, 'error');
      }
    });
    const urlInput = empty.querySelector('.image-url-row input');
    const addBtn = empty.querySelector('.image-url-row button');
    addBtn.addEventListener('click', () => {
      if (!urlInput.value.trim()) return;
      block.src = urlInput.value.trim();
      wrap.replaceWith(renderImageBlock(block));
      markDirty();
    });
    inner.appendChild(empty);
  } else {
    const fig = document.createElement('figure');
    fig.className = 'media-figure media-block-rendered';
    const img = document.createElement('img');
    img.src = block.src;
    fig.appendChild(img);
    const cap = document.createElement('figcaption');
    cap.className = 'caption-edit';
    cap.contentEditable = 'true';
    cap.textContent = block.caption || '';
    cap.addEventListener('input', () => {
      block.caption = cap.textContent.trim();
      markDirty();
    });
    fig.appendChild(cap);
    inner.appendChild(fig);
  }
  wrap.appendChild(inner);

  const actions = document.createElement('div');
  actions.className = 'block-actions';
  const delBtn = document.createElement('button');
  delBtn.className = 'block-delete-btn';
  delBtn.textContent = '×';
  delBtn.addEventListener('click', () => deleteBlock(block));
  actions.appendChild(delBtn);
  wrap.appendChild(actions);

  return wrap;
}

function renderVideoBlock(block) {
  const wrap = document.createElement('div');
  wrap.className = 'block';
  wrap.dataset.blockId = block.id;
  wrap.dataset.type = 'video';

  const handle = document.createElement('div');
  handle.className = 'block-handle';
  handle.draggable = true;
  handle.textContent = '⠿';
  attachDrag(handle, wrap, block);
  wrap.appendChild(handle);

  const inner = document.createElement('div');
  inner.style.flex = '1';

  if (!block.src) {
    const empty = document.createElement('div');
    empty.className = 'video-block-empty';
    empty.innerHTML = `
      <div class="image-upload-zone">
        <p>Click to upload a video</p>
        <span>MP4, WebM, MOV</span>
        <input type="file" accept="video/*" hidden />
      </div>
      <div class="video-url-row">
        <input placeholder="Or paste a YouTube URL…" />
        <button class="btn">Add</button>
      </div>
    `;
    const zone = empty.querySelector('.image-upload-zone');
    const fileInput = empty.querySelector('input[type=file]');
    zone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const res = await uploadMedia(file);
        block.src = res.url;
        block.isEmbed = false;
        wrap.replaceWith(renderVideoBlock(block));
        markDirty();
      } catch (err) {
        showToast('Upload failed: ' + err.message, 'error');
      }
    });
    const urlInput = empty.querySelector('.video-url-row input');
    const addBtn = empty.querySelector('.video-url-row button');
    addBtn.addEventListener('click', () => {
      const v = urlInput.value.trim();
      if (!v) return;
      const ytId = (v.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/) || [])[1];
      if (ytId) {
        block.src = `https://www.youtube.com/embed/${ytId}`;
        block.isEmbed = true;
      } else {
        block.src = v;
        block.isEmbed = false;
      }
      wrap.replaceWith(renderVideoBlock(block));
      markDirty();
    });
    inner.appendChild(empty);
  } else {
    const fig = document.createElement('figure');
    fig.className = 'media-figure media-block-rendered';
    const wrapV = document.createElement('div');
    wrapV.className = 'video-wrap';
    if (block.isEmbed) {
      const f = document.createElement('iframe');
      f.src = block.src;
      f.setAttribute('frameborder', '0');
      f.setAttribute('allowfullscreen', 'true');
      wrapV.appendChild(f);
    } else {
      const v = document.createElement('video');
      v.src = block.src;
      v.controls = true;
      wrapV.appendChild(v);
    }
    fig.appendChild(wrapV);
    const cap = document.createElement('figcaption');
    cap.className = 'caption-edit';
    cap.contentEditable = 'true';
    cap.textContent = block.caption || '';
    cap.addEventListener('input', () => {
      block.caption = cap.textContent.trim();
      markDirty();
    });
    fig.appendChild(cap);
    inner.appendChild(fig);
  }
  wrap.appendChild(inner);

  const actions = document.createElement('div');
  actions.className = 'block-actions';
  const delBtn = document.createElement('button');
  delBtn.className = 'block-delete-btn';
  delBtn.textContent = '×';
  delBtn.addEventListener('click', () => deleteBlock(block));
  actions.appendChild(delBtn);
  wrap.appendChild(actions);

  return wrap;
}

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

function rerenderBlocks() {
  const wrap = document.getElementById('editor-blocks');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (const b of state.blocks) wrap.appendChild(renderBlock(b));
}

function focusBlock(id) {
  const wrap = document.querySelector(`.block[data-block-id="${id}"]`);
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
    const newType = isStep ? 'step' : 'p';
    const nb = { id: uid(), type: newType, content: '' };
    if (isStep) nb.note = '';
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

let slashMenuEl = null;
function closeSlashMenu() {
  if (slashMenuEl) { slashMenuEl.remove(); slashMenuEl = null; }
}
function handleSlash(contentEl, block, wrap) {
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
    item.innerHTML = `<span class="slash-icon">${cmd.icon}</span><span>${cmd.label}</span><span class="slash-meta">${cmd.meta}</span>`;
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      applySlashCommand(cmd, block, wrap, contentEl);
    });
    slashMenuEl.appendChild(item);
  });
}

function applySlashCommand(cmd, block, wrap, contentEl) {
  closeSlashMenu();
  if (cmd.type === 'image' || cmd.type === 'video') {
    block.type = cmd.type;
    block.content = '';
    delete block.note;
    rerenderBlocks();
    markDirty();
    return;
  }
  block.type = cmd.type;
  block.content = '';
  if (cmd.type === 'step' && !block.note) block.note = '';
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

// Drag and drop
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

// Related editor
function renderRelatedEditor() {
  const all = getCachedEntries();
  const byId = new Map(all.map(e => [e.id, e]));

  const wrap = document.createElement('div');
  wrap.className = 'related-editor';
  const label = document.createElement('div');
  label.className = 'related-editor-label';
  label.textContent = 'Related Topics';
  wrap.appendChild(label);

  const pills = document.createElement('div');
  pills.className = 'related-pills';
  function rebuildPills() {
    pills.innerHTML = '';
    for (const id of state.related) {
      const e = byId.get(id);
      if (!e) continue;
      const pill = document.createElement('span');
      pill.className = `related-pill`;
      pill.innerHTML = `<span class="related-bubble ${e.type}" style="border:none;padding:0;background:transparent">${e.title}</span>`;
      const x = document.createElement('button');
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

function markDirty() {
  state.dirty = true;
  const status = document.getElementById('editor-save-status');
  if (status) status.textContent = 'Unsaved changes…';
  if (state.saveTimer) clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => saveEntry({ explicit: false }), 3000);
}

async function saveEntry({ explicit }) {
  if (!state.title) {
    if (explicit) showToast('Title is required', 'error');
    return;
  }
  const id = state.isNew ? slug(state.title) : state.originalId;
  if (!id) {
    if (explicit) showToast('Could not generate an ID from the title', 'error');
    return;
  }

  // collect block content from DOM (in case any contenteditable updates were debounced)
  for (const block of state.blocks) {
    const wrap = document.querySelector(`.block[data-block-id="${block.id}"]`);
    if (!wrap) continue;
    if (block.type === 'step') {
      const text = wrap.querySelector('.step-text-edit');
      if (text) block.content = decodeHtmlInline(text.innerHTML);
      const note = wrap.querySelector('.step-note-edit');
      if (note) block.note = decodeHtmlInline(note.innerHTML);
    } else if (block.type === 'image' || block.type === 'video') {
      const cap = wrap.querySelector('.caption-edit');
      if (cap) block.caption = cap.textContent.trim();
    } else {
      const c = wrap.querySelector('.block-content');
      if (c) block.content = decodeHtmlInline(c.innerHTML);
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
    } else {
      saved = await entriesApi.update(state.originalId, payload);
    }
    state.entry = saved;
    state.dirty = false;
    state.lastSavedAt = new Date();
    const status = document.getElementById('editor-save-status');
    if (status) status.textContent = 'Saved · ' + state.lastSavedAt.toLocaleTimeString();
    await buildSidebar();
    setActiveNav(saved.id);
    if (state.isNew === false && location.hash !== '#/entry/' + saved.id) {
      // For new-entry saves, update the hash without re-routing into the viewer.
      history.replaceState(null, '', '#/entry/' + saved.id);
    }
    if (explicit) showToast('Saved', 'success');
  } catch (e) {
    showToast('Save failed: ' + e.message, 'error');
  }
}

async function deleteCurrent() {
  if (state.isNew) return cancelEdit();
  const ok = confirm(`Delete "${state.title}"? This cannot be undone.`);
  if (!ok) return;
  try {
    await entriesApi.delete(state.originalId);
    showToast('Entry deleted', 'success');
    document.body.classList.remove('editor-active');
    hideFormatToolbar();
    await buildSidebar();
    router.navigate('/');
  } catch (e) {
    showToast('Delete failed: ' + e.message, 'error');
  }
}

function cancelEdit() {
  if (state.dirty) {
    if (!confirm('Discard unsaved changes?')) return;
  }
  document.body.classList.remove('editor-active');
  hideFormatToolbar();
  if (state.isNew || !state.originalId) {
    router.navigate('/');
  } else {
    router.navigate('/entry/' + state.originalId);
  }
}
