-- QueueLess Step 2 migration. Run AFTER schema.sql. Safe to run more than once.

-- 1. Extra database safety: a token number is never used twice for a doctor on a day
create unique index if not exists uniq_token_per_day
  on appointments (doctor_id, appointment_date, token_number);

-- 2. Queue table (clinics will update it in a later step; empty = demo queue is shown)
create table if not exists queue_state (
  doctor_id uuid not null references doctors(id),
  queue_date date not null,
  current_token integer not null default 0 check (current_token >= 0),
  primary key (doctor_id, queue_date)
);

-- 3. Lock the tables. RLS is ON and there are NO policies on appointments / queue_state,
--    so the browser can never read or change them directly.
alter table appointments enable row level security;
alter table queue_state enable row level security;
revoke all on appointments from anon, authenticated;
revoke all on queue_state from anon, authenticated;
revoke insert, update, delete on doctors from anon, authenticated;
drop policy if exists "public can read active doctors" on doctors;
create policy "public can read active doctors" on doctors
  for select using (is_active = true);

-- 4. Helpers
create or replace function ql_slots() returns text[] language sql immutable as $$
  select array['09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM',
               '04:00 PM','04:30 PM','05:00 PM','05:30 PM'];
$$;
create or replace function ql_today() returns date language sql stable as $$
  select (now() at time zone 'Asia/Kolkata')::date;
$$;

-- 5. Slots for a doctor/date (no patient data is returned)
create or replace function get_slots(p_doctor_id uuid, p_date date)
returns table(time_slot text, available boolean)
language sql stable security definer set search_path = public as $$
  select s,
    not exists (select 1 from appointments a
                where a.doctor_id = p_doctor_id and a.appointment_date = p_date
                  and a.time_slot = s and a.status <> 'Cancelled')
    and (p_date > ql_today()
         or (p_date = ql_today()
             and to_timestamp(s,'HH12:MI AM')::time > (now() at time zone 'Asia/Kolkata')::time))
  from unnest(ql_slots()) with ordinality as t(s, n)
  order by n;
$$;

-- 6. Book an appointment (all validation happens here, on the server)
create or replace function book_appointment(
  p_doctor_id uuid, p_name text, p_phone text, p_date date, p_slot text)
returns table(r_booking_id text, r_token integer)
language plpgsql security definer set search_path = public as $$
declare
  v_name text := trim(coalesce(p_name,''));
  v_phone text := trim(coalesce(p_phone,''));
  v_doc doctors%rowtype;
  v_dow text;
  v_token integer;
  v_id text;
begin
  if length(v_name) < 2 or length(v_name) > 60 then
    raise exception 'Please enter your full name (2 to 60 characters).'; end if;
  if v_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'Please enter a valid 10-digit Indian mobile number.'; end if;
  select * into v_doc from doctors where id = p_doctor_id and is_active;
  if not found then raise exception 'This doctor is not available for booking.'; end if;
  if p_date is null or p_date < ql_today() or p_date > ql_today() + 14 then
    raise exception 'Please choose a date within the next 14 days.'; end if;
  v_dow := (array['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])[extract(dow from p_date)::int + 1];
  if not (v_dow = any(v_doc.available_days)) then
    raise exception '% does not see patients on this day.', v_doc.name; end if;
  if p_slot is null or not (p_slot = any(ql_slots())) then
    raise exception 'Please choose a valid time slot.'; end if;
  if p_date = ql_today()
     and to_timestamp(p_slot,'HH12:MI AM')::time <= (now() at time zone 'Asia/Kolkata')::time then
    raise exception 'That time has already passed. Please choose a later slot.'; end if;
  if (select count(*) from appointments
      where patient_phone = v_phone and status in ('Booked','Waiting')
        and appointment_date >= ql_today()) >= 3 then
    raise exception 'This phone number already has 3 upcoming appointments.'; end if;

  -- one booking at a time per doctor+date, so tokens are assigned safely
  perform pg_advisory_xact_lock(hashtext(p_doctor_id::text || p_date::text));
  if exists (select 1 from appointments where doctor_id = p_doctor_id
             and appointment_date = p_date and time_slot = p_slot and status <> 'Cancelled') then
    raise exception 'Sorry, that time slot was just booked. Please pick another.'; end if;
  select coalesce(max(token_number),0) + 1 into v_token from appointments
    where doctor_id = p_doctor_id and appointment_date = p_date;
  v_id := 'QL-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into appointments (booking_id, patient_name, patient_phone, doctor_id,
                            appointment_date, time_slot, token_number)
  values (v_id, v_name, v_phone, p_doctor_id, p_date, p_slot, v_token);
  return query select v_id, v_token;
exception when unique_violation then
  raise exception 'Sorry, that time slot was just booked. Please pick another.';
end $$;

-- 7. Look up ONE appointment (needs booking ID + the phone used to book)
create or replace function lookup_appointment(p_booking_id text, p_phone text)
returns table(booking_id text, patient_name text, doctor_name text, clinic_name text,
              appointment_date date, time_slot text, token_number integer, status text)
language sql stable security definer set search_path = public as $$
  select a.booking_id, a.patient_name, d.name, d.clinic_name,
         a.appointment_date, a.time_slot, a.token_number, a.status
  from appointments a join doctors d on d.id = a.doctor_id
  where a.booking_id = upper(trim(p_booking_id)) and a.patient_phone = trim(p_phone);
$$;

-- 8. Cancel your own appointment
create or replace function cancel_appointment(p_booking_id text, p_phone text)
returns text language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select status into v_status from appointments
   where booking_id = upper(trim(p_booking_id)) and patient_phone = trim(p_phone) for update;
  if not found then
    raise exception 'No appointment found. Check your booking ID and phone number.'; end if;
  if v_status not in ('Booked','Waiting') then
    raise exception 'This appointment is "%" and can no longer be cancelled.', v_status; end if;
  update appointments set status = 'Cancelled'
   where booking_id = upper(trim(p_booking_id)) and patient_phone = trim(p_phone);
  return 'Cancelled';
end $$;

-- 9. Queue status. Uses queue_state if a clinic has set it; otherwise DEMO data.
create or replace function queue_status(p_booking_id text, p_phone text)
returns table(r_token integer, r_current integer, r_ahead integer, r_wait integer,
              r_status text, r_is_demo boolean, r_doctor text, r_date date, r_slot text)
language plpgsql stable security definer set search_path = public as $$
declare a appointments%rowtype; qs queue_state%rowtype;
        v_current integer; v_demo boolean; v_ahead integer := 0;
begin
  select * into a from appointments
   where booking_id = upper(trim(p_booking_id)) and patient_phone = trim(p_phone);
  if not found then
    raise exception 'No appointment found. Check your booking ID and phone number.'; end if;
  select * into qs from queue_state where doctor_id = a.doctor_id and queue_date = a.appointment_date;
  if found then v_current := qs.current_token; v_demo := false;
  else v_current := greatest(a.token_number - 3, 0); v_demo := true; end if;
  if a.status in ('Booked','Waiting','In Consultation') then
    select count(*) into v_ahead from appointments
     where doctor_id = a.doctor_id and appointment_date = a.appointment_date
       and status not in ('Cancelled','Completed')
       and token_number > v_current and token_number < a.token_number;
  end if;
  return query select a.token_number, v_current, v_ahead, v_ahead * 10, a.status, v_demo,
    (select name from doctors where id = a.doctor_id), a.appointment_date, a.time_slot;
end $$;

-- 10. Only these functions may be called from the browser
revoke all on function ql_slots(), ql_today() from public;
revoke all on function get_slots(uuid,date), book_appointment(uuid,text,text,date,text),
  lookup_appointment(text,text), cancel_appointment(text,text), queue_status(text,text) from public;
grant execute on function get_slots(uuid,date), book_appointment(uuid,text,text,date,text),
  lookup_appointment(text,text), cancel_appointment(text,text), queue_status(text,text)
  to anon, authenticated;
