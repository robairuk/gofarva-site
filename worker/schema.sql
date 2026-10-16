-- Go Farva launch newsletter (private; never expose via HTTP)
CREATE TABLE IF NOT EXISTS subscribers (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  email_normalized TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  consent INTEGER NOT NULL CHECK (consent = 1),
  consent_text_version TEXT NOT NULL,
  source TEXT
);

CREATE INDEX IF NOT EXISTS idx_subscribers_created_at ON subscribers(created_at);

-- Rate limit buckets: key is SHA-256(ip || salt), window is UTC hour
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key TEXT NOT NULL,
  window_start TEXT NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);
