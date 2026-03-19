-- ΩBuilder Schema

create extension if not exists "uuid-ossp";

-- Users extended profile
create table profiles (
  id uuid references auth.users primary key,
  email text not null,
  full_name text,
  avatar_url text,
  plan text not null default 'free', -- free | pro | team
  builds_used integer not null default 0,
  builds_limit integer not null default 3,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Builds
create table builds (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null,
  prompt text not null,
  product_name text,
  product_type text, -- saas | landing | app | dashboard | marketplace | tool | website
  status text not null default 'generating', -- generating | complete | error
  output text, -- full markdown output from Claude
  sections jsonb, -- parsed sections { interpretation, features, architecture, code_files, ... }
  model text not null default 'claude-sonnet-4-6',
  tokens_used integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table builds enable row level security;
create policy "Users can CRUD own builds" on builds for all using (auth.uid() = user_id);
create index builds_user_id_idx on builds(user_id);
create index builds_created_at_idx on builds(created_at desc);

-- Build likes/saves
create table build_stars (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null,
  build_id uuid references builds(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique(user_id, build_id)
);

alter table build_stars enable row level security;
create policy "Users can manage own stars" on build_stars for all using (auth.uid() = user_id);

-- Trigger: auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Trigger: increment builds_used on new build
create or replace function increment_builds_used()
returns trigger as $$
begin
  if new.status = 'complete' and (old.status is null or old.status != 'complete') then
    update profiles set builds_used = builds_used + 1 where id = new.user_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_build_complete
  after insert or update on builds
  for each row execute function increment_builds_used();

-- Trigger: updated_at
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger profiles_updated_at before update on profiles for each row execute function update_updated_at();
create trigger builds_updated_at before update on builds for each row execute function update_updated_at();
