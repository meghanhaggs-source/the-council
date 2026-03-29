CREATE TABLE council_memos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  from_advisor text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_council_memos_created ON council_memos (created_at);
