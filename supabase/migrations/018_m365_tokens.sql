-- Microsoft 365 OAuth tokens per user
CREATE TABLE IF NOT EXISTS m365_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  connected_email TEXT,
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
  sync_error TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE m365_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tokens" ON m365_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own tokens" ON m365_tokens FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role full access m365" ON m365_tokens FOR ALL USING (auth.role() = 'service_role');
