-- Protect public lead records from direct anon/authenticated access via Supabase APIs.
-- The application writes to this table through the trusted backend connection.
ALTER TABLE "PublicLeadSubmission" ENABLE ROW LEVEL SECURITY;
