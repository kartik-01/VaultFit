-- Create remote_activities table for encrypted client snapshots
-- Columns: id (text PK), user_id (uuid), type (text), data (text), timestamp (bigint)

create table if not exists public.remote_activities (
  id text primary key,
  user_id uuid references auth.users(id) not null,
  type text not null,
  data text not null,
  timestamp bigint not null,
  inserted_at timestamptz default now()
);

-- Enable row level security and add policies so that only the owner can insert/update their rows
alter table public.remote_activities enable row level security;

-- Allow authenticated users to insert rows where user_id = auth.uid()
create policy "allow_insert_owner" on public.remote_activities
  for insert with check (auth.role() = 'authenticated' AND user_id = auth.uid());

-- Allow authenticated users to update their own rows
create policy "allow_update_owner" on public.remote_activities
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Allow authenticated users to delete their own rows
create policy "allow_delete_owner" on public.remote_activities
  for delete using (user_id = auth.uid());

-- Optionally, allow authenticated users to select their rows
create policy "allow_select_owner" on public.remote_activities
  for select using (user_id = auth.uid());

-- Index to speed up queries per user
create index if not exists idx_remote_activities_user_ts on public.remote_activities (user_id, timestamp desc);
