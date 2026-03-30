-- Pending shares from iOS Share Extension
CREATE TABLE IF NOT EXISTS pending_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  text TEXT NOT NULL,
  source TEXT DEFAULT 'share_extension',
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE pending_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own pending shares" ON pending_shares FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own pending shares" ON pending_shares FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access" ON pending_shares FOR ALL USING (auth.role() = 'service_role');
