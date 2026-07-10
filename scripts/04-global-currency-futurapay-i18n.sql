-- CashRise production migration 04
-- Global country/currency support, Futurapay transaction fields, and the current
-- 8-machine AI catalog required by the app.
--
-- Run this in the Supabase SQL Editor after scripts 01, 02, and 03.
-- This script is idempotent: it can be run again after a partial failure.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'country'
      AND data_type <> 'jsonb'
  ) THEN
    ALTER TABLE public.users
      ALTER COLUMN country DROP NOT NULL,
      ALTER COLUMN country TYPE jsonb
      USING CASE
        WHEN country IS NULL THEN NULL
        WHEN left(trim(country::text), 1) = '{' THEN country::jsonb
        ELSE jsonb_build_object(
          'id', 1,
          'code', 'CM',
          'name', country::text,
          'dialCode', '237',
          'flag', 'CM',
          'currency', 'XAF',
          'currencySymbol', 'XAF',
          'usdExchangeRate', 573.9
        )
      END;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'password_hash'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS last_earning_date timestamptz,
  ADD COLUMN IF NOT EXISTS social_media_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_social_links text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS social_media_bonus_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "preferredLanguage" text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS "lastCurrencyUpdate" timestamptz NOT NULL DEFAULT now();

UPDATE public.users
SET country = jsonb_build_object(
    'id', 1,
    'code', 'CM',
    'name', 'Cameroon',
    'dialCode', '237',
    'flag', 'CM',
    'currency', 'XAF',
    'currencySymbol', 'XAF',
    'usdExchangeRate', 573.9
  )
WHERE country IS NULL;

ALTER TABLE public.users
  ALTER COLUMN country SET DEFAULT jsonb_build_object(
    'id', 1,
    'code', 'CM',
    'name', 'Cameroon',
    'dialCode', '237',
    'flag', 'CM',
    'currency', 'XAF',
    'currencySymbol', 'XAF',
    'usdExchangeRate', 573.9
  );

CREATE INDEX IF NOT EXISTS idx_users_country_code
  ON public.users ((country->>'code'));

CREATE INDEX IF NOT EXISTS idx_users_currency
  ON public.users ((country->>'currency'));

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  description text,
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XAF',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_transaction_id text,
  ADD COLUMN IF NOT EXISTS fapshi_trans_id text,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_transactions_provider_transaction
  ON public.transactions (provider, provider_transaction_id);

CREATE INDEX IF NOT EXISTS idx_transactions_fapshi_trans_id
  ON public.transactions (fapshi_trans_id);

CREATE INDEX IF NOT EXISTS idx_transactions_external_id
  ON public.transactions (external_id);

CREATE TABLE IF NOT EXISTS public.earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  machine_id text,
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XAF',
  type text,
  earning_type text,
  description text,
  earned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  constraint_record record;
BEGIN
  FOR constraint_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.earnings'::regclass
      AND contype = 'f'
      AND pg_get_constraintdef(oid) ILIKE '%machine_id%'
  LOOP
    EXECUTE format('ALTER TABLE public.earnings DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
  END LOOP;
END $$;

ALTER TABLE public.earnings
  ALTER COLUMN machine_id TYPE text USING machine_id::text;

ALTER TABLE public.earnings
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'XAF',
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS earning_type text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS earned_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'earnings'
      AND column_name = 'earning_type'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.earnings ALTER COLUMN earning_type DROP NOT NULL;
  END IF;

  UPDATE public.earnings
  SET
    earned_at = COALESCE(earned_at, created_at, now()),
    type = COALESCE(type, earning_type),
    earning_type = COALESCE(earning_type, type),
    currency = COALESCE(currency, 'XAF'),
    created_at = COALESCE(created_at, earned_at, now());
END $$;

ALTER TABLE public.earnings
  ALTER COLUMN earned_at SET DEFAULT now(),
  ALTER COLUMN earned_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_earnings_user_earned_at
  ON public.earnings (user_id, earned_at DESC);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'system',
  action_url text,
  related_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS action_url text,
  ADD COLUMN IF NOT EXISTS related_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, is_read)
  WHERE is_read = false;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint
  ON public.push_subscriptions (endpoint);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referral_date timestamptz NOT NULL DEFAULT now(),
  bonus numeric(12, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  reward_applied_at timestamptz,
  reward_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS referral_date timestamptz,
  ADD COLUMN IF NOT EXISTS bonus numeric(12, 2),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reward_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS reward_notes text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'referrals'
      AND column_name = 'bonus_amount'
  ) THEN
    UPDATE public.referrals
    SET bonus = COALESCE(bonus, bonus_amount, 0)
    WHERE bonus IS NULL;
  END IF;

  UPDATE public.referrals
  SET
    referral_date = COALESCE(referral_date, created_at, now()),
    bonus = COALESCE(bonus, 0),
    status = COALESCE(status, CASE WHEN COALESCE(bonus, 0) > 0 THEN 'active' ELSE 'pending' END);
END $$;

ALTER TABLE public.referrals
  ALTER COLUMN referral_date SET DEFAULT now(),
  ALTER COLUMN referral_date SET NOT NULL,
  ALTER COLUMN bonus SET DEFAULT 0,
  ALTER COLUMN bonus SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_date
  ON public.referrals (referrer_id, referral_date DESC);

CREATE INDEX IF NOT EXISTS idx_referrals_referred
  ON public.referrals (referred_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.referrals
    GROUP BY referred_id
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_referred_unique
      ON public.referrals (referred_id);
  ELSE
    RAISE NOTICE 'Skipped idx_referrals_referred_unique because duplicate referred_id rows exist. Clean duplicates after reviewing referral ownership.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL,
  amount_usd numeric(12, 2),
  currency text NOT NULL DEFAULT 'XAF',
  method text,
  account_details text,
  payment_method text,
  payment_details jsonb,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS amount_usd numeric(12, 2),
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'XAF',
  ADD COLUMN IF NOT EXISTS method text,
  ADD COLUMN IF NOT EXISTS account_details text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_details jsonb,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

UPDATE public.withdrawals
SET
  method = COALESCE(method, payment_method),
  payment_method = COALESCE(payment_method, method),
  account_details = COALESCE(account_details, payment_details->>'account_details'),
  amount_usd = COALESCE(amount_usd, amount / 573.9),
  created_at = COALESCE(created_at, requested_at, now()),
  requested_at = COALESCE(requested_at, created_at, now());

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_created
  ON public.withdrawals (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_withdrawals_status
  ON public.withdrawals (status);

CREATE TABLE IF NOT EXISTS public.admin_wallet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  balance numeric(12, 2) NOT NULL DEFAULT 0,
  total_received numeric(12, 2) NOT NULL DEFAULT 0,
  total_withdrawn numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.admin_wallet (balance, total_received, total_withdrawn)
SELECT 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM public.admin_wallet);

CREATE TABLE IF NOT EXISTS public.admin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric(12, 2) NOT NULL,
  transaction_type text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'completed',
  external_id text,
  withdrawal_method text,
  withdrawal_details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_transactions
  ADD COLUMN IF NOT EXISTS external_id text;

CREATE INDEX IF NOT EXISTS idx_admin_transactions_created
  ON public.admin_transactions (created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_transactions_external_id
  ON public.admin_transactions (external_id)
  WHERE external_id IS NOT NULL;

DO $$
DECLARE
  machine_id_type text;
  owned_machine_count integer := 0;
BEGIN
  SELECT data_type
    INTO machine_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'machine_types'
    AND column_name = 'id';

  IF machine_id_type = 'uuid' THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'user_machines'
    ) THEN
      EXECUTE 'SELECT COUNT(*) FROM public.user_machines' INTO owned_machine_count;
    END IF;

    IF owned_machine_count = 0 THEN
      DROP TABLE IF EXISTS public.user_machines CASCADE;
      DROP TABLE IF EXISTS public.machine_types CASCADE;
    ELSE
      RAISE EXCEPTION
        'Your database still uses old UUID machine IDs and already has % user_machines rows. Stop here and migrate those purchases manually before running script 04.',
        owned_machine_count;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.machine_types (
  id integer PRIMARY KEY,
  name text NOT NULL,
  description text,
  price numeric(12, 2) NOT NULL,
  daily_earning_rate numeric(10, 4),
  daily_earnings numeric(12, 2) NOT NULL DEFAULT 0,
  monthly_earnings numeric(12, 2) NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  image_url text,
  image_query text,
  gradient text NOT NULL DEFAULT 'blue-cyan',
  is_active boolean NOT NULL DEFAULT true,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_machines (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  machine_type_id integer NOT NULL REFERENCES public.machine_types(id),
  purchased_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  ads_watched_today integer NOT NULL DEFAULT 0,
  total_ads_watched integer NOT NULL DEFAULT 0,
  last_ad_watched_at timestamptz,
  daily_ad_limit integer NOT NULL DEFAULT 10,
  total_earned numeric(12, 2) NOT NULL DEFAULT 0,
  total_earnings numeric(12, 2) NOT NULL DEFAULT 0,
  activated_at timestamptz,
  last_claim_time timestamptz
);

ALTER TABLE public.user_machines
  ADD COLUMN IF NOT EXISTS purchased_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ads_watched_today integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_ads_watched integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_ad_watched_at timestamptz,
  ADD COLUMN IF NOT EXISTS daily_ad_limit integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS total_earned numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earnings numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_claim_time timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_machines'
      AND column_name = 'purchase_date'
  ) THEN
    UPDATE public.user_machines
    SET purchased_at = COALESCE(purchased_at, purchase_date::timestamptz)
    WHERE purchased_at IS NULL;
  END IF;

  UPDATE public.user_machines
  SET
    purchased_at = COALESCE(purchased_at, now()),
    activated_at = COALESCE(activated_at, purchased_at, now()),
    last_claim_time = COALESCE(last_claim_time, purchased_at, now()),
    updated_at = COALESCE(updated_at, now());
END $$;

ALTER TABLE public.user_machines
  ALTER COLUMN purchased_at SET DEFAULT now(),
  ALTER COLUMN purchased_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_machines_user_id
  ON public.user_machines (user_id);

CREATE INDEX IF NOT EXISTS idx_user_machines_machine_type_id
  ON public.user_machines (machine_type_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_machines_user_machine_unique
  ON public.user_machines (user_id, machine_type_id);

DO $$
DECLARE
  machine_id_type text;
  user_machine_type text;
BEGIN
  SELECT data_type
    INTO machine_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'machine_types'
    AND column_name = 'id';

  IF machine_id_type NOT IN ('integer', 'bigint', 'smallint') THEN
    RAISE EXCEPTION
      'public.machine_types.id is %, but the current CashRise app requires numeric machine IDs 1-8. Use a fresh Supabase project or migrate machine_types/user_machines IDs to integer before running script 04.',
      machine_id_type;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'user_machines'
  ) THEN
    SELECT data_type
      INTO user_machine_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_machines'
      AND column_name = 'machine_type_id';

    IF user_machine_type IS NOT NULL AND user_machine_type NOT IN ('integer', 'bigint', 'smallint') THEN
      RAISE EXCEPTION
        'public.user_machines.machine_type_id is %, but the current CashRise app requires numeric machine IDs 1-8. Use a fresh Supabase project or migrate user_machines.machine_type_id to integer before running script 04.',
        user_machine_type;
    END IF;
  END IF;
END $$;

ALTER TABLE public.machine_types
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS daily_earning_rate numeric(10, 4),
  ADD COLUMN IF NOT EXISTS daily_earnings numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_earnings numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_query text,
  ADD COLUMN IF NOT EXISTS gradient text NOT NULL DEFAULT 'blue-cyan',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;

INSERT INTO public.machine_types (
  id,
  name,
  description,
  price,
  daily_earning_rate,
  daily_earnings,
  monthly_earnings,
  features,
  image_url,
  image_query,
  gradient,
  is_active,
  is_available
)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 'AI Starter Engine', 'Perfect entry-level AI machine for beginners. Features blue holographic displays and smart learning algorithms.', 2500, 0.3600, 900, 27000, '["Smart Learning AI","Blue Holographic Display","Auto-Optimization","24/7 Operation","Beginner Friendly"]'::jsonb, '/placeholder.svg?height=200&width=200', 'blue holographic AI starter engine', 'blue-cyan', true, true),
  (2, 'Smart Gaming Engine', 'Advanced purple-themed gaming AI with enhanced processing power.', 5000, 0.3300, 1650, 49500, '["Purple Smart Interface","Enhanced Processing","Gaming Optimization","Ad Targeting AI","Consistent Earnings"]'::jsonb, '/placeholder.svg?height=200&width=200', 'purple smart gaming AI engine', 'purple-pink', true, true),
  (3, 'Quantum Processor', 'Green quantum-powered AI machine with advanced neural networks.', 10000, 0.3500, 3500, 105000, '["Quantum Processing","Green Energy Core","Neural Networks","Multi-Stream Revenue","Advanced Analytics"]'::jsonb, '/placeholder.svg?height=200&width=200', 'green quantum AI processor', 'green-emerald', true, true),
  (4, 'Neural Maximizer', 'Orange-themed neural AI maximizer with deep learning capabilities.', 15000, 0.3333, 5000, 150000, '["Deep Learning AI","Orange Neural Core","Predictive Algorithms","Engagement Maximizer","Revenue Optimization"]'::jsonb, '/placeholder.svg?height=200&width=200', 'orange neural AI maximizer', 'orange-red', true, true),
  (5, 'Hyper Intelligence', 'Red-powered hyper-intelligent AI system with advanced machine learning.', 25000, 0.3333, 8333, 250000, '["Hyper Intelligence","Red Power Core","Market Analysis","Premium Earnings","Sophisticated AI"]'::jsonb, '/placeholder.svg?height=200&width=200', 'red hyper intelligence AI system', 'orange-red', true, true),
  (6, 'Elite Matrix', 'Golden elite-class AI matrix with supreme processing power.', 50000, 0.3333, 16666, 500000, '["Elite Class AI","Golden Matrix Core","Supreme Processing","Maximum Revenue","Professional Grade"]'::jsonb, '/placeholder.svg?height=200&width=200', 'gold elite AI matrix machine', 'orange-red', true, true),
  (7, 'Omega Core', 'Cosmic silver omega-class AI core with unlimited potential.', 100000, 0.3333, 33333, 1000000, '["Omega Class AI","Cosmic Silver Core","Unlimited Potential","Revolutionary Tech","Coming Soon"]'::jsonb, '/placeholder.svg?height=200&width=200', 'silver cosmic omega AI core', 'blue-cyan', true, true),
  (8, 'Genesis Machine', 'Divine white and gold genesis-class AI machine. The ultimate AI earning system.', 150000, 0.3333, 50000, 1500000, '["Genesis Class AI","Divine Gold Core","Godlike Processing","Ultimate System","Future Technology"]'::jsonb, '/placeholder.svg?height=200&width=200', 'white gold genesis AI machine', 'green-emerald', true, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  daily_earning_rate = EXCLUDED.daily_earning_rate,
  daily_earnings = EXCLUDED.daily_earnings,
  monthly_earnings = EXCLUDED.monthly_earnings,
  features = EXCLUDED.features,
  image_url = EXCLUDED.image_url,
  image_query = EXCLUDED.image_query,
  gradient = EXCLUDED.gradient,
  is_active = EXCLUDED.is_active,
  is_available = EXCLUDED.is_available;

UPDATE public.machine_types
SET
  is_active = COALESCE(is_active, is_available, true),
  is_available = COALESCE(is_available, is_active, true);

DO $$
DECLARE
  sequence_name text;
BEGIN
  SELECT pg_get_serial_sequence('public.machine_types', 'id') INTO sequence_name;
  IF sequence_name IS NOT NULL THEN
    EXECUTE format(
      'SELECT setval(%L, GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.machine_types), 8), true)',
      sequence_name
    );
  END IF;
END $$;

SELECT
  'CashRise script 04 completed successfully' AS status,
  COUNT(*) FILTER (WHERE id BETWEEN 1 AND 8) AS seeded_cashrise_machines
FROM public.machine_types;
