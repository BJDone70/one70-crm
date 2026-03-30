-- In-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('task_assigned', 'task_completed', 'task_overdue', 'deal_stage', 'deal_won', 'deal_lost', 'email_received', 'email_unreplied', 'contact_stale', 'mention', 'system')),
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access notifications" ON notifications FOR ALL USING (auth.role() = 'service_role');
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- Deal stage history for velocity tracking
CREATE TABLE IF NOT EXISTS deal_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE deal_stage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view stage history" ON deal_stage_history FOR SELECT USING (true);
CREATE POLICY "Users can insert stage history" ON deal_stage_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role full access stage history" ON deal_stage_history FOR ALL USING (auth.role() = 'service_role');
CREATE INDEX idx_stage_history_deal ON deal_stage_history(deal_id);
CREATE INDEX idx_stage_history_stage ON deal_stage_history(to_stage);
