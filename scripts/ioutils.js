import { entries as entriesApi } from './db.js';
import { showToast } from './app.js';
import { buildSidebar } from './sidebar.js';

export async function exportAll() {
  try {
    const list = await entriesApi.list();
    const full = await Promise.all(list.map(e => entriesApi.get(e.id)));
    const json = JSON.stringify({
      version: 1,
      exported: new Date().toISOString(),
      entries: full,
    }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ent-reference-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Backup downloaded', 'success');
  } catch (e) {
    showToast('Export failed: ' + e.message, 'error');
  }
}

export function openImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed
        : Array.isArray(parsed.entries) ? parsed.entries : null;
      if (!list) throw new Error('Invalid file format');
      const ok = confirm(`Import ${list.length} entries? Existing entries with the same ID will be overwritten; others remain unchanged.`);
      if (!ok) return;
      let imported = 0;
      for (const entry of list) {
        try {
          await entriesApi.update(entry.id, entry);
        } catch {
          await entriesApi.create(entry);
        }
        imported++;
      }
      await buildSidebar();
      showToast(`Imported ${imported} entries`, 'success');
    } catch (err) {
      showToast('Import failed: ' + err.message, 'error');
    }
  });
  input.click();
}
