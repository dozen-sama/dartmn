# DartMN — Product / System Discovery Report

> Энэ баримт бичиг нь `/home/dozensama/Dev/darts` repository-г 2026-08-28 өдрийн байдлаар read-only судалж бэлтгэсэн иж бүрэн тайлан. Зорилго: бүтээгдэхүүний positioning, ОӨГ-т зохиогчийн эрхийн бүртгэл, барааны тэмдэг, лого/visual identity, roadmap боловсруулахад ашиглах эх сурвалж болгох. Техникийн нэр томьёо, file path, database table, function/component нэрийг эх English хэвээр үлдээв. Батлагдаагүй зүйлийг тус бүрд нь "Repository дээрээс баталгаажуулж чадсангүй" гэж тэмдэглэв.

---

## 1. Executive Summary

**DartMN гэж юу вэ?** DartMN бол Монгол улсын дартс тоглогчид, клубууд, тэмцээн зохион байгуулагчдад зориулсан цогц веб платформ. Хэрэглэгч энд тэмцээн зохион байгуулж, оролцож, онлайнаар бодит цагийн (real-time) дартс тоглож, өөрийн статистик/зэрэглэлээ хөтөлж, клуб байгуулж, дасгал хийж чаддаг.

**Ямар асуудлыг шийддэг вэ?** Монголд дартсны тэмцээнийг цаасан bracket, Excel, гар аргаар зохион байгуулдаг байсан цаг үеийг орлож, автомат bracket үүсгэлт (5 төрөл), онлайнаар шууд оноо бүртгэх, статистик/зэрэглэл автоматаар тооцоолох боломж олгодог. Мөн тоглогчид газарзүйн зайнаас үл хамааран онлайнаар бие биетэйгээ (video камер дагалдсан) тоглох боломжтой.

**Үндсэн хэрэглэгчид хэн бэ?** (1) Ганц бие тоглогч — статистик/зэрэглэлээ хөтөлж, дасгал хийж, онлайн тоглодог; (2) Тэмцээн зохион байгуулагч (клуб эсвэл хувь хүн) — local (auth шаардлагагүй) эсвэл online тэмцээн зохион байгуулдаг; (3) Клубын гишүүд/удирдлага; (4) Платформын admin (ганцхан хэрэглэгч, `role='admin'`).

**Хэрэглэгч юунд ашигладаг вэ?** Тэмцээн зохион байгуулах/оролцох, онлайн 1v1/2v2/3v3 тоглох (matchmaking-тэй), дасгал хийх (8 горим), статистик/зэрэглэлээ харах, клубтэй холбогдох, нэрний cosmetic (nameplate) өмссөн харагдах.

**Хамгийн гол 3–7 feature:**
1. Тэмцээний bracket engine (Single Elimination, Double Elimination, Round Robin, Groups+Knockout, Swiss)
2. Онлайн ELO-based matchmaking + бодит цагийн тоглолт (WebRTC камер дагалдсан)
3. X01 (501/301) оноо тооцоолол, checkout/bust дүрэм
4. Дэлгэрэнгүй статистик (average, 180, checkout%, first-9 average г.м.) болон ELO зэрэглэл/tier систем
5. Local (auth-гүй) тэмцээн систем — join-by-code-тай
6. AI камер-суурьт автомат оноо танигч (YOLO-суурьт)
7. Монгол хэлний дартс "дуут зарлагч" (voice caller)

**Энэ нь юу вэ?** Кодын гүн, комплекслэг байдлаар нь харвал DartMN нь дан ганц "tournament management system" биш, харин **darts-specific competition + scoring engine-ийг цөм болгосон, тоглогчийн identity/statistics давхарга дээр суурилсан цогц дартс экосистем** юм. Хамгийн их хөрөнгө оруулалт, кодын нарийвчлал bracket generation, X01 scoring, statistics, болон онлайн тоглолтын realtime/matchmaking давхаргад төвлөрсөн байна — энэ нь "generic tournament SaaS" биш, харин **darts спортын дүрэмд гүнзгий нийцсэн domain-specific engine** гэдгийг харуулж байна.

---

## 2. User Types / Roles

Кодоос бодитоор баталгаажсан role-ууд:

### Guest / Local тоглогч (auth шаардлагагүй)
- **Юу харж чаддаг:** `/local/*` бүх route — session үүсгэх, join хийх, тоглох.
- **Юу үүсгэж чаддаг:** Local тэмцээн (`local/new`), FFA тоглолт (`local/ffa/new`).
- **Юу засаж чаддаг:** Зөвхөн өөрийн үүсгэсэн session (`owned-sessions` нэртэй localStorage жагсаалтаар тодорхойлогддог — DB-суурьт ownership биш).
- **Workflow:** Session үүсгэх → password (сонголтоор) → тоглогчид нэмэх → bracket үүсгэх → тоглолт бүртгэх → үр дүн.
- Онцлог: ELO-д нөлөөгүй, `profiles.rating_points` хөндөгдөхгүй.

### Бүртгэлтэй тоглогч (`profiles.role = 'player'`)
- Профайл, статистик, зэрэглэл харах/засах, `/play/*` (online тоглолт, matchmaking, дасгал), тэмцээнд бүртгүүлэх, клубд элсэх.

### Клубын гишүүн/admin/owner (`club_members.role`)
- Тусдаа, платформ-даяар role-оос ялгаатай, клуб тус бүрт хамаарах эрхийн систем.
- `member` → клубын мэдээлэл, chat харах.
- `admin` (Орлогч, клуб бүрт дээд тал нь 3) → гишүүдийг удирдах (owner-оос бусад).
- `owner` (Удирдагч) → клуб үүсгэгч, бүх эрх, гишүүний role солих цорын ганц эрхтэй.

### Тэмцээн зохион байгуулагч
- Тусдаа persisted role биш — тэмцээн үүсгэсэн (`created_by`) хэрэглэгч бол `OrganizerPanel.tsx`-г хардаг: тэмцээн эхлүүлэх/дараагийн шат руу шилжүүлэх/дуусгах, бүртгэл удирдах, seed тохируулах, төлбөрийн данс удирдах.

### Платформын Admin (`profiles.role = 'admin'`)
- Ганцхан хэрэглэгч байдаг (memory-д баталгаажсан: dnt.tuguldurk). `/admin/*` бүх route: хэрэглэгч, тэмцээн, клуб, төлбөр, cosmetics, voice caller удирдлага. `requireAdmin()` server-side guard-аар хамгаалагдсан (`src/lib/auth/require-admin.ts`).
- **Анхаарах зүйл:** `profiles.role` баганад `club_admin`, `owner` гэсэн утга байдаг ч, платформ-даяар админ шалгалтад зөвхөн `'admin'` л ашиглагддаг — эдгээр утга нь **vestigial (хэрэглэгддэггүй)** харагдаж байна. `UserRoleSelect.tsx`-д зөвхөн `player`/`admin` хооронд л сонгох боломжтой.

---

## 3. Current Feature Inventory

### Authentication
- Email/password, Google OAuth. Password reset/forgot flow. Supabase Auth (`@supabase/ssr`) дээр суурилсан, `middleware.ts` байхгүй тул session шалгалт бүр route/server component дээр дангаараа хийгддэг.
- Route: `/login`, `/register`, `/forgot-password`, `/reset-password`, `auth/callback`.
- Status: **Production-ready**.

### Player profiles
- `/profile/[username]` — олон нийтэд харагдах профайл + статистик.
- `/settings/profile` — засах.
- Backend: `profiles` table.
- Status: **Production-ready**.

### Nameplate cosmetics
- `/settings/nameplate` — нэрний өнгө/фонт/animation/effect (Lottie-суурьт: fire, neon, rainbow, lightning г.м.) тохируулга.
- Component: `NamePlate.tsx`, `FireFrame.tsx`, `EffectsProvider.tsx`.
- Backend: `profiles` cosmetic баганууд, `cosmetic_passes`, `cosmetic_effects`, `player_unlocks`.
- Status: **Production-ready**.

### Tournament management
- `/tournaments`, `/tournaments/create`, `/tournaments/[id]`, `/tournaments/[id]/edit`, `/tournaments/new` (local/online сонголт).
- 5 bracket type: Single Elimination, Double Elimination, Round Robin, Groups+Knockout, Swiss. Play-in (клиг) систем bye-г орлоно.
- Backend: `tournaments`, `tournament_registrations`, `tournament_entrants`, `tournament_entrant_players`, `tournament_matches`, `tournament_stages`, `tournament_payout_accounts`, `organizer_ratings`. API: `src/app/api/tournaments/[id]/{start,next-round,finish,advance-knockout,advance-stage,...}`.
- Status: **Production-ready**, маш идэвхтэй хөгжүүлэгдэж буй хэсэг (git log-оор хамгийн олон commit-той).

### Match management / Scoring
- Local: `Scoreboard.tsx` (`/local/[sessionId]/match/[matchId]`). Online: `OnlineRoom.tsx` (`/play/[roomId]`).
- Backend: `matches`, `match_legs`, `throws`, `online_rooms`, `room_players`, `room_visits` (event-sourced лог).
- Status: **Production-ready**.

### Ranking / Rating (ELO)
- `/ratings` — leaderboard. `profiles.rating_points`, `rating_history` (audit trail).
- 7 Монгол нэртэй tier (Залуу→Дархан), "Аврага" (Champion) цол систем.
- Status: **Production-ready**.

### Statistics
- `/stats` — хувийн дэлгэрэнгүй статистик (`get_player_stat_summary` RPC).
- Backend: `match_stat_details` (per-match), `profiles` incremental баганууд (`career_points`, `count_180` г.м.).
- Status: **Production-ready**.

### League
- `/leagues`, `/leagues/create`, `/leagues/[id]`.
- Backend: `leagues`, `league_standings`.
- Status: Функциональ бүрэн харагдана, гэхдээ бусад module-той харьцуулбал нарийн шалгагдаагүй.

### Clubs
- `/clubs`, `/clubs/create`, `/clubs/[id]` (chat, roster, requests), `/clubs/[id]/edit`, `/clubs/[id]/showcase`.
- Backend: `clubs`, `club_members`, `club_join_requests`, `club_messages`.
- Status: **Production-ready**, гэхдээ дотор нь "Club War" tab **placeholder** ("🚧 Онлайн тоглолт нэвтэрсний дараа идэвхжинэ" гэсэн "Тун удахгүй" badge-тай).

### Teams
- Тусдаа persisted `teams` table байхгүй — багийн тоглолт `team`/`slot` баганаар `room_players`, `tournament_entrant_players` дотор ad-hoc загварчлагдсан.
- Status: **Partial** (persistent team identity байхгүй, зөвхөн тоглолт бүрийн хүрээнд).

### Live results / Brackets
- `MatchLiveView.tsx` (fullscreen), `useLiveTournament.ts`, `useTournamentBracket.ts` — Supabase Realtime-аар шууд шинэчлэгддэг bracket харагдац.
- Status: **Production-ready**.

### Notifications
- `NotificationPanel.tsx`, `notifications` table, per-user Realtime channel.
- Status: **Partial/цөөвтөр** — зөвхөн in-app, push notification байхгүй.

### Admin
- `/admin` (dashboard), `/admin/users`, `/admin/tournaments`, `/admin/clubs`, `/admin/payments`, `/admin/cosmetics`, `/admin/caller`.
- Status: **Production-ready**.

### Search
- Тусдаа site-wide search feature **олдсонгүй** (клуб хайлт `admin/clubs`-д байгаа боловч энэ нь admin-only).

### Public pages
- `/` (redirect), `/pricing`, `/pricing/checkout`.
- Status: Root бол зөвхөн redirect (техникийн marketing landing page байхгүй).

### Payments
- QPay, Byl.mn (webhook-тэй), Bonum (гэрээ хүлээгдэж буй тул 503 буцаадаг — **Partial/pending**). `SOCIALPAY_*` env бий ч API route алга (**Missing/planned**).
- Backend: `payment_transactions`, `player_subscriptions`.
- Status: QPay/Byl — **Production-ready**; Bonum — **Partial (config хүлээгдэж буй)**.

### Social/community
- Клубын chat (`ClubChat.tsx`) байгаа боловч ерөнхий community/feed feature (friends, feed, comments) **олдсонгүй**.
- Status: **Partial**.

### Media (Камер/дуут зарлагч)
- **Камер:** зум, ар/урд сэлгэх, dual камер (WebRTC compositing), PiP (online тоглолтод). AI автомат оноо танигч (`/play/camera` — YOLOv8n ONNX модел, идэвхтэй ажиллаж буй).
- **Voice caller:** Монгол дартс "зарлагч" — админ upload хийсэн аудио клип эсвэл Web Speech API TTS.
- Status: Камер зум/сэлгэх/PiP — **Production-ready**; AI auto-scoring — **идэвхтэй боловч экспериментал шинжтэй** (моделийн нарийвчлал/production maturity баталгаажаагүй).

### Other — Practice / Дасгал
- `/play/practice` — 8 горим (Solo501, Checkout121, CheckoutDrill, ScoringDrill, AroundTheBoard, Bobs27, CricketPractice, Shanghai), хувийн дэвшил tracking (`PracticeProgressDashboard.tsx`).
- Backend: `practice_sessions`.
- Status: **Production-ready**.

### Other — Achievements
- `src/components/achievements/`, `achievements`/`player_achievements` table, `check_achievements` RPC.
- Status: Байгаа боловч энэ судалгаанд гүнзгий шалгагдаагүй — **баталгаажуулж чадсангүй** дэлгэрэнгүй.

---

## 4. Main User Flows

### Тэмцээн зохион байгуулагч (Online tournament)
`/tournaments/new` → local/online сонгох → `/tournaments/create` (формат, bracket type, оролцооны хураамж, шагналын сан, клубтэй холбох) → бүртгэл нээгдэх → тоглогчид бүртгүүлэх → organizer seed/play-in тохируулах → `start` API bracket үүсгэх → тоглолт бүрийг online room-оор тоглох эсвэл гараар үр дүн оруулах → `advance-knockout`/`next-round`/`advance-stage` → `finish` → ranking/statistics шинэчлэгдэх.

### Тоглогч (Online тоглолт)
`/register` → `/dashboard` → `/play` (lobby, `PlayLobby.tsx`) → matchmaking queue-д орох (`matchmaking/join`, ELO±300 цонх) эсвэл шууд room үүсгэх → `/play/[roomId]` (`OnlineRoom.tsx`): bull-off → ready → ээлжээр шидэх (`turn`/`undo`) → форфейт/decide/claim → тоглолт дуусах (`finishOnlineRoom`) → ELO шинэчлэгдэх, статистик бичигдэх (`apply_match_result` RPC) → `/profile/[username]`, `/stats`, `/ratings` дээр харагдана.

### Тоглогч (Local, auth-гүй)
`/local` → `/local/new` (`SetupWizard.tsx`: формат, bracket type, тоглогчид) → session үүсгэгдэх (localStorage) → `/local/[sessionId]` → тоглолт бүрийг `Scoreboard.tsx`-аар бүртгэх → bracket автоматаар дараагийн раунд руу шилжих → session-г сонголтоор `local/sync` API-аар Supabase рүү синк хийж join-code-оор бусдад нээх боломжтой.

### Дасгал (Practice)
`/play/practice` → горим сонгох (жишээ нь `Checkout121`) → тоглох → `practice_sessions`-д бичигдэх → `PracticeProgressDashboard.tsx` дээр хувийн дэвшил харагдана. Энэ бол leaderboard/стат pipeline-д ордоггүй, зөвхөн хувийн track.

---

## 5. Tournament / Competition Model

DartMN-ийн тэмцээний өгөгдлийн загвар дараах ойлголтуудыг агуулна — **бүгд repository дээр баталгаажсан**:

- **Tournament** — `tournaments` table: формат (501/301), төрөл (singles/doubles/team), `bracket_type` (single_elimination / double_elimination / round_robin / groups_knockout / swiss), оролцооны хураамж, шагналын сан, зохион байгуулагчийн банкны мэдээлэл (Phase 3, off-platform payout), `platform_fee_paid`.
- **Registration/Entry** — `tournament_registrations` (бүртгэл) → `tournament_entrants` + `tournament_entrant_players` (bracket дэх бодит "слот", баг тоглогчдыг дэмждэг).
- **Bracket/Match** — `tournament_matches`: `next_match_id`/`next_loser_match_id` DEFERRABLE FK-ээр bracket-ийг нэг INSERT-д бүхэлд нь бүтээх боломжтой.
- **Seeding** — `standings.ts:seedPositions` — recursive seeding algorithm (доор 11-р хэсэгт дэлгэрэнгүй).
- **Group stage** — `generateGroupsKnockout`, group доторх round-robin, дараа нь knockout-руу шилжих.
- **Knockout** — Single/Double elimination.
- **Round robin** — `generateRoundRobin` (circle/rotation алгоритм).
- **Swiss** — `generateSwissRound1`/`generateSwissNextRound` (backtracking pairing).
- **Play-in (клиг)** — оролцогчийн тоо 2-ын зэрэг биш үед bye-ийн оронд бодит клиг тоглолт зохион байгуулах (`play-in.ts`).
- **Multi-stage** — тэмцээн олон шаттай байж болно (жишээ нь Group → Knockout, эсвэл RR → Semifinal → Final), `tournament_stages` table, `stage-advance.ts` orchestration.
- **Leg/Set** — X01 тоглолтын дотоод бүтэц (доор 6-р хэсэгт).
- **Ranking points** — тэмцээний оноо биш, харин ELO (`profiles.rating_points`) л тоглолтын үр дүнгээс шууд шинэчлэгддэг; тэмцээний зэрэглэлийн онооны тусдаа систем **олдсонгүй** ("Аврага" цол л 32+ тоглогчтой тэмцээний ялалтад суурилдаг).
- **Tournament status** — `upcoming/ongoing/completed` төлөв (leagues-д ч мөн адил ажиглагдсан).

---

## 6. Darts-specific Logic

Энэ хэсэг нь DartMN-ийг ерөнхий "tournament website"-ээс ялгах хамгийн чухал давхарга.

- **501 / 301 (X01)** — `x01LegsConfig()` нь `best_of`/`legs_per_set` DB талбаруудыг "эхэлж N хүрэх" (first-to-N) семантик болгон хөрвүүлдэг (`Math.ceil(x/2)`).
- **Legs / Sets** — `deriveX01()` (`src/lib/local-game/x01.ts`) нь legs (set бүрд шинэчлэгддэг) болон sets (хуримтлагдсан) массивыг тусад нь хөтөлдөг.
- **Checkout (double-out)** — `canDoubleOut()`, боломжгүй double-out үлдэгдлийн бүрэн жагсаалт (`IMPOSSIBLE_CHECKOUTS`: 169,168,166,165,163,162,159) кодлогдсон. 2–170 хүртэлх checkout санал болгох бүрэн хүснэгт (`CHECKOUTS`) хатуу кодлогдсон.
- **Average / First-9 average** — `match-stat-details.ts:computeMatchStatDetails()` дотор тооцоологддог.
- **180 (max)** — score band тооллого (`count_180`, band 60/80/100/120/140/170/180).
- **High checkout** — тоглолт бүрийн хамгийн өндөр checkout хадгалагдана (`highest_checkout`).
- **Double percentage / checkout-keep-break %** — checkout/keep(өөрийн эхний ээлжийг хамгаалсан)/break(өрсөлдөгчийн эхний ээлжийг эвдсэн) attempt-vs-make хувь тооцоолол.
- **Bust дүрэм** — `classifyTurn()` (`src/lib/local-game/checkouts.ts`): 0-ээс доош унасан (overthrow) бол bust; double-out идэвхтэй үед checkout боломжгүй тооноос яг 0-д хүрвэл bust; 1 үлдэх нь double-out дээр үргэлж bust (доод double нь D1=2); нэмэлт "requireBullFinish" (яг 25/50-д дуусах ёстой) дүрэм.
- **Darts thrown** — leg/match-ийн турш шидсэн сумны тоо тооцоологддог (checkout attempt eligibility тооцоолол дотор).
- **Throw order / Bull-off** — тэнцүү эхлэх эрхийг тодруулах бодит bull-off процедур (`play/room/[id]/bulloff` API): төлөөлөгч тус бүр шидэж, өндөр оноо гаргасан нь эхэлнэ, тэнцвэл дахин шидэнэ.
- **Handicap систем** — **репозиторид олдсонгүй** (шууд хайлтаар ч 0 тохирол).
- **Match statistics** — leg/match бүрийн дэлгэрэнгүй бичлэг (`match_stat_details`), best/worst leg (сумны тоогоор).
- **Forfeit/walkover** — форфейт хийсэн тоглогчийн эсрэг талд leg/set тоог ялалтын босго хүртэл албадан бичих (стандинг тооцооллын тууштай байдлыг хадгалахын тулд, кодын comment-д тодорхой дурдсан).

---

## 7. Statistics & Rankings

**Write-time vs read-time:**
- **Write-time (тоглолт дуусахад бичигддэг):** `match_stat_details` (тоглолт бүрийн дэлгэрэнгүй, `computeMatchStatDetails()`-ээр тооцоологдож upsert хийгддэг), `profiles`-ийн incremental баганууд (`average_score`, `career_points`, `career_darts`, `count_180`, `highest_checkout`, `matches_played`, `matches_won` — `applyMatchResult()`-ээр `apply_match_result` RPC-ээр атомаар шинэчлэгддэг), `rating_history` (ELO audit trail).
- **Read-time (харах үед тооцоологддог):** Career нийлбэр статистик `get_player_stat_summary(player_id)` Postgres функцээр `match_stat_details`-ийн бүх мөрөөс `SUM`/`AVG` хийгдэж гаргагддаг.
- **Practice статистик** тусдаа (`practice_sessions`, `practice-stats.ts`) — leaderboard/match статистикт **орохгүй**.

**ELO/rating:**
- `calculateEloChange(playerRating, opponentRating, won, k=32)` — стандарт ELO томьёо.
- Багийн тоглолтод (2v2/3v3) тоглогч бүр **өрсөлдөгч багийн дундаж рейтингийн эсрэг** ELO өөрчлөлт тооцдог — энэ бол стандарт 1v1 ELO-ийн custom өргөтгөл.
- **Tier систем:** 7 Монгол нэртэй зэрэглэл (Залуу/Начин/Харцага/Заан/Гарьд/Арслан/Дархан), дараагийн зэрэглэл хүртэлх дэвшлийн хувь тооцоолол.
- **"Аврага" (Champion) цол:** ELO-оос тусдаа, 32+ тоглогчтой тэмцээнд хуримтлуулсан ялалтад суурилсан.
- **Leaderboard:** `/ratings` — `profiles.rating_points`-оор эрэмбэлсэн энгийн харагдац.

---

## 8. Database Architecture

**Гол entity relationship:**

```
auth.users (Supabase Auth)
  → profiles (1:1, trigger-ээр авто үүсдэг)
      → rating_history (ELO лог)
      → match_stat_details (match бүрийн стат)
      → player_achievements, player_unlocks

clubs
  → club_members (role: owner/admin/member)
  → club_join_requests, club_messages

tournaments
  → tournament_registrations
  → tournament_entrants → tournament_entrant_players
  → tournament_matches (next_match_id/next_loser_match_id-ээр bracket холбогдоно)
  → tournament_stages (олон шаттай тэмцээн)
  → tournament_payout_accounts, organizer_ratings

online_rooms (real-time тоглолт)
  → room_players, room_invites
  → room_visits (event-sourced, append-only лог)

matches → match_legs → throws (per-dart түвшний бүтэц, local/offline-д илүү хэрэглэгддэг)

matchmaking_queue (ELO-суурьт)
payment_transactions, player_subscriptions
notifications, achievements
practice_sessions, pending_match_results, synced_local_sessions
cosmetics / cosmetic_effects / cosmetic_passes
caller_clips
leagues → league_standings
```

- **Auth model:** Supabase Auth (`auth.users`), `handle_new_user()` trigger-ээр `profiles` мөр авто үүснэ.
- **Ownership:** ихэнх table-д `owner`/`created_by`/`player_id` багана дамжуулан RLS policy-оор хамгаалагддаг.
- **Roles:** дээрх 2-р хэсэгт дурдсан 2 тусдаа систем (`profiles.role`, `club_members.role`).
- **RLS/security:** `schema.sql`-д 53 `CREATE POLICY` — стандарт хэв маяг: нийтэд SELECT нээлттэй, `auth.uid() = owner_column` бол л бичих боломжтой. `matchmaking_claim_match`, `matchmaking_heartbeat`, `matchmaking_join_queue`, `undo_last_room_visit` зэрэг `SECURITY DEFINER` функцийн `EXECUTE` эрхийг зөвхөн `service_role`-д олгож, `PUBLIC`/`anon`/`authenticated`-аас **тусгайлан хассан** — учир нь эдгээр функц нь дурын `p_player_id`-г хүлээн авдаг тул client шууд дуудвал эрх зөрчигдөнө. Ижил шалтгаанаар `online_rooms`/`room_players`-ийн зарим client-writable UPDATE/INSERT policy-г тусгайлан устгаж, бүх room mutation-ыг service-role API route-оор л зөвшөөрдөг болгосон (commit лог-д тэмдэглэгдсэн ноцтой засвар).
- **Audit/history:** `rating_history` (ELO өөрчлөлтийн бүрэн лог), `organizer_ratings`, `room_visits` (event-sourced, sequence дугаартай, live match state-ийг undo/дахин угсрах боломжтой).
- **Soft delete:** **олдсонгүй** — `deleted_at`/`is_deleted` багана хаана ч байхгүй; устгалт бүгд hard-delete (`ON DELETE CASCADE`/`SET NULL`).
- **⚠️ Schema drift (чухал анхааруулга):** `supabase/schema.sql` (969 мөр, сүүлд 2026-07-07 засварласан) нь **хуучирсан/дутуу**. `supabase/migrations/` directory **огт байхгүй**. `src/types/database.ts`-тай харьцуулахад 15+ table (`achievements`, `notifications`, `practice_sessions`, `club_join_requests`, `club_messages`, `synced_local_sessions`, `pending_match_results`, `player_unlocks`, `cosmetic_passes`, `cosmetic_effects`, `tournament_stages` г.м.) schema.sql-д алга. Энэ нь бодит schema өөрчлөлт нь live Supabase project дээр шууд (SQL editor/MCP-ээр) хийгдэж, git version control-д бүрэн track хийгдээгүй гэсэн үг — **schema-ийн түүх/rollback боломж git-ээс сэргээгдэхгүй**.

---

## 9. Technical Architecture

- **Frontend:** Next.js **16.2.7** (App Router), React 19.2.4, TypeScript, Tailwind CSS v4 (CSS-native `@theme inline` тохиргоо, `tailwind.config.*` файл байхгүй), Zustand (local game state), shadcn/ui (Base UI — `@base-ui/react`, Radix биш).
- **Backend:** Next.js API routes (`src/app/api/`) + Postgres RPC функцууд (SECURITY DEFINER, service-role admin client-ээр дуудагддаг). `middleware.ts` **байхгүй** — session шалгалт бүр page/route-ийн дотор дангаараа хийгддэг.
- **Database:** Supabase (Postgres), RLS идэвхтэй.
- **Authentication:** Supabase Auth (email/password + Google OAuth), `@supabase/ssr` cookie-суурьт.
- **Hosting:** Vercel гэж таамаглаж болохоор шинж тэмдэг бий (`x-forwarded-host` OAuth callback fix), гэхдээ **Repository дээрээс баталгаажуулж чадсангүй**.
- **Storage:** Supabase Storage — `caller-voice`, `cosmetics`, `tournaments`, `clubs` гэсэн 4 bucket баталгаажсан.
- **Realtime:** Supabase Realtime — `online_rooms`, `room_players`, `room_invites`, `room_visits`, `throws`, `matches`, `match_legs` publication-д нэмэгдсэн; 10 файлд client-side subscription (live scoreboard, matchmaking, bracket, club chat, notification, **WebRTC signaling transport болгож ч ашигласан**).
- **External APIs / Payment:** QPay, Byl.mn (HMAC-SHA256 webhook баталгаажуулалт, `crypto.timingSafeEqual`), Bonum (HMAC-signed, гэрээ хүлээгдэж буй).
- **Email:** тусдаа transactional email SDK байхгүй — Supabase Auth-ийн built-in mailer, custom HTML template (`supabase/templates/`).
- **Notifications:** зөвхөн in-app (push notification/FCM/web-push байхгүй).
- **Analytics:** **олдсонгүй** (PostHog/Segment/GA/Vercel Analytics dependency алга).
- **Computer vision / ML:** `onnxruntime-web` — YOLOv8n ONNX модел (`public/models/dart.onnx`) client-side (WebGPU/WASM) ажиллаж дартсны үзүүрийг таньдаг.
- **WebRTC:** p2p video (ар/урд камерын canvas compositing), Google public STUN, **Supabase Realtime-ийг өөрөө signaling транспорт болгож ашигласан** (тусдаа signaling server байхгүй).
- **Voice:** Web Speech API (TTS fallback), Монгол-Орос хэлний voice сонголт; синтезийн загвар биш, rule-based NLG.

**Ерөнхий flow:**
```
Browser (Next.js Client Components, Zustand local state)
  → Server Components / API Routes (Next.js, admin client)
      → Postgres RPC (SECURITY DEFINER, service_role)
      → Supabase (Postgres + RLS + Realtime + Storage + Auth)
  ↘ WebRTC p2p (video, Realtime-аар signal солилцоно)
  ↘ Client-side ONNX inference (камерын dart detection)
```

---

## 10. Routes / Screens

### Public / Auth
| Route | Screen | Зорилго |
|---|---|---|
| `/` | Redirect | Нэвтэрсэн бол `/dashboard`, үгүй бол `/login` |
| `/login` | Нэвтрэх | Email/password, Google OAuth |
| `/register` | Бүртгүүлэх | Шинэ хэрэглэгч |
| `/forgot-password`, `/reset-password` | Нууц үг сэргээх | |
| `/pricing`, `/pricing/checkout` | Үнийн санал | Premium subscription tier |

### Player-facing
| Route | Screen | Зорилго |
|---|---|---|
| `/dashboard` | Нүүр хуудас | Хувийн хяналтын самбар |
| `/profile/[username]` | Профайл | Тоглогчийн нээлттэй профайл+статистик |
| `/settings/profile`, `/settings/nameplate` | Тохиргоо | Профайл засах, cosmetic |
| `/stats` | Статистик | Дэлгэрэнгүй хувийн стат |
| `/ratings` | Зэрэглэл | ELO leaderboard |
| `/calendar` | Хуанли | Ирэх тэмцээн/эвент |
| `/clubs`, `/clubs/create`, `/clubs/[id]`, `/clubs/[id]/edit`, `/clubs/[id]/showcase` | Клуб | Клубын жагсаалт/дэлгэрэнгүй/удирдлага |
| `/leagues`, `/leagues/create`, `/leagues/[id]` | Лиг | Лигийн жагсаалт/дэлгэрэнгүй |
| `/tournaments`, `/create`, `/new`, `/[id]`, `/[id]/edit` | Тэмцээн | Тэмцээн үүсгэх/удирдах/харах |
| `/play` | Онлайн лобби | Идэвхтэй room жагсаалт |
| `/play/[roomId]` | Онлайн тоглолт | Бодит цагийн scoreboard |
| `/play/together` | Хамтдаа тоглох | Ганц төхөөрөмж дээр 2 тоглогч |
| `/play/practice`, `/play/practice/modes/*`, `/play/practice/progress` | Дасгал | 8 горим + дэвшил |
| `/play/camera` | AI камер оноо | ONNX-суурьт автомат таних |
| `/play/confirm/[id]` | Үр дүн баталгаажуулах | Opponent confirm flow |
| `/local`, `/local/new`, `/local/join/[code]`, `/local/[sessionId]`, `/local/[sessionId]/match/[matchId]`, `/local/ffa/*` | Local тэмцээн | Auth-гүй тэмцээн/FFA систем |

### Admin / Internal (бүгд `requireAdmin()`-ээр хамгаалагдсан)
| Route | Screen |
|---|---|
| `/admin` | Хяналтын самбар (хэрэглэгч, тэмцээн, орлого) |
| `/admin/users`, `/admin/users/[id]` | Хэрэглэгч удирдлага, role оноох |
| `/admin/tournaments` | Тэмцээний хяналт |
| `/admin/clubs` | Клубын хяналт |
| `/admin/payments` | Гүйлгээний лог |
| `/admin/cosmetics` | Cosmetic pass/effect удирдлага |
| `/admin/caller` | Voice caller аудио клип удирдлага |

### API (`src/app/api/`)
`admin/*`, `clubs/*`, `cosmetics/*`, `local/*`, `matchmaking/*`, `payments/{qpay,byl,byl/webhook,bonum}`, `play/*` (room lifecycle: join/ready/bulloff/turn/undo/decide/forfeit/leave/invite/confirm-result/together-record), `subscriptions/activate`, `tournaments/[id]/*` (start/advance-knockout/advance-stage/next-round/finish/bracket assign).

---

## 11. Unique / Potentially Protectable Work

> Энэ хэсэгт хуулийн дүгнэлт өгөхгүй — зөвхөн repository дээрх өөрсдийн бүтээсэн, DartMN-д онцлог software asset-уудыг баримтжуулна.

### Asset 1 — Tournament / Bracket Engine (цөм orchestration давхарга)
- **Purpose:** 5 өөр bracket төрлийг (SE/DE/RR/Groups+Knockout/Swiss) нэг нэгдсэн интерфэйсээр үүсгэж, тоглогчийн урсгал (winner/loser progression)-ыг удирддаг.
- **Main algorithm/logic:** Generator функцүүд (`generateSingleElimination`, `generateDoubleElimination`, `generateRoundRobin`, `generateGroupsKnockout`, `generateSwissRound1/NextRound`) + тэдгээрийг DB мөр рүү хөрвүүлэгч давхарга.
- **Related files:** `src/lib/local-game/bracket.ts` (447 мөр), `src/lib/tournament/bracket-server.ts` (397 мөр), `src/lib/tournament/standings.ts`, `src/lib/tournament/play-in.ts`.
- **Related DB/RPC:** `tournament_matches` (self-referencing `next_match_id`/`next_loser_match_id` DEFERRABLE FK), `advance_tournament_match`, `seed_knockout` RPC-ууд.
- **Why non-trivial:** 5 өөр bracket топологи, play-in, олон шат хоорондын шилжилтийг нэг нэгдсэн загвараар зохицуулдаг — энгийн CRUD tournament систем биш, бодит tournament theory-г кодчилсон.
- **Complexity:** Very High.
- **Reusability outside DartMN:** Өндөр — bracket engine нь спорт-агностик (аль ч 1v1/team тэмцээнд ашиглаж болно), гэхдээ leg/set/X01-тэй нягт холбогдсон хэсгүүд нь darts-специфик.
- **Dart-specific:** Хэсэгчлэн (bracket topology биш, гэхдээ X01 leg/set-тэй холбогдсон интеграц тийм).
- **Mongolia-specific:** Үгүй.

### Asset 2 — Recursive Seeding Algorithm
- **Purpose:** Bracket дэх тоглогчдын байрлалыг (1 vs хамгийн бага seed г.м.) эрт шатанд дээд seed хоорондоо мөргөлдөхөөс сэргийлж эрэмбэлэх.
- **Main algorithm:** `sum - p` reflection-г давтан ашигласан recursive seeding order үүсгэлт.
- **Related files:** `src/lib/tournament/standings.ts` (`seedPositions`), мөн group→knockout шилжихэд ашиглагддаг `seedKnockout` (group-ийн байр эрэмбээр interleave хийдэг).
- **Related DB/RPC:** `seed_knockout` RPC (schema.sql-д дурдагдсан, migration-аар live дээр орсон).
- **Why non-trivial:** Стандарт tournament seeding алгоритм боловч зөв хэрэгжүүлэлт нь rekursив логик, edge case (тэгш бус тоо, group-ээс knockout-руу орох)-той нарийн зохицсон.
- **Complexity:** Medium.
- **Reusability outside DartMN:** Өндөр — ямар ч tournament системд ашиглагдана.
- **Dart-specific:** Үгүй.
- **Mongolia-specific:** Үгүй.

### Asset 3 — Double-Elimination Losers-Bracket Logic
- **Purpose:** Winners Bracket, Losers Bracket, Grand Final гурвыг зөв дарааллаар, play-in-ийн ялагдагчдыг ч зөв холбож удирдах.
- **Main algorithm:** WB round 1..k, LB round 100+1..100+2(k-1) (minor/major round ээлжлэн), Grand Final round 200; play-in-ийн 0/1/2 ялагдагчийг нэгтгэх **synthetic "insertion match"** (round=-1 sentinel) — 3 тохиолдлыг тусад нь боддог логик.
- **Related files:** `src/lib/local-game/bracket.ts` (`generateDoubleElimination`, `isDoubleEliminationEligible`).
- **Related DB/RPC:** `bracket-server.ts`-ийн мөн адил серверийн хувилбар; `advance_tournament_match` RPC.
- **Why non-trivial:** "Хоёр удаа ялагдвал хасагдана" гэсэн DE-ийн семантикийг play-in шат нэмэгдэхэд ч зөрчилгүй хадгалах нь нэлээд ховор, нарийн боловсруулсан edge-case логик (кодын comment-д тодорхой тайлбарласан).
- **Complexity:** Very High.
- **Reusability outside DartMN:** Дунд-Өндөр — DE bracket ямар ч тэмцээнд хэрэгтэй, гэхдээ play-in нэгтгэл нь харьцангуй ховор feature.
- **Dart-specific:** Үгүй.
- **Mongolia-specific:** Үгүй.

### Asset 4 — Play-in (Клиг) Logic
- **Purpose:** Оролцогчийн тоо 2-ын зэрэг биш үед bye олгохын оронд доод seed-үүдийг бодит клиг тоглолтоор өрсөлдүүлж, аль болох олон тоглогчид бодит эхлэлт олгох.
- **Main algorithm:** `targetSize` (2-ын зэрэг ≤N), `excess = N - targetSize`, доод `excess*2` seed-ийг клиг тоглолт болгож хослуулах.
- **Related files:** `src/lib/tournament/play-in.ts` (`computePlayInPlan`).
- **Related DB/RPC:** Bracket үүсгэлтийн route-уудад нэгтгэгдсэн.
- **Why non-trivial:** Стандарт bye систем биш, ялгаатай fairness-ийн шийдэл — доод seed-үүдэд илүү тэгш боломж олгох custom дизайн шийдвэр.
- **Complexity:** High.
- **Reusability outside DartMN:** Өндөр — ямар ч knockout тэмцээнд хэрэглэгдэнэ.
- **Dart-specific:** Үгүй.
- **Mongolia-specific:** Үгүй.

### Asset 5 — Swiss Pairing / Backtracking Algorithm
- **Purpose:** Swiss системийн раунд бүрт стандинг-аар хос үүсгэх, өмнө нь тоглосон хосыг давтуулахгүй байх.
- **Main algorithm:** `backtrackPairSwiss` — стандингаар шунахай (greedy) хослуулж, бүх нэр дэвшигч аль хэдийн тоглочихсон тохиолдолд ухарч (backtrack) дахин оролддог, тооцооллын хязгаар (`SWISS_BACKTRACK_BUDGET = 200,000`), хязгаарт хүрвэл naive sequential pairing руу fallback хийдэг.
- **Related files:** `src/lib/local-game/bracket.ts` (`generateSwissRound1`, `generateSwissNextRound`, `backtrackPairSwiss`).
- **Related DB/RPC:** `tournaments/[id]/next-round` API.
- **Why non-trivial:** Constraint satisfaction төрлийн бодит backtracking алгоритм, тооцооллын өртгийг ухамсартайгаар хязгаарлаж, correctness/performance хоёрын хооронд тэнцвэржүүлсэн инженерийн шийдэл.
- **Complexity:** Very High.
- **Reusability outside DartMN:** Өндөр — Swiss формат ашигладаг ямар ч тэмцээн (шатар, бусад спорт) шууд ашиглаж болно.
- **Dart-specific:** Үгүй.
- **Mongolia-specific:** Үгүй.

### Asset 6 — Multi-Stage Tournament Orchestration
- **Purpose:** Олон шаттай тэмцээнийг (жишээ Group → Knockout, RR → Semifinal → Final) дараалуулан удирдах.
- **Main algorithm:** `computeQualifiedPlayerIds` (шат бүрийн төрлөөр ялгаатай шаталгааны логик), `buildStageMatches` (шат бүрийн generator сонголт+баталгаажуулалт), `advanceToNextStage` (session-ийн "flat" config талбаруудыг шинэ шатны дүрэмд тааруулан patch хийх orchestration).
- **Related files:** `src/lib/local-game/stage-advance.ts` (258 мөр), `src/lib/tournament/stage-types.ts` (277 мөр).
- **Related DB/RPC:** `tournaments/[id]/advance-stage` API (online хувилбар, ижил branching логикийг Supabase-ийн эсрэг ажиллуулдаг).
- **Why non-trivial:** Шат тус бүрийн дүрэм (тоглогчийн тоо, формат) өөр байхад ч нэг session-ийн доторх "тэгш" config-руу зөв хөрвүүлж, шатнуудын хооронд тасралтгүй урсгал бүрдүүлдэг orchestration давхарга.
- **Complexity:** High.
- **Reusability outside DartMN:** Дунд — bracket engine дээр суурилсан тул хамт зөөх шаардлагатай.
- **Dart-specific:** Хэсэгчлэн (leg/set config интеграцаараа).
- **Mongolia-specific:** Үгүй.

### Asset 7 — X01 Scoring / Checkout Derivation Engine
- **Purpose:** Дартсны 501/301 оноог, checkout/bust дүрмийг зөв тооцоолж, бодит цагийн тоглолтын төлөвийг сэргээх.
- **Main algorithm:** `classifyTurn(before, points, rules)` — bust/checkout/score-ийн ангилал; `deriveX01(visits, config)` — visit (event) массиваас тоглолтын одоогийн төлөвийг **replay хийж** сэргээдэг event-sourcing загвар.
- **Related files:** `src/lib/local-game/checkouts.ts` (240 мөр), `src/lib/local-game/x01.ts` (160 мөр).
- **Related DB/RPC:** `room_visits` (append-only event лог), `throws`/`match_legs`.
- **Why non-trivial:** Бүх боломжгүй double-out үлдэгдэл (169/168/166/165/163/162/159), leg loser-first дүрэм, round-limit+bull-off finish зэрэг олон house rule хувилбарыг нэг цөм логикт нэгтгэсэн, **бүх consumer компонент (Together/Online/Local/FFA/Solo/Camera) нэг эх сурвалжийг ашигладаг болсон** (өмнө нь 3 газар давхардаж байсныг нэгтгэсэн).
- **Complexity:** High.
- **Reusability outside DartMN:** Дунд — X01 дүрмийг дагадаг ямар ч дартс аппликэйшнд шууд дахин ашиглах боломжтой, зах зээлд ховор нээлттэй хэрэгжилт.
- **Dart-specific:** **Тийм, бүрэн darts-specific**.
- **Mongolia-specific:** Үгүй.

### Asset 8 — Match Statistics Engine
- **Purpose:** Тоглолтын дэлгэрэнгүй статистик (average, first-9 average, 180 тоо, high checkout, checkout/keep/break %) тооцоолох.
- **Main algorithm:** `computeMatchStatDetails(legs, doubleOut)` — leg-үүдээс шууд тооцоолсон pure функц, double-out vs straight-out horьоор checkout attempt eligibility ялгаатай тооцдог.
- **Related files:** `src/lib/local-game/match-stat-details.ts`.
- **Related DB/RPC:** `match_stat_details` table, `get_player_stat_summary` RPC (read-time career aggregation).
- **Why non-trivial:** Дартсны статистикийн стандарт metric-үүдийг (keep/break гэх мэт) зөв тодорхойлолтоор нь тооцоолсон, write-time+read-time hybrid архитектур.
- **Complexity:** High.
- **Reusability outside DartMN:** Дунд-Өндөр — X01 дээр суурилсан ямар ч darts платформд хэрэглэгдэнэ.
- **Dart-specific:** **Тийм**.
- **Mongolia-specific:** Үгүй.

### Asset 9 — ELO / Rating Engine
- **Purpose:** Тоглогчийн ур чадварыг тоглолтын үр дүнгээс тасралтгүй тооцоолж, matchmaking-д ашиглах.
- **Main algorithm:** `calculateEloChange(playerRating, opponentRating, won, k=32)` — стандарт ELO, багийн horьид **өрсөлдөгч багийн дундаж рейтинг**-тэй харьцуулах custom өргөтгөл.
- **Related files:** `src/lib/rating.ts`, `src/lib/local-game/match-stats.ts` (`applyMatchResult`).
- **Related DB/RPC:** `apply_match_result` RPC (атом бичилт), `rating_history`.
- **Why non-trivial:** ELO томьёо стандарт боловч team-average generalization нь custom шийдэл; матч дуусах бүрд рейтинг+стат+achievement-ийг нэг транзакцад атомаар бичихийг баталгаажуулсан.
- **Complexity:** Medium.
- **Reusability outside DartMN:** Өндөр — ELO нь ерөнхий competitive game дизайны түгээмэл загвар.
- **Dart-specific:** Үгүй (team-average өргөтгөл нь darts-ийн 2v2/3v3 форматад зориулагдсан ч алгоритм өөрөө спорт-агностик).
- **Mongolia-specific:** Үгүй.

### Asset 10 — Mongolian Tier / Title System
- **Purpose:** ELO оноог 7 Монгол нэртэй зэрэглэлд хөрвүүлж, тоглогчийн статус/сэдэлийг харуулах.
- **Main algorithm:** `TIERS` (Залуу/Начин/Харцага/Заан/Гарьд/Арслан/Дархан) — рейтингийн мужаас зэрэглэл рүү mapping + дараагийн зэрэглэл хүртэлх дэвшлийн хувь тооцоолол (`getProgress`); тусдаа `AVRAGA_TITLES` (32+ тоглогчтой тэмцээний хуримтлагдсан ялалтад суурилсан "Аврага" цол).
- **Related files:** `src/lib/rating.ts`.
- **Related DB/RPC:** `profiles.rating_points`.
- **Why non-trivial:** Монгол ахуй/соёлд тохирсон нэршил бүхий давхар зэрэглэл/цол систем — зүгээр ELO тоо биш, тоглогчийн "identity"-г бий болгосон.
- **Complexity:** Low-Medium (логик энгийн, гэхдээ нэршил/дизайны шийдэл өвөрмөц).
- **Reusability outside DartMN:** Бага — нэршил нь DartMN/Монгол контекстэд онцгой уялдсан.
- **Dart-specific:** Хэсэгчлэн (аль ч competitive тоглоомд зохицуулж болно).
- **Mongolia-specific:** **Тийм, бүрэн Монгол нэршил/соёлд суурилсан**.

### Asset 11 — Matchmaking Concurrency / RPC Logic
- **Purpose:** ELO±300 цонхонд тохирсон тоглогчдыг зэрэгцээ (concurrent) хүсэлтийн орчинд аюулгүй хослуулах.
- **Main algorithm:** `matchmaking_claim_match` SQL функц — `pg_advisory_xact_lock`-аар бүх зэрэгцээ дуудлагыг бүрэн цуваа болгож (serialize), 2 тоглогч зэрэг нэгдэхэд аль аль нь "no match found" гэж алдаатай хариулах livelock асуудлыг арилгасан; "сарнисан" (crash/tab close) queue мөрийг heartbeat staleness шалгалтаар (30 секунд) авто цэвэрлэдэг.
- **Related files:** `src/app/api/matchmaking/{join,heartbeat,leave}/route.ts`.
- **Related DB/RPC:** `matchmaking_claim_match`, `matchmaking_join_queue`, `matchmaking_heartbeat` (бүгд `SECURITY DEFINER`, зөвхөн `service_role`-д эрхтэй).
- **Why non-trivial:** Энэ бол чанартай concurrent systems engineering — race condition, livelock, ghost-entry cleanup зэрэг олон бодит edge case-ийг нарийн боловсруулсан.
- **Complexity:** High.
- **Reusability outside DartMN:** Өндөр — ELO-суурьт matchmaking шаардлагатай ямар ч realtime тоглоомд хэрэглэгдэнэ.
- **Dart-specific:** Үгүй.
- **Mongolia-specific:** Үгүй.

### Asset 12 — Camera Dart Detection / Calibration (Geometry)
- **Purpose:** Камерын зурган дээрх пиксел байрлалыг бодит дартсны оноо (segment+multiplier) руу хөрвүүлэх, камер эгц бус өнцгөөр байрлуулагдсан үед ч зөв ажиллуулах.
- **Main algorithm:** `positionToScore` — бодит WDF/BDO самбарын харьцаагаар пиксел→оноо зураглал; `deriveCal`/`positionToScoreCal` — 3 цэгээр (bullseye, T20, T6) тохируулсан **2×3 affine transform** тооцоолол; `detectDartInFrames` — frame-difference-д суурилсан, сумны иш (shaft) биш үзүүрийг (tip) онилсон 2-үе intensity-weighted centroid арга.
- **Related files:** `src/lib/dartboard.ts` (278 мөр), `src/lib/camera-zoom.ts`.
- **Related DB/RPC:** Байхгүй (бүрэн client-side тооцоолол).
- **Why non-trivial:** Энгийн зурган боловсруулалт биш — бодит геометр/affine transform математик, самбарын өнцгийн алдааг засах calibration систем, сумны биш үзүүрийг зорилтот болгосон детекц арга.
- **Complexity:** High.
- **Reusability outside DartMN:** Дунд-Өндөр — дартс-специфик боловч affine calibration арга нь ерөнхий computer-vision техник.
- **Dart-specific:** **Тийм**.
- **Mongolia-specific:** Үгүй.

### Asset 13 — ONNX Dart Model Integration (AI auto-scoring)
- **Purpose:** Камерын видеон дээр бодит цагийн YOLO-суурьт объект танилтаар сумны байрлал болон самбарын өнцгийг автоматаар илрүүлэх.
- **Main algorithm:** YOLOv8n ONNX модел (`onnxruntime-web`, WebGPU/WASM), сумны үзүүр танилт + самбарын булан танилт (20/3/11/6 segment)-аар авто calibration (`detectBoardCorners`/`computeCalFromCorners`, 9° detector-offset засвар, circumcenter fallback).
- **Related files:** `src/lib/dart-model.ts`, `src/hooks/useDartModel.ts`, `src/app/(main)/play/camera/page.tsx` (idle→motion→settling→detected/manual state machine, YOLO-г эхлээд оролдож, амжилтгүй бол frame-diff, эцэст нь гар товшилт руу fallback).
- **Related DB/RPC:** Байхгүй (бүрэн client-side inference, `public/models/dart.onnx`).
- **Why non-trivial:** Хөнгөн жинтэй ч бодит-цагийн browser-суурьт ML inference pipeline, автомат calibration, олон түвшний fallback стратеги бүхий бүрэн ажиллагаатай систем — comment-той идэвхгүй биш, **идэвхтэй ажиллаж буй** feature.
- **Complexity:** High.
- **Reusability outside DartMN:** Дунд — YOLO pipeline нь ерөнхий, гэхдээ dartboard geometry-той нягт холбогдсон.
- **Dart-specific:** **Тийм**.
- **Mongolia-specific:** Үгүй.

### Asset 14 — WebRTC Dual-Camera Architecture
- **Purpose:** Ихэнх утас нэгэн зэрэг 2 камер нээж чадахгүй тул ар/урд камерыг canvas дээр нэгтгэж (composite) нэг MediaStream болгож дамжуулах.
- **Main algorithm:** Canvas-суурьт compositing (урд камер жижиг "selfie" inset болгож давхарлах), Google public STUN, **Supabase Realtime-ийг өөрөө WebRTC signaling транспорт болгож ашигласан** (тусдаа signaling server шаардлагагүй).
- **Related files:** `src/hooks/useWebRTCCamera.ts`, `src/components/game/FloatingCameraPiP.tsx`, `CameraGrid.tsx`.
- **Related DB/RPC:** Supabase Realtime channel (offer/answer/ICE exchange).
- **Why non-trivial:** Мобайл төхөөрөмжийн техникийн хязгаарлалт (нэг л камер track нээх боломжтой)-ыг ухаалаг canvas workaround-оор шийдсэн, бэлэн 3rd-party signaling үйлчилгээ ашиглахгүйгээр одоо байгаа Realtime дэд бүтцээ дахин ашигласан.
- **Complexity:** Medium-High.
- **Reusability outside DartMN:** Дунд — WebRTC video бүхий ямар ч realtime аппликэйшнд ашиглагдана.
- **Dart-specific:** Үгүй (тоглолтын камер-мониторинг зорилготой ч darts-логиктой холбоогүй).
- **Mongolia-specific:** Үгүй.

### Asset 15 — Mongolian Voice Caller / Number-to-Word / Suffix Logic
- **Purpose:** Монгол хэл дээр дартсны оноог "зарлах" (жишээ нь "Таны оноо жаран нэгээс...")
- **Main algorithm:** `mnNumber()` — тоог Монгол үг рүү бүрэн хөрвүүлэгч (нэгж/аравтын хоёр өөр хэлбэр — бие даасан vs нийлмэл, ж: "хорь" vs "хорин" ялгаа зөв боловсруулсан); `ablativeSuffix`/`ablativeText` — эгшиг зохицлын дагуу зөв ялгах "-аас/-ээс/-оос/-өөс" төгсгөл сонгодог, эгшгийн зөрчлийг (hiatus) шийдэхийн тулд "н" оруулах логиктой lookup table.
- **Related files:** `src/lib/caller.ts`, `src/hooks/useCaller.ts`, admin удирдлага `src/app/(main)/admin/caller/CallerVoiceManager.tsx`.
- **Related DB/RPC:** `caller_clips` table, `caller-voice` Storage bucket.
- **Why non-trivial:** Бэлэн санг ашигладаггүй, эх сурвалжаас бүрэн бичсэн Монгол хэлний тоо-үг хөрвүүлэлт + эгшиг зохицлын дүрмийг код болгосон NLG (natural language generation) — цөөн нөөцтэй хэлний хувьд ийм түвшний хэрэгжилт ховор.
- **Complexity:** Medium-High.
- **Reusability outside DartMN:** Дунд — Монгол хэлний тоо/өгүүлбэр боловсруулалт хэрэгтэй бусад аппликэйшнд (darts бус ч) шууд дахин ашиглагдах боломжтой.
- **Dart-specific:** Хэсэгчлэн (checkout/bust үгсийн санг нь тооцвол darts-специфик, гэхдээ core NLG механизм нь ерөнхий).
- **Mongolia-specific:** **Тийм, бүрэн Монгол хэлний дүрэмд суурилсан**.

---

## 12. Product Differentiators

> Энэ хэсэгт **generic SaaS/infrastructure capability** (Authentication, Payments, Profile, Notifications г.м.) болон **darts-домэйн differentiator**-ийг тодорхой ялгаж харуулав. Эдгээрийг хооронд нь холихгүй.

### Generic infrastructure capability (differentiator биш — байх ёстой суурь)
Authentication, Payments (QPay/Byl/Bonum), Profile/Settings, Club membership CRUD, Admin dashboard, Notifications (in-app), File Storage — эдгээр нь чанартай хэрэгжсэн ч, өөр ямар ч SaaS платформд байдаг стандарт capability бөгөөд **DartMN-ийг өрсөлдөгчөөс ялгаж чадахгүй**.

### Already exists (домэйн differentiator, кодоор баталгаажсан)
- **Swiss pairing/backtracking algorithm** — Asset 5.
- **Double-elimination + play-in интеграц** — Asset 3, 4.
- **X01 scoring/checkout engine** — Asset 7.
- **Match statistics engine** (checkout/keep/break %, average) — Asset 8.
- **Монгол Tier/Title систем** — Asset 10.
- **AI камер-суурьт автомат оноо танигч (идэвхтэй)** — Asset 12, 13.
- **Монгол дуут зарлагч** — Asset 15.
- **Local (auth-гүй) + Online хос экосистем** нэг X01 engine дээр.

### Partially exists (суурь нь байгаа боловч бүрэн биш)
- **Club War** — UI placeholder ("Тун удахгүй"), backend логик хараахан хэрэгжээгүй.
- **Persistent Teams** — тогтмол багийн identity table байхгүй, тоглолт бүрд ad-hoc.
- **Тэмцээний зохион байгуулагчийн reputation** (`organizer_ratings`) — table бий, гүн ашиглалт баталгаажаагүй.
- **Achievements систем** — table/RPC бий, гэхдээ энэ судалгаанд гүнзгий шалгагдаагүй.

### Opportunity (кодод байхгүй, зөвхөн санал — architecture дээр тулгуурлан логикоор боломжтой)
> ⚠️ Эдгээр нь **репозиторид одоогоор байхгүй, зөвхөн санал** гэдгийг тодорхой тэмдэглэж байна.
- Дэлхийн бусад дартс холбоо/лигтэй (WDF, PDC форматтай) нийцсэн гадаад rating exchange.
- Тэмцээний спонсорлолт/реклам систем.
- Push notification (одоогийн in-app notifications table дээр суурилж өргөтгөх боломжтой).
- Олон улсын өрсөлдөгчидтэй тохирох боломжтой цаг бүсийн-хэлний тохиргоо (i18n framework нэмэх).
- AI камер моделийг тэмцээний албан ёсны оноо баталгаажуулалтад ашиглах (одоогоор туслах/санал болгогч төдийхнөөр ажиллаж болзошгүй).

---

## 13. Product Weaknesses / Missing Pieces

- **Schema/migration түүх алдагдсан** — `supabase/migrations/` байхгүй, schema.sql хуучирсан. Хэрэв Supabase project алдагдвал schema-г git-ээс бүрэн сэргээх боломжгүй. (8-р хэсэгт дэлгэрэнгүй.)
- **Branding/visual identity бараг байхгүй** — custom logo/app icon алга, README боловсруулагдаагүй boilerplate хэвээр, Монгол-специфик visual motif (Соёмбо гэх мэт) байхгүй.
- **i18n цөөн** — зөвхөн Монгол хэл, i18n framework алга — олон улсын тоглогч татахад хязгаарлалттай.
- **Push notification байхгүй** — зөвхөн in-app, тоглогчийг идэвхтэй буцаан татах чадвар сул.
- **Persistent Teams байхгүй** — багийн тэмцээн/статистикийн урт хугацааны тасралтгүй байдал хязгаарлагдмал.
- **Analytics байхгүй** — хэрэглээний зан төлөвийг хэмжих боломжгүй, бүтээгдэхүүний шийдвэр гаргалт data-driven биш байх магадлалтай.
- **Search feature байхгүй** — тэмцээн/клуб/тоглогч хайх нэгдсэн UI алга.
- **Community/social feature хязгаарлагдмал** — клубын chat-аас өөр friend/feed/comment зэрэг байхгүй.
- **Club War, зарим Pricing tier "Тун удахгүй"** — UI дээр амлагдсан боловч backend хараахан хэрэгжээгүй feature.
- **AI камер feature-ийн production maturity баталгаажаагүй** — идэвхтэй ажиллаж буй ч, comment/тест хэрэгжилтийн бүрэн байдал энэ судалгаанд шалгагдаагүй.

---

## 14. Possible Product Positioning

### Option A — Mongolia's Darts Tournament Platform
- **Target:** Дартс клуб, тэмцээн зохион байгуулагчид.
- **Core value:** Автомат bracket engine (5 төрөл), local+online хос горим, оролцооны хураамж/шагналын удирдлага.
- **Strength:** Bracket engine нь кодын хамгийн гүн хэсэг — Very High complexity, шууд ашигт зорилтот.
- **Weakness:** Branding сул, олон улсын өргөтгөл хараахан алга.

### Option B — Darts Player Identity & Statistics Platform
- **Target:** Ганц тоглогч, өөрийн ур чадвар/түүхээ хөтлөх хүсэлтэй хэрэглэгч.
- **Core value:** ELO+Tier+Statistics+Nameplate cosmetics — тоглогчийн "digital identity".
- **Strength:** Статистикийн гүнзгий давхарга (write+read hybrid), Монгол tier нэршил өвөрмөц.
- **Weakness:** Ганцаараа тоглох боломж (offline stats logging) хязгаарлагдмал — statistics зөвхөн match-аас гардаг, practice тооцогддоггүй.

### Option C — Complete Darts Ecosystem
- **Target:** Клуб, тэмцээн зохион байгуулагч, ганц тоглогч бүгд.
- **Core value:** Local+Online тэмцээн, дасгал, статистик, клуб, онлайн тоглолт (камер+voice), cosmetics — бүгдийг нэг платформд.
- **Strength:** Хамрах хүрээ хамгийн өргөн, боломжуудын нийлбэр давуу тал өндөр.
- **Weakness:** Positioning тодорхойгүй болох эрсдэлтэй — "юу ч хийдэг" гэдэг нь маркетингийн хувьд message нарийсгахад хүндрэлтэй.

**Санал:** Одоогийн кодтой хамгийн сайн нийцэж буй нь **Option C (Complete Darts Ecosystem)** — учир нь код бодитоор bracket/scoring/statistics/online-play/local-play/camera/voice бүх давхаргад тэнцвэртэй хөрөнгө оруулалттай. Гэхдээ маркетинг/branding хийхдээ **Option A**-г "leading edge" (bracket engine) болгож толилуулбал илүү тодорхой, эхлэл хийхэд хялбар байх магадлалтай.

---

## 15. Branding Input

- **DartMN нэр хаанаас харагдаж байна:** `src/app/layout.tsx`-ийн `metadata.title` ("DartMN — Монголын Дартсын Платформ") болон `description` дотор л. Тусдаа marketing landing page байхгүй тул нэр анх удаа зөвхөн browser tab title-аар харагдана.
- **Одоогийн logo:** Байхгүй. `public/` дотор зөвхөн Next.js create-app стандарт SVG-үүд (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`) байгаа — DartMN-ий custom logo/app icon огт олдсонгүй.
- **Одоогийн colors:** `globals.css` дотор OKLCH өнгөний орон зайд тодорхойлогдсон: background `oklch(0.08 0.015 265)` (бараг хар, цэнхэр өнгөлөг), `--primary: oklch(0.55 0.22 15)` (ханасан улаан/улбар шар), `--gold: oklch(0.78 0.16 85)`, `--live: oklch(0.65 0.22 145)` (ногоон, "live" төлөв заахад). Tailwind config биш, CSS-native `@theme inline`.
- **Typography:** Inter, Oswald, Russo One, Montserrat, Rubik, Exo 2 — бүгд `latin+cyrillic` subset-тэй тусгайлан ачаалагдсан (Монгол кирилл дэмжихийн тулд).
- **Favicon:** Зөвхөн стандарт `favicon.ico` (Next.js анхны default) — custom favicon байхгүй.
- **Icon:** Custom app icon (`icon.tsx`/`apple-icon`) байхгүй.
- **Design language:** Dark mode-only (`className="dark"` hardcode), `next-themes` dependency бий боловч ашиглагдаагүй (vestigial). Улаан/алт өнгөний хослол нь дартс таргетын аура (bullseye-ийн улаан) санагдуулна.
- **Dark/light mode:** Зөвхөн dark, light mode toggle байхгүй.
- **UI style:** shadcn/ui-style Base UI компонент, орчин үеийн card/dashboard дизайн.
- **Darts imagery:** Тусгай darts icon/illustration/graphic **олдсонгүй** — зөвхөн текст/өнгөөр л darts identity илэрхийлэгдсэн.
- **Монголтой холбоотой visual element:** Соёмбо, үндэсний туг өнгө г.м. **олдсонгүй** — Монгол identity нь зөвхөн **хэл** (бүх текст, tier нэр, voice caller)-ээр илэрхийлэгдсэн, visual граф хэлбэрээр биш.

**Товч дүгнэлт:** Branding-ийн **сул тал** нь ил тод — custom logo/icon/marketing хуудас байхгүй, README боловсруулагдаагүй. **Сайн тал** нь: Монгол кирилл бичгийг зөв дэмжсэн фонт сонголт, Монгол tier/voice нэршлийн хэл-суурьт identity (visual биш ч концептуал хувьд өвөрмөц), тогтвортой dark-mode өнгөний систем (OKLCH токен) нь logo/branding хийхэд шууд ашиглах боломжтой суурь өгдөг.

---

## 16. Logo Design Input

Дараах 5–10 concept keyword-ыг код дээрх онцлогуудад үндэслэн санал болгож байна:

1. **Dart** (сум) — цөм бүтээгдэхүүн.
2. **Dartboard** (самбар) — bracket/tournament imagery-тэй холбогдоно.
3. **Bullseye** (bull) — checkout/precision-ийн бэлгэдэл.
4. **DM** (DartMN товчлол) — monogram loго-д тохиромжтой.
5. **Target/Precision** — оноо тооцооллын нарийвчлал (affine calibration, checkout logic).
6. **Champion/Аврага** — "Аврага" цол системтэй шууд холбогдоно.
7. **Bracket/Tree** — bracket engine-ийг илэрхийлэх геометр хэлбэр (Very High complexity asset).
8. **Zero/Checkout** ("0" тоо, checkout-ийн бэлгэдэл) — X01 engine-тэй холбогдоно.
9. **Voice/Sound wave** — Монгол дуут зарлагчтай холбогдох боломжтой (хоёрдогч concept).
10. **Community/Circle** — клуб/лиг сүлжээний бэлгэдэл.

**Дүгнэлт:** Хамгийн хүчтэй concept бол **Dartboard + Bullseye + DM monogram**-ийн хослол — учир нь энэ нь (a) darts спортыг шууд таниулна, (b) DartMN нэрийг товчилсон хэлбэрээр агуулна, (c) кодын хамгийн гүн хөрөнгө оруулалттай хэсэг болох "нарийвчлал" (checkout logic, camera calibration)-ыг бэлгэддэнэ. Монгол-специфик визуал элемент (жишээ Соёмбо-аас санаа авсан хээ) нэмбэл платформын "Монголын" гэдэг positioning-ийг илүү тодотгож болно — гэхдээ энэ бол зөвхөн санал, кодоос батлагдаагүй.

---

## 17. Intellectual Property Inventory

> Хууль зүйн зөвлөгөө биш — ОӨГ-т бүртгүүлэхэд баримтжуулж болох software asset-уудын inventory.

### A. Core software source code
- **Status: Present.** Бүх Next.js/TypeScript frontend, API route, Zustand state менежмент код `src/` дотор бүрэн байна (routes/roles-ийн 4-р хэсэгт тоологдсон бүх feature module).

### B. Algorithms / domain logic
- **Status: Present.** 11-р хэсэгт баримтжуулсан 15 asset (bracket engine, seeding, DE losers-bracket, play-in, Swiss backtracking, multi-stage orchestration, X01 engine, statistics engine, ELO engine, tier систем, matchmaking concurrency, camera calibration, ONNX integration, WebRTC dual-camera, voice caller NLG) — бүгд эх кодоор бодитоор баталгаажсан.

### C. Database / data model
- **Status: Present (гэхдээ баримтжуулалт Partial).** `src/types/database.ts` дотор бодит бүтэц бүрэн тусгагдсан (40+ table). Гэхдээ хувилбарлагдсан schema/migration баримт (`supabase/migrations/`) **байхгүй** тул schema-ийн albeit **эх сурвалж** нь repo дотор бүрэн биш — зөвхөн snapshot (`schema.sql`, хуучирсан) болон generated types (`database.ts`, бодит боловч зөвхөн бүтэц, migration түүхгүй) хэлбэрээр л бий.

### D. UI / UX assets
- **Status: Present.** Component library (shadcn/Base UI-суурьт), dashboard/scoreboard/bracket харагдац, cosmetic nameplate систем, camera overlay UI — эдгээр бүгд `src/components/` дотор custom хэрэгжсэн.

### E. Brand assets
- **Status: Missing.** Custom logo, app icon, favicon, marketing materials **байхгүй**. Зөвхөн текст нэр ("DartMN") болон OKLCH өнгөний токен систем байгаа боловч тэдгээрийг "brand asset" гэж албан ёсоор баримтжуулаагүй.

### F. Documentation
- **Status: Partial/Missing.** `README.md` нь Next.js create-app-ийн анхны boilerplate хэвээр, DartMN-д тусгайлан бичигдээгүй. Кодын дотоод comment (жишээ нь Swiss backtracking, DE insertion logic-ийн тайлбар) чанартай ч, гадаад/хэрэглэгчийн баримт бичиг (API docs, architecture diagram) **олдсонгүй**.

### G. Content / localization
- **Status: Present.** `src/locales/mn.ts` (250 мөр, бүрэн Монгол хэл), voice caller-ийн Монгол NLG (тоо/эгшиг зохицол), tier/title нэршил (Залуу→Дархан, Аврага) — бүгд эх бичвэрээр repo дотор бий.

---

## Product Identity Signals

> Кодыг харахад DartMN аль identity руу хамгийн хүчтэй хэлбийж байгааг 0–10 оноогоор үнэлэв.

| Identity | Оноо (0–10) | Үндэслэл |
|---|---|---|
| **Tournament Management Platform** | **8** | Bracket engine (5 төрөл, play-in, multi-stage) кодын хамгийн гүн, идэвхтэй хөгжүүлэгдэж буй давхарга — гэхдээ payment/organizer-payout зэрэг "менежмент" тал бүрэн биш (Bonum тохиргоо хүлээгдэж буй). |
| **Darts Competition Engine** | **9** | X01 scoring/checkout/bull-off/undo/forfeit-walkover зэрэг дартсны дүрмийг нарийн дагасан цөм engine — энэ бол хамгийн баттай "darts-native" сигнал. |
| **Player Statistics / Identity Platform** | **7** | ELO+Tier+nameplate cosmetics+дэлгэрэнгүй статистик хүчтэй хэрэгжсэн, гэхдээ практик стат leaderboard-д ордоггүй (зөвхөн match-аас) тул "бүрэн" identity давхарга биш. |
| **Online Darts Platform** | **7** | Realtime matchmaking, WebRTC камер, voice caller — техникийн хувьд өндөр, гэхдээ AI auto-scoring-ийн production maturity баталгаажаагүй. |
| **Darts Training Platform** | **5** | 8 practice горим, дэвшил tracking байгаа боловч энэ нь leaderboard/статистик экосистемтэй тусгаарлагдмал (нэгдээгүй) хэсэг. |
| **Darts Community / Social Platform** | **3** | Клубын chat-аас цааш friend/feed/comment зэрэг байхгүй — community давхарга сул. |
| **Darts Club / League Platform** | **6** | Club role систем (owner/admin/member), league CRUD байгаа боловч "Club War" зэрэг холбогдох feature placeholder төлөвтэй. |
| **Complete Darts Ecosystem** | **8** | Бүх дээрх давхаргыг нэг платформд нэгтгэсэн цар хүрээ өргөн боловч зарим хэсэг (community, branding) сул тул "бүрэн" гэхэд хэт эрт. |

---

## 18. Repository Metrics

*(Repository дээрээс шууд тоологдоогүй тул доорх нь энэ судалгааны гурван Explore agent-ийн ажиглалт дээр үндэслэсэн ойролцоо тоо — Repository дээрээс баталгаажуулж чадсангүй тэмдэглэвэл тэр хэсэгт тодорхой заасан.)*

- **Approx source files:** Хэдэн зуун TypeScript/TSX файл (`src/app`, `src/components`, `src/lib`, `src/hooks` дотор) — **нарийн тоо баталгаажуулж чадсангүй**.
- **Main languages:** TypeScript/TSX (frontend+API), SQL (Postgres RPC/schema), CSS (Tailwind v4 native).
- **Approx LOC:** Гол алгоритм файлууд дангаараа 100–450 мөр хооронд (жишээ: `bracket.ts` 447, `bracket-server.ts` 397, `stage-types.ts` 277, `dartboard.ts` 278, `checkouts.ts` 240, `stage-advance.ts` 258, `x01.ts` 160) — нийт LOC **нарийн тоо баталгаажуулж чадсангүй**.
- **Main modules:** Auth, Profile/Cosmetics, Tournament/Bracket, Match/Scoring, Ratings/Statistics, League, Clubs, Play (Online/Together/Practice/Camera), Local (auth-гүй систем), Pricing/Payments, Admin.
- **Database migrations count:** **0 файл** `supabase/migrations/` дотор (directory байхгүй) — бодит schema өөрчлөлт git-д track хийгдээгүй.
- **Main routes count:** ~40+ page route (`(auth)`+`(main)` бүлэг дотор), ~35+ API route (`src/app/api/` дотор, зарим нь dynamic sub-route-той).
- **Test files count:** Explore судалгаагаар тусгайлан хайгдаагүй — **Repository дээрээс баталгаажуулж чадсангүй**.
- **Git activity:** ~275 commit 2026-06-02–2026-08-27 хооронд (~3 сар) — маш идэвхтэй хөгжүүлэлт, хамгийн их төвлөрөл нь online tournament bracket, online room/matchmaking, WebRTC камер, voice caller дээр.

---

## 19. Final Assessment

**DartMN in one sentence:** Монголын дартс тоглогч, клуб, тэмцээн зохион байгуулагчдад зориулсан, X01 scoring/bracket engine-ийг цөм болгож, ELO зэрэглэл, онлайн бодит цагийн тоглолт (камер+voice дагалдсан), local auth-гүй тэмцээн зэргийг нэгтгэсэн цогц дартс экосистем.

**Primary product category:** Darts Competition & Tournament Engine (Tournament Management + Darts-specific Scoring/Statistics хосолсон).

**Primary users:** Монголын дартс тоглогч (ганц бие), клуб/тэмцээн зохион байгуулагч, платформын ганц admin.

**Top 5 existing capabilities:**
1. 5 төрлийн bracket engine (SE/DE/RR/Groups+Knockout/Swiss) + play-in + multi-stage
2. X01 scoring/checkout engine (нэгдсэн эх сурвалж)
3. ELO+Tier+Champion цол зэрэглэлийн систем
4. Online realtime тоглолт (matchmaking, WebRTC камер, undo, forfeit)
5. Local (auth-гүй) тэмцээн систем, join-by-code

**Top 5 strongest technical/product assets:**
1. Swiss pairing backtracking algorithm (Very High)
2. Double-elimination + play-in insertion logic (Very High)
3. Matchmaking concurrency RPC (advisory lock, livelock fix)
4. Camera dartboard calibration (affine transform) + ONNX auto-scoring
5. Монгол voice caller NLG (тоо-үг хөрвүүлэлт + эгшиг зохицол)

**Top 5 missing opportunities:**
1. Custom branding/logo/marketing давхарга
2. Persistent Teams identity
3. Push notification
4. Analytics/data-driven product decision дэд бүтэц
5. Schema/migration version control сэргээх (git-д бүрэн track хийх)

**Most distinctive DartMN feature:** X01 scoring/checkout engine + bracket engine-ийн хослол — бусад generic tournament SaaS-д байхгүй, спортын дүрэмд гүнзгий нийцсэн domain logic.

**Best positioning candidate:** Option C (Complete Darts Ecosystem), гэхдээ маркетинг communication-д Option A (Tournament Platform)-ийг "leading edge" болгож ашиглах нь илүү тодорхой эхлэл өгнө.

**Potential brand identity:** Dartboard + Bullseye + "DM" monogram хослол, улаан/алт өнгөний схем дээр суурилсан.

**Potentially strongest IP assets:** Bracket engine (Very High complexity, 4 тусдаа asset-д задарсан), X01 scoring engine, Монгол voice caller NLG, camera calibration+ONNX pipeline.

---

## Product Identity Signals
*(дээрх 17.5-р хэсэгт нийцүүлэн 18-р хэсгийн өмнө тавигдав — харна уу дээрх хүснэгт.)*

---

## AI Handoff Summary

DartMN is: Монголын дартс тоглогч, клуб, тэмцээн зохион байгуулагчдад зориулсан цогц веб платформ — X01 scoring/checkout engine, олон төрлийн bracket generation, ELO+Tier зэрэглэл, онлайн бодит цагийн тоглолт (WebRTC камер, AI auto-scoring, voice caller дагалдсан), болон auth-гүй local тэмцээн системийг нэг архитектурт нэгтгэсэн.

Core audience: Монголын дартс тоглогч, клуб, тэмцээн зохион байгуулагч.

Core problem: Дартсны тэмцээнийг гараар/цаасаар зохион байгуулах, тоглогчийн ур чадвар/статистикийг хөтлөх боломжгүй байсныг автомат bracket, оноо тооцоолол, зэрэглэл, онлайн тоглолтоор шийддэг.

Strongest existing feature: Bracket/tournament engine (5 төрөл + play-in + multi-stage), кодын хамгийн гүн хөрөнгө оруулалттай хэсэг.

Most technically distinctive asset: Double-elimination + play-in insertion logic болон Swiss pairing backtracking algorithm — хоёулаа Very High complexity, өвөрмөц edge-case шийдэлтэй.

Most darts-specific asset: X01 scoring/checkout derivation engine (`classifyTurn`/`deriveX01`) — бүрэн darts дүрэмд суурилсан, нэгдсэн эх сурвалж болсон.

Most Mongolia-specific asset: Монгол voice caller (тоо-үг хөрвүүлэлт + эгшиг зохицлын ablative suffix logic) болон 7 Монгол нэртэй tier/"Аврага" цол систем — хэл/соёлд гүнзгий суурилсан, гэхдээ visual (лого/Соёмбо) identity алга.

Current product maturity: Цөм engine (bracket, scoring, statistics, ELO) production-ready, идэвхтэй хөгжүүлэгдэж байгаа (~275 commit/3 сар); branding/marketing давхарга бараг эхлээгүй; schema version control git-д бүрэн track хийгдээгүй; AI камер auto-scoring идэвхтэй ч production maturity баталгаажаагүй.

Best positioning candidate: Complete Darts Ecosystem (Option C) бодит архитектуртай хамгийн нийцтэй, гэхдээ анхны маркетинг мессежинд Tournament/Competition Engine-ийг тэргүүлэх сигнал болгож ашиглах нь зөв.

Main branding weakness: Custom logo/icon/marketing хуудас байхгүй, README боловсруулагдаагүй, Монгол-специфик visual motif (Соёмбо г.м.) байхгүй — Монгол identity зөвхөн хэлээр илэрхийлэгдсэн, визуалаар биш.

Main technical weakness: `supabase/migrations/` байхгүй тул schema-ийн бодит түүх git-ээс сэргээгдэхгүй; push notification/analytics байхгүй; persistent Teams table байхгүй.

Top 3 expansion opportunities: (1) Push notification+analytics дэд бүтэц нэмэх, (2) Persistent Teams identity бий болгох, (3) i18n framework нэмж олон улсын өргөтгөлд бэлдэх.

Top 5 IP-worthy software assets: (1) Bracket/tournament engine (SE/DE/RR/Groups+Knockout/Swiss, play-in), (2) X01 scoring/checkout derivation engine, (3) Match statistics engine (keep/break/checkout%), (4) Монгол voice caller NLG (тоо-үг + эгшиг зохицол), (5) Camera dartboard calibration (affine transform) + ONNX auto-scoring pipeline.

---

## Files inspected

Энэ тайланг бэлтгэхэд ашигласан хамгийн чухал file/path-ууд:

**Config/branding:**
- `package.json`, `src/app/layout.tsx`, `src/app/globals.css`, `src/locales/mn.ts`, `README.md`, `public/` (icon/graphic файлууд)

**Database/backend:**
- `supabase/schema.sql`, `supabase/online_rooms_teams.sql`, `supabase/drop_notifications_type_check.sql`, `src/types/database.ts`, `src/lib/supabase/{client,server}.ts`, `src/lib/auth/require-admin.ts`

**Routes:**
- `src/app/(auth)/*`, `src/app/(main)/*` (dashboard, profile, settings, stats, ratings, calendar, clubs, leagues, tournaments, play/*, local/*, pricing, admin/*), `src/app/api/*`

**Tournament/bracket engine:**
- `src/lib/local-game/bracket.ts`, `src/lib/tournament/bracket-server.ts`, `src/lib/tournament/standings.ts`, `src/lib/tournament/play-in.ts`, `src/lib/tournament/stage-types.ts`, `src/lib/local-game/stage-advance.ts`

**X01/statistics/rating:**
- `src/lib/local-game/checkouts.ts`, `src/lib/local-game/x01.ts`, `src/lib/local-game/match-stat-details.ts`, `src/lib/local-game/match-stats.ts`, `src/lib/rating.ts`

**Matchmaking/online play:**
- `src/app/api/matchmaking/{join,heartbeat,leave}/route.ts`, `src/app/api/play/room/[id]/*`, `src/app/(main)/play/[roomId]/OnlineRoom.tsx`, `src/app/(main)/play/PlayLobby.tsx`

**Camera/voice:**
- `src/lib/dartboard.ts`, `src/lib/dart-model.ts`, `src/hooks/useDartModel.ts`, `src/hooks/useWebRTCCamera.ts`, `src/lib/camera-zoom.ts`, `src/lib/caller.ts`, `src/hooks/useCaller.ts`, `src/app/(main)/play/camera/page.tsx`

**Local (auth-гүй) систем:**
- `src/lib/local-game/store.ts`, `src/lib/local-game/sync.ts`, `src/lib/local-game/room-finish.ts`, `src/app/(main)/local/*`
