-- QueueLess schema (Step 1). Run in Supabase > SQL Editor.
create table if not exists doctors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialization text not null,
  clinic_name text not null,
  consultation_fee integer not null check (consultation_fee >= 0),
  available_days text[] not null default '{}',
  is_active boolean not null default true
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  booking_id text not null unique,
  patient_name text not null,
  patient_phone text not null check (patient_phone ~ '^[0-9]{10}$'),
  doctor_id uuid not null references doctors(id),
  appointment_date date not null,
  time_slot text not null,
  token_number integer not null,
  status text not null default 'Booked'
    check (status in ('Booked','Waiting','In Consultation','Completed','Cancelled')),
  created_at timestamptz not null default now()
);

-- No two ACTIVE bookings for the same doctor, date and slot
create unique index if not exists uniq_active_slot
  on appointments (doctor_id, appointment_date, time_slot)
  where status <> 'Cancelled';
create index if not exists idx_appt_doctor_date on appointments (doctor_id, appointment_date);
create index if not exists idx_appt_phone on appointments (patient_phone);

-- Row Level Security
alter table doctors enable row level security;
alter table appointments enable row level security;

-- Anyone may read ACTIVE doctors. Nobody can write from the browser.
create policy "public can read active doctors" on doctors
  for select using (is_active = true);
-- appointments: no policies yet = browser has no access.
-- Step 2 adds safe functions for booking and lookup.

-- DEMO doctors (fictional)
insert into doctors (name, specialization, clinic_name, consultation_fee, available_days) values
 ('Dr. Aarav Mehta','General Physician','Demo Care Clinic',300,'{Mon,Tue,Wed,Thu,Fri}'),
 ('Dr. Nisha Shah','Pediatrician','Demo Little Steps Clinic',400,'{Mon,Wed,Fri}'),
 ('Dr. Rohan Desai','Dermatologist','Demo SkinFirst Clinic',500,'{Tue,Thu,Sat}'),
 ('Dr. Kavya Iyer','Cardiologist','Demo Heart Centre',800,'{Mon,Thu}'),
 ('Dr. Imran Qureshi','Orthopedic','Demo Bone & Joint Clinic',600,'{Tue,Wed,Sat}'),
 ('Dr. Sneha Patel','Dentist','Demo Smile Dental',350,'{Mon,Tue,Thu,Fri,Sat}');
