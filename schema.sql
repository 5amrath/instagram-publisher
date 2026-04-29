-- Run this in your Neon SQL editor (one-time setup)
-- If already run the basic schema, run the ALTER TABLE section separately

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_url TEXT NOT NULL,
  video_url TEXT,
  thumbnail_url TEXT,
  media_type TEXT DEFAULT 'VIDEO',
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

-- If you already ran the old schema, run these ALTER TABLE commands:
-- ALTER TABLE posts ADD COLUMN IF NOT EXISTS video_url TEXT;
-- ALTER TABLE posts ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
-- ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'VIDEO';
-- ALTER TABLE posts ADD COLUMN IF NOT EXISTS ig_post_id TEXT;
