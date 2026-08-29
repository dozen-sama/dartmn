-- LEGACY / HISTORICAL REFERENCE ONLY
-- DO NOT APPLY
-- This change is already represented in the recovered migration history
-- (supabase/migration-archive/20260615150457_drop_notifications_type_check.sql)
-- and the active baseline (supabase/migrations/20260829120000_baseline.sql),
-- which does not recreate the notifications_type_check constraint.
--
-- This file was a locally hand-edited copy of that migration (comment text
-- diverged slightly from the applied version) kept loose at supabase/ root;
-- moved here during Baseline Recovery follow-up cleanup (2026-08-29).

-- notifications.type нь app-defined string. Хатуу CHECK хязгаар нь шинэ төрлүүдийг
-- (room_invite, room_invite_accepted, match_confirm/confirmed/rejected,
-- club_join_request/approved/rejected г.м.) чимээгүй татгалзаж, мэдэгдэл
-- огт үүсэхгүй байх далд алдаа үүсгэж байв. Хязгаарыг хасав.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
