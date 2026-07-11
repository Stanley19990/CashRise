-- CashRise production migration 05
-- Withdrawal gating, bonus wallet, daily missions, lucky spin, and achievements.
--
-- Run this in Supabase SQL Editor after scripts 01, 02, 03, and 04.
-- This script is idempotent and safe to rerun.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verification_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS verification_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_machine_purchase_date timestamptz,
  ADD COLUMN IF NOT EXISTS bonus_wallet_balance numeric(12, 2) NOT NULL DEFAULT 0;

UPDATE public.users u
SET first_machine_purchase_date = first_machine.first_purchase
FROM (
  SELECT user_id, MIN(purchased_at) AS first_purchase
  FROM public.user_machines
  GROUP BY user_id
) first_machine
WHERE u.id = first_machine.user_id
  AND u.first_machine_purchase_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_verification_status
  ON public.users (verification_status);

CREATE INDEX IF NOT EXISTS idx_users_first_machine_purchase_date
  ON public.users (first_machine_purchase_date);

CREATE TABLE IF NOT EXISTS public.user_reward_state (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  daily_streak integer NOT NULL DEFAULT 0,
  last_daily_claim_date date,
  last_spin_date date,
  bonus_wallet_balance numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_reward_state
  ADD COLUMN IF NOT EXISTS daily_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_daily_claim_date date,
  ADD COLUMN IF NOT EXISTS last_spin_date date,
  ADD COLUMN IF NOT EXISTS bonus_wallet_balance numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

INSERT INTO public.user_reward_state (user_id, bonus_wallet_balance)
SELECT id, COALESCE(bonus_wallet_balance, 0)
FROM public.users
ON CONFLICT (user_id) DO UPDATE
SET bonus_wallet_balance = EXCLUDED.bonus_wallet_balance,
    updated_at = now();

CREATE TABLE IF NOT EXISTS public.reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reward_type text NOT NULL,
  claim_key text NOT NULL,
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XAF',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reward_claims
  ADD COLUMN IF NOT EXISTS reward_type text NOT NULL DEFAULT 'bonus',
  ADD COLUMN IF NOT EXISTS claim_key text,
  ADD COLUMN IF NOT EXISTS amount numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'XAF',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_claims_user_claim_key
  ON public.reward_claims (user_id, claim_key)
  WHERE claim_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reward_claims_user_created
  ON public.reward_claims (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  unlocked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_achievements
  ADD COLUMN IF NOT EXISTS achievement_key text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS unlocked_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_achievements_unique
  ON public.user_achievements (user_id, achievement_key);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_unlocked
  ON public.user_achievements (user_id, unlocked_at DESC);

ALTER TABLE public.user_reward_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own reward state" ON public.user_reward_state;
CREATE POLICY "Users can view own reward state"
  ON public.user_reward_state FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own reward claims" ON public.reward_claims;
CREATE POLICY "Users can view own reward claims"
  ON public.reward_claims FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own achievements" ON public.user_achievements;
CREATE POLICY "Users can view own achievements"
  ON public.user_achievements FOR SELECT
  USING (auth.uid() = user_id);
