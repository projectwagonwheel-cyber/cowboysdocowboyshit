-- 0001_init.sql
-- Core schema: submissions, votes, reports, kill switch.

CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('photo', 'video')),
  media_key TEXT NOT NULL,
  poster_key TEXT,
  caption TEXT,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'rejected', 'removed')),
  reject_reason TEXT,
  rating REAL NOT NULL DEFAULT 1000,
  vote_count INTEGER NOT NULL DEFAULT 0,
  cowboy_count INTEGER NOT NULL DEFAULT 0,
  report_count INTEGER NOT NULL DEFAULT 0,
  submitter_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at TEXT,
  reviewed_at TEXT
);

CREATE INDEX idx_submissions_status ON submissions (status);
CREATE INDEX idx_submissions_status_rating ON submissions (status, rating DESC);
CREATE INDEX idx_submissions_status_approved_at ON submissions (status, approved_at DESC);
CREATE INDEX idx_submissions_submitter ON submissions (submitter_hash, created_at);

CREATE TABLE votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  voter_hash TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('cowboy', 'not_cowboy')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_votes_voter_recent ON votes (voter_hash, created_at);
CREATE UNIQUE INDEX idx_votes_one_per_voter_per_sub ON votes (submission_id, voter_hash);

CREATE TABLE reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  reporter_hash TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_reports_submission ON reports (submission_id);
CREATE UNIQUE INDEX idx_reports_one_per_reporter_per_sub ON reports (submission_id, reporter_hash);

-- Single-row settings table for global flags (kill switch, etc.)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO settings (key, value) VALUES ('feed_paused', '0');
