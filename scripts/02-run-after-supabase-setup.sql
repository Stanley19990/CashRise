-- Run this script after setting up Supabase integration
-- This ensures all tables are created and populated

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Create policies for machine_types table
CREATE POLICY "Anyone can view machine types" ON machine_types FOR SELECT USING (is_active = true);

-- Create policies for user_machines table
CREATE POLICY "Users can view own machines" ON user_machines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own machines" ON user_machines FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own machines" ON user_machines FOR UPDATE USING (auth.uid() = user_id);

-- Create policies for earnings table
CREATE POLICY "Users can view own earnings" ON earnings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert earnings" ON earnings FOR INSERT WITH CHECK (true);

-- Create policies for withdrawals table
CREATE POLICY "Users can view own withdrawals" ON withdrawals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create withdrawals" ON withdrawals FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policies for referrals table
CREATE POLICY "Users can view own referrals" ON referrals FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
CREATE POLICY "System can insert referrals" ON referrals FOR INSERT WITH CHECK (true);

-- Create policies for ad_sessions table
CREATE POLICY "Users can view own ad sessions" ON ad_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create ad sessions" ON ad_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Insert default machine types if they don't exist
INSERT INTO machine_types (name, price, daily_earning_rate, description, image_url) 
SELECT * FROM (VALUES
  ('Basic Miner', 10.00, 0.05, 'Entry-level machine perfect for beginners', NULL),
  ('Power Miner', 25.00, 0.08, 'Enhanced mining capabilities with better returns', NULL),
  ('Turbo Miner', 50.00, 0.12, 'High-performance machine for serious earners', NULL),
  ('Quantum Miner', 100.00, 0.18, 'Top-tier machine with maximum earning potential', NULL),
  ('Mega Miner', 200.00, 0.25, 'Ultimate mining machine for power users', NULL)
) AS new_machines(name, price, daily_earning_rate, description, image_url)
WHERE NOT EXISTS (SELECT 1 FROM machine_types WHERE machine_types.name = new_machines.name);
