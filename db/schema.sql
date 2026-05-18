CREATE TABLE IF NOT EXISTS entries (
  id          TEXT        PRIMARY KEY,
  type        TEXT        NOT NULL CHECK (type IN ('dx', 'proc', 'ma')),
  region      TEXT        NOT NULL CHECK (region IN ('nose', 'ear', 'general')),
  title       TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  blocks      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  related     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS entries_type_idx        ON entries (type);
CREATE INDEX IF NOT EXISTS entries_region_idx      ON entries (region);
CREATE INDEX IF NOT EXISTS entries_type_region_idx ON entries (type, region);
CREATE INDEX IF NOT EXISTS entries_blocks_gin      ON entries USING GIN (blocks);

CREATE INDEX IF NOT EXISTS entries_fts_idx ON entries
  USING GIN (to_tsvector('english',
    coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(blocks::text,'')
  ));

CREATE TABLE IF NOT EXISTS media (
  filename     TEXT        PRIMARY KEY,
  url          TEXT        NOT NULL,
  kind         TEXT        NOT NULL CHECK (kind IN ('image', 'video', 'pdf', 'doc')),
  mime         TEXT        NOT NULL,
  size_bytes   INTEGER,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS templates (
  id          TEXT        PRIMARY KEY,
  title       TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  body        TEXT        NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
