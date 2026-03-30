-- V1 Fixes Migration

-- 1. Prime Contact flag on contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_prime_contact BOOLEAN DEFAULT false;

-- 1b. Mobile phone for contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS mobile_phone TEXT;

-- 1c. LinkedIn URL for organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

-- 2. Feedback: add priority, urgency, category, allow image URLs
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical'));
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'urgent'));
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'system' CHECK (category IN ('system', 'process', 'ui', 'data', 'integration', 'other'));
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

-- 3. Feedback: allow users to update their own feedback (for editing)
CREATE POLICY "Users can update own feedback" ON feedback FOR UPDATE
  USING (auth.uid() = user_id);

-- 4. Feedback comments table for threaded dialogue
CREATE TABLE IF NOT EXISTS feedback_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID REFERENCES feedback(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE feedback_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read comments on accessible feedback" ON feedback_comments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM feedback WHERE feedback.id = feedback_id AND (feedback.user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')))
  );
CREATE POLICY "Users can insert comments" ON feedback_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. Custom verticals table
CREATE TABLE IF NOT EXISTS custom_verticals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE custom_verticals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All users can read verticals" ON custom_verticals FOR SELECT USING (true);
CREATE POLICY "Admins can manage verticals" ON custom_verticals FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 6. Remove the CHECK constraint on organizations.vertical to allow custom values
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_vertical_check;

-- 7. Add sorting-friendly indexes
CREATE INDEX IF NOT EXISTS idx_contacts_last_name ON contacts(last_name);
CREATE INDEX IF NOT EXISTS idx_contacts_org_id ON contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_priority ON feedback(priority);
