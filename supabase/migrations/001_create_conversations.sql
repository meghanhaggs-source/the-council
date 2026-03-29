CREATE TABLE conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  advisor_name text NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_conversations_advisor ON conversations (advisor_name, created_at);
