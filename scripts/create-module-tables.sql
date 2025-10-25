-- Create role_modules table if it doesn't exist
CREATE TABLE IF NOT EXISTS role_modules (
  role TEXT PRIMARY KEY,
  modules TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create user_modules table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_modules (
  user_id TEXT PRIMARY KEY,
  modules TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_role_modules_role ON role_modules(role);
CREATE INDEX IF NOT EXISTS idx_user_modules_user_id ON user_modules(user_id);

SELECT 'Tables created successfully' AS result;
