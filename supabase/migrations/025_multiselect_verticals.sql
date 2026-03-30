-- Multi-select verticals: add array column
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS verticals TEXT[] DEFAULT '{}';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS verticals TEXT[] DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS verticals TEXT[] DEFAULT '{}';

-- Migrate existing single vertical into array
UPDATE organizations SET verticals = ARRAY[vertical] WHERE vertical IS NOT NULL AND (verticals IS NULL OR verticals = '{}');
UPDATE deals SET verticals = ARRAY[vertical] WHERE vertical IS NOT NULL AND (verticals IS NULL OR verticals = '{}');
UPDATE projects SET verticals = ARRAY[vertical] WHERE vertical IS NOT NULL AND (verticals IS NULL OR verticals = '{}');

-- Rename hotel → hospitality everywhere
UPDATE organizations SET vertical = 'hospitality', verticals = array_replace(verticals, 'hotel', 'hospitality') WHERE 'hotel' = ANY(verticals) OR vertical = 'hotel';
UPDATE deals SET vertical = 'hospitality', verticals = array_replace(verticals, 'hotel', 'hospitality') WHERE 'hotel' = ANY(verticals) OR vertical = 'hotel';
UPDATE projects SET vertical = 'hospitality', verticals = array_replace(verticals, 'hotel', 'hospitality') WHERE 'hotel' = ANY(verticals) OR vertical = 'hotel';
UPDATE properties SET vertical = 'hospitality' WHERE vertical = 'hotel';
UPDATE sequences SET vertical = 'hospitality' WHERE vertical = 'hotel';
UPDATE custom_verticals SET name = 'hospitality' WHERE name = 'hotel';
