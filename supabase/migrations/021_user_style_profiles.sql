-- User writing style profiles
CREATE TABLE IF NOT EXISTS user_style_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  style_profile TEXT NOT NULL, -- The analyzed style description
  sample_count INTEGER DEFAULT 0, -- How many emails were analyzed
  last_analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_style_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own style" ON user_style_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own style" ON user_style_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role full access styles" ON user_style_profiles FOR ALL USING (auth.role() = 'service_role');
