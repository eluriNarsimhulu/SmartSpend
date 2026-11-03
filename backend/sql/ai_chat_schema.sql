-- SmartSpend AI V2 – Chat schema migration.
-- Safe to run more than once (all statements use IF NOT EXISTS / DO blocks).
-- Does NOT modify or delete any V1 tables.

-- Enable pgcrypto for gen_random_uuid() if not already enabled.
-- On PostgreSQL 13+ gen_random_uuid() is built-in; this is a no-op there.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ai_conversations: one row per chat session.
CREATE TABLE IF NOT EXISTS ai_conversations (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL DEFAULT 'New Chat',
  summary      TEXT         NOT NULL DEFAULT '',   -- rolling summary of older messages
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ai_messages: every user and assistant turn.
CREATE TABLE IF NOT EXISTS ai_messages (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID         NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role             VARCHAR(10)  NOT NULL CHECK (role IN ('user', 'assistant')),
  content          TEXT         NOT NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes for the most common access patterns.
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id    ON ai_conversations (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages      (conversation_id, created_at ASC);

