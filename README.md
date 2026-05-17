# ENT Clinical Reference

A local clinical-reference web app for ENT diagnoses, procedures, and MA workflows. Notion-style block editor, password-gated editing, file-based JSON storage so MAs can hand-edit, back up, or restore content.

## Run

```bash
cd ent-reference
npm install
npm start
```

Then open http://localhost:3100 in a browser.

By default the server runs on port 3100. To use a different port:

```bash
PORT=4000 npm start
```

(Port 3100 was chosen because port 3000 is commonly used by other dev tools. The original spec called for 3000 — change `PORT` if you prefer that.)

## Edit mode

- Click `✏ Edit` in the top right.
- Password: `ENT2024`
- Once unlocked you can edit any entry (✏ icon next to nav items, "Edit this page" on entry view) or create new entries (`+ Add` buttons in the sidebar).
- Click `🔒 Lock` to leave edit mode. Tokens are session-scoped (cleared on lock or browser close).

To change the password: edit the literal `'ENT2024'` in two places — `server.js` (line where it computes `PASSWORD_HASH`) and the password is verified server-side via SHA-256, so you only have to change it in `server.js`. The client never sees the hash.

## Editing — slash commands

In a block, type `/` to open the slash menu:

- `Text` — paragraph
- `Heading` — section heading
- `List item` — bullet item
- `Warning` / `Info` / `Note` — colored alert callouts
- `Numbered step` — numbered card row (used for MA protocols)
- `Image` — upload or paste URL
- `Video` — upload or paste a YouTube URL (auto-detected and embedded)

Drag the `⠿` handle to reorder blocks. Backspace on an empty block deletes it. Edits auto-save 3 seconds after the last keystroke; click `Save` to save immediately.

## Data layout

Each entry is one JSON file under `data/`:

```
data/
  diagnoses/    # type: "dx"
  procedures/   # type: "proc"
  protocols/    # type: "ma"
```

Filename = entry ID (e.g. `chronic-sinusitis.json`). Entry shape:

```json
{
  "id": "chronic-sinusitis",
  "type": "dx",
  "title": "Chronic Sinusitis",
  "desc": "Inflammation of paranasal sinuses…",
  "blocks": [
    { "id": "…", "type": "h3", "content": "Definition" },
    { "id": "…", "type": "p", "content": "Symptoms persisting <strong>≥12 weeks</strong>…" },
    { "id": "…", "type": "li", "content": "Nasal endoscopy in clinic…" },
    { "id": "…", "type": "alert-info", "content": "If maximal medical therapy fails…" },
    { "id": "…", "type": "step", "content": "Step text", "note": "Optional clarification" },
    { "id": "…", "type": "image", "src": "/media/foo.jpg", "caption": "…" },
    { "id": "…", "type": "video", "src": "https://www.youtube.com/embed/…", "caption": "…", "isEmbed": true }
  ],
  "related": ["nasal-polyps", "fess"],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

Inline `<strong>` and `<em>` are preserved inside `content` strings; everything else is escaped.

## Adding an entry by hand

1. Create a new JSON file in `data/diagnoses/`, `data/procedures/`, or `data/protocols/`.
2. Use the schema above. Pick an ID (lowercase, kebab-case) — the filename without `.json` becomes the ID.
3. Restart `npm start` (the server reads the directory on each request, so a restart isn't strictly required, but it's cleaner).
4. Reload the browser. Your entry appears in the sidebar.

## Backup

Two options:

1. **Edit mode → ⋯ menu → Export all (JSON).** Downloads a single combined JSON file containing every entry. Restore via Import in the same menu.
2. **Copy `data/` and `media/` directories.** This is the entire database — no other state lives outside these folders.

## Architecture notes

- Server: `server.js`, plain Express. Routes live in one file. SHA-256 of the password is computed at boot; tokens are kept in an in-memory `Set` for the server's lifetime (no DB, no expiry).
- Client: vanilla ES modules, hash-based router. No build step.
- Block model: each entry's body is an ordered array of typed blocks. Consecutive `li` blocks group into a bulleted list at render time; consecutive `step` blocks group into a numbered card.
- Steps are numbered, **not** interactive checklists — by design, this is a reference tool, not a workflow tracker.
