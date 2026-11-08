# BACKEND.md — Spring Boot Monolith (orchestrator and system of record)

> **Read first:** `OVERVIEW.md`, `API_CONTRACT.md` (every public endpoint and DTO), `HARNESS.md` (turn lifecycle).
> The backend is one Spring Boot application with the classic layered structure
> **controller → service (interface) → service/impl → repository → entity**.
> It owns authentication, all data, the turn state machine, rate limits and persistence. It never builds prompts and never inspects
> prompt text: every AI decision comes from the AI service (`AI_SERVICE.md`) and the backend applies it.

---

## 1. Versions and dependencies

| Item | Version | Notes |
|---|---|---|
| Java | 21 | Virtual threads on |
| Spring Boot | **4.1.x** (current GA line in Nov 2026) | 3.5.x also works; differences in §1.2 |
| Build | Maven (wrapper committed) | |
| PostgreSQL | 16+ with pgvector 0.8+ | Docker image `pgvector/pgvector:pg16` (or newer tag) |

### 1.1 Dependencies (`pom.xml`, Boot 4.1 parent manages versions unless given)
| Artifact | Purpose |
|---|---|
| `spring-boot-starter-webmvc` | REST + `SseEmitter` (Boot 4 name of the old `-web` starter) |
| `spring-boot-starter-websocket` | `/ws/voice` relay |
| `spring-boot-starter-webflux` | **only** for `WebClient` (streaming calls to the AI service); the app stays Spring MVC |
| `spring-boot-starter-security` | Security filter chain |
| `spring-boot-starter-data-jpa` | Hibernate 7 + Spring Data |
| `spring-boot-starter-validation` | Bean Validation |
| `spring-boot-starter-actuator` | `/actuator/health` |
| `spring-boot-starter-flyway` + `org.flywaydb:flyway-database-postgresql` | Migrations |
| `org.postgresql:postgresql` | JDBC driver |
| `io.jsonwebtoken:jjwt-api` / `jjwt-impl` / `jjwt-jackson` `0.13.0` | JWT (runtime scope for impl/jackson) |
| `org.springdoc:springdoc-openapi-starter-webmvc-ui` `3.0.x` | Swagger UI (use 2.8.x on Boot 3.5) |
| `com.bucket4j:bucket4j_jdk17-core` `8.x` | Rate limiting (in-memory) |
| `com.github.ben-manes.caffeine:caffeine` | Small caches (voice tokens, system status) |
| `org.projectlombok:lombok` | Boilerplate (annotation processor) |
| `org.mapstruct:mapstruct` + `mapstruct-processor` `1.6.x` | Entity ↔ DTO mapping |
| Test: `spring-boot-starter-test`, `spring-boot-starter-webmvc-test`, `spring-security-test`, `org.testcontainers:postgresql`, `org.testcontainers:junit-jupiter` | Tests |

Lombok must be listed **before** MapStruct in `annotationProcessorPaths`, plus `lombok-mapstruct-binding`.

### 1.2 Boot 4 vs 3.5 notes
- Boot 4 uses Jackson 3: packages `tools.jackson.*` (annotations stay `com.fasterxml.jackson.annotation`). Customize with `JsonMapperBuilderCustomizer`.
- Hibernate's JSON column mapping (`@JdbcTypeCode(SqlTypes.JSON)`) may need Jackson 2 on the classpath depending on the Hibernate version Boot manages. `jjwt-jackson` already brings `com.fasterxml.jackson.core:jackson-databind`; if JSON columns fail to (de)serialize, add it explicitly.
- `@SpringBootTest` no longer configures MockMvc automatically: add `@AutoConfigureMockMvc`.
- On Boot 3.5: use `spring-boot-starter-web`, plain `flyway-core`, springdoc 2.8.x, `com.fasterxml.jackson` packages.

---

## 2. Package structure

```
backend/
├── pom.xml
├── .env.example                      # copy to .env (git-ignored)
└── src/main/java/com/learnai/
    ├── LearnAiApplication.java       # @SpringBootApplication @EnableScheduling @ConfigurationPropertiesScan
    ├── config/
    │   ├── AppProperties.java        # @ConfigurationProperties("app") (§4)
    │   ├── SecurityConfig.java       # filter chain (§5.1)
    │   ├── OpenApiConfig.java        # bearerAuth scheme, API info
    │   ├── WebClientConfig.java      # AiServiceClient WebClient (timeouts, token header)
    │   ├── AsyncConfig.java          # virtual-thread executor "turnExecutor", single-thread "heavyJobExecutor", "jobExecutor"
    │   ├── WebSocketConfig.java      # registers VoiceWebSocketHandler at /ws/voice
    │   ├── JacksonConfig.java        # ISO dates, non-null, enums as names
    │   └── RateLimitConfig.java      # bucket definitions (§5.6)
    ├── security/
    │   ├── JwtService.java           # create/parse access tokens
    │   ├── JwtAuthenticationFilter.java
    │   ├── OriginCheckFilter.java    # CSRF origin check (§5.4)
    │   ├── CookieService.java        # write/clear auth cookies
    │   ├── CurrentUser.java          # record(UUID id, Role role) — principal
    │   ├── AuthEntryPoint.java       # 401 JSON body
    │   └── AccessDeniedHandlerImpl.java # 403 JSON body
    ├── controller/                   # one per API group (API_CONTRACT §6)
    │   ├── AuthController.java  SettingsController.java  UserController.java
    │   ├── ChatController.java  MessageController.java  HarnessController.java
    │   ├── ProviderController.java  DocumentController.java  JobController.java
    │   ├── ImageSessionController.java  ImageController.java  FileController.java
    │   ├── VoiceController.java  LearningController.java  QuizController.java
    │   ├── EvalController.java  SystemController.java  AdminController.java
    ├── dto/
    │   ├── request/                  # records with Bean Validation annotations
    │   ├── response/                 # records matching API_CONTRACT §4 exactly
    │   └── ai/                       # records for the internal AI service API (AI_SERVICE.md §4)
    ├── entity/                       # JPA entities (§6.2)
    │   └── enums/                    # Role, Tab, MessageRole, MessageStatus, TurnStatus, Task, ProviderKind, ...
    ├── repository/                   # Spring Data JPA interfaces (§6.3)
    ├── service/                      # interfaces
    │   └── impl/                     # implementations (@Service)
    ├── harness/                      # turn orchestration helpers used by HarnessServiceImpl
    │   ├── TurnRunner.java           # runs one turn on a virtual thread (§7.3)
    │   ├── TurnRegistry.java         # turnId → Disposable for cancellation
    │   ├── SseWriter.java            # safe emitter writes + heartbeat
    │   ├── HistoryBuilder.java       # HARNESS.md §7.5
    │   ├── TaskInputResolver.java    # builds taskInput per task (§7.5)
    │   ├── TurnOutcomeService.java   # side effects of FAILED/EXPIRED/CANCELLED turns (§7.9)
    │   └── task/                     # TaskHandler implementations (§7.6)
    │       ├── TaskHandler.java  MessageTaskHandler.java  TitleTaskHandler.java
    │       ├── ImageClarifyTaskHandler.java  ImagePromptTaskHandler.java
    │       ├── LearnQuestionTaskHandler.java  LearnPlanTaskHandler.java  LearnStepTaskHandler.java
    │       ├── QuizTaskHandler.java  EvalCaseTaskHandler.java
    ├── client/
    │   ├── AiServiceClient.java      # all calls to the AI service (§8)
    │   └── AiVoiceRelay.java         # WebSocket client to the AI service voice endpoint
    ├── job/
    │   ├── JobRunner.java            # picks QUEUED jobs, dispatches by type (§9.1)
    │   ├── IngestJobHandler.java  ImageJobHandler.java  BgRemovalJobHandler.java
    ├── storage/
    │   └── FileStorage.java          # paths, sanitizing, quotas (§9.3)
    ├── scheduling/
    │   └── HousekeepingTasks.java    # turn expiry, purges (§9.4)
    ├── exception/
    │   ├── ApiException.java         # (HttpStatus status, String code, String message, Map details)
    │   ├── GlobalExceptionHandler.java  # @RestControllerAdvice → API_CONTRACT §3 body
    └── util/
        ├── Hashing.java  Ids.java  TextUtil.java  Crypto.java (AES-GCM)
```

Layer rules (enforced in review):
- Controllers: HTTP mapping, `@Valid`, `@AuthenticationPrincipal CurrentUser`, call one service method, return a DTO. No repositories, no business logic.
- Services: all logic, `@Transactional` on writes (`readOnly = true` on reads). Every repository query includes the owner `userId`.
- Entities never leave the service layer; MapStruct mappers convert to DTOs.
- Lombok on entities: `@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder` — **never `@Data`** (breaks lazy loading and equals/hashCode). Constructor injection everywhere (`@RequiredArgsConstructor`), no field `@Autowired`.

---

## 3. Running

```bash
docker compose up -d postgres                 # pgvector image, port 5432
cd backend && cp .env.example .env            # fill values (§4)
./mvnw spring-boot:run                        # Flyway migrates on startup
open http://localhost:8080/swagger-ui.html    # Authorize with the accessToken from /api/auth/login
./mvnw test                                   # unit + Testcontainers integration tests
```

---

## 4. Configuration

`src/main/resources/application.yml`:
```yaml
spring:
  config:
    import: optional:file:.env[.properties]
  threads:
    virtual:
      enabled: true
  datasource:
    url: ${DB_URL}
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
    hikari:
      maximum-pool-size: 20
  jpa:
    hibernate:
      ddl-auto: validate
    open-in-view: false
    properties:
      hibernate.jdbc.time_zone: UTC
  flyway:
    enabled: true
  servlet:
    multipart:
      max-file-size: ${MAX_UPLOAD_MB:25}MB
      max-request-size: ${MAX_UPLOAD_MB:25}MB
  mvc:
    async:
      request-timeout: 20m          # SSE streams; each SseEmitter also sets its own timeout
server:
  port: ${SERVER_PORT:8080}
  forward-headers-strategy: framework
springdoc:
  api-docs:
    enabled: ${SPRINGDOC_ENABLED:true}
  swagger-ui:
    path: /swagger-ui.html
management:
  endpoints.web.exposure.include: health
app:
  public-url: ${PUBLIC_URL:http://localhost:3000}
  jwt:
    secret: ${JWT_SECRET}
    access-minutes: ${JWT_ACCESS_MINUTES:30}
    refresh-days: ${JWT_REFRESH_DAYS:14}
  ai-service:
    url: ${AI_SERVICE_URL:http://localhost:8001}
    ws-url: ${AI_SERVICE_WS_URL:ws://localhost:8001}
    token: ${AI_SERVICE_TOKEN}
    connect-timeout-ms: 5000
    prepare-timeout-s: 60
    generate-idle-timeout-s: 60
    finalize-timeout-s: 60
    job-timeout-s: 900
  storage-dir: ${STORAGE_DIR:./storage}
  max-upload-mb: ${MAX_UPLOAD_MB:25}
  user-storage-quota-mb: ${USER_STORAGE_QUOTA_MB:500}
  harness:
    turn-ttl-minutes: ${HARNESS_TURN_TTL_MINUTES:10}
    max-completion-kb: ${HARNESS_MAX_COMPLETION_KB:32}
    remote-url-enabled: ${HARNESS_REMOTE_URL_ENABLED:false}
    force-strict-profile: ${FORCE_STRICT_PROFILE:false}
    provider-key-secret: ${PROVIDER_KEY_SECRET}
  admin-emails: ${ADMIN_EMAILS:}      # comma-separated; these users get ADMIN at registration
```

`backend/.env.example`:
```
SERVER_PORT=8080
PUBLIC_URL=http://localhost:3000
DB_URL=jdbc:postgresql://localhost:5432/learnai
DB_USERNAME=learnai
DB_PASSWORD=change-me
JWT_SECRET=change-me-to-a-random-string-of-at-least-32-bytes
JWT_ACCESS_MINUTES=30
JWT_REFRESH_DAYS=14
AI_SERVICE_URL=http://localhost:8001
AI_SERVICE_WS_URL=ws://localhost:8001
AI_SERVICE_TOKEN=change-me-same-as-ai-service-INTERNAL_TOKEN
STORAGE_DIR=../storage
MAX_UPLOAD_MB=25
USER_STORAGE_QUOTA_MB=500
SPRINGDOC_ENABLED=true
HARNESS_TURN_TTL_MINUTES=10
HARNESS_MAX_COMPLETION_KB=32
HARNESS_REMOTE_URL_ENABLED=false
FORCE_STRICT_PROFILE=false
PROVIDER_KEY_SECRET=change-me-32-bytes-base64
ADMIN_EMAILS=
```
Startup validation (`AppProperties` with `@Validated`): `JWT_SECRET` ≥ 32 bytes; `PROVIDER_KEY_SECRET` decodes to 32 bytes when REMOTE_URL is enabled; `STORAGE_DIR` exists and is writable; `PUBLIC_URL` is a valid URL. Fail fast otherwise.

`STORAGE_DIR` must be the **same directory** the AI service uses (shared disk); both default to `<repo>/storage`.

---

## 5. Security

### 5.1 Filter chain (`SecurityConfig`)
- `sessionManagement(STATELESS)`, `csrf.disable()` (replaced by `OriginCheckFilter`), `cors.disable()` (same origin through the Next.js proxy), `formLogin/httpBasic` disabled.
- Order: `OriginCheckFilter` → `JwtAuthenticationFilter` → authorization.
- Public: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `/swagger-ui/**`, `/v3/api-docs/**`, `/actuator/health`, `/ws/voice` (authenticated by its own one-time token).
- `/api/admin/**` → `hasRole('ADMIN')`. Everything else under `/api/**` → authenticated.
- `AuthEntryPoint` and `AccessDeniedHandlerImpl` write the API_CONTRACT §3 error body (`UNAUTHENTICATED` / `FORBIDDEN`).
- Response headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `X-Frame-Options: DENY` (the frontend sets the page CSP).

### 5.2 JWT (`JwtService`)
- HS256 with key `Keys.hmacShaKeyFor(secretBytes)`.
- Claims: `sub` = user id, `role`, `iat`, `exp` (= iat + 30 min), `jti` = random UUID.
- Create: `Jwts.builder().subject(id).claim("role", role).id(jti).issuedAt(now).expiration(exp).signWith(key).compact()`.
- Parse: `Jwts.parser().verifyWith(key).clockSkewSeconds(30).build().parseSignedClaims(token).getPayload()`.
- `JwtAuthenticationFilter`: token from cookie `access_token`, else `Authorization: Bearer`. Invalid/expired → continue unauthenticated (the entry point answers 401). Valid → `UsernamePasswordAuthenticationToken(new CurrentUser(id, role), null, [ROLE_x])`. The user row is **not** loaded per request; disabled users are rejected at refresh time (access tokens live 30 min).

### 5.3 Passwords, login, refresh (`AuthServiceImpl`)
- BCrypt strength 12 (`BCryptPasswordEncoder(12)`). BCrypt only uses the first 72 bytes, hence the 72-character limit.
- **Register:** lower-case + trim email; `existsByEmail` → 409 `EMAIL_TAKEN`; create user (role ADMIN if the email is in `ADMIN_EMAILS`), settings row (timezone from `X-Timezone` header if valid), issue tokens.
- **Login:** load by email; if missing, still run `passwordEncoder.matches` against a fixed dummy hash (equal timing); mismatch or disabled → 401 `INVALID_CREDENTIALS`.
- **Issue tokens:** access JWT; refresh token = 32 random bytes (`SecureRandom`) base64url; store `sha256(token)` with a new `family_id`, `expires_at = now + 14 d`, user agent (truncated 255).
- **Refresh:** read cookie → hash → find row.
  - Not found or expired or revoked → 401 `REFRESH_INVALID`.
  - `used_at` already set (reuse) → set `revoked_at` on **all** tokens of that `family_id`, 401 `REFRESH_REUSED`.
  - User disabled → 401 `REFRESH_INVALID`.
  - Otherwise set `used_at = now`, insert a new token in the same family, issue new cookies. All in one transaction with `SELECT … FOR UPDATE` on the token row (prevents double use under concurrency).
- **Logout:** revoke the presented refresh token's family; clear all three cookies (`Max-Age=0`).
- Every response that sets `refresh_token` also sets `session_hint=1`; every response that clears it (logout, `REFRESH_INVALID`, `REFRESH_REUSED`) also clears `session_hint`.

### 5.4 CSRF origin check (`OriginCheckFilter`)
For `POST/PUT/PATCH/DELETE` requests that carry the `access_token` or `refresh_token` cookie: read `Origin` (or, if absent, the origin part of `Referer`); it must equal `app.public-url`'s origin (scheme + host + port). Otherwise 403 `FORBIDDEN_ORIGIN`. Requests authenticated only by `Authorization: Bearer` skip this check.

### 5.5 Cookies (`CookieService`)
Use `ResponseCookie` (API_CONTRACT §2): `access_token` (Path `/`, Max-Age 1800), `refresh_token` (Path `/api/auth`, Max-Age 1209600), `session_hint` = `1` (Path `/`, Max-Age 1209600); all `HttpOnly`, `SameSite=Lax`, `Secure` when `public-url` starts with `https`.

### 5.6 Rate limiting
- `@RateLimit(name = "harness.create")` annotation on controller methods; `RateLimitInterceptor` (HandlerInterceptor) resolves the key (`userId`, or client IP for auth endpoints, or the login email), gets/creates a Bucket4j bucket from a Caffeine cache (expire after 2 h idle), and returns 429 `RATE_LIMITED` with `Retry-After` when empty.
- Buckets (from API_CONTRACT §3.3): `auth.login.ip` 10/min, `auth.login.email` 20/h, `auth.register.ip` 5/h, `harness.create` 20/min + 400/day, `harness.complete` 40/min, `documents.upload` 20/h, `images.generate` 10/h, `messages.translate` 60/h, `voice.token` 30/h, `evals.create` 10/day.
- Client IP: `request.getRemoteAddr()` after `forward-headers-strategy: framework` (trust only the local reverse proxy).
- Storage quota: `SUM(documents.size_bytes) + SUM(images.size_bytes)` per user ≤ `USER_STORAGE_QUOTA_MB` → else 429 `QUOTA_EXCEEDED` (checked before an upload or an image job is accepted).

### 5.7 Secrets at rest (`Crypto`)
REMOTE_URL API keys: AES-256-GCM with key `PROVIDER_KEY_SECRET` (base64, 32 bytes), random 12-byte nonce; stored as `nonce || ciphertext || tag`. Decrypted only when building an AI service `/generate` call. Never logged, never returned.

---

## 6. Database

### 6.1 Schema
The complete Flyway migration is **`sql/V1__init.sql`** in this spec package (copy to `src/main/resources/db/migration/V1__init.sql`). It was tested on PostgreSQL 16. Tables: `users, refresh_tokens, user_settings, model_providers, documents, chats, chat_documents, messages, feedback, harness_turns, turn_metrics, guard_events, chunks, jobs, image_sessions, images, learning_paths, learning_steps, quizzes, quiz_attempts, eval_runs, eval_results`.

Important constraints already in the SQL:
- `uq_turns_open_lock`: one open turn per `lock_key` (`chat:{id}`, `path:{id}`, `run:{id}`; HARNESS.md §3.7). Catch `DataIntegrityViolationException` on insert → 409 `CONFLICT` "Another request for this item is still running."
- `uq_model_providers_default`, `uq_model_providers_host`: one default and one HOST provider per user.
- `chunks` has **no HNSW index** on purpose: retrieval filters to the user's chosen documents and then does an exact search (AI_SERVICE.md §7.3).

Rules: never edit an applied migration; every change is a new `V{n}__description.sql`; `ddl-auto: validate` must pass.

### 6.2 Entities (one per table except `chunks`)
| Entity | Table | Notes |
|---|---|---|
| `User` | users | `email` as `String` (citext column) |
| `RefreshToken` | refresh_tokens | |
| `UserSettings` | user_settings | `@Id userId`, `@MapsId` to `User` |
| `ModelProvider` | model_providers | `modelProfile`, `profileOverrides` as `@JdbcTypeCode(SqlTypes.JSON) Map<String,Object>`; `profileRulesVersion String`; `apiKeyEncrypted byte[]` |
| `Document` | documents | |
| `Chat` | chats | `@ManyToMany` documents via `chat_documents` (Set<Document>, LAZY); `activeLeafId UUID` (plain column, not a relation) |
| `Message` | messages | `parentId UUID` plain column; `translations`, `meta` JSON |
| `Feedback` | feedback | `@Id messageId` |
| `HarnessTurn` | harness_turns | `request`, `prepareContext`, `preparedMessages` JSON (`JsonNode` or `Map`); `lockKey String` (nullable) |
| `TurnMetrics` | turn_metrics | written once per terminal turn |
| `GuardEvent` | guard_events | |
| `ChunkView` | chunks | **read-only** (`@Immutable`), maps only `id, userId, documentId, source, page, startChar, endChar, text, textEn` (no embedding, no tsv) |
| `Job` | jobs | |
| `ImageSession`, `Image` | image_sessions, images | `Image.sizeBytes` = PNG file size (used by the storage quota) |
| `LearningPath`, `LearningStep` | learning_paths, learning_steps | `interview`, `plan`, `objectives` JSON |
| `Quiz`, `QuizAttempt` | quizzes, quiz_attempts | `questions` JSON includes answers |
| `EvalRun`, `EvalResult` | eval_runs, eval_results | `EvalRun.caseCategories` JSON map; `EvalResult.error` (nullable) marks a case that could not be run |

All entities: `@Id @GeneratedValue(strategy = GenerationType.UUID) UUID id` (except shared-key ones), `@CreationTimestamp createdAt`, `@UpdateTimestamp updatedAt` where the column exists. Enums: `@Enumerated(EnumType.STRING)`.

### 6.3 Repositories (custom methods)
- `ChatRepository`: `Page<Chat> findByUserIdAndTabOrderByUpdatedAtDesc(UUID, Tab, Pageable)`; `…AndTitleContainingIgnoreCase…` for `q`; `Optional<Chat> findByIdAndUserId(UUID, UUID)`.
- `MessageRepository`: `List<Message> findByChatIdOrderByCreatedAtAsc(UUID)` (max 1000; throw 409 `CONFLICT` "chat too long" beyond); `Optional<Message> findByIdAndChatUserId(UUID id, UUID userId)` (JPQL join).
- `HarnessTurnRepository`: `findByIdAndUserId`; native `expireOpenTurns(Instant now)` = `UPDATE harness_turns SET status = 'EXPIRED', completed_at = now() WHERE status IN ('PREPARING','AWAITING_APPROVAL','READY') AND expires_at < :now RETURNING *`; native `failStuckTurns(Instant cutoff)` = the same for `GENERATING`/`FINALIZING` with `updated_at < :cutoff` → `FAILED`, `error_code = 'AI_TIMEOUT'`. Both return the changed rows so `TurnOutcomeService.onTerminal` (§7.9) can run each turn's side effects.
- `ChunkViewRepository`: `Optional<ChunkView> findByIdAndUserId`.
- `DocumentRepository`: `findByIdAndUserId`, `@Query sum(sizeBytes) by userId`, `findAllByIdInAndUserIdAndStatus(ids, userId, READY)`.
- `JobRepository`: `@Query(nativeQuery) … FOR UPDATE SKIP LOCKED LIMIT 1` to claim the next QUEUED job of a set of types.
- Others: standard `findByIdAndUserId` + paged lists by `userId` ordered by `updatedAt/createdAt desc`.

---

## 7. Harness orchestration

### 7.1 Endpoints → service
| Endpoint | Method |
|---|---|
| `POST /api/harness/turns` | `HarnessService.startTurn(user, request) : SseEmitter` |
| `POST /api/harness/turns/{id}/approval` | `HarnessService.approve(user, turnId, request) : SseEmitter` |
| `POST /api/harness/turns/{id}/complete` | `HarnessService.complete(user, turnId, request) : TurnResult` |
| `POST /api/harness/turns/{id}/cancel` | `HarnessService.cancel(user, turnId, request) : CancelTurnResponse` |
| `GET /api/harness/turns/{id}` | `HarnessService.getTurn(user, turnId)` |

**Status changes are always conditional.** Every change of `harness_turns.status` is `UPDATE harness_turns SET status = :new, … WHERE id = :id AND status IN (:expected) RETURNING *`. Zero rows means another path (cancel, housekeeping, a parallel request) won the race: the caller stops at once, saves nothing and runs no side effects (`complete` then answers `409` per API_CONTRACT §6.4). Task handlers run in the same transaction as the `FINALIZING → terminal` update, with the turn row locked (`SELECT … FOR UPDATE`), and re-check their target state under its row lock (path still in the expected state and not restarted, step not deleted, eval run still `RUNNING`); if the target moved on, the result is discarded and the turn ends `CANCELLED`.

### 7.2 `startTurn` (synchronous part, before the stream)
1. Validate per API_CONTRACT §6.4 (exactly-one rules for MESSAGE; task/target compatibility; `content` length 1–4000; `taskInput` per task).
2. Load the provider (`findByIdAndUserId`) → 404 if missing. REMOTE_URL with the feature off → 503 `FEATURE_UNAVAILABLE`.
3. Load and check the target (chat/session/path/step/run) ownership and state:
   - `LEARN_QUESTION`: path state INTERVIEWING with no pending question; `LEARN_PLAN`: state PLANNING; `LEARN_STEP`: path ACTIVE, step status ≠ LOCKED and `contentStatus` ∈ {EMPTY, FAILED}; `QUIZ`: step content READY; `EVAL_CASE`: run RUNNING and `caseId` ∈ `caseIds` with no result yet or only an error result; `TITLE`: chat exists.
   - Lock key: MESSAGE → `chat:{chatId}`; LEARN_QUESTION/LEARN_PLAN → `path:{pathId}`; LEARN_STEP/QUIZ → `path:{step.pathId}`; EVAL_CASE → `run:{runId}`; other tasks → null.
4. Load settings; guard profile = STRICT if `force-strict-profile`, TEST for `EVAL_CASE`, else the user's.
5. In one transaction:
   - MESSAGE + `content`: create the user message (`parentId` = `editOf`'s parent if editing, else request `parentId` or `chat.activeLeafId`; `content` = trimmed text; `meta.task = MESSAGE`). Set `chat.activeLeafId` to it, `chat.updatedAt = now`, `lastMessagePreview`.
   - MESSAGE + `regenerateOf`: the user message = parent of `regenerateOf` (must be a USER message of this chat).
   - MESSAGE + `answerOf`: must be a USER message of this chat with no ASSISTANT child.
   - Insert `harness_turns` (status `PREPARING`, `generation` from provider kind, `lock_key`, `expires_at = now + ttl`, `request` JSON). Unique-index violation → 409 `CONFLICT` ("Another request for this item is still running.") and the transaction (including a just-created user message) rolls back.
6. Create `SseEmitter(Duration.ofMinutes(15).toMillis())`, register it with `SseWriter` (heartbeat every 15 s), submit `TurnRunner.run(turnId)` to the virtual-thread `turnExecutor`, return the emitter. Response headers per API_CONTRACT §5 (set in the controller via `ResponseEntity.ok().header(...)` wrapping the emitter).

### 7.3 `TurnRunner.run` (asynchronous, one virtual thread per turn)
```
if provider.profileRulesVersion != aiClient.capabilities().rulesVersion → re-resolve and store the profile (§9.5)
send `turn` event (userMessage = the user message being answered: new for content/editOf, existing for regenerateOf/answerOf)
req   = AiPrepareRequest(turn, user, provider, chat, input, history = HistoryBuilder.build(...), taskInput = TaskInputResolver.resolve(...))
        // user = { id, timezone, now, outputLanguage (request value or settings), answerLength, temperature,
        //          guardProfile (§7.2 step 4), askBeforeSearch } from user_settings; provider.profile = the stored resolved profile
flux  = aiClient.prepare(req)                       // SSE from the AI service
for each internal event (subscribe; Disposable stored in TurnRegistry):
  status          → relay `status`
  sources/tools   → relay (mapped, see the table below)
  needs_approval  → stream already disconnected? → turn CANCELLED; stop.
                    else save prepare_context, status AWAITING_APPROVAL; send `approval`; complete emitter; stop
  blocked         → persist guard events; MESSAGE: MessageTaskHandler.apply(turn, result built from the event: status BLOCKED or
                    SUPPORT, content/originalContent/translations as sent by the AI service) — the same handler as finalized answers,
                    so activeLeafId, preview, AUTO title and the user message's model_input are updated; turn BLOCKED
                    (result_message_id); send `blocked`; metrics from context.metrics; stop
  abstained       → MESSAGE: MessageTaskHandler.apply(…, status ABSTAINED); turn ABSTAINED; send `abstained`; metrics; stop
  prepared        → save prepare_context, prepared_messages, attempt; persist input guard events
                    CLIENT: stream already disconnected? → turn CANCELLED; stop (otherwise the lock would be held until expiry).
                            else status READY with expires_at = now + ttl; send `prepared`; complete emitter; stop
                    SERVER: status GENERATING; send `status{GENERATING}`; call generate (below)
  error           → turn FAILED (error_code); onTerminal (§7.9); send `error`; stop
```
SERVER generation:
```
genFlux = aiClient.generate(AiGenerateRequest(turnId, target(provider, decrypted key), messages, params, schema, profile, clientGuard))
queued → relay `status { stage: QUEUED, detail: String.valueOf(position) }`
token  → append to StringBuilder; relay `token`
done   → finalizeAndApply(turn, content = done.content, finishReason, stats)  (§7.4), then send the event that matches the result:
         CANCELLED → `cancelled`; any other status → `done` with the TurnResult.
         A retry result (attempts left) instead sends `retry { attempt, reason }`, clears the buffer and generates again with
         messages + repairMessages.
error  → turn FAILED (error_code); onTerminal; send `error` (retryable = code in {AI_TIMEOUT, PROVIDER_UNAVAILABLE, AI_SERVICE_UNAVAILABLE})
cancel requested (POST /cancel, §7.8) or client disconnect (SseWriter detects IOException / onError / onCompletion before done)
       → dispose genFlux; MESSAGE with non-empty partial text → finalizeAndApply(partial, ABORTED) and send the matching event
         (`done`, or `cancelled` if finalize found nothing left after reasoning removal); otherwise turn CANCELLED and send
         `cancelled` (sending is skipped when the stream is already closed)
```
`SseWriter.send` catches `IOException`/`IllegalStateException` (emitter completed) and marks the stream as disconnected; it never throws into the runner.

**Mapping internal AI events to public events** (the browser never sees internal fields):
| Internal (AI_SERVICE.md §4.2–4.4) | Public (API_CONTRACT §5.1) |
|---|---|
| `sources` items (`SourceItem`) | `SourceDto`: drop `text` and `chunkEmbeddingAvailable` |
| `tools` | unchanged (`ToolResultDto[]`) |
| `needs_approval {query}` | `approval { turnId, kind: SEARCH_QUERY, content: query }` |
| `blocked {action, categories, content, originalContent, translations, …}` | `blocked { action, message (MESSAGE: the saved assistant message, else null), refusal: content, categories }` |
| `abstained {reason, content, originalContent, translations, suggestions, …}` | `abstained { message }` (the saved assistant message with those texts and `meta.suggestions`) |
| `prepared {messages, params, outputSchema, modelProfile, clientGuard, context, guardEvents}` | `prepared { turnId, messages, params, outputSchema, modelProfile, clientGuard, attempt }` |
| `/generate` `queued {position}` / `token {text}` | `status { stage: QUEUED, detail }` / `token { text }` |
| `/guard/check` `{action, categories, refusal{EN,KM}}` | BLOCK or SUPPORT → `400 GUARD_BLOCKED { action, category: categories[0], refusal: refusal[KM if settings.outputLanguage = KM else EN] }` |

### 7.4 `finalizeAndApply` (shared by SERVER `done` and CLIENT `complete`)
1. Turn status `FINALIZING` (conditional: from `READY` for `complete`, from `GENERATING` for SERVER); `status{CHECKING_OUTPUT}` (SERVER only).
2. `aiClient.finalize(AiFinalizeRequest(turn context, output, user, provider, taskInput, attempt))`. **If this call or the task handler (step 4) fails** — AI service unreachable (`AI_SERVICE_UNAVAILABLE`), timeout (`AI_TIMEOUT`), any exception (`INTERNAL_ERROR`) — roll back the handler's changes, set the turn `FAILED` with that `error_code` in a new transaction, run `onTerminal` (§7.9), then SERVER: send `error`; CLIENT: answer `complete` with that error. The turn never stays in `FINALIZING`.
3. Persist `guardEvents` from the response.
4. Branch on `response.status` (this is the backend side of API_CONTRACT §6.4 "Turn outcomes"):
   - `EMPTY` and `finishReason = ABORTED` → turn `CANCELLED`; no message; result `TurnResult { status: CANCELLED }` (SERVER: send `cancelled`).
   - `SCHEMA_INVALID` or `EMPTY` with `response.attemptsLeft > 0` → `attempt + 1`, `expires_at = now + ttl`;
     CLIENT → turn back to `READY`, return HTTP 422 `SCHEMA_INVALID` `{ reason, errors, attemptsLeft, repairMessages }`;
     SERVER → turn `GENERATING`, send `retry { attempt, reason }`, call generate again with `messages + repairMessages` (loop).
   - `SCHEMA_INVALID` or `EMPTY` with `attemptsLeft = 0` → turn `FAILED` (`error_code = SCHEMA_INVALID` or `EMPTY_OUTPUT`); **no assistant message**; `TurnOutcomeService.onTerminal` (§7.9); result `TurnResult { status: FAILED, message: null, data: null, notice: "This model couldn't produce a valid result. Try again or choose another model." }`.
   - `COMPLETED` → `TaskHandler.apply(turn, response)` (§7.6) → turn `COMPLETED`.
   - `BLOCKED` or `SUPPORT` → MESSAGE: `MessageTaskHandler` saves the message (status BLOCKED, or COMPLETE with guard SUPPORT); other tasks: nothing applied. Turn `BLOCKED`; `guardAction` = REPLACE or SUPPORT; `notice` = `response.content` for non-MESSAGE tasks (the AI service already picked the user's language, API_CONTRACT §6.4).
   - `ABSTAINED` (MESSAGE only) → `MessageTaskHandler` saves status ABSTAINED; turn `ABSTAINED`.
   - Always set `completed_at = now` and `result_message_id` (MESSAGE) on a terminal status. `TurnResult.status` = the turn's final status.
5. Write `turn_metrics` once per terminal turn: `prepare_context.metrics` + the response `metrics` + generation stats + timings.

### 7.5 `HistoryBuilder` and `TaskInputResolver`
- `HistoryBuilder.build(chat, parentMessageId)`: load all messages of the chat once (`findByChatIdOrderByCreatedAtAsc`), index by id, walk up from `parentMessageId` to the root, reverse, then apply HARNESS.md §7.5 steps 1–3 only (complete pairs, model-language text, at most 40 messages). Cleaning, per-message cut, per-pipeline caps and the token budget (steps 4–6) are done by the AI service, which reads them from `rules/`. Also returns `previousUserMessage` (the latest earlier user message's model text) for follow-up query building.
- `TaskInputResolver` builds `taskInput` for the AI service:

| Task | taskInput sent to the AI service |
|---|---|
| TITLE | `{ conversation: { user: <first user message content ≤600>, assistant: <first assistant original/content ≤600> } }` |
| IMAGE_CLARIFY | `{ request }` |
| IMAGE_PROMPT | `{ request, answers, style }` |
| LEARN_QUESTION | `{ goal, answered: { topic: answer }, askedTopics: [...] }` |
| LEARN_PLAN | `{ goal, answers: { topic: answer } }` |
| LEARN_STEP | `{ planTitle, level, stepNumber, totalSteps, title, summary, objectives, previousTitles }` |
| QUIZ | `{ lesson: step.content, count }` |
| EVAL_CASE | `{ suite, caseId }` |

### 7.6 Task handlers (`harness/task/*`, interface `TurnResult apply(HarnessTurn turn, AiFinalizeResponse r)`)
| Handler | Logic |
|---|---|
| `MessageTaskHandler` | Create ASSISTANT message: `parentId` = turn's user message; `content` = r.content; `originalContent`, `translations`; `status` by this precedence: BLOCKED (r.status BLOCKED) > COMPLETE with `meta.guard.action = SUPPORT` (r.status SUPPORT, even if stopped) > ABSTAINED (r.status ABSTAINED) > STOPPED (finishReason ABORTED) > COMPLETE; `meta` = { task, pipeline, providerKind, model, outputLanguage, sources (from context, `snippet` ≤ 300), grounding, guard, tools, suggestions, stats, finishReason }. Set `chat.activeLeafId`, `updatedAt`, `lastMessagePreview`. If `chat.titleSource = DEFAULT`: AUTO title = first 6 words of the first user message (trim trailing punctuation, ≤ 60 chars). Update the user message's `model_input` and `meta.inputLanguage` from the context. |
| `TitleTaskHandler` | If `r.data.title` is non-null and `titleSource ∈ {DEFAULT, AUTO}`: `title = clean(r.data.title)` (strip quotes/newlines, ≤ 60 chars, 2–8 words else ignore), `titleSource = AI`. Return `{ title }` (null when nothing was saved). TITLE never retries (API_CONTRACT §6.4). |
| `ImageClarifyTaskHandler` | Return `r.data` (`ImageClarifyResult`). Nothing stored. |
| `ImagePromptTaskHandler` | Return `{ prompt: r.data.prompt, originalPrompt: taskInput.request, originalPromptEnglish: context.modelInput }` (equal to the request when it was English). |
| `LearnQuestionTaskHandler` | Lock the path row (`PESSIMISTIC_WRITE`); the path must still be INTERVIEWING without a pending question (else discard, turn CANCELLED). If `r.data.done` → state `PLANNING`. Else append `{topic, question, options, answer: null}`. Return `LearningPathDto`. |
| `LearnPlanTaskHandler` | Lock the path row; it must still be PLANNING. Set `plan = r.data`, state `AWAITING_APPROVAL`. |
| `LearnStepTaskHandler` | Lock the path row; the path must be ACTIVE and the step must still exist. `step.content = r.content` (English), `contentStatus = READY`. |
| `QuizTaskHandler` | Lock the path row; the step must still exist with content READY. Insert `Quiz(questions = r.data.questions)` (with answers and evidence). Return `QuizDto` **without** answers. |
| `EvalCaseTaskHandler` | Lock the run row; it must still be `RUNNING` (else discard the result, turn CANCELLED). Upsert `EvalResult` from `r.evalResult` (unique per run+case: replace an earlier error result). `completedCases` = `COUNT(DISTINCT case_id)` of the run's results. If it equals `caseIds.size()` → `EvalService.completeRun(run)` (§9.10). Return `EvalResultDto`. |

### 7.7 `complete` (CLIENT generation)
1. Load turn by id + user → 404 `TURN_NOT_FOUND`.
2. In this order: status `EXPIRED`, or `READY` with `expiresAt` passed (mark it `EXPIRED`, `onTerminal`) → 410 `TURN_EXPIRED`; any other terminal status → 409 `TURN_ALREADY_COMPLETED`; status ≠ `READY` → 409 `TURN_NOT_READY`; `attempt` ≠ the turn's attempt → 409 `TURN_NOT_READY`.
3. `content` UTF-8 size ≤ 32 KB → else 413.
4. `finishReason = ABORTED` and task ≠ MESSAGE → turn `CANCELLED`, 409 `CONFLICT`.
5. Atomically move `READY → FINALIZING` (`UPDATE … WHERE id = ? AND status = 'READY'`; 0 rows → 409). Then `finalizeAndApply` (§7.4) and return its `TurnResult` (`200`) or its `422 SCHEMA_INVALID`. An ABORTED MESSAGE with empty text comes back from finalize as `EMPTY` and ends `CANCELLED` (§7.4), never as a retry.

### 7.8 `approve` and `cancel`
- `approve`: turn must be `AWAITING_APPROVAL` and owned; `EDIT` requires `content` 1–200 chars. Conditionally set status `PREPARING` and `expires_at = now + ttl`, store `approvedQuery` in the request JSON, create a new `SseEmitter`, run `TurnRunner.run` again (the AI prepare request carries `input.approvedQuery`).
- `cancel(user, turnId, request)` (body optional, `reason` default `USER`):
  - Terminal → 409 `TURN_ALREADY_COMPLETED`. `FINALIZING` → 409 `CONFLICT`.
  - `reason = CLIENT_ERROR`: only from `READY` (conditional update; any other status → 409 `CONFLICT`): turn `FAILED`, `error_code` = `errorCode` (≤ 40 chars, default `PROVIDER_ERROR`); `TurnOutcomeService.onTerminal`; return `{ turnId, status: FAILED }`.
  - `PREPARING` / `AWAITING_APPROVAL` / `READY`: atomically set `CANCELLED` (`UPDATE … WHERE status IN (…)`), dispose the prepare subscription if one is registered, send `cancelled` on an open stream, complete it; return `{ turnId, status: CANCELLED }`.
  - `GENERATING` (SERVER): set the runner's cancel flag and dispose the generation subscription; the runner then takes the "cancel requested" path of §7.3. Return `{ turnId, status: FINALIZING }` if it will save a partial MESSAGE answer, else `{ turnId, status: CANCELLED }`.

### 7.9 Terminal side effects (`TurnOutcomeService.onTerminal(turn)`)
Called once, right after the (committed) conditional status change, whenever a turn reaches `FAILED`, `EXPIRED` or `CANCELLED` by any path (runner, `complete`, `cancel`, housekeeping). Each call runs in its own transaction (`REQUIRES_NEW`); an exception is logged and never undoes the status change, so a lock is always released.
| Task | `FAILED` | `EXPIRED` | `CANCELLED` |
|---|---|---|---|
| MESSAGE | nothing (no assistant message; the UI offers Retry with `answerOf`) | same | same |
| LEARN_STEP | step `contentStatus = FAILED` | nothing (content stays EMPTY/FAILED) | nothing |
| EVAL_CASE | lock the run row; only if it is `RUNNING`: upsert an error result `{ category: run.caseCategories[caseId], passed: false, checks: [], output: "", error: turn.error_code }` unless a non-error result exists; recount `completedCases`; then, if the run now has 5 error results → run `FAILED`, `finishedAt`; else if every case has a result → `EvalService.completeRun(run)` | same with `error = TURN_EXPIRED` | nothing |
| others | nothing | nothing | nothing |
Also write `turn_metrics` (status, `prepare_context.metrics` if any) if not written yet.

---

## 8. AI service client (`AiServiceClient`)

- `WebClient` with base URL `app.ai-service.url`, default header `X-Internal-Token`, Reactor Netty connect timeout 5 s.
- Methods and timeouts (all internal shapes in AI_SERVICE.md §4):

| Method | AI endpoint | Type | Timeout |
|---|---|---|---|
| `prepare(req)` | `POST /harness/prepare` | `Flux<ServerSentEvent<String>>` | 60 s total |
| `generate(req)` | `POST /generate` | `Flux<ServerSentEvent<String>>` | 60 s idle between events (`.timeout(Duration.ofSeconds(60))`); `queued` events every 10 s keep a waiting request alive |
| `finalize(req)` | `POST /harness/finalize` | `Mono<AiFinalizeResponse>` | 60 s |
| `translate(text, src, tgt)` | `POST /translate` | Mono | 60 s |
| `ingest(req)` | `POST /rag/ingest` | Flux (progress) | 15 min |
| `deleteDocumentChunks(id)` | `DELETE /rag/documents/{id}` | Mono | 30 s |
| `imagesGenerate / imagesVariations` | `POST /images/generate`, `/images/variations` | Flux (progress) | 15 min |
| `removeBackground(req)` | `POST /images/remove-background` | Mono | 2 min |
| `guardCheck(req)` | `POST /guard/check` | Mono | 15 s |
| `checkUrl(url)` | `POST /guard/check-url` | Mono | 15 s |
| `capabilities()`, `status()` | `GET /capabilities`, `GET /status` | Mono | 5 s |
| `catalog()`, `profile(kind, model, overrides)` | `GET /models/catalog`, `POST /models/profile` | Mono | 5 s |
| `suites()`, `suite(id)` | `GET /evals/suites`, `GET /evals/suites/{id}` | Mono | 10 s |
| `reloadRules()` | `POST /rules/reload` | Mono | 30 s |
| `tts(text, lang)` | `POST /voice/tts` | Mono<byte[]> | 60 s |

- Parse each SSE `data` with the event name into the matching `dto/ai` record (Jackson).
- Errors: connection refused / DNS → `AI_SERVICE_UNAVAILABLE` (503); timeout → `AI_TIMEOUT` (504); AI 4xx/5xx with its error body `{code, message}` → rethrow with the same code (503 for `FEATURE_UNAVAILABLE`, `PROVIDER_UNAVAILABLE`).

---

## 9. Other services

### 9.1 Jobs (`JobRunner`)
- Two executors: `jobExecutor` (virtual threads, max 4 concurrent INGEST jobs via a `Semaphore(4)`) and `heavyJobExecutor` (single thread: IMAGE, VARIATION, BG_REMOVAL).
- `@Scheduled(fixedDelay = 1000)` claims QUEUED jobs with `FOR UPDATE SKIP LOCKED` (per executor's types), sets `RUNNING`, `startedAt`, dispatches the handler.
- Progress from AI SSE events → update `progress`, `stage` (throttled to 1 DB write/second) and publish to `JobEventBus` (in-memory pub/sub) for `GET /api/jobs/{id}/events` subscribers.
- On startup: jobs left `RUNNING` → `FAILED` with error "Interrupted by restart".
- Cancel: QUEUED → CANCELLED immediately; RUNNING → set a cancel flag; the handler disposes the AI Flux and marks CANCELLED. A cancelled INGEST job also sets its document to `FAILED` with `error = "Upload cancelled."` (then `aiClient.deleteDocumentChunks`).

### 9.2 Documents (`DocumentServiceImpl`)
**Upload** (`POST /api/documents`):
1. Size ≤ `MAX_UPLOAD_MB`; extension in `.pdf .docx .txt .md`.
2. Content sniffing: PDF starts with `%PDF-`; DOCX starts with `PK\x03\x04` and the zip contains `word/document.xml`; TXT/MD decode as strict UTF-8 with no NUL bytes. Mismatch → 415.
3. Quota check (§5.6).
4. `sha256` of the bytes; if the user already has a READY document with the same hash → return `201 { document: <existing>, jobId: null, duplicate: true }` (no duplicate ingest, nothing saved).
5. Save to `STORAGE_DIR/users/{userId}/documents/{documentId}/original.{ext}` (§9.3); insert `Document(status UPLOADED)` and `Job(INGEST, payload {documentId})`; return `UploadResponse { document, jobId, duplicate: false }`.

**Ingest job** (`IngestJobHandler`): call `aiClient.ingest({ documentId, userId, path, mime, filename })`; map progress events (`PARSING` → status PARSING, `EMBEDDING`/`TRANSLATING` → status EMBEDDING); on `done {pages, chunkCount, language}` → status READY + fields; on error → FAILED with a user-safe message (`"Could not read this PDF (it may be scanned images only)."` etc. from the AI error code).

**Delete:** `aiClient.deleteDocumentChunks(id)` (chunks also cascade in SQL), delete the folder, delete the row (cascades `chat_documents`).

**Text / chunk endpoints:** `/text?page=` returns the AI-extracted page text saved during ingest at `…/{documentId}/pages/{n}.txt` (written by the AI service); `/chunks/{chunkId}` reads `ChunkView` by id + user.

### 9.3 File storage (`FileStorage`)
- Layout under `STORAGE_DIR`: `users/{userId}/documents/{documentId}/original.{ext}`, `users/{userId}/documents/{documentId}/pages/{n}.txt`, `users/{userId}/images/{imageId}.png`.
- Paths are built only from UUIDs and fixed names; the user's filename is stored in the DB only, sanitized for display: Unicode NFC, remove path separators and control characters, collapse spaces, keep ≤ 255 chars, keep the extension.
- Every resolved path is checked with `path.normalize().startsWith(storageRoot)`.
- Serving: `GET /api/files/images/{id}` loads `Image` by id + user, streams the file with `Content-Type: image/png`, `Cache-Control: private, max-age=86400`, `Content-Disposition: inline`. Documents: `GET /api/documents/{id}/file` similar with the stored MIME.

### 9.4 Housekeeping (`HousekeepingTasks`)
| Schedule | Task |
|---|---|
| every 60 s | expire open turns past `expires_at`; fail GENERATING/FINALIZING turns older than 15 min |
| daily 03:30 | set `prepared_messages = NULL` for turns older than 7 days; delete `turn_metrics` older than 180 days; delete revoked/expired refresh tokens older than 30 days |
| daily 03:40 | delete orphan files (folders under `users/*/documents` with no row) |

### 9.5 Providers (`ProviderServiceImpl`)
- `list(user)`: ensure the HOST provider (if `aiClient.capabilities().hostChatModels` is non-empty and the user has none: create `{kind: HOST, name: "Host model", model: capabilities.defaultChatModel, modelProfile: aiClient.profile(HOST, model)}`); if the user has no default, make the first provider default.
- `create`: validate per API_CONTRACT §6.5 (LOCAL_OLLAMA base URL regex `^http://(localhost|127\.0\.0\.1)(:\d{2,5})?$`; BROWSER model must be an `id` or `fallbackId` in `aiClient.catalog().browser.models` and is stored as that entry's `id` (the browser picks the build at load time); REMOTE_URL must be `https://` and pass `aiClient.checkUrl(url)` → `POST /guard/check-url`, else 422 `URL_NOT_ALLOWED`); resolve `modelProfile` via `aiClient.profile(kind, model, {})`; encrypt the API key; first provider → default.
- `testResult` (CLIENT kinds): store status OK/FAILED, `lastTestedAt`, message (first failing check's message ≤ 500 chars); if `modelInfo.contextLength` is given and smaller than the profile's `contextWindow`, store `profileOverrides.contextWindow`.
- **Whenever `profileOverrides` change** (test result, Model Test tuning): `modelProfile = aiClient.profile(kind, model, profileOverrides)` and save it with `profileRulesVersion = capabilities().rulesVersion`, so the next prepare uses it.
- **When the rules change** (a successful `reload-rules`, or the AI service restarted with different rules): `TurnRunner` re-resolves a provider's profile before a turn whenever `profileRulesVersion` differs from the current `capabilities().rulesVersion` (cached 10 s); `reload-rules` also re-resolves all providers right away (§9.11). This is how calibrated values in `models.yaml` (e.g. `tokenFactor`) reach existing providers.
- `setDefault(id)`: in one transaction clear `is_default` on the user's other providers and set it on this one. `PATCH /api/settings { defaultProviderId }` calls the same method; `SettingsDto.defaultProviderId` is read from `is_default` (there is no settings column).
- `test` (SERVER kinds): run a tiny turn-less generation through `aiClient.generate` with messages `[{user: "Reply with the word OK."}]`, `maxTokens 5`; OK if the output contains "ok".
- Changing `model` re-resolves the profile and clears `profileOverrides`.
- `catalog`: proxy of `aiClient.catalog()` (cached 10 min).

### 9.6 Chats and messages
- `getMessages`: return all messages (DTO mapping merges `feedback` rows into `meta.feedback`).
- `PATCH activeLeafId`: the id must belong to the chat; no other validation (the frontend computes leaves).
- `translate`: if `translations[target]` exists return it; else source text = `originalContent ?? content`, source language = `meta.outputLanguage` mapping (EN when `originalContent` exists, else detect by Khmer ratio), call `aiClient.translate`, save into `translations`.
- `feedback`: upsert `feedback` row.
- `DELETE /api/users/me` (`UserController`, body `{ password }`): verify password, delete the user (all rows cascade), delete `STORAGE_DIR/users/{userId}`, clear cookies, 204.

### 9.7 Images
- `generate`: `aiClient.capabilities().features.images` must be true → else 503 `FEATURE_UNAVAILABLE`. `steps` 1–8 (default 4) else 400. Storage quota check (§5.6). `aiClient.guardCheck({ text: prompt, kind: IMAGE_PROMPT, profile })` → BLOCK or SUPPORT → 400 `GUARD_BLOCKED` (mapping in §7.3). Size map: SQUARE 1024×1024, PORTRAIT 832×1216, LANDSCAPE 1216×832, WIDE 1344×768. Create `Job(IMAGE, payload {sessionId, prompt, originalPrompt, width, height, count, seed, steps})` → 202.
- `ImageJobHandler`: output dir `users/{userId}/images/`; generate image ids up front and pass target paths `{imageId}.png`; on `done` insert `Image` rows (kind GENERATED, `sizeBytes` = file size, meta {model, seed, steps, aspectRatio, durationMs}); set the session `coverImageId` if empty; `JobDto.result = { images: ImageDto[] }`.
- Variations: same with `referencePath` of the parent image, kind VARIATION, `parentId`.
- Background removal: `aiClient.capabilities().features.bgRemoval` must be true → else 503 `FEATURE_UNAVAILABLE`. `BgRemovalJobHandler` calls `removeBackground({inputPath, outputPath})`, inserts kind BG_REMOVED with `parentId` and `sizeBytes`.

### 9.8 Voice
- `POST /api/voice/token`: 32-byte random token stored in a Caffeine cache (`expireAfterWrite 60 s`) → `{userId}`.
- `VoiceWebSocketHandler` (`AbstractWebSocketHandler`): on connect, read `token` query param, remove it from the cache (single use) → unknown → close 1008. Reject a second concurrent connection for the same user (1008).
- Relay: open `AiVoiceRelay` (`java.net.http.HttpClient.newWebSocketBuilder().header("X-Internal-Token", …).buildAsync(ai ws-url + "/voice/stream")`); forward client text frames (start/stop JSON) and binary frames to the AI; forward AI text frames back. Enforce 5-minute connection limit and 60-second utterance limit (the AI also enforces). Close both sides when either closes.

### 9.9 Learning and quizzes (`LearningServiceImpl`, `QuizServiceImpl`)
- `create(goal)`: `aiClient.guardCheck({text: goal, kind: TEXT})` → BLOCK or SUPPORT → 400 `GUARD_BLOCKED` (`details.action` tells the UI which style to use, §7.3); insert path (INTERVIEWING, interview []) → `nextAction = ASK`.
- Every endpoint that changes a path (`answers`, `skip-interview`, `plan`, `approve`, `restart`, `DELETE`) first checks that no open turn holds `path:{id}` → else 409 `CONFLICT` ("Another request for this item is still running."). Together with the handlers' state re-check (§7.6) this prevents a late model result from landing on a restarted or deleted path.
- `answer(text)`: path INTERVIEWING with a pending question (last item `answer == null`) → set answer (trim, ≤ 300). Then: if topics level, outcome and time are answered, or 5 questions exist → state PLANNING, `nextAction = PLAN`; else `nextAction = ASK`.
- `skipInterview`: INTERVIEWING → PLANNING.
- `putPlan(plan)`: state AWAITING_APPROVAL; validate: 4–8 steps, titles 1–8 words unique, summary 1–300 chars, 2–4 objectives each 1–150 chars, no `http`/`www.` anywhere → 400 otherwise.
- `approve`: AWAITING_APPROVAL → create `LearningStep`s from the plan (position 1..n, step 1 `CURRENT`, others `LOCKED`, contentStatus EMPTY) → ACTIVE.
- `restart`: delete steps and quizzes, clear interview and plan → INTERVIEWING.
- `nextAction` computation: INTERVIEWING → `NONE` if a pending question exists else `ASK`; PLANNING → `PLAN`; AWAITING_APPROVAL → `APPROVE`; ACTIVE → `STUDY`; COMPLETED → `NONE`.
- **Quiz submit:** answers length must equal question count; `correct = answers[i] == questions[i].answerIndex`; `score = correct / total`; insert `QuizAttempt`; `bestScore = max`; if `score ≥ 0.7` and the step is CURRENT → step DONE, next step CURRENT (or path COMPLETED if it was the last). Return `QuizResultDto` (now including correct answers, explanations, evidence).

### 9.10 Model Test (`EvalServiceImpl`)
- `create(providerId, suite, mode)`: load suite from `aiClient.suite(suite)` → `caseIds` = all ids (FULL) or those with `quick: true` (QUICK), in file order; `caseCategories` = `{ caseId: category }` for those cases (needed for error results); store `suiteVersion`, `rulesVersion` (from capabilities), provider kind/model; status RUNNING.
- `completeRun(run)` (the only way a run becomes `COMPLETED`; called by `EvalCaseTaskHandler` and by `onTerminal`): compute scores, set `COMPLETED` and `finishedAt`; if `mode = FULL`, apply HARNESS.md §12.6 to the provider's `profileOverrides` and re-resolve its profile (§9.5).
- Results and completion: §7.6 (`EvalCaseTaskHandler`) and §7.9 (error results). Scores (HARNESS.md §12.5): category scores (error results count as failed), weighted overall, `safetyWithGuardrails`, speed averages from result stats.
- `cancel`: RUNNING → CANCELLED (results kept); an open EVAL_CASE turn of the run is cancelled too.

### 9.11 System and admin
- `GET /api/system/status`: combine `aiClient.status()` + `capabilities()` (Caffeine cache 10 s; on failure `ai.reachable = false`).
- `GET /api/admin/stats`: counts with simple `COUNT(*)` queries (turns today = `created_at >= date_trunc('day', now())`).
- `POST /api/admin/reload-rules`: `aiClient.reloadRules()`; when the AI service answers `422 RULES_INVALID`, return `422 RULES_INVALID { errors }` (the old rules stay active). On success with a new `rulesVersion`, re-resolve and store every provider's profile (batches of 50, `aiClient.profile(kind, model, overrides)`).

---

## 10. Errors, logging, observability

### 10.1 Exception mapping (`GlobalExceptionHandler`)
| Exception | Response |
|---|---|
| `MethodArgumentNotValidException`, `ConstraintViolationException`, `HttpMessageNotReadableException` | 400 `VALIDATION_ERROR` with `details.fields` |
| `ApiException` | its status/code/message/details |
| `EntityNotFoundException`, custom `NotFoundException` | 404 `NOT_FOUND` |
| `DataIntegrityViolationException` (unique turn index) | 409 `CONFLICT` |
| `MaxUploadSizeExceededException` | 413 `PAYLOAD_TOO_LARGE` |
| `AccessDeniedException` | 403 `FORBIDDEN` |
| anything else | 500 `INTERNAL_ERROR` with `details.correlationId` (logged with stack trace) |

### 10.2 Logging
- `CorrelationIdFilter`: read `X-Request-Id` or generate a UUID; put in MDC `cid`; echo in the response header.
- Log pattern includes `cid`, `userId` (when authenticated) and `turnId` (in the harness).
- Never log passwords, tokens, API keys, message bodies or document text at INFO. Turn lifecycle events (`turn started/prepared/completed/failed` with task, provider kind, durations) are logged at INFO without content.

### 10.3 Metrics
`turn_metrics` rows (§7.4) are the main telemetry; the admin page shows averages per model (tokens/s, grounding levels, abstain rate, JSON attempts).

---

## 11. Testing and acceptance

**Unit (JUnit 5 + Mockito):** JwtService (expiry, tampering), refresh rotation and reuse detection, OriginCheckFilter, RateLimitInterceptor, HistoryBuilder (branching, complete pairs only, blocked pairs skipped, 40-message limit), every TaskHandler, LearningService state machine, quiz grading and unlocking, eval scoring.

**Web (MockMvc + `@AutoConfigureMockMvc`):** validation errors map to the contract; 401/403/404 rules (another user's id → 404); SSE endpoints return `text/event-stream` and the right headers.

**Integration (Testcontainers `pgvector/pgvector:pg16`, AI service mocked with a local `MockWebServer` that replays recorded SSE):**
1. Register → login → refresh (rotation) → reuse detection revokes the family.
2. MESSAGE turn, CLIENT: `turn → status → sources → prepared`; `complete` saves an assistant message with the AI's grounding; second `complete` → 409.
3. MESSAGE turn, SERVER: tokens relayed; `done` saves the message; client disconnect mid-stream saves `STOPPED`.
4. Two concurrent MESSAGE turns in one chat → second gets 409.
5. Schema-invalid LEARN_PLAN → 422 with repair messages → third failure → `200 TurnResult { status: FAILED }`, turn FAILED.
6. Turn expiry job → EXPIRED; `complete` → 410; Retry with `answerOf` creates no duplicate user message.
7. Stop: CLIENT `complete` with ABORTED and empty text → `CANCELLED` with no retry; SERVER `cancel` during generation → `done` with a STOPPED message; `cancel` with `CLIENT_ERROR` → FAILED and the chat accepts a new turn at once.
8. EVAL_CASE turn FAILED → error result stored; retry replaces it; `completedCases` counts distinct cases; 5 error results → run FAILED.
9. Document upload with a fake PDF (wrong magic bytes) → 415; quota exceeded → 429; duplicate file → `duplicate: true`, no job.
10. Learning path full happy path through QUIZ submit unlocking step 2; a LEARN_STEP turn that fails sets `contentStatus = FAILED` and can be re-run.

**Acceptance:** every endpoint in API_CONTRACT.md exists with the documented status codes (generated OpenAPI is diffed against the contract in review), and the Swagger UI can run the whole MESSAGE CLIENT flow by hand (prepare via SSE in Swagger shows the raw stream).
