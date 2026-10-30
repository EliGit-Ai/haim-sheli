-- טלפונים שנרשמו להתראות של האפליקציה.
-- רק מה שצריך כדי לדעת איזה יום לשלוח ומתי. בלי מייל, בלי שם ובלי תשובות.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  start_date date not null,
  tz text not null default 'Asia/Jerusalem',
  shabbat boolean not null default false,
  no_relationship boolean not null default false,
  no_kids boolean not null default false,
  full_access boolean not null default false,
  morning_hour smallint check (morning_hour between 0 and 23),
  midday_hour smallint check (midday_hour between 0 and 23),
  evening_hour smallint check (evening_hour between 0 and 23),
  last_morning date,
  last_midday date,
  last_evening date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- סגור לגמרי מבחוץ: אין מדיניות, ולכן רק מפתח השרת (service role) ניגש לטבלה
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
