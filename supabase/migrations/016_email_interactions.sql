-- Email interaction tracking
CREATE TABLE IF NOT EXISTS email_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  contact_id UUID REFERENCES contacts(id),
  org_id UUID REFERENCES organizations(id),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_email TEXT NOT NULL,
  to_email TEXT,
  subject TEXT NOT NULL,
  snippet TEXT,
  received_at TIMESTAMPTZ DEFAULT now(),
  needs_reply BOOLEAN DEFAULT false,
  replied_at TIMESTAMPTZ,
  follow_up_date DATE,
  follow_up_note TEXT,
  source TEXT DEFAULT 'forwarded' CHECK (source IN ('forwarded', 'monitored', 'manual')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own email interactions" ON email_interactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert email interactions" ON email_interactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own email interactions" ON email_interactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access ei" ON email_interactions FOR ALL USING (auth.role() = 'service_role');
CREATE INDEX IF NOT EXISTS idx_email_interactions_user ON email_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_email_interactions_contact ON email_interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_interactions_needs_reply ON email_interactions(needs_reply);

-- Meeting tracking (calendar integration)
CREATE TABLE IF NOT EXISTS meeting_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  contact_id UUID REFERENCES contacts(id),
  org_id UUID REFERENCES organizations(id),
  subject TEXT NOT NULL,
  meeting_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  attendees TEXT,
  notes TEXT,
  follow_up_created BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'outlook', 'teams')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE meeting_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own meetings" ON meeting_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert meetings" ON meeting_tracking FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meetings" ON meeting_tracking FOR UPDATE USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_tracking_user ON meeting_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_tracking_contact ON meeting_tracking(contact_id);
CREATE INDEX IF NOT EXISTS idx_meeting_tracking_date ON meeting_tracking(meeting_date);
