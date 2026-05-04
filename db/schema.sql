create table if not exists profiles (
  user_id text primary key,
  email text,
  nickname text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists vanishoot_saves (
  user_id text primary key references profiles(user_id) on delete cascade,
  gold integer not null default 0,
  upgrades jsonb not null default '{}'::jsonb,
  best_score integer not null default 0,
  best_wave integer not null default 1,
  total_runs integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
