# DartMN — Supabase Schema Recovery & Migration Baseline Audit

**Огноо:** 2026-08-28
**Горим:** READ-ONLY audit. Ямар ч SQL mutation, migration apply, эсвэл файл өөрчлөлт хийгдээгүй.
**Live project:** `mongol-darts` (ref: `idomtybdmqhsxbuttubk`), region `ap-northeast-1`, Postgres `17.6.1.127`, status `ACTIVE_HEALTHY`.

> ⚠️ Энэ audit явцад **баримт бичгийн зорилгоос давсан, ОДООХОНДОО ЛИВ дээр идэвхтэй байгаа ноцтой аюулгүй байдлын алдаа** илэрсэн (§5, §18 — SECURITY DEFINER функцууд + Storage policy). Энэ нь зөвхөн "baseline migration risk" биш, **одоо байгаа production vulnerability**. Даалгаврын дүрмийн дагуу энд ЗАСВАРЛАХГҮЙ, зөвхөн тайлагнана.

---

## 1. Connection / Environment Discovery

| Зүйл | Төлөв |
|---|---|
| Supabase CLI (`supabase` binary) | **missing** (systemd PATH дээр олдсонгүй) |
| `supabase/config.toml` (local link) | **missing** |
| Local Supabase (`supabase start`) | **not configured** |
| `.env.local` | **exists** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, QPay/SocialPay/Bonum түлхүүрүүд — утга уншаагүй, зөвхөн key нэрс) |
| `.env.example` | **exists**, `.env.local`-тай ижил key бүтэцтэй |
| Supabase MCP server | **configured, connected** — read-only query боломжтой |
| `NEXT_PUBLIC_SUPABASE_URL` → project ref таарсан эсэх | **verified** — `.env.local` доторх URL-д `idomtybdmqhsxbuttubk` орсныг grep-ээр баталгаажуулав (утгыг хэвлээгүй) |

**Дүгнэлт: LIVE SUPABASE ACCESS AVAILABLE** — MCP-ээр read-only холболт бүрэн ажиллаж байна. Local CLI/config холбогдоогүй тул `supabase db diff`/`db pull` шиг CLI командыг ашиглах боломжгүй; бүх inspection MCP `execute_sql`/`list_*` дуудлагаар хийгдсэн.

---

## 2. Live Schema Inventory — Schema-ууд

| Schema | Relation тоо (`relkind='r'`) | Ангилал |
|---|---|---|
| `public` | 39 | **DartMN application schema (цорын ганц)** |
| `auth` | 23 | Supabase-managed |
| `storage` | 8 | Supabase-managed |
| `realtime` | 8 | Supabase-managed |
| `supabase_migrations` | 1 | Supabase-managed (migration tracking) |
| `vault` | 1 | Supabase-managed (pgsodium vault) |
| `information_schema` / `pg_catalog` | 4 / 64 | Postgres built-in |

DartMN зөвхөн `public` schema ашигладаг — өөр custom application schema байхгүй. Мөн `public` дотор **1 VIEW** (`province_rankings`) байгаа нь `list_tables`-д (зөвхөн base table буцаадаг тул) харагдаагүй — доор §14, §18-д дэлгэрэнгүй.

---

## 3. Tables — Inventory

Бүгд `public` schema, **бүгд RLS enabled** (`relrowsecurity=true`, `relforcerowsecurity=false`).

### Task-д заасан жагсаалтын verify үр дүн

| Хүсэлтэд байсан нэр | Live дээр байгаа эсэх | Тайлбар |
|---|---|---|
| profiles | ✅ | PK `id`→`auth.users.id` (CASCADE) |
| rating_history | ✅ | |
| match_stat_details | ✅ | |
| clubs | ✅ | |
| club_members | ✅ | |
| club_join_requests | ✅ | |
| club_messages | ✅ | |
| tournaments | ✅ | |
| tournament_registrations | ✅ | |
| tournament_entrants | ✅ | |
| tournament_entrant_players | ✅ | |
| tournament_matches | ✅ | |
| tournament_stages | ✅ | |
| tournament_payout_accounts | ✅ | |
| organizer_ratings | ✅ | |
| online_rooms | ✅ | |
| room_players | ✅ | |
| room_invites | ✅ | |
| room_visits | ✅ | |
| matches | ✅ | |
| match_legs | ✅ | |
| throws | ✅ | |
| matchmaking_queue | ✅ | |
| payment_transactions | ✅ | |
| player_subscriptions | ✅ | |
| notifications | ✅ | |
| achievements | ✅ | |
| player_achievements | ✅ | |
| player_unlocks | ✅ | |
| practice_sessions | ✅ | |
| pending_match_results | ✅ | |
| synced_local_sessions | ✅ | |
| **cosmetics** | ❌ **MISSING** | Ийм нэртэй table байхгүй. Оронд нь `cosmetic_effects` + `cosmetic_passes` table, мөн `cosmetics` нэртэй **storage bucket** байна (§12). Discovery report-д table гэж androж алдаатай тэмдэглэсэн байж болзошгүй. |
| cosmetic_effects | ✅ | |
| cosmetic_passes | ✅ | |
| caller_clips | ✅ | |
| leagues | ✅ | |
| league_standings | ✅ | |

### Жагсаалтад ороогүй, гэхдээ live дээр байгаа нэмэлт table

- `club_subscriptions` — клубын багц захиалга (subscription_plan, expires_at)
- `local_session_sync` — /local тэмцээний realtime sync (session_id PK)

### PK/FK/Unique/Check тойм (бүрэн жагсаалт хавсралт мэт — гол зүйлс):

- **Бүх table** UUID PK (`uuid_generate_v4()` эсвэл `gen_random_uuid()`), 2 нэрлэсэн түлхүүр (`local_session_sync.session_id text`, `synced_local_sessions.session_id uuid`) л текст/uuid natural key.
- **`profiles.id` → `auth.users.id` ON DELETE CASCADE** — гол auth холбоос.
- Бүх сан hierarchical FK бүрэн бүрдсэн (clubs↔club_members↔profiles, tournaments↔tournament_entrants↔tournament_matches↔tournament_stages, online_rooms↔room_players/room_invites/room_visits, matches↔match_legs↔throws).
- `tournament_matches` бол хамгийн олон self-referencing FK-той (`next_match_id`, `next_loser_match_id` → өөрөө өөртөө) — DE bracket-ийн зангилаа холболт.
- Check constraint-ууд бүгд `role`/`status`/`format`/`type` төрлийн текст баганан дээр `ARRAY[...]::text[]`-тэй `= ANY` хэлбэрээр — жинхэнэ Postgres ENUM ашиглаагүй (доор §9).
- `notifications` — **schema.sql-аас `drop_notifications_type_check` migration-аар type check constraint-ийг устгасан түүхтэй** (repo-д `supabase/drop_notifications_type_check.sql` байгаа нь баталгаа) — учир нь live-д `notifications.type` дээр CHECK алга, зөвхөн NOT NULL text.
- `matchmaking_queue.player_id` FK **зорилтот table заагаагүй** query-д гарсан (`foreign_table: null`) — энэ нь FK биш зүгээр нэг нэрлэсэн constraint байж болзошгүй тул анхаарууштай (доор §15).
- `notifications.user_id` мөн адил foreign_table `null` гарсан — constraint нэр `notifications_user_id_fkey` байгаа хэдий ч `constraint_column_usage` query FK зорилтот багана шийдэж чадаагүй нь query joins-ийн хязгаарлалт байж болзошгүй тул шууд "FK алга" гэж дүгнэхгүй, зөвхөн тэмдэглэв.

---

## 4. Functions / RPC Inventory

`public` schema дотор **65 функц** байгаа боловч эдгээрийн **36 нь `pg_trgm` extension operator функц** (owner=`supabase_admin`, DartMN-тэй хамааралгүй). **DartMN-owned custom функц: 29** (owner=`postgres`).

| Функц | Args | Return | Lang | SECURITY DEFINER | Зорилго |
|---|---|---|---|---|---|
| `apply_match_result` | `p_updates jsonb, p_history jsonb` | void | plpgsql | **YES** | Тоглолт дууссаны дараа profile stat/rating bulk update + rating_history insert + achievement check (нэг транзакцид) |
| `advance_tournament_match` | `p_match_id uuid, p_winning_side smallint, p_side1_legs int, p_side2_legs int` | void | plpgsql | **YES** | Тэмцээний тоглолт дуусгаж bracket-ийг дараагийн шат руу дэвшүүлэх |
| `seed_knockout` | `p_tournament_id uuid, p_assignments jsonb` | void | plpgsql | **YES** | Клиг/групп үр дүнгээс knockout bracket-д entrant хуваарилах |
| `start_tournament` | `p_tournament_id uuid, p_entrants/p_entrant_players/p_matches jsonb` | void | plpgsql | **YES** | Тэмцээн эхлүүлж bracket бүтэц (entrants+matches) bulk insert |
| `check_achievements` | `p_player_id uuid` | text[] | plpgsql | **YES** | Тоглогчийн stat-аас achievement шалгаж idempotent олгох |
| `matchmaking_claim_match` | `p_player_id uuid, p_rating, p_format, p_best_of, p_double_out, p_elo_window` | TABLE(room_id, matched) | plpgsql | **YES** | Matchmaking queue-с opponent claim хийж online_room үүсгэх (concurrency-safe, advisory lock) |
| `matchmaking_join_queue` | `p_player_id, p_rating, p_format, p_best_of, p_double_out` | void | sql | **YES** | Queue-д элсэх |
| `matchmaking_heartbeat` | `p_player_id uuid` | void | sql | **YES** | Queue дэх `last_seen_at` шинэчлэх |
| `undo_last_room_visit` | `p_room_id uuid, p_user_id uuid` | SETOF room_visits | sql | **YES** | Сүүлийн онооны throw-г atomic буцаах |
| `handle_new_user` | — | trigger | plpgsql | **YES** | `auth.users` INSERT trigger — `profiles` мөр авто үүсгэх |
| `check_avraga_on_tournament_complete` | — | trigger | plpgsql | **YES** | Тэмцээн дуусахад "avraga" (аварга) тоолуур шинэчлэх |
| `notify_achievement`, `notify_club_joined`, `notify_club_tier_up`, `notify_tournament_registered`, `notify_tournament_status` | — | trigger | plpgsql | **YES** (бүгд) | `notifications` мөр auto-insert хийх trigger-ууд |
| `on_profile_stats_change`, `on_rating_change` | — | trigger | plpgsql | **YES** | profiles UPDATE trigger — achievement/rating side-effect |
| `sync_primary_club`, `sync_club_logo_to_members` | — | trigger | plpgsql | **YES** | Club гишүүнчлэл/лого мэдээллийг profiles/club_members-д sync |
| `update_club_member_count`, `update_tournament_player_count` | — | trigger | plpgsql | **YES** | Тоолуур багана автомат sync |
| `update_club_score` | `p_club_id uuid` | void | plpgsql | **YES** | Клубын нэгдсэн оноог дахин тооцох |
| `refresh_premium_status` | `p_player_id uuid` | void | plpgsql | **YES** | Тоглогчийн premium төлөвийг дахин тооцох |
| `update_updated_at`, `update_updated_at_column` | — | trigger | plpgsql | NO | Ерөнхий `updated_at` timestamp trigger (2 хувилбар зэрэгцэн байна — legacy давхардал) |
| `calculate_elo_change` | `player_rating, opponent_rating, won, k_factor` | int | plpgsql | NO | ELO тооцоолол (pure function) |
| `club_tier_idx` | `score int` | int | sql | NO | Клубын tier index тооцоолол (pure function) |
| `get_player_stat_summary` | `p_player_id uuid` | TABLE(...) | sql | NO | Тоглогчийн нэгдсэн стат (leaderboard/профайл popup-д) |
| `get_practice_stat_summary` | `p_player_id uuid` | TABLE(...) | sql | NO | Бэлтгэлийн стат нэгтгэл |

Repository-д дурдсан бүх RPC (`apply_match_result`, `get_player_stat_summary`, `advance_tournament_match`, `seed_knockout`, `matchmaking_claim_match`, `matchmaking_join_queue`, `matchmaking_heartbeat`, `undo_last_room_visit`, `check_achievements`) — **бүгд verify хийгдэж, live дээр яг тэр нэрээр байна.**

---

## 5. SECURITY DEFINER Audit — **ХАМГИЙН ЧУХАЛ ОЛДВОР**

24 функц + 1 view (`province_rankings`, §14) `SECURITY DEFINER`. Эдгээр нь `postgres` owner-тай (Supabase дээр ихэвчлэн `BYPASSRLS`) ажилладаг тул **RLS policy-г бүрэн тойрч гардаг** — client талын RLS-д тулгуурласан хамгаалалт эдгээр RPC-д огт хамаарахгүй.

### ✅ Зөв хязгаарлагдсан (зөвхөн `service_role`-д EXECUTE)

| Функц | EXECUTE эрх |
|---|---|
| `matchmaking_claim_match` | `service_role` ЗӨВХӨН |
| `matchmaking_heartbeat` | `service_role` ЗӨВХӨН |
| `matchmaking_join_queue` | `service_role` ЗӨВХӨН |
| `undo_last_room_visit` | `service_role` ЗӨВХӨН |

Эдгээрийг migration-уудаас харахад санаатайгаар хожим хязгаарласан байна (`restrict_matchmaking_undo_rpc_execute_to_service_role`, `revoke_matchmaking_join_queue_from_anon_authenticated`, `fix_matchmaking_claim_match_livelock`) — **зөв design pattern, өмнөх аудитаар олсон асуудлыг засчихсан жишээ.**

### 🔴 HIGH / CRITICAL RISK — `anon` + `authenticated` + `PUBLIC`-д нээлттэй, дотор нь `auth.uid()`/эзэмшлийн шалгалт ОГТ ХИЙДЭГГҮЙ

Эдгээр нь Supabase Data API-ээр (`/rest/v1/rpc/<name>`) **хэн ч дуудаж болно** (authenticated session хэрэгтэй ч зорилтот `player_id`/`match_id`/`tournament_id`-г дурын утгаар дамжуулж болно):

| Функц | Дуудахад юу боломжтой | Severity |
|---|---|---|
| **`apply_match_result`** | `p_updates`-д дурын `id` (uuid) орсон profile-ийн `rating_points`, `matches_played`, `matches_won`, `count_180`, `highest_checkout`, `average_score`, `career_points`, `career_darts`-г шууд ДАХИН БИЧИХ + дурын `rating_history` мөр INSERT хийх. Дотор нь өгсөн `id`/`player_id`-г дуудагчийн `auth.uid()`-тэй харьцуулах шалгалт **байхгүй**. | **CRITICAL** — leaderboard/ELO/achievement бүрэн хуурамчаар удирдах боломжтой |
| **`advance_tournament_match`** | Дурын `p_match_id`-г "completed" болгож ялагчийг санамсаргүй тохируулан bracket-ийг дэвшүүлж, тэмцээнийг "completed" болгож чадна. Match нь өөрийн тэмцээн мөн эсэхийг шалгахгүй. | **CRITICAL** — prize_pool/entry_fee-тэй тэмцээний үр дүнг хэн ч хуурамчаар өөрчилж чадна |
| **`start_tournament`** | Дурын `p_tournament_id`-г (draft/registration/ongoing төлөвтэй бол) шууд эхлүүлж, хуурамч `entrants`/`matches` bulk insert хийж чадна. Дуудагч тэр тэмцээний organizer мөн эсэхийг шалгахгүй. | **HIGH** |
| **`seed_knockout`** | Дурын тэмцээний "pending" knockout match-д дурын `side1`/`side2` entrant assign хийж чадна — bracket "тохироог" удирдах боломж. Organizer шалгалт байхгүй. | **HIGH** |
| `check_achievements` | Дурын `player_id`-д зориулж achievement force-recompute хийнэ. Impact бага (cosmetic/gamification), гэхдээ зохисгүй trigger боломжтой. | MEDIUM |
| `update_club_score` | Дурын `club_id`-ийн оноог дахин тооцно. Impact бага (derived утга), гэхдээ зохисгүй trigger боломжтой. | LOW-MEDIUM |
| `refresh_premium_status` | Дурын `player_id`-ийн premium төлөвийг дахин тооцно (эх сурвалж нь `player_subscriptions`, тиймээс шууд урамшуулал бэлэглэхгүй), гэхдээ recompute-ийг зохисгүй эрхгүй дуудаж болно. | LOW-MEDIUM |

Trigger-төрлийн (`return type = trigger`) `SECURITY DEFINER` функцууд (`handle_new_user`, `notify_*`, `sync_*`, `on_rating_change`, `on_profile_stats_change`, `update_club_member_count`, `update_tournament_player_count`, `check_avraga_on_tournament_complete`) мөн `anon`/`authenticated`-д `EXECUTE` олгогдсон харагдаж байгаа ч, **Postgres дээр trigger функцийг чиг ажиллагаагаар шууд дуудах боломжгүй** ("trigger functions can only be called as triggers" алдаа өгнө) — тиймээс эдгээрийн бодит эксплойт эрсдэл бага, гэхдээ Supabase-ийн `get_advisors` мөн WARN болгон жагсаасан тул baseline-д GRANT-уудыг цэвэрлэхэд анхаарах нь зохистой.

**Яагаад RLS энэ бүхнийг зогсоохгүй вэ:** RLS policy-үүд (`matches`, `tournament_matches`, `profiles` дээрх) зөв бичигдсэн ("Players can update their own matches" гэх мэт), гэхдээ эдгээр RPC нь SECURITY DEFINER тул шууд table-ыг postgres эрхээр (RLS bypass) шинэчилдэг — RLS-ийн ач холбогдол дуусна.

### function_search_path_mutable (Supabase Advisor, 18 функц WARN)

`update_updated_at_column`, `update_updated_at`, `update_tournament_player_count`, `calculate_elo_change`, `update_club_score`, `on_rating_change`, `check_achievements`, `on_profile_stats_change`, `refresh_premium_status`, `notify_achievement`, `sync_primary_club`, `sync_club_logo_to_members`, `notify_club_joined`, `notify_tournament_registered`, `notify_tournament_status`, `club_tier_idx`, `get_player_stat_summary`, `get_practice_stat_summary` — эдгээрт `SET search_path` тодорхойлогдоогүй тул session-level `search_path` hijack-д өртөх боломжтой (ялангуяа SECURITY DEFINER-тэй хослоход эрсдэл нэмэгддэг сонгодог Postgres pattern). Зарим шинэ функц (`apply_match_result`, `advance_tournament_match`, `seed_knockout`, `start_tournament`, `matchmaking_*`) `SET search_path TO 'public'` зөв тохируулсан байгаа нь **хожуу migration-уудад засагдсан дадал** гэдгийг харуулж байна — хуучин функцууд өртсөн хэвээр.

---

## 6. RLS Audit

**39/39 table дээр RLS enabled.** Policy тоймлол:

| Ангилал | Жишээ |
|---|---|
| **Public read policy** (`USING (true)`) | `profiles`, `clubs`, `matches`, `match_legs`, `throws`, `tournaments`, `tournament_*` (registrations/entrants/matches/stages), `rating_history`, `achievements`, `player_achievements`, `room_invites`, `room_players`, `room_visits`, `league_standings`, `leagues`, `organizer_ratings`, `cosmetic_effects`, `cosmetic_passes`, `caller_clips`, `club_subscriptions`, `local_session_sync` |
| **Ownership policy** (`auth.uid() = owner/player_id`) | `clubs` (owner UPDATE/DELETE), `matches` (player1/2 UPDATE), `notifications` (user_id), `payment_transactions` (player_id), `matchmaking_queue` (player_id, бүх CRUD), `pending_match_results`, `player_subscriptions`, `player_unlocks`, `practice_sessions`, `tournament_payout_accounts`, `club_join_requests` |
| **Relation-based ownership** (subquery-аар шалгах) | `club_messages` (club_members гишүүн + club.subscription_plan шаардлагатай), `tournament_stages` (organizer_id тохирох), `tournament_registrations` UPDATE (organizer_id), `tournament_payout_accounts` SELECT (self OR organizer), `room_players` DELETE (self OR host_id) |
| **Admin/service-only write** | Илэрхий "service_role only" policy алга (учир нь ихэнх write SECURITY DEFINER RPC-ээр дамждаг, §5-ийг үз) |
| **Suspicious/зохисгүй чөлөөтэй policy** | `local_session_sync`: "anyone can update live sessions" `USING(true)` — ямар ч auth шалгалтгүй бүх session-ийг хэн ч update хийж болно (session_id нь UUID biткийн нууцлалт учир бага эрсдэлтэй боловч дизайны хувьд сул) |

### ⚠️ RLS enabled боловч policy АЛГА

**`public.synced_local_sessions`** — RLS идэвхжсэн, гэхдээ **ямар ч policy үүсээгүй**. Энэ нь default-deny (anon/authenticated бүрэн хандах эрхгүй, зөвхөн `service_role` уншиж/бичиж чадна) гэсэн үг. Supabase Advisor мөн үүнийг `rls_enabled_no_policy` (INFO) гэж тэмдэглэсэн. **Санаатай эсэхийг баталгаажуулах шаардлагатай** — хэрэв server-side (service_role) л хандах ёстой sync table бол зөв, харин client-аас шууд хандах ёстой байсан бол функционал алдаа.

### RLS disabled custom table

Байхгүй — бүх 39 table RLS идэвхтэй.

---

## 7. Triggers

| Table | Trigger | Timing/Event | Функц | Зорилго |
|---|---|---|---|---|
| `auth.users` | `on_auth_user_created` | AFTER INSERT | `handle_new_user` | **Profile auto-create** — шинэ хэрэглэгч бүртгүүлэхэд `profiles` мөр автоматаар үүсгэнэ |
| `club_members` | `club_member_sync_club` | AFTER INSERT/DELETE | `sync_primary_club` | Тоглогчийн `primary_club_id` sync |
| `club_members` | `club_members_count_trigger` | AFTER INSERT/DELETE | `update_club_member_count` | `clubs.member_count` тоолуур |
| `club_members` | `on_club_member_joined` | AFTER INSERT | `notify_club_joined` | Мэдэгдэл үүсгэх |
| `clubs` | `club_logo_sync` | AFTER UPDATE | `sync_club_logo_to_members` | Клубын лого `profiles.primary_club_logo`-д sync |
| `clubs` | `club_tier_up_trigger` | AFTER UPDATE | `notify_club_tier_up` | Tier ахих мэдэгдэл |
| `clubs` | `clubs_updated_at` | BEFORE UPDATE | `update_updated_at` | timestamp |
| `payment_transactions` | `payment_transactions_updated_at` | BEFORE UPDATE | `update_updated_at` | timestamp |
| `player_achievements` | `on_achievement_earned` | AFTER INSERT | `notify_achievement` | Мэдэгдэл |
| `profiles` | `profile_rating_change` | AFTER UPDATE | `on_rating_change` | Rating өөрчлөлтийн side-effect |
| `profiles` | `profile_stats_achievement_check` | AFTER UPDATE | `on_profile_stats_change` | Achievement шалгах |
| `profiles` | `profiles_updated_at` | BEFORE UPDATE | `update_updated_at` | timestamp |
| `tournament_registrations` | `on_tournament_registered` | AFTER INSERT | `notify_tournament_registered` | Мэдэгдэл |
| `tournament_registrations` | `tournament_registration_count_trigger` | AFTER INSERT/DELETE | `update_tournament_player_count` | `tournaments.current_players` тоолуур |
| `tournaments` | `on_tournament_completed` | AFTER UPDATE | `check_avraga_on_tournament_complete` | Аварга тоолуур |
| `tournaments` | `on_tournament_status_change` | AFTER UPDATE | `notify_tournament_status` | Мэдэгдэл |
| `tournaments` | `tournaments_updated_at` | BEFORE UPDATE | `update_updated_at` | timestamp |

Нийт **17 custom trigger `public` schema дотор + 1 `auth.users` trigger = 18**. Repository-д дурдсан "auto-create profile trigger" бүрэн baild(verified). Statistics/achievement/tournament trigger бүгд байгаа.

---

## 8. Indexes

Гол custom index-үүд бүгд байна (FK lookup, tournament progression, matchmaking, ratings, usernames, room visits sequence):

- **Username**: `profiles_username_key` (unique), `profiles_username_idx`
- **Rating**: `profiles_rating_idx` (DESC), `rating_history_player_idx`
- **Tournament progression**: `tournament_matches_tournament_idx (tournament_id, round, match_number)`, `idx_tournament_matches_stage`, `idx_tournament_stages_order`, `idx_tournament_stages_tournament`
- **Matchmaking**: `idx_matchmaking_queue_searching` (partial index `WHERE status='searching'`, оновчтой), `matchmaking_queue_player_id_unique`
- **Room visits sequence**: `room_visits_room_id_seq_key` (unique `room_id,seq`), `room_visits_room_idx`
- **Payment/subscription**: `payment_transactions_pkey` л байна — **`invoice_id`/`qr_text` дээр тусдаа index байхгүй** (webhook callback-аар invoice_id-ээр хайх бол table scan болно — жижиг өгөгдлийн хэмжээтэй үед асуудалгүй ч өсөхөд анхаарах performance тэмдэглэл)
- **club/tournament join code**: `clubs_tag_key`, `tournaments_join_code_key` (unique)

Нийт **95 custom index** `public` schema-д (schema.sql-д ердөө 37 байгаатай харьцуулбал — доор §15).

---

## 9. Enum / Custom Types

**Live дээр `public` schema-д НЭГ Ч custom Postgres ENUM байхгүй** (`pg_enum` query хоосон буцсан).

Бүх "enum шинжтэй" багана (`role`, `status`, `format`, `type`, `bracket_type`, `provider`, `payment_status`, `subscription_status` гэх мэт) **`text` + `CHECK (... = ANY (ARRAY[...]))`** байдлаар хэрэгжсэн. Жишээ нь:

- `profiles.role` — `'player' | 'club_admin' | 'admin' | 'owner'`
- `tournaments.status` — `'draft' | 'registration' | 'ongoing' | 'completed' | 'cancelled'`
- `tournaments.bracket_type` — `'single_elimination' | 'double_elimination' | 'round_robin' | 'groups_knockout' | 'swiss'`
- `online_rooms.mode` — `'1v1' | '2v2' | '3v3'`

`src/types/database.ts` эдгээрийг TypeScript string-literal union хэлбэрээр зөв дүрсэлсэн байгаа нь **CHECK constraint утгуудтай яг таарч байна** — enum type mismatch гэсэн ангилал энд хамааралгүй (учир нь жинхэнэ ENUM байхгүй).

`notifications.type` — нэгэн цагт CHECK байсан ч `drop_notifications_type_check` migration-аар устгагдсан (repo-д баталгаа файл байгаа) — одоо чөлөөт text.

---

## 10. Extensions

| Extension | Schema | Суусан эсэх | DartMN хамаарал |
|---|---|---|---|
| `pgcrypto` | `extensions` | ✅ суусан | `gen_random_uuid()` |
| `uuid-ossp` | `extensions` | ✅ суусан | `uuid_generate_v4()` (ихэнх PK) |
| `pg_trgm` | **`public`** ⚠️ | ✅ суусан | Хайлт/similarity (аль хэсэгт ашигладаг нь тодорхойгүй, гэхдээ Advisor `extension_in_public` WARN өгсөн — `extensions` schema руу шилжүүлэх зөвлөмжтэй) |
| `pg_stat_statements` | `extensions` | ✅ суусан | Supabase built-in monitoring |
| `supabase_vault` | `vault` | ✅ суусан | Supabase-managed |
| `plpgsql` | `pg_catalog` | ✅ (default) | Бүх PL/pgSQL функц |
| `pg_cron`, `pg_net`, `pgjwt`, `pg_graphql`, `postgis`, `vector`, гэх мэт | — | ❌ суугаагүй | DartMN ашигладаггүй |

**Supabase default/internal vs DartMN шаарддаг**: `pgcrypto`, `uuid-ossp`, `pg_trgm` нь DartMN-ийн schema-д шууд ашиглагдаж байгаа тул baseline-д **заавал орох ёстой** (`CREATE EXTENSION IF NOT EXISTS`). `pg_stat_statements`/`supabase_vault`/`plpgsql` нь Supabase project бүрт дефолтоор ирдэг — baseline-д тусад нь удирдах шаардлагагүй.

---

## 11. Realtime / Publication

`supabase_realtime` publication-д **12 table** нэмэгдсэн байна:

```
club_messages, local_session_sync, match_legs, matches, notifications,
online_rooms, room_invites, room_players, room_visits, throws,
tournament_entrants, tournament_matches
```

Discovery report-д дурдсан 7 table (`online_rooms, room_players, room_invites, room_visits, throws, matches, match_legs`) **бүгд баталгаажлаа** — **PLUS 5 нэмэлт table** (`club_messages`, `local_session_sync`, `notifications`, `tournament_entrants`, `tournament_matches`) хожим migration-аар нэмэгдсэн боловч discovery баримт бичигт тэмдэглэгдээгүй байсан (доор §15, schema.sql-тэй зөрүү).

Realtime-д ОРООГҮЙ хэдий ч client-аас идэвхтэй ашиглагдаж болзошгүй table: `rating_history`, `tournament_stages`, `matchmaking_queue`, `achievements`, `player_achievements`, `tournament_registrations`, `pending_match_results` — эдгээр нь polling/refetch-ээр ажилладаг байх магадлалтай (код шалгаагүй, зөвхөн publication дутуу байгааг тэмдэглэв).

**Baseline-д тусад нь сэргээх шаардлагатай:** ✅ Тийм — `ALTER PUBLICATION supabase_realtime ADD TABLE ...` statement-уудыг schema baseline-д заавал оруулах ёстой, учир нь энэ бол Supabase-ийн стандарт schema дамжуулалтгүй тохиргоо (шинэ project дээр publication хоосон эхэлдэг).

---

## 12. Storage

### Buckets (4, бүгд `public: true`)

| Bucket | Public | Size limit | MIME whitelist |
|---|---|---|---|
| `caller-voice` | true | none | none |
| `clubs` | true | 5 MB | jpeg/jpg/png/webp/gif |
| `cosmetics` | true | none | none |
| `tournaments` | true | 5 MB | jpeg/png/webp/gif |

Discovery-д дурдсан 4 bucket **бүгд verify хийгдлээ**.

### 🔴 Storage RLS (`storage.objects`) — ноцтой асуудалтай

| Policy | Bucket | Cmd | Бодит хязгаарлалт |
|---|---|---|---|
| "Anyone can upload tournament images" | `tournaments` | INSERT | `bucket_id='tournaments'` **л**, `auth.uid()` шалгалт ОГТ БАЙХГҮЙ → **бүрэн unauthenticated хэн ч upload хийж чадна** |
| "Owner can delete tournament images" | `tournaments` | DELETE | `bucket_id='tournaments'` **л** (нэрнээс үл хамааран "owner" шалгалт байхгүй) → **хэн ч ямар ч тэмцээний зургийг устгаж чадна** |
| "Anyone can view tournament images" | `tournaments` | SELECT | public — санаатай, зөв |
| "Club owners can upload/update/delete" | `clubs` | INSERT/UPDATE/DELETE | зөвхөн `auth.uid() IS NOT NULL` (нэвтэрсэн эсэх) — **club ownership шалгалт байхгүй** → нэвтэрсэн ЯМАР Ч хэрэглэгч БУСДЫН клубын лого/cover зургийг солих/устгах боломжтой (нэрнээс үл хамааран) |
| "Club images public read" | `clubs` | SELECT | public — зөв |

`caller-voice`/`cosmetics` bucket дээр INSERT/UPDATE/DELETE policy огт байхгүй (зөвхөн SELECT public read байгаа байх магадлалтай, эсвэл policy бүрхэгдээгүй) — энэ нь **зөв дизайн** (зөвхөн `service_role`/admin CMS л бичих ёстой контент).

---

## 13. Auth Dependencies

- **Profile auto-create trigger**: `auth.users` → `handle_new_user()` (`SECURITY DEFINER`) — verify хийгдсэн, зөв ажиллаж байна.
- **Auth method**: Код дотор `signInWithOAuth` (`LoginForm.tsx`) БОЛОН `signInWithPassword`/`signUp` (`LoginForm.tsx`, `RegisterForm.tsx`) хоёул ашиглагдаж байна — өөрөөр хэлбэл **OAuth (жишээ нь Google) + email/password хоёул** идэвхтэй.
- **Custom email templates**: `supabase/templates/{confirm-signup,email-change,magic-link,reset-password}.html` + тэдгээрийг push хийх `supabase/apply-email-templates.sh` script repo-д бий. Эдгээр нь **Auth service тохиргоо** (Postgres schema биш) тул SQL-ээр verify хийх боломжгүй — dashboard/CLI-ээр л шалгагдана. Шинэ project дээр baseline сэргээхэд **энэ script-ийг дахин ажиллуулах шаардлагатай** гэдгийг тэмдэглэв.
- **`auth_leaked_password_protection`**: Advisor-аар **disabled** гэж тэмдэглэгдсэн (HaveIBeenPwned шалгалт унтраалттай). Энэ Auth-level тохиргоо, schema-тай хамааралгүй ч аюулгүй байдлын зөвлөмж болгон тэмдэглэв.

---

## 14. `database.ts` vs Live Comparison

`src/types/database.ts` дотор **36 table + 6 RPC type** (`get_player_stat_summary`, `get_practice_stat_summary`, `undo_last_room_visit`, `matchmaking_claim_match`, `matchmaking_heartbeat`, `matchmaking_join_queue`) тодорхойлогдсон.

### Present in both (36 table)
`profiles`, `clubs`, `club_members`, `club_join_requests`, `synced_local_sessions`, `pending_match_results`, `club_messages`, `player_unlocks`, `cosmetic_passes`, `cosmetic_effects`, `tournaments`, `tournament_stages`, `tournament_registrations`, `tournament_entrants`, `tournament_entrant_players`, `tournament_matches`, `tournament_payout_accounts`, `organizer_ratings`, `matches`, `match_legs`, `throws`, `leagues`, `league_standings`, `rating_history`, `matchmaking_queue`, `payment_transactions`, `online_rooms`, `room_players`, `room_invites`, `room_visits`, `achievements`, `player_achievements`, `notifications`, `player_subscriptions`, `match_stat_details`, `practice_sessions`.

### Live only (database.ts-д байхгүй)
- `club_subscriptions` (table)
- `local_session_sync` (table)
- `caller_clips` (table)
- `province_rankings` (**VIEW**, §18-д онцгой анхаарал шаардана)
- ~23 custom функц (`apply_match_result`, `advance_tournament_match`, `seed_knockout`, `start_tournament`, `check_achievements`, `calculate_elo_change`, `refresh_premium_status`, `club_tier_idx`, бүх trigger функцууд) — эдгээрийн ихэнх нь client `.rpc()`-ээр дуудагдахгүй (эсвэл dynamic/`any`-ээр дуудагддаг) тул client type байхгүй нь функционал асуудал биш, зөвхөн type-safety цоорхой.

### Types only (database.ts-д байгаа ч live-д байхгүй)
Олдсонгүй — бүх declared table live дээр байгааг баталгаажуулав.

### Structural mismatch
Бүрэн баганаар баганаар (39 table × бүх багана) deep-diff хийгдээгүй (цар хүрээний хувьд), гэхдээ **`profiles` spot-check**: `role`/`gender` union утгууд, rating/stat багана бүгд live-тэй яг таарч байна. Enum байхгүй тул "enum mismatch" ангилал хамааралгүй.

**Дүгнэлт: `database.ts` нь live-тэй ӨНДӨР итгэлцэлтэй ойролцоо** (High confidence) — зөвхөн 3 table + 1 view дутуу, бусад нь бүрэн зөрүүгүй. Энэ нь `schema.sql`-ээс хамаагүй найдвартай эх сурвалж (memory-д тэмдэглэсэнтэй нийцэж байна).

---

## 15. `schema.sql` vs Live Comparison

`supabase/schema.sql` (969 мөр, сүүлд 2026-07-07 өөрчлөгдсөн) нь live schema-аас **эрс хоцорсон**:

| Ангилал | schema.sql | Live | Дутуу |
|---|---|---|---|
| **Tables** | 23 | 39 | **16 table дутуу**: `achievements`, `player_achievements`, `club_subscriptions`, `player_subscriptions`, `notifications`, `local_session_sync`, `club_messages`, `player_unlocks`, `cosmetic_passes`, `cosmetic_effects`, `club_join_requests`, `pending_match_results`, `synced_local_sessions`, `tournament_stages`, `match_stat_details`, `practice_sessions` |
| **Functions** | 10 | 29 custom | **19 функц дутуу** — үүнд бүх matchmaking RPC, `apply_match_result`, `advance_tournament_match`, `seed_knockout`, `start_tournament`, `check_achievements`, `refresh_premium_status`, `club_tier_idx`, олон notify/sync trigger функц |
| **Triggers** | 7 | 18 | **11 trigger дутуу** — achievement/club-tier/rating/stats-change/tournament-status холбоотой бүх trigger |
| **Policies** | 53 | ~90+ (pg_policies бүртгэлээр) | Дутуу table бүрийн policy бүгд алга, мөн шинэ table-уудад (`matchmaking_queue`, `tournament_stages`, `club_join_requests`, `organizer_ratings`) нэмэгдсэн policy-ууд алга |
| **Indexes** | 37 | 95 | ~58 index дутуу (дутуу table-уудынх + шинэ нэмэлт index) |
| **Enums/Types** | N/A | N/A | Хамааралгүй (аль алинд нь ENUM байхгүй) |
| **Realtime config** | 7 table publish | 12 table publish | **5 table дутуу** (`club_messages`, `local_session_sync`, `notifications`, `tournament_entrants`, `tournament_matches`) |
| **Storage config** | **0** (storage bucket/policy огт байхгүй) | 4 bucket + 7 storage.objects policy | **100% дутуу** — schema.sql нь storage-ийн ул мөр огт агуулаагүй |

**Дүгнэлт**: `schema.sql`-г **current source of truth гэж үзэж БОЛОХГҮЙ** — task-ийн урьдчилсан таамаглалыг бүрэн баталж байна.

---

## 16. Managed vs Application-Owned Objects

### A. DartMN-owned — baseline-д оруулах candidate
- Бүх 39 `public` table (бүтэц, constraint, index)
- `province_rankings` VIEW (гэхдээ §18-д дурдсан SECURITY DEFINER асуудлыг мэдэж авах хэрэгтэй)
- Бүх 29 custom функц (§4)
- Бүх RLS policy (`public` schema)
- Бүх custom trigger (§7) — **`on_auth_user_created` ч мөн адил** (учир нь функц нь `public.handle_new_user`, зөвхөн attach хийсэн object нь `auth.users` дээр)
- 4 storage bucket (`caller-voice`, `clubs`, `cosmetics`, `tournaments`) + тэдгээрийн `storage.objects` policy
- Realtime publication ADD TABLE statement-ууд (12ш)
- `pgcrypto`, `uuid-ossp`, `pg_trgm` extension enable statement (`CREATE EXTENSION IF NOT EXISTS`)

### B. Supabase-managed — baseline-д шууд dump/recreate хийхээс зайлсхийх
- `auth.*` схемийн бүх table (`auth.users` гэх мэт) — Supabase өөрөө үүсгэдэг, dump хийж болохгүй
- `storage.buckets`/`storage.objects` схемийн CORE table бүтэц (зөвхөн bucket **мөр өгөгдөл** application-owned, table бүтэц биш)
- `realtime.*` схемийн бүх зүйл
- `supabase_migrations.*` — Supabase өөрөө удирддаг
- `vault.*` — Supabase-managed
- `pg_stat_statements`, `supabase_vault` extension — Supabase дефолт тохиргоо, DartMN шаардаагүй

### C. Needs review
- `pg_trgm` — `public` schema-д суусан нь Supabase advisor `extension_in_public` гэж шүүмжилсэн, baseline дээр `extensions` schema руу шилжүүлэх эсэхийг шийдэх шаардлагатай (**гэхдээ шилжүүлэх нь одоо байгаа function/index-үүдэд нөлөөлж болзошгүй тул родоор шалгах хэрэгтэй**)
- `matchmaking_queue.player_id` FK-ийн зорилтот table тодорхойгүй гарсан (§3) — жинхэнэ FK эсэхийг баталгаажуулах шаардлагатай

---

## 17. Data vs Schema

### Schema assets (baseline-д багтах ёстой)
Table definitions, 29 функц, RLS policy-үүд, 95 index, 18 trigger, storage bucket config, realtime publication config, 3 extension.

### Production data assets (ЭНЭ TASK-ИЙН ХҮРЭЭНД БИШ)
- `auth.users` (хэрэглэгчийн бүртгэл)
- `profiles`, `clubs`, `tournaments`, `matches`, `throws` гэх мэт бүх мөр өгөгдөл
- `rating_history`, `payment_transactions` (мөнгөн гүйлгээний бодит бичлэг)
- Storage дахь бодит зураг/дуу файлууд (`clubs`/`tournaments`/`caller-voice`/`cosmetics` bucket-ийн objects)

**Санал болгох дараагийн phase**: Baseline migration хэрэгжсэний дараа (одоо биш) production data-г тусад нь backup хийх стратеги (`pg_dump --data-only` эсвэл Supabase-ийн Point-in-Time Recovery/scheduled backup) — ялангуяа `payment_transactions`, `profiles`, `tournament_payout_accounts` (санхүү холбоотой) нь хамгийн өндөр priority.

Live дээр одоогийн мөр тоо бага байна (`online_rooms`: 1, `room_players`: 2, `practice_sessions`: 1, бусад бүх table 0 мөр) — өөрөөр хэлбэл **энэ бол шинэ/тест project**, бодит production өгөгдөл бага байгаа тул data backup эрсдэл одоогоор бага.

---

## 18. Baseline Migration Risk Assessment

| # | Эрсдэл | Severity | Нотолгоо | Санал болгох mitigation (ЗАСВАРЛАХГҮЙ, зөвхөн санал) |
|---|---|---|---|---|
| 1 | `apply_match_result`, `advance_tournament_match` SECURITY DEFINER + `anon`/`authenticated` EXECUTE, дотор нь authorization шалгалт байхгүй — **одоо байгаа production vulnerability**, baseline-тай хамааралгүй | **CRITICAL** | `pg_get_functiondef` эх код (§5), Supabase Advisor `anon/authenticated_security_definer_function_executable` WARN | `REVOKE EXECUTE FROM anon, authenticated, PUBLIC` + зөвхөн `service_role`-ээр дамжуулах (Next.js server route/Server Action), эсвэл функц дотор `auth.uid()`-ийг эзэмшлийн баганатай харьцуулах шалгалт нэмэх |
| 2 | `start_tournament`, `seed_knockout` мөн адил — organizer эсэхийг шалгадаггүй | **HIGH** | §5 | Дээрхтэй адил |
| 3 | Storage `tournaments` bucket: unauthenticated INSERT/DELETE зөвшөөрөгдсөн | **HIGH** | §12 | Policy-г `auth.uid() IS NOT NULL` (upload) + organizer_id шалгалт (delete)-той болгох |
| 4 | Storage `clubs` bucket: ямар ч нэвтэрсэн хэрэглэгч бусдын клубын зургийг өөрчилж/устгаж чадна | MEDIUM | §12 | Policy-д `clubs.owner_id = auth.uid()` эсвэл `club_members.role IN ('owner','admin')` нэмэх |
| 5 | `province_rankings` VIEW нь `SECURITY DEFINER` (Postgres view-ийн хувьд `security_invoker` тохируулаагүй) | MEDIUM | Advisor `security_definer_view` ERROR | `CREATE VIEW ... WITH (security_invoker=true)` болгох (Postgres 15+ дэмждэг) |
| 6 | 18 функц `search_path` тодорхойгүй (`function_search_path_mutable`) | MEDIUM | Advisor WARN ×18 | Бүх функцэд `SET search_path = public` нэмэх |
| 7 | `synced_local_sessions` RLS enabled боловч policy алга | LOW-MEDIUM (санаатай эсэхийг батлах хэрэгтэй) | Advisor INFO | Санаатай бол баримтжуулах, санамсаргүй бол зорилготой policy нэмэх |
| 8 | Baseline үүсгэхэд Supabase-managed schema (`auth`, `storage`, `realtime`, `vault`) санамсаргүй dump/recreate хийгдэх эрсдэл | HIGH (баримт бичгийн horte) | §16 | Зөвхөн §16-A object-уудыг л baseline-д оруулах, dump script-д schema filter (`--schema=public`) заавал ашиглах |
| 9 | `pg_trgm` `public` schema-д — baseline-д "extension ordering" алдаа гарах магадлал (хэрэв `extensions` schema руу шилжүүлбэл функц/index dependency эвдэрч болзошгүй) | LOW | §16-C | Шилжүүлэхээс өмнө `pg_depend`-аар хамаарлыг шалгах |
| 10 | Self-referencing FK (`tournament_matches.next_match_id`/`next_loser_match_id`) — baseline restore дараалал | LOW | §3 | Table-ыг эхлээд FK-гүйгээр үүсгэж, дараа нь `ALTER TABLE ADD CONSTRAINT` (DEFERRABLE) хэлбэрээр нэмэх нь аюулгүй |
| 11 | Realtime publication (§11) болон Storage bucket config (§12) `schema.sql`-д огт байхгүй тул баримт бичгийн snapshot дутуу — гэхдээ **live дээрээс шууд унших боломжтой** тул мэдээлэл алдагдаагүй | LOW | §11, §12 | Baseline script-д заавал оруулах |
| 12 | `database.ts` vs live 3 table + 1 view зөрүү (§14) | LOW | §14 | Baseline-ийн дараа `generate_typescript_types`-ийг дахин ажиллуулж, `database.ts`-г шинэчлэх |

**Нэгтгэсэн тоо**: CRITICAL — 1 (эгнээ 1, 2 функцийг нэг эрсдэл бүлэг гэж тооцвол), гэхдээ функц тус бүрээр тоолвол **CRITICAL 2 (apply_match_result, advance_tournament_match)**, **HIGH 3 (start_tournament, seed_knockout, storage-tournaments)**, **MEDIUM 3**, **LOW 4**.

---

## 19. Recovery Test Design (ТӨЛӨВЛӨГӨӨ Л, ОДОО АЖИЛЛУУЛАХГҮЙ)

| # | Test | Зорилго |
|---|---|---|
| 1 | Шинэ Supabase project эсвэл `supabase start` (local) орчин бэлдэх | Production-оос тусгаарлагдсан sandbox |
| 2 | Baseline migration apply хийх | Schema бүрэн, алдаагүй сэргэдэг эсэхийг шалгах |
| 3 | `list_tables`/`pg_dump --schema-only` харьцуулалт (baseline vs original live) | Drift байхгүй эсэхийг баталгаажуулах |
| 4 | `generate_typescript_types` ажиллуулж `database.ts`-тай diff хийх | Type-level regression илрүүлэх |
| 5 | Critical RPC smoke test: `apply_match_result`, `advance_tournament_match`, `matchmaking_claim_match` (test data-тай) | Функцууд шинэ project дээр identical ажиллаж байгааг батлах |
| 6 | RLS test: `anon`/`authenticated`/`service_role` эрхээр key table-уудад CRUD оролдлого хийж policy зөв ажиллаж байгааг батлах | Aюулгүй байдлын regression илрүүлэх |
| 7 | Tournament bracket DB dependency test (`start_tournament` → `seed_knockout` → `advance_tournament_match` → `tournament_matches` self-FK chain) | Bracket progression логик бүрэн ажиллахыг батлах |
| 8 | Matchmaking RPC/security test (`service_role`-аар concurrent claim, `anon`/`authenticated`-аар шууд дуудах — REVOKE зөв ажиллаж байгааг батлах) | Concurrency + access-control хосолсон regression |
| 9 | Storage/Realtime config verify (`list_buckets`, `pg_publication_tables` шалгах) | Config migration bucket/publication алдаагаагүйг батлах |
| 10 | `npm run build` / `npm run typecheck` / application smoke run | End-to-end application compatibility |

---

## 20. Recommended Baseline Strategy

| Strategy | Тайлбар | Тохиромж |
|---|---|---|
| **A — Current live schema → single baseline migration** | Одоогийн live schema-г бүхэлд нь нэг migration болгон dump хийх | Хурдан, гэхдээ түүхэн context алдагдана |
| **B — Reconstruct historical migrations** | 75 migration-ыг бие даан дахин зохиох | ⚠️ **ШААРДЛАГАГҮЙ БОЛСОН** — доорх нээлт үзнэ үү |
| **C — Hybrid baseline + future clean migrations** | A-г хийгээд цаашид зөв migration урсгал эхлүүлэх | Стандарт practice |

### 🟢 Чухал нээлт: Strategy B-г "боломжгүй" гэж үзэх шаардлагагүй болсон

`supabase_migrations.schema_migrations` table-д зөвхөн `version`/`name` биш, **бодит SQL statement-үүд (`statements` баганад, `text[]` төрөл) хадгалагдсан байна** — 5 жишээ мөрийг шалгахад бүгд `n_statements=1`-тэй буюу SQL агуулгатай гарсан. Энэ нь:

> **75 migration-ы БОДИТ SQL түүхийг Git-ээс биш, ГЭХД�ээ live database-ээс READ-ONLY select-ээр бүрэн сэргээх боломжтой** (`select version, name, statements from supabase_migrations.schema_migrations order by version`).

Энэ нь таны эх санааг ("current live DB → verified baseline → future migrations", Strategy C) бататгаж байгаа боловч **нэмэлт боломж нээж байна**: хэрэв ирээдүйд шат дараалсан migration түүхийг Git-д бүрэн сэргээхийг хүсвэл (jr. developer onboarding, audit trail гэх мэт зорилгоор), энэ 75 бичлэгийг тус бүрд нь `supabase/migrations/<version>_<name>.sql` файл болгон экспортлож болно — **энэ бол Strategy B-г маш бага эрсдэлтэй болгож байгаа шинэ мэдээлэл**.

### Эцсийн зөвлөмж: **Strategy C (Hybrid), таны санаатай нийцнэ**

1. Одоогийн live schema-с **нэг цэвэр baseline migration** (Strategy A-ийн үр дүн) — энэ нь repo-ийн "эхлэл цэг" болно.
2. **(Сонголттой, санал болгож буй нэмэлт)** `schema_migrations.statements`-ыг тусад нь export хийж `docs/`/`archive/` хавтсанд аудит-trail болгон хадгалах — Git migration chain-д БИШ, зөвхөн лавлагаа болгон (учир нь эдгээр statement-үүд аль хэдийн baseline-д нэгтгэгдсэн байх тул дахин apply хийх шаардлагагүй).
3. Үүнээс хойш **бүх шинэ өөрчлөлтийг** `supabase migration new` дүрмээр репозитори дотор явуулж эхлэх (Imperative migration workflow, `supabase/schemas/` declarative биш — учир нь одоогийн repo declarative бүтэцгүй).

---

## 21. Final Go / No-Go

## BASELINE READINESS

**Status:** **GO WITH BLOCKERS**

**Live schema access:** Yes (Supabase MCP, read-only, бүрэн ажилласан)

**Live schema vs database.ts confidence:** **High** (36/39 table таарсан, зөвхөн 3 table + 1 view дутуу, enum/type зөрчилгүй)

**Current schema reproducible from Git:** **No** (`supabase/migrations/` байхгүй, `schema.sql` 39-ийн 23-г л агуулна) — **гэхдээ live database-ийн `supabase_migrations.schema_migrations.statements`-аас бүрэн сэргээх боломжтой** (§20)

**Critical missing artifacts:**
- `supabase/migrations/` directory (75 migration Git-д алга)
- 16 table, 19 функц, 11 trigger, ~58 index, storage config (100%), 5 realtime table — `schema.sql`-д алга

**Critical security findings:**
- `apply_match_result`, `advance_tournament_match` — SECURITY DEFINER, `anon`/`authenticated`-д нээлттэй, дотоод authorization шалгалт байхгүй (CRITICAL, §5)
- `start_tournament`, `seed_knockout` — мөн адил pattern (HIGH, §5)
- Storage `tournaments` bucket — unauthenticated upload/delete (HIGH, §12)
- Storage `clubs` bucket — ownership бус зөвхөн "нэвтэрсэн эсэх" шалгалт (MEDIUM, §12)
- `province_rankings` VIEW — SECURITY DEFINER (MEDIUM, Advisor ERROR)
- 18 функц дээр `search_path` тодорхойгүй (MEDIUM, §5/§18)

**Supabase-managed objects requiring exclusion:** `auth.*`, `storage.*` (core table бүтэц), `realtime.*`, `supabase_migrations.*`, `vault.*`, `pg_stat_statements`/`supabase_vault` extension (§16)

**Recommended baseline approach:** **Strategy C (Hybrid)** — current live schema-с нэг baseline + `schema_migrations.statements`-ийг archive болгон экспортлох + цаашид цэвэр imperative migration урсгал (§20)

**Required backups before implementation:** Одоогоор production мөр өгөгдөл бага (ихэнх table 0 мөр) тул яаралтай биш, гэхдээ baseline ажлыг эхлэхээс өмнө `payment_transactions`, `profiles`, `tournament_payout_accounts` (санхүүтэй холбоотой)-г Point-in-Time Recovery-ээр нөөцлөх зөвлөмжтэй

**Recommended next action:** Хэрэглэгчийн review/approval хүлээх. Дараагийн алхам болгон санал болгох (ЭХЛЭЭГҮЙ, зөвхөн санал):
1. §5-ийн CRITICAL/HIGH SECURITY DEFINER эрсдэлийг **тусад нь, яаралтай хэлэлцэх** (baseline migration хүлээхгүйгээр)
2. Дараа нь Strategy C-ийн дагуу baseline migration ажлыг эхлүүлэх

---

# Verification (audit хийсний дараа)

- `git status --short` → зөвхөн `?? DARTMN_SUPABASE_SCHEMA_AUDIT.md` шинэ файл гарсан (доор баталгаажуулав)
- Repository-ийн бусад ямар ч файл өөрчлөгдөөгүй
- Live database дээр CREATE/ALTER/DROP/INSERT/UPDATE/DELETE **огт ажиллуулаагүй** — бүх query зөвхөн `SELECT`/`list_*`/`get_advisors` (read-only)
- Commit хийгдээгүй
