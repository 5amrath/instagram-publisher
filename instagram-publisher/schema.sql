CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  media_type TEXT DEFAULT 'IMAGE',
  caption TEXT,
  status TEXT DEFAULT 'pending',
  scheduled_at TIMESTAMP,
  posted_at TIMESTAMP,
  retry_count INT DEFAULT 0,
  error_message TEXT,
  ig_post_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at ON posts(scheduled_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO settings (key, value) VALUES ('daily_limit', '25')
ON CONFLICT (key) DO NOTHING;
