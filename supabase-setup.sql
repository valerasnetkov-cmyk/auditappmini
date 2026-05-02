-- ============================================
-- SUPABASE SETUP: Audit Mini MVP
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. USERS (extends auth.users)
create table if not exists users (
    id uuid primary key references auth.users(id) on delete cascade,
    name text not null,
    role text not null check (role in ('inspector', 'manager')),
    created_at timestamp with time zone default now()
);

-- 2. VEHICLES
create table if not exists vehicles (
    id uuid primary key default gen_random_uuid(),
    number text not null,
    name text not null,
    status text not null default 'active' check (status in ('active', 'repair')),
    qr_code text unique,
    created_at timestamp with time zone default now()
);

-- 3. INSPECTIONS
create table if not exists inspections (
    id uuid primary key default gen_random_uuid(),
    vehicle_id uuid not null references vehicles(id) on delete cascade,
    inspector_id uuid not null references users(id),
    type text not null check (type in ('quick', 'full')),
    completed boolean not null default false,
    created_at timestamp with time zone default now()
);

-- 4. CHECKLIST ITEMS
create table if not exists checklist_items (
    id uuid primary key default gen_random_uuid(),
    inspection_id uuid not null references inspections(id) on delete cascade,
    title text not null,
    result boolean,
    comment text
);

-- 5. DEFECTS
create table if not exists defects (
    id uuid primary key default gen_random_uuid(),
    inspection_id uuid not null references inspections(id) on delete cascade,
    title text not null,
    comment text,
    created_at timestamp with time zone default now()
);

-- 6. PHOTOS
create table if not exists photos (
    id uuid primary key default gen_random_uuid(),
    inspection_id uuid not null references inspections(id) on delete cascade,
    defect_id uuid references defects(id) on delete set null,
    url text not null,
    geo text,
    is_required boolean not null default false,
    created_at timestamp with time zone default now()
);

-- ============================================
-- INDEXES
-- ============================================
create index if not exists idx_inspections_vehicle_id on inspections(vehicle_id);
create index if not exists idx_inspections_inspector_id on inspections(inspector_id);
create index if not exists idx_checklist_items_inspection_id on checklist_items(inspection_id);
create index if not exists idx_defects_inspection_id on defects(inspection_id);
create index if not exists idx_photos_inspection_id on photos(inspection_id);
create index if not exists idx_photos_defect_id on photos(defect_id);
create index if not exists idx_vehicles_status on vehicles(status);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table users enable row level security;
alter table vehicles enable row level security;
alter table inspections enable row level security;
alter table checklist_items enable row level security;
alter table defects enable row level security;
alter table photos enable row level security;

-- Users
create policy "users_read_authenticated"
    on users for select using (auth.role() = 'authenticated');

create policy "users_insert_own"
    on users for insert with check (auth.uid() = id);

-- Vehicles
create policy "vehicles_all_authenticated"
    on vehicles for all
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');

-- Inspections
create policy "inspections_select_authenticated"
    on inspections for select using (auth.role() = 'authenticated');

create policy "inspections_insert_authenticated"
    on inspections for insert with check (auth.role() = 'authenticated');

create policy "inspections_update_authenticated"
    on inspections for update using (auth.role() = 'authenticated');

-- Checklist items
create policy "checklist_items_select_authenticated"
    on checklist_items for select using (auth.role() = 'authenticated');

create policy "checklist_items_insert_authenticated"
    on checklist_items for insert with check (auth.role() = 'authenticated');

-- Defects
create policy "defects_select_authenticated"
    on defects for select using (auth.role() = 'authenticated');

create policy "defects_insert_authenticated"
    on defects for insert with check (auth.role() = 'authenticated');

-- Photos
create policy "photos_select_authenticated"
    on photos for select using (auth.role() = 'authenticated');

create policy "photos_insert_authenticated"
    on photos for insert with check (auth.role() = 'authenticated');

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.users (id, name, role)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
        coalesce(new.raw_user_meta_data->>'role', 'inspector')
    );
    return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

-- Auto-create defects from checklist items with result = false
create or replace function public.create_defect_from_checklist()
returns trigger as $$
begin
    if new.result = false then
        insert into public.defects (inspection_id, title, comment)
        values (new.inspection_id, new.title, new.comment);
    end if;
    return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_checklist_item_inserted
    after insert on public.checklist_items
    for each row execute procedure public.create_defect_from_checklist();
