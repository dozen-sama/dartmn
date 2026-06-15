-- notifications.type нь app-defined string. Хатуу CHECK хязгаар нь шинэ төрлүүдийг
-- (room_invite, room_invite_accepted, match_confirm/confirmed/rejected,
-- club_join_request/approved/rejected г.м.) чимээгүй татгалзаж, мэдэгдэл
-- огт үүсэхгүй байх далд алдаа үүсгэж байв. Хязгаарыг хасав.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
