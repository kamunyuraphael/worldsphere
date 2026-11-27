CREATE TABLE IF NOT EXISTS circles (
 slug VARCHAR(48) PRIMARY KEY,
 name VARCHAR(100) NOT NULL,
 description TEXT NOT NULL,
 category VARCHAR(20) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS circle_members (
 circle_slug VARCHAR(48) NOT NULL REFERENCES circles(slug) ON DELETE CASCADE,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (circle_slug, user_id));
CREATE INDEX IF NOT EXISTS idx_circle_members_user ON circle_members(user_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_circle_joined ON circle_members(circle_slug, joined_at DESC);
INSERT INTO circles (slug, name, description, category) VALUES
 ('wildlife-guild', 'Wildlife Guild', 'Trackers and field biologists documenting animal life.', 'animal'),
 ('flora-circle', 'Flora Circle', 'Botanists and growers cataloguing the plant world.', 'plant'),
 ('waters-collective', 'Waters Collective', 'Divers and hydrologists exploring aquatic ecosystems.', 'water')
ON CONFLICT (slug) DO NOTHING;
