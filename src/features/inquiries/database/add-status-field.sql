-- Add status field to inquiries table
-- This migration adds a status field to track inquiry states

-- Add status column with default value 'pending'
ALTER TABLE inquiries 
ADD COLUMN status VARCHAR(20) DEFAULT 'pending' NOT NULL;

-- Add updated_at column for tracking when inquiries are modified
ALTER TABLE inquiries 
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create an index on status for better query performance
CREATE INDEX idx_inquiries_status ON inquiries(status);

-- Create an index on updated_at for sorting
CREATE INDEX idx_inquiries_updated_at ON inquiries(updated_at);

-- Add a check constraint to ensure valid status values
ALTER TABLE inquiries 
ADD CONSTRAINT inquiries_status_check 
CHECK (status IN ('pending', 'resolved', 'closed'));

-- Create a trigger to automatically update updated_at when row is modified
CREATE OR REPLACE FUNCTION update_inquiries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_inquiries_updated_at
    BEFORE UPDATE ON inquiries
    FOR EACH ROW
    EXECUTE FUNCTION update_inquiries_updated_at();

-- Update existing inquiries to have 'pending' status (already set by default)
-- This is just for clarity and documentation
UPDATE inquiries SET status = 'pending' WHERE status IS NULL;
