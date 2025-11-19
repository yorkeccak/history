-- History Research Database Schema
-- This script is idempotent - safe to run multiple times
-- It will create tables if they don't exist and add missing columns

-- Users table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  avatar_url text,
  subscription_tier text DEFAULT 'free'::text
    CHECK (subscription_tier = ANY (ARRAY['free'::text, 'pay_per_use'::text, 'subscription'::text])),
  polar_customer_id text UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  subscription_id text,
  subscription_status text DEFAULT 'inactive'::text,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- Research tasks (stores minimal metadata, full data fetched from DeepResearch API)
CREATE TABLE IF NOT EXISTS public.research_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  deepresearch_id text NOT NULL UNIQUE,
  location_name text NOT NULL,
  location_lat double precision NOT NULL,
  location_lng double precision NOT NULL,
  status text NOT NULL DEFAULT 'queued'::text
    CHECK (status = ANY (ARRAY['queued'::text, 'running'::text, 'completed'::text, 'failed'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  anonymous_id text,
  is_public boolean DEFAULT false,
  share_token text UNIQUE,
  shared_at timestamp with time zone,
  CONSTRAINT research_tasks_pkey PRIMARY KEY (id),
  CONSTRAINT research_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Add location_images column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'research_tasks'
    AND column_name = 'location_images'
  ) THEN
    ALTER TABLE public.research_tasks ADD COLUMN location_images jsonb;
  END IF;
END $$;

-- Rate limits
CREATE TABLE IF NOT EXISTS public.user_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  usage_count integer NOT NULL DEFAULT 0,
  reset_date text NOT NULL,
  monthly_usage_count integer NOT NULL DEFAULT 0,
  monthly_reset_date text NOT NULL DEFAULT '',
  last_request_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_rate_limits_pkey PRIMARY KEY (id),
  CONSTRAINT user_rate_limits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Add monthly tracking columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_rate_limits'
    AND column_name = 'monthly_usage_count'
  ) THEN
    ALTER TABLE public.user_rate_limits ADD COLUMN monthly_usage_count integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_rate_limits'
    AND column_name = 'monthly_reset_date'
  ) THEN
    ALTER TABLE public.user_rate_limits ADD COLUMN monthly_reset_date text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_research_tasks_user_id ON public.research_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_research_tasks_created_at ON public.research_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_tasks_deepresearch_id ON public.research_tasks(deepresearch_id);
CREATE INDEX IF NOT EXISTS idx_research_tasks_status ON public.research_tasks(status);
CREATE INDEX IF NOT EXISTS idx_research_tasks_share_token ON public.research_tasks(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_research_tasks_is_public ON public.research_tasks(is_public) WHERE is_public = true;

-- Function to generate unique share token
CREATE OR REPLACE FUNCTION generate_share_token() RETURNS text AS $$
DECLARE
  token text;
  exists boolean;
BEGIN
  LOOP
    -- Generate random 12 character alphanumeric token
    token := substring(md5(random()::text || clock_timestamp()::text) from 1 for 12);

    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM public.research_tasks WHERE share_token = token) INTO exists;

    IF NOT exists THEN
      RETURN token;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
