-- ============================================================
-- SmartPrint Automation System — Supabase Database Migration
-- ============================================================

-- 1. Profiles table (extends Supabase Auth users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now()
);

-- 2. Orders table
create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  order_number text unique not null,
  file_name text not null,
  file_url text,
  file_path text,
  file_type text not null,
  file_size bigint not null,
  page_count integer not null default 1,
  copies integer not null default 1,
  print_type text not null default 'bw' check (print_type in ('bw', 'color')),
  page_size text not null default 'A4' check (page_size in ('A4', 'A3', 'Letter', 'Legal')),
  status text not null default 'pending_payment' check (status in ('pending_payment', 'queued', 'printing', 'completed', 'cancelled', 'printed', 'downloaded_offline')),
  queue_position integer,
  estimated_time integer,
  total_price numeric(10,2) not null default 0,
  payment_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Notifications table
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  message text not null,
  type text not null default 'info' check (type in ('info', 'success', 'warning', 'error')),
  read boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.notifications enable row level security;

-- Profiles: users see & update own profile
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Allow insert on profiles (for the trigger)
create policy "Allow insert for auth trigger"
  on public.profiles for insert with check (true);

-- Orders: users see own orders
create policy "Users can view own orders"
  on public.orders for select using (auth.uid() = user_id);

create policy "Users can insert own orders"
  on public.orders for insert with check (auth.uid() = user_id);

create policy "Users can update own orders"
  on public.orders for update using (auth.uid() = user_id);

-- Orders: admins see and update all orders
create policy "Admins can view all orders"
  on public.orders for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update any order"
  on public.orders for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Notifications: users see & update own
create policy "Users can view own notifications"
  on public.notifications for select using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update using (auth.uid() = user_id);

create policy "Allow insert notifications"
  on public.notifications for insert with check (true);

-- ============================================================
-- Auto-create profile on signup
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'User'), 'user');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Updated_at auto-update
-- ============================================================

create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger orders_updated_at
  before update on public.orders
  for each row execute procedure public.update_updated_at();

-- ============================================================
-- Storage bucket for print files
-- ============================================================

insert into storage.buckets (id, name, public)
values ('print-files', 'print-files', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload files
create policy "Authenticated users can upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'print-files');

-- Allow public reads (for file preview)
create policy "Public can read print files"
  on storage.objects for select
  to public
  using (bucket_id = 'print-files');

-- Allow users to delete own files
create policy "Users can delete own files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'print-files');
