-- Algory Rent — örnek veri + panel giriş kullanıcıları
-- Çalıştırma: npm run db:seed
--
-- Giriş (Supabase Auth):
--   admin@algoryrent.test  /  AlgoryRent2026!
--   operator@algoryrent.test /  AlgoryRent2026!

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Auth kullanıcıları
-- ---------------------------------------------------------------------------
do $$
declare
  admin_id uuid := 'a1000001-0001-4001-8001-000000000001';
  operator_id uuid := 'a1000001-0001-4001-8001-000000000002';
  instance uuid := '00000000-0000-0000-0000-000000000000';
  pwd text := crypt('AlgoryRent2026!', gen_salt('bf'));
begin
  if not exists (select 1 from auth.users where email = 'admin@algoryrent.test') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token, is_super_admin
    ) values (
      instance, admin_id, 'authenticated', 'authenticated',
      'admin@algoryrent.test', pwd, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Rent Admin"}'::jsonb,
      now(), now(), '', '', '', '', false
    );
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), admin_id,
      jsonb_build_object('sub', admin_id::text, 'email', 'admin@algoryrent.test'),
      'email', admin_id::text, now(), now(), now()
    );
  end if;

  if not exists (select 1 from auth.users where email = 'operator@algoryrent.test') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token, is_super_admin
    ) values (
      instance, operator_id, 'authenticated', 'authenticated',
      'operator@algoryrent.test', pwd, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Rent Operator"}'::jsonb,
      now(), now(), '', '', '', '', false
    );
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), operator_id,
      jsonb_build_object('sub', operator_id::text, 'email', 'operator@algoryrent.test'),
      'email', operator_id::text, now(), now(), now()
    );
  end if;
end $$;

update rent_profiles
set rent_roles = '{RENT_ADMIN}'::rent_app_role[], full_name = 'Rent Admin'
where email = 'admin@algoryrent.test';

update rent_profiles
set rent_roles = '{RENT_MANAGER}'::rent_app_role[], full_name = 'Rent Operator'
where email = 'operator@algoryrent.test';

-- ---------------------------------------------------------------------------
-- Coğrafya
-- ---------------------------------------------------------------------------
insert into rent_countries (id, code, name, color_code) values
  (1, 'TR', 'Türkiye', '#E30A17'),
  (2, 'AL', 'Arnavutluk', '#E41E20')
on conflict (code) do update set name = excluded.name, color_code = excluded.color_code;

select setval(pg_get_serial_sequence('rent_countries', 'id'), (select coalesce(max(id), 1) from rent_countries));

insert into rent_cities (id, name, country_id) values
  (1, 'İstanbul', 1),
  (2, 'Ankara', 1),
  (3, 'İzmir', 1),
  (4, 'Tiran', 2)
on conflict do nothing;

select setval(pg_get_serial_sequence('rent_cities', 'id'), (select coalesce(max(id), 1) from rent_cities));

-- ---------------------------------------------------------------------------
-- Araç kataloğu
-- ---------------------------------------------------------------------------
insert into rent_vehicle_catalog (kind, code, label_tr, sort_order) values
  ('body_style', 'SEDAN', 'Sedan', 1),
  ('body_style', 'SUV', 'SUV', 2),
  ('body_style', 'HATCHBACK', 'Hatchback', 3),
  ('fuel_type', 'GASOLINE', 'Benzin', 1),
  ('fuel_type', 'DIESEL', 'Dizel', 2),
  ('fuel_type', 'HYBRID', 'Hibrit', 3),
  ('transmission_type', 'MANUAL', 'Manuel', 1),
  ('transmission_type', 'AUTOMATIC', 'Otomatik', 2),
  ('vehicle_status', 'ACTIVE', 'Aktif', 1),
  ('vehicle_status', 'MAINTENANCE', 'Bakımda', 2),
  ('vehicle_status', 'RENTED', 'Kirada', 3)
on conflict (kind, code) do update set label_tr = excluded.label_tr, sort_order = excluded.sort_order;

insert into rent_vehicle_brands (id, name, sort_order) values
  (1, 'Toyota', 1),
  (2, 'Volkswagen', 2),
  (3, 'Renault', 3),
  (4, 'Hyundai', 4)
on conflict do nothing;

select setval(pg_get_serial_sequence('rent_vehicle_brands', 'id'), (select coalesce(max(id), 1) from rent_vehicle_brands));

insert into rent_vehicle_models (id, brand_id, name, sort_order) values
  (1, 1, 'Corolla', 1),
  (2, 2, 'Passat', 1),
  (3, 3, 'Clio', 1),
  (4, 4, 'i20', 1),
  (5, 1, 'Yaris', 2)
on conflict do nothing;

select setval(pg_get_serial_sequence('rent_vehicle_models', 'id'), (select coalesce(max(id), 1) from rent_vehicle_models));

-- ---------------------------------------------------------------------------
-- Teslim / iade noktaları
-- ---------------------------------------------------------------------------
insert into rent_handover_locations (id, kind, name, description, city_id, line_order, active, surcharge_eur) values
  (1, 'pickup', 'İstanbul Havalimanı (IST)', 'Terminal çıkışı', 1, 1, true, 25),
  (2, 'pickup', 'Sabiha Gökçen (SAW)', 'Terminal çıkışı', 1, 2, true, 20),
  (3, 'pickup', 'Ankara Esenboğa', 'Gelen yolcu', 2, 1, true, 15),
  (10, 'return', 'İstanbul Havalimanı (IST)', 'Terminal iade', 1, 1, true, 0),
  (11, 'return', 'Sabiha Gökçen (SAW)', 'Terminal iade', 1, 2, true, 0),
  (12, 'return', 'Ankara Esenboğa', 'Ofis iade', 2, 1, true, 0)
on conflict do nothing;

select setval(pg_get_serial_sequence('rent_handover_locations', 'id'), (select coalesce(max(id), 1) from rent_handover_locations));

-- ---------------------------------------------------------------------------
-- Opsiyon şablonları
-- ---------------------------------------------------------------------------
insert into rent_vehicle_option_templates (id, title, description, price, icon, line_order, active) values
  (1, 'Navigasyon', 'GPS cihazı', 8, 'map', 1, true),
  (2, 'Bebek koltuğu', '0-13 kg', 12, 'baby', 2, true),
  (3, 'Ek sürücü', 'İkinci sürücü', 15, 'user', 3, true)
on conflict do nothing;

select setval(pg_get_serial_sequence('rent_vehicle_option_templates', 'id'), (select coalesce(max(id), 1) from rent_vehicle_option_templates));

insert into rent_reservation_extra_option_templates (id, code, title, description, price, line_order, active, requires_co_driver_details) values
  (1, 'GREEN_INS', 'Yeşil sigorta', 'Kapsamlı mini hasar paketi', 45, 1, true, false),
  (2, 'CO_DRIVER', 'Ortak sürücü', 'Ek sürücü detayları gerekir', 20, 2, true, true)
on conflict (code) do update set title = excluded.title, price = excluded.price;

select setval(pg_get_serial_sequence('rent_reservation_extra_option_templates', 'id'), (select coalesce(max(id), 1) from rent_reservation_extra_option_templates));

-- ---------------------------------------------------------------------------
-- Araçlar
-- ---------------------------------------------------------------------------
insert into rent_vehicles (
  id, vehicle_model_id, plate, brand, model, year, status, status_code,
  external, rental_daily_price, country_code, city_id,
  default_pickup_handover_location_id, default_return_handover_location_id,
  engine, fuel_type, body_color, seats, luggage, transmission_type,
  body_style_code, highlights, images
) values
  (
    1, 1, '34 ABC 101', 'Toyota', 'Corolla', 2023, 'ACTIVE', 'ACTIVE',
    false, 55, 'TR', 1, 1, 10,
    '1.6', 'Benzin', 'Beyaz', 5, 2, 'Otomatik', 'SEDAN',
    array['Bluetooth', 'Klima', 'Cruise control'],
    '{"front":"https://images.unsplash.com/photo-1623869675783-5f8d4ae4c7b8?w=800"}'::jsonb
  ),
  (
    2, 2, '06 XYZ 202', 'Volkswagen', 'Passat', 2022, 'RENTED', 'RENTED',
    false, 75, 'TR', 2, 3, 12,
    '1.5 TSI', 'Benzin', 'Gri', 5, 3, 'Otomatik', 'SEDAN',
    array['Deri koltuk', 'Sunroof'],
    '{}'::jsonb
  ),
  (
    3, 3, '35 DEF 303', 'Renault', 'Clio', 2024, 'ACTIVE', 'ACTIVE',
    false, 42, 'TR', 3, 2, 11,
    '1.0 TCe', 'Benzin', 'Kırmızı', 5, 2, 'Manuel', 'HATCHBACK',
    array['Şehir içi ekonomik'],
    '{}'::jsonb
  ),
  (
    4, 4, '16 GHI 404', 'Hyundai', 'i20', 2021, 'MAINTENANCE', 'MAINTENANCE',
    false, 38, 'TR', 1, 1, 10,
    '1.2', 'Benzin', 'Mavi', 5, 2, 'Manuel', 'HATCHBACK',
    array[]::text[],
    '{}'::jsonb
  ),
  (
    5, 5, '34 JKL 505', 'Toyota', 'Yaris', 2023, 'ACTIVE', 'ACTIVE',
    true, 48, 'TR', 1, 1, 10,
    '1.5 Hybrid', 'Hibrit', 'Siyah', 5, 2, 'Otomatik', 'HATCHBACK',
    array['Hibrit', 'Düşük yakıt'],
    '{}'::jsonb
  )
on conflict (plate) do update set
  rental_daily_price = excluded.rental_daily_price,
  status = excluded.status,
  status_code = excluded.status_code;

select setval(pg_get_serial_sequence('rent_vehicles', 'id'), (select coalesce(max(id), 1) from rent_vehicles));

insert into rent_vehicle_option_definitions (vehicle_id, title, description, price, icon, line_order, active) values
  (1, 'Navigasyon', 'GPS', 8, 'map', 1, true),
  (1, 'Bebek koltuğu', null, 12, 'baby', 2, true),
  (2, 'Navigasyon', 'GPS', 8, 'map', 1, true)
on conflict do nothing;

insert into rent_vehicle_return_handover_locations (vehicle_id, handover_location_id) values
  (1, 10), (1, 11),
  (2, 12),
  (3, 10), (3, 11)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Müşteriler
-- ---------------------------------------------------------------------------
insert into rent_customers (
  id, full_name, national_id, passport_no, phone, email, birth_date,
  driver_license_no, kind
) values
  (1, 'Ayşe Yılmaz', '12345678901', 'U12345678', '+905321112233', 'ayse@example.com', '1990-05-12', 'TR-AY12345', 'individual'),
  (2, 'Mehmet Demir', '98765432109', 'U87654321', '+905339998877', 'mehmet@example.com', '1985-11-03', 'TR-MD98765', 'individual'),
  (3, 'Algory Filo A.Ş.', null, null, '+902121234567', 'filo@algorycode.com', null, null, 'corporate')
on conflict do nothing;

select setval(pg_get_serial_sequence('rent_customers', 'id'), (select coalesce(max(id), 1) from rent_customers));

-- ---------------------------------------------------------------------------
-- Kiralamalar
-- ---------------------------------------------------------------------------
insert into rent_rentals (
  id, vehicle_id, customer_id, start_date, end_date, status,
  pickup_handover_location_id, return_handover_location_id,
  outside_country_travel, net_amount, note
) values
  (
    1, 2, 1, current_date - 2, current_date + 5, 'active',
    3, 12, false, 525, 'Havalimanı teslim'
  ),
  (
    2, 1, 2, current_date + 7, current_date + 14, 'pending',
    1, 10, false, 385, null
  ),
  (
    3, 3, 1, current_date - 30, current_date - 23, 'completed',
    2, 11, false, 294, 'Erken iade yok'
  )
on conflict do nothing;

select setval(pg_get_serial_sequence('rent_rentals', 'id'), (select coalesce(max(id), 1) from rent_rentals));

insert into rent_rental_option_lines (rental_id, title, price, icon) values
  (1, 'Navigasyon', 8, 'map'),
  (1, 'Bebek koltuğu', 12, 'baby')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Kiralama talepleri
-- ---------------------------------------------------------------------------
insert into rent_rental_requests (
  id, reference_no, status, vehicle_id, start_date, end_date,
  outside_country_travel, green_insurance_fee, note,
  customer_full_name, customer_phone, customer_email, customer_birth_date,
  customer_national_id, customer_passport_no, customer_driver_license_no
) values
  (
    1, 'REQ-SEED-001', 'pending', 1,
    current_date + 3, current_date + 10,
    false, 45, 'Web formu test',
    'Zeynep Kaya', '+905551234567', 'zeynep@example.com', '1992-08-20',
    '11122233344', 'P99887766', 'TR-ZK55443'
  ),
  (
    2, 'REQ-SEED-002', 'approved', 3,
    current_date + 1, current_date + 4,
    true, 45, 'Yurt dışı seyahat',
    'Can Öztürk', '+905557654321', 'can@example.com', '1988-01-15',
    null, 'P11223344', 'TR-CO11223'
  )
on conflict (reference_no) do nothing;

select setval(pg_get_serial_sequence('rent_rental_requests', 'id'), (select coalesce(max(id), 1) from rent_rental_requests));

-- ---------------------------------------------------------------------------
-- Kuponlar & ödemeler
-- ---------------------------------------------------------------------------
insert into rent_discount_coupons (id, code, discount_type, discount_value, description, active, usage_limit, usage_count) values
  (1, 'ILK10', 'PERCENT', 10, 'İlk kiralama %10', true, 100, 3),
  (2, 'YAZ50', 'AMOUNT', 50, 'Yaz kampanyası 50 EUR', true, 50, 0)
on conflict (code) do update set discount_value = excluded.discount_value;

select setval(pg_get_serial_sequence('rent_discount_coupons', 'id'), (select coalesce(max(id), 1) from rent_discount_coupons));

insert into rent_payments (id, amount_try, status, method, plate, vehicle_id, customer_name, reference, note) values
  (1, 18500, 'completed', 'Kredi kartı', '06 XYZ 202', 2, 'Ayşe Yılmaz', 'PAY-SEED-001', 'Kapora'),
  (2, 9200, 'pending', 'Havale', '34 ABC 101', 1, 'Mehmet Demir', 'PAY-SEED-002', null)
on conflict do nothing;

select setval(pg_get_serial_sequence('rent_payments', 'id'), (select coalesce(max(id), 1) from rent_payments));

insert into rent_panel_users (id, full_name, email, role, active, last_active_at) values
  (1, 'Rent Admin', 'admin@algoryrent.test', 'admin', true, now()),
  (2, 'Rent Operator', 'operator@algoryrent.test', 'operator', true, now() - interval '1 day')
on conflict (email) do update set role = excluded.role, active = excluded.active;

select setval(pg_get_serial_sequence('rent_panel_users', 'id'), (select coalesce(max(id), 1) from rent_panel_users));

insert into rent_customer_record_states (record_key, active, backend_customer_id) values
  ('seed:ayse-yilmaz', true, 1),
  ('seed:mehmet-demir', true, 2)
on conflict (record_key) do update set active = excluded.active, backend_customer_id = excluded.backend_customer_id;
