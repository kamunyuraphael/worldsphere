CREATE TABLE IF NOT EXISTS circle_threads (
 id BIGSERIAL PRIMARY KEY,
 circle_slug VARCHAR(48) NOT NULL REFERENCES circles(slug) ON DELETE CASCADE,
 author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title VARCHAR(120) NOT NULL,
 body TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_circle_threads_circle_created ON circle_threads(circle_slug, created_at DESC);
CREATE TABLE IF NOT EXISTS circle_replies (
 id BIGSERIAL PRIMARY KEY,
 thread_id BIGINT NOT NULL REFERENCES circle_threads(id) ON DELETE CASCADE,
 author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 body TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_circle_replies_thread_created ON circle_replies(thread_id, created_at);
