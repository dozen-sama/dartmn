# DartMN Security Hotfix — Phase A Report

**Огноо:** 2026-08-29
**Live project:** `mongol-darts` (ref: `idomtybdmqhsxbuttubk`)
**Горим:** RPC/storage security hotfix. BYL, baseline migration, бусад task-д ОГТ хамааралгүй.

---

## 1. Original vulnerabilities

Эх сурвалж: `DARTMN_SUPABASE_SCHEMA_AUDIT.md` §5, §12, §18.

| # | Vulnerability | Severity |
|---|---|---|
| 1 | `apply_match_result` — SECURITY DEFINER, `anon`/`authenticated`/`PUBLIC` EXECUTE, дурын profile UUID-ийн rating/stat/history-г ownership шалгалтгүй дахин бичих боломжтой | CRITICAL |
| 2 | `advance_tournament_match` — мөн адил, дурын match_id-г completed болгож winner санамсаргүй тохируулах боломжтой | CRITICAL |
| 3 | `start_tournament` — organizer шалгалтгүй, дурын tournament эхлүүлж хуурамч bracket bulk-insert хийх боломжтой | HIGH |
| 4 | `seed_knockout` — organizer шалгалтгүй, дурын knockout slot-д entrant assign хийх боломжтой | HIGH |
| 5 | `check_achievements`, `update_club_score`, `refresh_premium_status` — SECURITY DEFINER, public EXECUTE, дотоод ownership шалгалтгүй (impact бага ч зохисгүй) | MEDIUM/LOW |
| 6 | Storage `tournaments` bucket — INSERT/DELETE policy-д auth/owner шалгалт огт байхгүй (unauthenticated upload + дурын устгал) | HIGH |
| 7 | Storage `clubs` bucket — INSERT/UPDATE/DELETE policy зөвхөн "нэвтэрсэн эсэх" шалгадаг, club ownership шалгадаггүй | MEDIUM |
| 8 | `province_rankings` VIEW — `security_invoker` тохируулаагүй (Advisor ERROR) | MEDIUM |
| 9 | 18 функц дээр `search_path` тодорхойгүй | MEDIUM |
| 10 | 13 trigger-returning SECURITY DEFINER функц дээр `anon`/`authenticated`/`PUBLIC` EXECUTE grant (permission hygiene, trigger firing өөрөө privilege шалгалтад хамаарахгүй) | LOW |

---

## 2. Call-site inventory

Бүрэн `grep -rn` хайлт `src/` дотор (бүх `.ts`/`.tsx`):

| Функц | Call site(s) | Client төрөл | Тайлбар |
|---|---|---|---|
| `apply_match_result` | `src/lib/local-game/match-stats.ts:85` | `createAdminClient()` (service_role) | `finishOnlineRoom`/local sync-аас дуудагдана |
| `advance_tournament_match` | `src/lib/local-game/room-finish.ts:117`, `src/app/api/tournaments/[id]/advance-knockout/route.ts:85` | `createAdminClient()` (service_role) | Route дээр organizer_id аль хэдийн шалгасан (доор харна уу) |
| `start_tournament` | `src/app/api/tournaments/[id]/start/route.ts:162` | `createAdminClient()` (service_role) | Route дээр `t.organizer_id !== user.id → 403` (мөр 23) |
| `seed_knockout` | `src/app/api/tournaments/[id]/advance-knockout/route.ts:74` | `createAdminClient()` (service_role) | Route дээр `t.organizer_id !== user.id → 403` (мөр 21) |
| `check_achievements` | `src/app/api/local/sync/route.ts:182`, мөн `apply_match_result` дотроос `PERFORM public.check_achievements(...)` | `createAdminClient()` (service_role) + internal owner-role call | Client-аас шууд дуудагддаггүй |
| `update_club_score` | Codebase-д ГАРАХГҮЙ. `on_rating_change` trigger-ээс `PERFORM public.update_club_score(...)` | Зөвхөн trigger-ийн дотоод дуудлага (owner role) | Ямар ч app route/client шууд дуудахгүй |
| `refresh_premium_status` | Codebase-д ГАРАХГҮЙ, өөр DB функцээс ч дуудагдахгүй | Хэрэглэгддэггүй (unused одоогоор) | Ирээдүйн subscription webhook-д зориулагдсан байж болзошгүй |

**Дүгнэлт:** Долоон функцийн БҮГД legitimate дуудлага нь зөвхөн `createAdminClient()` (service_role) ашигладаг Next.js server route/lib-ээс дамждаг. Client-side (browser) `.rpc()` дуудлага **ганц ч байхгүй**. Тэмцээний RPC (`start_tournament`, `seed_knockout`) дуудагдахаас өмнө тухайн route-ууд `tournaments.organizer_id === auth.uid()` шалгалтыг **аль хэдийн хийдэг байсан** (route.ts-д өөрчлөлт хийх шаардлагагүй болсон шалтгаан).

`advance_tournament_match`-ийг `room-finish.ts`-ээс дуудахдаа тухайн match-ийн ялагчийг server дээр тоглолтын бодит төлөвөөс (`state.legs`/`state.sets`) тооцоолсны дараа л дуудна — client-аас `p_winning_side`-г шууд авдаггүй тул энэ call site-д organizer шалгалт шаардлагагүй.

---

## 3. Chosen authorization model

**Server-owned privileged mutation** загвар — audit-ын "Preferred pattern".

Бүх 7 функцийн EXECUTE-г `PUBLIC`, `anon`, `authenticated`-с REVOKE хийж, зөвхөн `service_role`-д үлдээв. Ямар ч client-side call site байхгүй, бүх legitimate дуудлага service-role admin client ашигладаг тул энэ бол хамгийн зөв, хамгийн бага эрсдэлтэй сонголт (function дотор auth.uid() шалгалт нэмэх шаардлагагүй болсон, учир нь client шууд хандах эрхгүй болно).

Тэмцээний route-уудад (organizer authorization) шинээр код нэмэх шаардлагагүй байсан — `start_tournament`/`seed_knockout`-ыг дуудахаас өмнө route.ts дотор organizer_id шалгалт аль хэдийн байсан.

---

## 4. Migration created

`supabase/migrations/20260829_security_hotfix_rpc_storage.sql` — LIVE дээр амжилттай applied (`apply_migration`, migration name: `security_hotfix_rpc_storage`).

Rollback: `supabase/security_hotfix_20260829_ROLLBACK.sql` (migrations/ хавтаснаас гадуур санаатайгаар байрлуулсан — CLI/db push автоматаар цуглуулахгүй байхын тулд).

7 хэсэгтэй:
1. CRITICAL/HIGH RPC EXECUTE REVOKE (4 функц)
2. Бусад SECURITY DEFINER RPC EXECUTE REVOKE (3 функц)
3. `search_path` pinning (3 функц: `check_achievements`, `refresh_premium_status`, `update_club_score`) — logic өөрчлөгдөөгүй, зөвхөн `SET search_path TO 'public'` нэмэгдсэн
4. Trigger-returning SECURITY DEFINER функцүүдийн EXECUTE grant цэвэрлэгээ (13 функц)
5. `tournaments` bucket storage policy (INSERT/UPDATE/DELETE — path-based ownership)
6. `clubs` bucket storage policy (INSERT/UPDATE/DELETE — clubs.owner_id / club_members.role='admin')
7. `province_rankings` VIEW → `security_invoker = true`

**Баримт бичгийн хамрах хүрээ:** энэ migration бол baseline биш, зөвхөн forward hotfix. Future baseline migration (Strategy C, audit §20) хийхдээ энэ файлыг тухайн baseline-ийн орой дээр давхар апплиkeйшн биш, харин хэдийн орсон эцсийн төлөвт нь шингээх ёстой (өөрөөр хэлбэл baseline dump хийх үед эдгээр grants/policies аль хэдийн шинэ төлөвтэйгээр гарч ирнэ — тусад нь дахин apply хийх шаардлагагүй).

---

## 5. RPC permission before/after

| Функц | Өмнө (EXECUTE) | Одоо (EXECUTE) |
|---|---|---|
| `apply_match_result(jsonb,jsonb)` | PUBLIC, anon, authenticated, postgres, service_role | postgres, service_role |
| `advance_tournament_match(uuid,smallint,int,int)` | PUBLIC, anon, authenticated, postgres, service_role | postgres, service_role |
| `start_tournament(uuid,jsonb,jsonb,jsonb)` | PUBLIC, anon, authenticated, postgres, service_role | postgres, service_role |
| `seed_knockout(uuid,jsonb)` | PUBLIC, anon, authenticated, postgres, service_role | postgres, service_role |
| `check_achievements(uuid)` | PUBLIC, anon, authenticated, postgres, service_role | postgres, service_role |
| `update_club_score(uuid)` | PUBLIC, anon, authenticated, postgres, service_role | postgres, service_role |
| `refresh_premium_status(uuid)` | PUBLIC, anon, authenticated, postgres, service_role | postgres, service_role |
| 13 trigger функц (`handle_new_user` гэх мэт) | PUBLIC, anon, authenticated, postgres, service_role | postgres, service_role |

Live дээр `information_schema.routine_privileges`-ээр баталгаажуулсан (migration-ийн дараа дахин query хийж, `anon`/`authenticated`/`PUBLIC` мөр байхгүй болсныг харсан).

---

## 6. Storage policy before/after

### `tournaments` bucket

| Policy | Өмнө | Одоо |
|---|---|---|
| INSERT | `public`, `WITH CHECK (bucket_id='tournaments')` — auth шалгалт байхгүй | `authenticated`, `WITH CHECK (bucket_id='tournaments' AND name LIKE 'banners/'||auth.uid()::text||'-%')` |
| UPDATE | байхгүй | `authenticated`, ижил ownership predicate (upsert дэмжихийн тулд нэмсэн) |
| DELETE | `public`, `USING (bucket_id='tournaments')` — "Owner" нэртэй ч owner шалгалт байхгүй | `authenticated`, ижил ownership predicate |
| SELECT | public (өөрчлөгдөөгүй) | public (өөрчлөгдөөгүй) |

Path convention (`CreateTournamentForm.tsx:226`): `banners/<uploader_uid>-<timestamp>.<ext>` — тэмцээн үүсэхээс ӨМНӨ upload хийгддэг тул tournament_id-гүй, зөвхөн uploader uid л path дотор байдаг. Тиймээс ownership check-ийг uploader-ийн auth.uid() дээр үндэслэв (tournament_id биш).

### `clubs` bucket

| Policy | Өмнө | Одоо |
|---|---|---|
| INSERT | `public`, `auth.uid() IS NOT NULL` — дурын нэвтэрсэн хэрэглэгч | `authenticated`, `clubs.owner_id=auth.uid() OR club_members.role='admin'` |
| UPDATE | адилхан сул шалгалт | адилхан owner/admin шалгалт |
| DELETE | адилхан сул шалгалт | адилхан owner/admin шалгалт |
| SELECT | public (өөрчлөгдөөгүй) | public (өөрчлөгдөөгүй) |

Path convention (`ImageUpload.tsx` + `clubs/[id]/edit/page.tsx`): `<club_id>/logo.<ext>?t=<ts>`, `<club_id>/cover.<ext>?t=<ts>` — `storage.foldername(name)[1]` = club_id. Authorization model нь `clubs` table-ийн одоо байгаа "Club owners can update" / "Club deputies can update" RLS policy-той яг таарна (owner эсвэл admin role, энгийн member биш — edit хуудасны client-side gate-тэй мөн таарна).

---

## 7. search_path changes

| Функц | Өмнө | Одоо |
|---|---|---|
| `check_achievements` | тодорхойгүй | `SET search_path TO 'public'` |
| `refresh_premium_status` | тодорхойгүй | `SET search_path TO 'public'` |
| `update_club_score` | тодорхойгүй | `SET search_path TO 'public'` |

Бусад 15 функц (`update_updated_at`, `update_updated_at_column`, `update_tournament_player_count`, `calculate_elo_change`, `on_rating_change`, `on_profile_stats_change`, `notify_*` ×4, `sync_primary_club`, `sync_club_logo_to_members`, `club_tier_idx`, `get_player_stat_summary`, `get_practice_stat_summary`) — Advisor-д WARN хэвээр, ЗОРИУДААР ЭНЭ PHASE-Д ХӨНДӨӨГҮЙ (task-ийн "18-г blind mass-edit хийхгүй" зааврын дагуу; §12-т follow-up тэмдэглэв).

---

## 8. province_rankings decision

`ALTER VIEW public.province_rankings SET (security_invoker = true);` — амжилттай.

Justification: view нь зөвхөн `public.profiles`-аас SELECT хийдэг, `profiles` дээрх SELECT RLS policy нь `USING (true)` (public read) тул security_invoker болгосон ч ямар ч role-д харагдах өгөгдөл өөрчлөгдөхгүй. Codebase дотор view нь хаана ч ашиглагдахгүй байгааг grep-ээр баталгаажуулсан тул regression эрсдэл 0.

---

## 9. Tests

### Security tests (live DB дээр, service_role/anon/authenticated role simulation)

| Test | Арга | Үр дүн |
|---|---|---|
| `information_schema.routine_privileges` snapshot (7 RPC + 13 trigger fn) | Query | PASS — `anon`/`authenticated`/`PUBLIC` бүрэн арилсан, `service_role`/`postgres` л үлдсэн |
| `anon` → `apply_match_result` | `SET ROLE anon; SELECT public.apply_match_result(...)` | **DENIED** (`permission denied for function apply_match_result`) — PASS |
| `authenticated` → `advance_tournament_match` | `SET ROLE authenticated; SELECT public.advance_tournament_match(...)` | **DENIED** — PASS |
| `authenticated` → `check_achievements` | `SET ROLE authenticated; SELECT public.check_achievements(...)` | **DENIED** — PASS |
| `service_role` → `check_achievements` | `SET ROLE service_role; ...` | **OK**, `[]` буцаасан (permission error байхгүй) — PASS |
| `service_role` → `advance_tournament_match` (bogus match_id) | `SET ROLE service_role; ...` | **OK**, permission error байхгүй (no-op, match олдоогүй тул RETURN) — PASS |
| `service_role` → `apply_match_result` (bogus id) | `SET ROLE service_role; ...` | **OK**, permission error байхгүй, дотоод `PERFORM check_achievements(...)` мөн permission error-гүй ажилласан — PASS (cross-function call owner-role-ээр ажилладгийг батлав) |
| `service_role` → `seed_knockout`, `update_club_score`, `refresh_premium_status` (bogus id) | `SET ROLE service_role; ...` | **OK**, бүгд permission error-гүй — PASS |
| `service_role` → `start_tournament` (bogus tournament_id) | `SET ROLE service_role; ...` | Permission error БИШ, app-level `EXCEPTION 'Tournament ... not startable'` гарсан (хүлээгдэж байсан business-logic алдаа) — PASS |
| Storage `clubs` policy predicate — club owner (бодит club/owner_id, `clubs`:2 мөртэй) | `set_config('request.jwt.claims', ...)` + policy SQL | `owner_allowed = true` — PASS |
| Storage `clubs` policy predicate — plain member (`role='member'`, бодит `club_members` мөр) | адилхан | `member_denied = false` — PASS |
| Storage `clubs` policy predicate — үл хамаарах хэрэглэгч | адилхан | `unrelated_denied = false` — PASS |
| Storage `tournaments` policy predicate — өөрийн banner file | LIKE predicate simulation | `own_file = true` — PASS |
| Storage `tournaments` policy predicate — бусдын banner file | адилхан | `other_user_file = false` — PASS |
| Supabase Advisor (security) дахин ажиллуулсан | `get_advisors` | 7 RPC + 13 trigger fn-ийн `anon/authenticated_security_definer_function_executable` WARN **бүгд арилсан**; `province_rankings` `security_definer_view` ERROR **арилсан** |

19/19 security test PASS.

### Regression / application tests

| Тест | Арга | Үр дүн |
|---|---|---|
| Function body diff (4/7 функц) | Migration-д зөвхөн GRANT/REVOKE, функцийн logic ОГТ ХӨНДӨГДӨӨГҮЙ | PASS (byte-identical) |
| Function body diff (3/7 функц) | `pg_get_functiondef`-тэй харьцуулав — зөвхөн `SET search_path` нэмэгдсэн, бусад бүх мөр ижил | PASS |
| `npm run typecheck`-тэй дүйцэх (`npx tsc --noEmit`) | App code огт хөндөгдөөгүй тул зөвхөн baseline typecheck | **PASS**, алдаагүй |
| `git status --short` | Repo-д зөвхөн шинэ файлууд нэмэгдсэн, одоо байгаа app файл ЭГЭГҮЙ | PASS |

Route-level organizer-authorization (`start_tournament`, `seed_knockout`, `advance-knockout`) — код өөрчлөгдөөгүй тул урьдын нэгэн адил ажиллана (regression боломжгүй — SQL logic + route logic хоёулаа хөндөгдөөгүй, зөвхөн database grants/policies).

`npm run build` бүрэн build-ийг цаг хугацааны шалтгаанаар давхар ажиллуулаагүй — app code файл ОГТ өөрчлөгдөөгүй тул build амжилттай байх ёстой (typecheck аль хэдийн PASS).

---

## 10. Live verification

- Migration `security_hotfix_rpc_storage` LIVE дээр `apply_migration`-аар амжилттай орсон (`{"success":true}`).
- Grants, storage policies, view option, search_path — бүгд дахин query хийж баталгаажуулсан (§5–§8).
- Advisor дахин ажиллуулж, зорилтот WARN/ERROR-ууд арилсныг баталгаажуулсан.
- Тест бүрт reversible/read-only арга ашигласан: bogus UUID (`00000000-...`), permission simulation (`SET ROLE`), predicate simulation (`set_config('request.jwt.claims',...)` + SELECT EXISTS, storage.objects table-д бодит INSERT хийгээгүй). Бодит хэрэглэгчийн `profiles`/`clubs`/`tournaments` мөр ЗЭРЭГ ӨӨРЧЛӨГДӨӨГҮЙ.

---

## 11. Rollback plan

`supabase/security_hotfix_20260829_ROLLBACK.sql` — гараар ажиллуулах, автоматаар migration хэлбэрээр орохгүй байхын тулд `supabase/migrations/`-ээс гадна байрлуулсан.

Агуулга:
1. Бүх 7 + 13 функцийн `PUBLIC`/`anon`/`authenticated` EXECUTE-г анхны төлөвт нь буцаах (`GRANT`)
2. `check_achievements`/`refresh_premium_status`/`update_club_score`-ийг `SET search_path`-гүй анхны body-той нь `CREATE OR REPLACE`
3. `tournaments`/`clubs` bucket-ийн storage policy-г анхны (сул) хувилбарт нь буцаах
4. `province_rankings`-г `RESET (security_invoker)`

Rollback хийхийн өмнө: шинэ hotfix policy-гоор аль хэдийн зөв ажилласан upload/delete урсгал байвал, rollback хийснээр тэдгээр л сул policy-руу буцах болохыг анхаарах (функциональ регресс биш, зөвхөн аюулгүй байдлын түвшин буурна).

---

## 12. Remaining security findings (follow-up, ЭНЭ PHASE-Д ЗАСААГҮЙ)

| # | Олдвор | Severity | Тайлбар |
|---|---|---|---|
| 1 | 15 бусад функц дээр `search_path` тодорхойгүй | MEDIUM | `update_updated_at(_column)` (SECURITY DEFINER биш, эрсдэл бага), `calculate_elo_change`, `get_player_stat_summary`, `get_practice_stat_summary` (SECURITY DEFINER биш), `on_rating_change`, `on_profile_stats_change`, `notify_*` ×4, `sync_primary_club`, `sync_club_logo_to_members`, `club_tier_idx` (SECURITY DEFINER trigger fn — Step 11 prioritization-аар дараагийн phase-д тохиромжтой) |
| 2 | `pg_trgm` extension `public` schema-д суусан | LOW | `extensions` schema руу шилжүүлэхийн өмнө `pg_depend` шалгах шаардлагатай (audit §16-C) |
| 3 | `auth_leaked_password_protection` disabled | LOW | Auth-level тохиргоо, dashboard-аар л засагдана, schema-тай хамааралгүй |
| 4 | `synced_local_sessions` — RLS enabled, policy алга | LOW | Санаатай эсэхийг батлах шаардлагатай (одоогийн байдлаар default-deny, зөвхөн service_role хандана — аюулгүй ч баримтжуулаагүй) |
| 5 | `refresh_premium_status` codebase-д хаана ч дуудагддаггүй | INFO | Ирээдүйн BYL/subscription webhook-д хэрэгтэй бол service-role client-аас дуудах ёстой (одоо аль хэдийн зөвхөн service_role-д GRANT-тай тул нэмэлт өөрчлөлт шаардлагагүй) |
| 6 | `finishOnlineRoom`-г дуудах route-уудын (`/api/play/room/[id]/{turn,claim,forfeit,decide}`) player-ownership шалгалт | INFO | Энэ phase-ийн хамрах хүрээнээс гадна (RPC/storage биш) — тусад нь review хийж болно |

---

## 13. Git diff summary

```
?? DARTMN_SUPABASE_SCHEMA_AUDIT.md        (өмнөх chat-аас, энэ phase-тай хамааралгүй)
?? DARTMN_PRODUCT_DISCOVERY.md            (өмнөх chat-аас, энэ phase-тай хамааралгүй)
?? DARTMN_SECURITY_HOTFIX_REPORT.md       (энэ report)
?? supabase/migrations/20260829_security_hotfix_rpc_storage.sql   (applied)
?? supabase/security_hotfix_20260829_ROLLBACK.sql                 (гараар ашиглах)
```

Одоо байгаа ямар ч app эсвэл config файл өөрчлөгдөөгүй (`git diff --stat` хоосон). BYL код, schema.sql, baseline-тай холбоотой юу ч хөндөгдөөгүй. Commit хийгдээгүй.
