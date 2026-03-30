-- Task updates / steps log
CREATE TABLE IF NOT EXISTS task_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  body TEXT NOT NULL,
  update_type TEXT DEFAULT 'note' CHECK (update_type IN ('note', 'step_completed', 'status_change', 'reassigned')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE task_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view task updates" ON task_updates FOR SELECT USING (true);
CREATE POLICY "Users can insert task updates" ON task_updates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_task_updates_task ON task_updates(task_id);
