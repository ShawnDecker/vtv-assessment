-- Running From Miracles - Daily Devotional Content
-- Migration 006: Create devotional tables for faith-based content platform

CREATE TABLE IF NOT EXISTS rfm_chapters (
    id SERIAL PRIMARY KEY,
    chapter_number INTEGER NOT NULL UNIQUE,
    title TEXT NOT NULL,
    book_page INTEGER,
    word_count INTEGER,
    themes TEXT[] DEFAULT '{}',
    bible_verses TEXT[] DEFAULT '{}',
    summary TEXT,
    reflection_prompt TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rfm_devotionals (
    id SERIAL PRIMARY KEY,
    chapter_id INTEGER REFERENCES rfm_chapters(id),
    day_number INTEGER NOT NULL UNIQUE,
    title TEXT NOT NULL,
    theme TEXT NOT NULL,
    scripture_reference TEXT,
    scripture_text TEXT,
    reflection TEXT NOT NULL,
    prayer TEXT,
    action_step TEXT,
    podcast_topic TEXT,
    social_media_post TEXT,
    is_published BOOLEAN DEFAULT false,
    scheduled_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rfm_subscriber_progress (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    current_day INTEGER DEFAULT 1,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_sent_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(email)
);

-- Index for daily delivery queries
CREATE INDEX IF NOT EXISTS idx_devotionals_day ON rfm_devotionals(day_number);
CREATE INDEX IF NOT EXISTS idx_devotionals_scheduled ON rfm_devotionals(scheduled_date) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_subscriber_active ON rfm_subscriber_progress(is_active) WHERE is_active = true;
