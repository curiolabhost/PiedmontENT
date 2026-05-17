import { entries as entriesApi } from './db.js';
import { router, setBreadcrumb } from './app.js';
import { setActiveNav, getCachedEntries, TYPE_LABELS } from './sidebar.js';
import { openEditor } from './editor.js';

const ALERT_ICON = { 'alert-warn': '⚠', 'alert-info': '→', 'alert-note': '→' };

const INLINE_VOID_TAGS = new Set(['strong', 'em', 'b', 'i', 'u', 's', 'strike']);

function filterSafeStyleViewer(style) {
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

function safeInline(s) {
  // Escape everything, then re-allow a small set of inline formatting tags.
  let out = String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // Re-allow the void-style inline tags (strong/em/b/i/u/s/strike — open and close)
  out = out.replace(/&lt;(\/?)(strong|em|b|i|u|s|strike)&gt;/gi, '<$1$2>');

  // Re-allow <span style="color:..."> / <span style="background-color:...">
  // The escaped form looks like: &lt;span style=&quot;color: #abc&quot;&gt;
  out = out.replace(
    /&lt;span\s+style=&quot;([^&]*)&quot;&gt;/gi,
    (_m, style) => {
      const safe = filterSafeStyleViewer(style.replace(/&amp;/g, '&'));
      if (!safe) return '';
      return `<span style="${safe}">`;
    }
  );
  out = out.replace(/&lt;\/span&gt;/gi, '</span>');

  return out;
}

function renderBlocks(blocks, container) {
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];

    if (b.type === 'li') {
      const list = document.createElement('div');
      list.className = 'block-list';
      while (i < blocks.length && blocks[i].type === 'li') {
        const li = document.createElement('div');
        li.className = 'block-li';
        li.innerHTML = safeInline(blocks[i].content || '');
        list.appendChild(li);
        i++;
      }
      container.appendChild(list);
      continue;
    }

    if (b.type === 'step' || b.type === 'checklist-step') {
      const card = document.createElement('div');
      card.className = 'steps-card';
      const stepType = b.type;
      let n = 1;
      while (i < blocks.length && blocks[i].type === stepType) {
        const cur = blocks[i];
        const row = document.createElement('div');
        row.className = 'step-row';

        const num = document.createElement('div');
        num.className = 'step-num';
        num.textContent = String(n++);
        row.appendChild(num);

        const body = document.createElement('div');
        body.className = 'step-body';
        const text = document.createElement('div');
        text.className = 'step-text';
        text.innerHTML = safeInline(cur.content || '');
        body.appendChild(text);
        if (cur.note) {
          const note = document.createElement('div');
          note.className = 'step-note';
          note.innerHTML = safeInline(cur.note);
          body.appendChild(note);
        }
        row.appendChild(body);
        card.appendChild(row);
        i++;
      }
      container.appendChild(card);
      continue;
    }

    if (b.type === 'h2') {
      const h = document.createElement('h2');
      h.className = 'block-h2';
      h.innerHTML = safeInline(b.content || '');
      container.appendChild(h);
      i++;
      continue;
    }

    if (b.type === 'h3') {
      const h = document.createElement('h3');
      h.className = 'block-h3';
      h.innerHTML = safeInline(b.content || '');
      container.appendChild(h);
      i++;
      continue;
    }

    if (b.type === 'letter') {
      const el = document.createElement('div');
      el.className = 'block-letter';
      const body = document.createElement('div');
      const escaped = String(b.content || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      body.innerHTML = escaped.replace(/\[([^\]]+)\]/g, '<span class="fill-field">[$1]</span>');
      el.appendChild(body);

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'block-letter-copy';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', async () => {
        const text = b.content || '';
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
          } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          copyBtn.textContent = 'Copied';
          copyBtn.classList.add('copied');
        } catch (err) {
          copyBtn.textContent = 'Failed';
        }
        setTimeout(() => {
          copyBtn.textContent = 'Copy';
          copyBtn.classList.remove('copied');
        }, 1500);
      });
      el.appendChild(copyBtn);

      container.appendChild(el);
      i++;
      continue;
    }

    if (b.type === 'p') {
      const p = document.createElement('p');
      p.className = 'block-p';
      p.innerHTML = safeInline(b.content || '');
      container.appendChild(p);
      i++;
      continue;
    }

    if (b.type === 'alert-warn' || b.type === 'alert-info' || b.type === 'alert-note') {
      const div = document.createElement('div');
      div.className = `alert ${b.type}`;
      const icon = document.createElement('span');
      icon.className = 'alert-icon';
      icon.textContent = ALERT_ICON[b.type] || '→';
      div.appendChild(icon);
      const body = document.createElement('div');
      body.innerHTML = safeInline(b.content || '');
      div.appendChild(body);
      container.appendChild(div);
      i++;
      continue;
    }

    if (b.type === 'image') {
      const fig = document.createElement('figure');
      fig.className = 'media-figure';
      const img = document.createElement('img');
      img.src = b.src || '';
      img.alt = b.caption || '';
      fig.appendChild(img);
      if (b.caption) {
        const cap = document.createElement('figcaption');
        cap.textContent = b.caption;
        fig.appendChild(cap);
      }
      container.appendChild(fig);
      i++;
      continue;
    }

    if (b.type === 'video') {
      const fig = document.createElement('figure');
      fig.className = 'media-figure';
      const wrap = document.createElement('div');
      wrap.className = 'video-wrap';
      if (b.isEmbed) {
        const iframe = document.createElement('iframe');
        iframe.src = b.src || '';
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allowfullscreen', 'true');
        wrap.appendChild(iframe);
      } else {
        const vid = document.createElement('video');
        vid.src = b.src || '';
        vid.controls = true;
        wrap.appendChild(vid);
      }
      fig.appendChild(wrap);
      if (b.caption) {
        const cap = document.createElement('figcaption');
        cap.textContent = b.caption;
        fig.appendChild(cap);
      }
      container.appendChild(fig);
      i++;
      continue;
    }

    // Unknown block — render as paragraph
    const p = document.createElement('p');
    p.className = 'block-p';
    p.textContent = b.content || '';
    container.appendChild(p);
    i++;
  }
}

function renderRelated(related, container) {
  if (!Array.isArray(related) || related.length === 0) return;
  const all = getCachedEntries();
  const byId = new Map(all.map(e => [e.id, e]));

  const wrap = document.createElement('div');
  wrap.className = 'entry-related';
  const label = document.createElement('div');
  label.className = 'entry-related-label';
  label.textContent = 'Related Topics';
  wrap.appendChild(label);

  const bubbles = document.createElement('div');
  bubbles.className = 'related-bubbles';
  for (const id of related) {
    const e = byId.get(id);
    if (!e) continue;
    const b = document.createElement('span');
    b.className = `related-bubble ${e.type}`;
    b.textContent = e.title;
    b.addEventListener('click', () => router.navigate('/entry/' + e.id));
    bubbles.appendChild(b);
  }
  wrap.appendChild(bubbles);
  container.appendChild(wrap);
}

export async function showEntry(id) {
  document.body.classList.remove('editor-active');
  let entry;
  try {
    entry = await entriesApi.get(id);
  } catch (e) {
    const content = document.getElementById('content');
    content.innerHTML = `<div class="empty-state">Could not load entry: ${e.message}</div>`;
    return;
  }

  setActiveNav(id);
  setBreadcrumb([
    { label: 'Home', onClick: () => router.navigate('/') },
    { label: TYPE_LABELS[entry.type] || entry.type, onClick: () => router.navigate('/cat/' + entry.type) },
    { label: entry.title },
  ]);

  const content = document.getElementById('content');
  content.innerHTML = '';
  content.classList.remove('fade-in');
  void content.offsetWidth;

  const view = document.createElement('div');
  view.className = 'entry-view fade-in';

  const eyebrow = document.createElement('div');
  eyebrow.className = `entry-eyebrow ${entry.type}`;
  eyebrow.textContent = TYPE_LABELS[entry.type] || entry.type;
  view.appendChild(eyebrow);

  const headerRow = document.createElement('div');
  headerRow.className = 'entry-header-row';
  const h1 = document.createElement('h1');
  h1.className = 'entry-title';
  h1.textContent = entry.title;
  headerRow.appendChild(h1);
  const editBtn = document.createElement('button');
  editBtn.className = 'btn entry-edit-btn';
  editBtn.textContent = '✏ Edit this page';
  editBtn.addEventListener('click', () => openEditor(entry.id));
  headerRow.appendChild(editBtn);
  view.appendChild(headerRow);

  if (entry.desc) {
    const p = document.createElement('p');
    p.className = 'entry-desc';
    p.textContent = entry.desc;
    view.appendChild(p);
  }

  const hr = document.createElement('hr');
  hr.className = 'entry-divider';
  view.appendChild(hr);

  const blocksWrap = document.createElement('div');
  blocksWrap.className = 'entry-blocks';
  renderBlocks(Array.isArray(entry.blocks) ? entry.blocks : [], blocksWrap);
  view.appendChild(blocksWrap);

  renderRelated(entry.related, view);

  content.appendChild(view);
}
