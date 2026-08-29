-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260615150457
-- Original name: drop_notifications_type_check

-- notifications.type нь app-defined string. Хатуу CHECK хязгаар нь шинэ
-- төрлүүдийг (room_invite, match_confirm, club_approved г.м.) чимээгүй татгалзаж
-- мэдэгдэл үүсэхгүй байх далд алдаа үүсгэж байсан тул хасав.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
