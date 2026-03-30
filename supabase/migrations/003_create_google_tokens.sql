CREATE TABLE IF NOT EXISTS google_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token text NOT NULL,
  refresh_token text,
  expires_at bigint,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
