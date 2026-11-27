ALTER TABLE circle_threads ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE circle_replies ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS circle_reports (
 id BIGSERIAL PRIMARY KEY,
 thread_id BIGINT REFERENCES circle_threads(id) ON DELETE CASCADE,
 reply_id BIGINT REFERENCES circle_replies(id) ON DELETE CASCADE,
 reporter_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 reason VARCHAR(200),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ((thread_id IS NOT NULL) <> (reply_id IS NOT NULL)));
CREATE UNIQUE INDEX IF NOT EXISTS uq_circle_reports_thread ON circle_reports(thread_id, reporter_id) WHERE thread_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_circle_reports_reply ON circle_reports(reply_id, reporter_id) WHERE reply_id IS NOT NULL;
