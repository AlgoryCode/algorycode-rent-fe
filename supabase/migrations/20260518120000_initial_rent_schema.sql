-- Algory Rent Dashboard — initial schema (FE models → Postgres)
-- Run in Supabase SQL Editor or: psql "$POSTGRES_URL_NON_POOLING" -f supabase/migrations/20260518120000_initial_rent_schema.sql

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type rent_app_role as enum ('RENT_USER', 'RENT_MANAGER', 'RENT_ADMIN');
create type rent_vehicle_catalog_kind as enum (
  'body_style', 'fuel_type', 'transmission_type', 'vehicle_status'
);
create type rent_handover_kind as enum ('pickup', 'return');
create type rent_rental_status as enum ('active', 'pending', 'completed', 'cancelled');
create type rent_rental_request_status as enum ('pending', 'approved', 'rejected');
create type rent_discount_type as enum ('PERCENT', 'AMOUNT');
create type rent_payment_status as enum ('completed', 'pending', 'failed', 'refunded');
create type rent_panel_user_role as enum ('admin', 'operator', 'viewer');
create type rent_customer_kind as enum ('individual', 'corporate');
create type rent_commission_flow as enum ('collect', 'pay');
create type rent_vehicle_status_code as enum ('ACTIVE', 'PENDING', 'MAINTENANCE', 'RENTED');

-- ---------------------------------------------------------------------------
-- Profiles (auth.users extension)
-- ---------------------------------------------------------------------------
create table rent_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  rent_roles rent_app_role[] not null default '{RENT_USER}'::rent_app_role[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function rent_profiles_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger rent_profiles_updated_at
  before update on rent_profiles
  for each row execute function rent_profiles_set_updated_at();

create or replace function rent_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into rent_profiles (id, email, full_name, rent_roles)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    '{RENT_USER}'::rent_app_role[]
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function rent_handle_new_user();

-- ---------------------------------------------------------------------------
-- Geography
-- ---------------------------------------------------------------------------
create table rent_countries (
  id bigserial primary key,
  code char(2) not null unique,
  name text not null,
  color_code text not null default '#808080',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rent_cities (
  id bigserial primary key,
  name text not null,
  country_id bigint not null references rent_countries (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index rent_cities_country_id_idx on rent_cities (country_id);

-- ---------------------------------------------------------------------------
-- Vehicle catalog
-- ---------------------------------------------------------------------------
create table rent_vehicle_catalog (
  id bigserial primary key,
  kind rent_vehicle_catalog_kind not null,
  code text not null,
  label_tr text not null,
  sort_order int not null default 0,
  unique (kind, code)
);

create table rent_vehicle_brands (
  id bigserial primary key,
  name text not null,
  sort_order int not null default 0
);

create table rent_vehicle_models (
  id bigserial primary key,
  brand_id bigint not null references rent_vehicle_brands (id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

create index rent_vehicle_models_brand_id_idx on rent_vehicle_models (brand_id);

-- ---------------------------------------------------------------------------
-- Handover & option templates
-- ---------------------------------------------------------------------------
create table rent_handover_locations (
  id bigserial primary key,
  kind rent_handover_kind not null,
  name text not null,
  description text,
  city_id bigint references rent_cities (id) on delete set null,
  line_order int not null default 0,
  active boolean not null default true,
  surcharge_eur numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rent_vehicle_option_templates (
  id bigserial primary key,
  title text not null,
  description text,
  price numeric(12, 2) not null default 0,
  icon text,
  line_order int not null default 0,
  active boolean not null default true
);

create table rent_reservation_extra_option_templates (
  id bigserial primary key,
  code text not null unique,
  title text not null,
  description text,
  price numeric(12, 2) not null default 0,
  icon text,
  line_order int not null default 0,
  active boolean not null default true,
  requires_co_driver_details boolean not null default false
);

-- ---------------------------------------------------------------------------
-- Vehicles
-- ---------------------------------------------------------------------------
create table rent_vehicles (
  id bigserial primary key,
  vehicle_model_id bigint references rent_vehicle_models (id) on delete set null,
  transmission_type_id bigint,
  body_style_id bigint,
  fuel_type_id bigint,
  plate text not null unique,
  brand text not null,
  model text not null,
  year int not null,
  status rent_vehicle_status_code not null default 'ACTIVE',
  status_code text not null default 'ACTIVE',
  external boolean not null default false,
  external_company text,
  rental_daily_price numeric(12, 2),
  commission_enabled boolean not null default false,
  commission_rate_percent numeric(5, 2),
  commission_broker_full_name text,
  commission_broker_phone text,
  country_code char(2),
  city_id bigint references rent_cities (id) on delete set null,
  engine text,
  fuel_type text,
  body_color text,
  seats int,
  luggage int,
  transmission_type text,
  body_style_code text,
  body_style_label text,
  default_pickup_handover_location_id bigint references rent_handover_locations (id) on delete set null,
  default_return_handover_location_id bigint references rent_handover_locations (id) on delete set null,
  highlights text[] not null default '{}',
  images jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rent_vehicle_option_definitions (
  id bigserial primary key,
  vehicle_id bigint not null references rent_vehicles (id) on delete cascade,
  title text not null,
  description text,
  price numeric(12, 2) not null default 0,
  icon text,
  line_order int not null default 0,
  active boolean not null default true
);

create table rent_vehicle_return_handover_locations (
  vehicle_id bigint not null references rent_vehicles (id) on delete cascade,
  handover_location_id bigint not null references rent_handover_locations (id) on delete cascade,
  primary key (vehicle_id, handover_location_id)
);

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
create table rent_customers (
  id bigserial primary key,
  full_name text not null,
  national_id text,
  passport_no text,
  phone text not null,
  email text,
  birth_date date,
  driver_license_no text,
  driver_license_image_url text,
  passport_image_url text,
  kind rent_customer_kind default 'individual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rent_customer_record_states (
  record_key text primary key,
  active boolean not null default true,
  backend_customer_id bigint references rent_customers (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Rentals
-- ---------------------------------------------------------------------------
create table rent_rentals (
  id bigserial primary key,
  vehicle_id bigint not null references rent_vehicles (id) on delete restrict,
  user_id uuid references auth.users (id) on delete set null,
  customer_id bigint not null references rent_customers (id) on delete restrict,
  start_date date not null,
  end_date date not null,
  status rent_rental_status not null default 'pending',
  pickup_handover_location_id bigint references rent_handover_locations (id) on delete set null,
  return_handover_location_id bigint references rent_handover_locations (id) on delete set null,
  discount_amount numeric(12, 2),
  discount_type rent_discount_type,
  net_amount numeric(12, 2),
  commission_amount numeric(12, 2),
  commission_flow rent_commission_flow,
  commission_company text,
  outside_country_travel boolean not null default false,
  green_insurance_fee numeric(12, 2),
  note text,
  feedback jsonb,
  photos jsonb not null default '[]',
  accident_reports jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rent_rental_additional_drivers (
  id bigserial primary key,
  rental_id bigint not null references rent_rentals (id) on delete cascade,
  full_name text not null,
  birth_date date not null,
  driver_license_no text,
  passport_no text,
  driver_license_image_url text,
  passport_image_url text
);

create table rent_rental_option_lines (
  id bigserial primary key,
  rental_id bigint not null references rent_rentals (id) on delete cascade,
  title text not null,
  description text,
  price numeric(12, 2) not null default 0,
  icon text
);

create table rent_rental_vehicle_options (
  rental_id bigint not null references rent_rentals (id) on delete cascade,
  vehicle_option_definition_id bigint not null references rent_vehicle_option_definitions (id) on delete cascade,
  primary key (rental_id, vehicle_option_definition_id)
);

create table rent_rental_reservation_extras (
  rental_id bigint not null references rent_rentals (id) on delete cascade,
  reservation_extra_template_id bigint not null references rent_reservation_extra_option_templates (id) on delete cascade,
  primary key (rental_id, reservation_extra_template_id)
);

-- ---------------------------------------------------------------------------
-- Rental requests (public form)
-- ---------------------------------------------------------------------------
create table rent_rental_requests (
  id bigserial primary key,
  reference_no text not null unique,
  status rent_rental_request_status not null default 'pending',
  status_message text,
  vehicle_id bigint references rent_vehicles (id) on delete set null,
  start_date date not null,
  end_date date not null,
  outside_country_travel boolean not null default false,
  green_insurance_fee numeric(12, 2) not null default 0,
  note text,
  contract_pdf_path text,
  contract_generation_available boolean not null default false,
  whatsapp_contract_sent_at timestamptz,
  whatsapp_contract_error text,
  customer_full_name text not null,
  customer_phone text not null,
  customer_email text not null,
  customer_birth_date date not null,
  customer_national_id text,
  customer_passport_no text not null,
  customer_driver_license_no text not null,
  customer_passport_image_url text,
  customer_driver_license_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rent_rental_request_additional_drivers (
  id bigserial primary key,
  rental_request_id bigint not null references rent_rental_requests (id) on delete cascade,
  full_name text not null,
  birth_date date not null,
  driver_license_no text not null,
  passport_no text not null,
  passport_image_url text,
  driver_license_image_url text
);

-- ---------------------------------------------------------------------------
-- Coupons & payments
-- ---------------------------------------------------------------------------
create table rent_discount_coupons (
  id bigserial primary key,
  code text not null unique,
  discount_type rent_discount_type not null,
  discount_value numeric(12, 2) not null,
  description text,
  active boolean not null default true,
  usage_limit int,
  usage_count int not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rent_payments (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  amount_try numeric(12, 2) not null,
  status rent_payment_status not null default 'pending',
  method text not null default '',
  plate text not null default '',
  vehicle_id bigint references rent_vehicles (id) on delete set null,
  customer_name text not null default '',
  reference text not null default '',
  note text
);

-- Panel users (legacy mock → DB; optional link to auth)
create table rent_panel_users (
  id bigserial primary key,
  auth_user_id uuid references auth.users (id) on delete set null,
  full_name text not null,
  email text not null unique,
  role rent_panel_user_role not null default 'operator',
  last_active_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers: role check
-- ---------------------------------------------------------------------------
create or replace function rent_current_roles()
returns rent_app_role[] language sql stable security definer set search_path = public as $$
  select coalesce(
    (select rent_roles from rent_profiles where id = auth.uid()),
    '{}'::rent_app_role[]
  );
$$;

create or replace function rent_has_manager_role()
returns boolean language sql stable security definer set search_path = public as $$
  select rent_current_roles() && array['RENT_MANAGER', 'RENT_ADMIN']::rent_app_role[];
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table rent_profiles enable row level security;
alter table rent_countries enable row level security;
alter table rent_cities enable row level security;
alter table rent_vehicle_catalog enable row level security;
alter table rent_vehicle_brands enable row level security;
alter table rent_vehicle_models enable row level security;
alter table rent_handover_locations enable row level security;
alter table rent_vehicle_option_templates enable row level security;
alter table rent_reservation_extra_option_templates enable row level security;
alter table rent_vehicles enable row level security;
alter table rent_vehicle_option_definitions enable row level security;
alter table rent_vehicle_return_handover_locations enable row level security;
alter table rent_customers enable row level security;
alter table rent_customer_record_states enable row level security;
alter table rent_rentals enable row level security;
alter table rent_rental_additional_drivers enable row level security;
alter table rent_rental_option_lines enable row level security;
alter table rent_rental_vehicle_options enable row level security;
alter table rent_rental_reservation_extras enable row level security;
alter table rent_rental_requests enable row level security;
alter table rent_rental_request_additional_drivers enable row level security;
alter table rent_discount_coupons enable row level security;
alter table rent_payments enable row level security;
alter table rent_panel_users enable row level security;

-- Authenticated panel users: read/write (refine per role in app layer)
create policy rent_profiles_self on rent_profiles
  for select using (auth.uid() = id);
create policy rent_profiles_self_update on rent_profiles
  for update using (auth.uid() = id);

do $policy$
declare
  t text;
begin
  foreach t in array array[
    'rent_countries', 'rent_cities', 'rent_vehicle_catalog', 'rent_vehicle_brands',
    'rent_vehicle_models', 'rent_handover_locations', 'rent_vehicle_option_templates',
    'rent_reservation_extra_option_templates', 'rent_vehicles', 'rent_vehicle_option_definitions',
    'rent_vehicle_return_handover_locations', 'rent_customers', 'rent_customer_record_states',
    'rent_rentals', 'rent_rental_additional_drivers', 'rent_rental_option_lines',
    'rent_rental_vehicle_options', 'rent_rental_reservation_extras', 'rent_discount_coupons',
    'rent_payments', 'rent_panel_users'
  ]
  -- rent_rental_requests*: ayrı public insert/select politikaları
  loop
    execute format(
      'create policy %I_auth_select on %I for select to authenticated using (true)',
      t, t
    );
    execute format(
      'create policy %I_auth_write on %I for all to authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end;
$policy$;

-- Public can insert rental requests (form)
create policy rent_rental_requests_public_insert on rent_rental_requests
  for insert to anon, authenticated with check (true);
create policy rent_rental_requests_public_select on rent_rental_requests
  for select to anon, authenticated using (true);
create policy rent_rental_request_drivers_public on rent_rental_request_additional_drivers
  for all to anon, authenticated using (true) with check (true);

-- Storage bucket hint (create in dashboard): vehicle-images, customer-docs
