-- V1__init.sql — full schema for the Local AI Learning Assistant (BACKEND.md §6).
-- Owner: backend (Flyway). The AI service only reads/writes the `chunks` table.
-- Requires PostgreSQL 16+ with the pgvector extension (image: pgvector/pgvector:pg16 or newer).

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------- users & auth
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           CITEXT       NOT NULL UNIQUE,
    password_hash   VARCHAR(100) NOT NULL,
    name            VARCHAR(60)  NOT NULL,
    role            VARCHAR(8)   NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
    enabled         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      CHAR(64)     NOT NULL UNIQUE,          -- SHA-256 hex of the raw token
    family_id       UUID         NOT NULL,                 -- all rotations of one login share a family
    expires_at      TIMESTAMPTZ  NOT NULL,
    used_at         TIMESTAMPTZ  NULL,                     -- set when rotated (reuse ⇒ revoke family)
    revoked_at      TIMESTAMPTZ  NULL,
    user_agent      VARCHAR(255) NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user   ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);

CREATE TABLE user_settings (
    user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme              VARCHAR(6)   NOT NULL DEFAULT 'SYSTEM'   CHECK (theme IN ('LIGHT', 'DARK', 'SYSTEM')),
    ui_language        VARCHAR(2)   NOT NULL DEFAULT 'EN'       CHECK (ui_language IN ('EN', 'KM')),
    output_language    VARCHAR(4)   NOT NULL DEFAULT 'EN'       CHECK (output_language IN ('EN', 'KM', 'BOTH')),
    answer_length      VARCHAR(8)   NOT NULL DEFAULT 'NORMAL'   CHECK (answer_length IN ('SHORT', 'NORMAL', 'DETAILED')),
    temperature        NUMERIC(3,2) NULL                        CHECK (temperature IS NULL OR (temperature >= 0 AND temperature <= 1)),
    ask_before_search  BOOLEAN      NOT NULL DEFAULT FALSE,
    guard_profile      VARCHAR(8)   NOT NULL DEFAULT 'STANDARD' CHECK (guard_profile IN ('STANDARD', 'STRICT')),
    timezone           VARCHAR(64)  NOT NULL DEFAULT 'Asia/Phnom_Penh',
    show_speed_stats   BOOLEAN      NOT NULL DEFAULT TRUE,
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- model providers
CREATE TABLE model_providers (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name               VARCHAR(60)  NOT NULL,
    kind               VARCHAR(12)  NOT NULL CHECK (kind IN ('HOST', 'BROWSER', 'LOCAL_OLLAMA', 'REMOTE_URL')),
    base_url           VARCHAR(500) NULL,
    model              VARCHAR(100) NOT NULL,
    api_key_encrypted  BYTEA        NULL,                      -- AES-GCM (nonce || ciphertext || tag), REMOTE_URL only
    model_profile      JSONB        NOT NULL,                  -- resolved ModelProfile (API_CONTRACT §4.5)
    profile_overrides  JSONB        NOT NULL DEFAULT '{}'::jsonb, -- e.g. {"khmerNative": true} from Model Test
    profile_rules_version VARCHAR(40) NULL,                    -- rulesVersion the stored model_profile was resolved with
    is_default         BOOLEAN      NOT NULL DEFAULT FALSE,
    status             VARCHAR(8)   NOT NULL DEFAULT 'UNTESTED' CHECK (status IN ('UNTESTED', 'OK', 'FAILED')),
    last_tested_at     TIMESTAMPTZ  NULL,
    last_test_message  VARCHAR(500) NULL,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_model_providers_user ON model_providers(user_id);
CREATE UNIQUE INDEX uq_model_providers_default ON model_providers(user_id) WHERE is_default;
CREATE UNIQUE INDEX uq_model_providers_host    ON model_providers(user_id) WHERE kind = 'HOST';

-- ---------------------------------------------------------------- documents
CREATE TABLE documents (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename      VARCHAR(255) NOT NULL,                       -- sanitized display name
    mime          VARCHAR(100) NOT NULL,
    size_bytes    BIGINT       NOT NULL,
    sha256        CHAR(64)     NOT NULL,
    storage_path  VARCHAR(500) NOT NULL,                       -- relative to STORAGE_DIR
    pages         INT          NULL,
    language      VARCHAR(5)   NULL CHECK (language IS NULL OR language IN ('EN', 'KM', 'MIXED', 'OTHER')),
    status        VARCHAR(10)  NOT NULL DEFAULT 'UPLOADED' CHECK (status IN ('UPLOADED', 'PARSING', 'EMBEDDING', 'READY', 'FAILED')),
    error         VARCHAR(500) NULL,
    chunk_count   INT          NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_documents_user ON documents(user_id, created_at DESC);

-- ---------------------------------------------------------------- chats & messages
CREATE TABLE chats (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tab                   VARCHAR(4)   NOT NULL CHECK (tab IN ('CHAT', 'DOCS')),
    title                 VARCHAR(80)  NOT NULL DEFAULT 'New chat',
    title_source          VARCHAR(8)   NOT NULL DEFAULT 'DEFAULT' CHECK (title_source IN ('DEFAULT', 'AUTO', 'AI', 'USER')),
    active_leaf_id        UUID         NULL,                    -- FK added below
    last_message_preview  VARCHAR(120) NULL,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_chats_user_tab ON chats(user_id, tab, updated_at DESC);

CREATE TABLE chat_documents (
    chat_id      UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    PRIMARY KEY (chat_id, document_id)
);

CREATE TABLE messages (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id           UUID         NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    parent_id         UUID         NULL REFERENCES messages(id) ON DELETE CASCADE,
    role              VARCHAR(9)   NOT NULL CHECK (role IN ('USER', 'ASSISTANT')),
    content           TEXT         NOT NULL,
    original_content  TEXT         NULL,                       -- assistant: model-language text when content is a translation
    model_input       TEXT         NULL,                       -- user: English pivot text sent to the model
    translations      JSONB        NOT NULL DEFAULT '{}'::jsonb, -- {"KM": "...", "EN": "..."}
    status            VARCHAR(9)   NOT NULL DEFAULT 'COMPLETE' CHECK (status IN ('COMPLETE', 'STOPPED', 'BLOCKED', 'ABSTAINED')),
    meta              JSONB        NOT NULL DEFAULT '{}'::jsonb, -- MessageMeta (API_CONTRACT §4.4) minus feedback
    turn_id           UUID         NULL,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_chat   ON messages(chat_id, created_at);
CREATE INDEX idx_messages_parent ON messages(parent_id);
ALTER TABLE chats ADD CONSTRAINT fk_chats_active_leaf FOREIGN KEY (active_leaf_id) REFERENCES messages(id) ON DELETE SET NULL;

CREATE TABLE feedback (
    message_id  UUID PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating      SMALLINT     NOT NULL CHECK (rating IN (-1, 1)),
    reason      VARCHAR(500) NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- harness turns & metrics
CREATE TABLE harness_turns (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chat_id            UUID         NULL REFERENCES chats(id) ON DELETE CASCADE,
    task               VARCHAR(16)  NOT NULL,
    target_type        VARCHAR(16)  NULL,
    target_id          UUID         NULL,
    lock_key           VARCHAR(80)  NULL,                      -- chat:{id} | path:{id} | run:{id} | NULL (HARNESS.md §3.7)
    provider_id        UUID         NULL REFERENCES model_providers(id) ON DELETE SET NULL,
    provider_kind      VARCHAR(12)  NOT NULL,
    model              VARCHAR(100) NOT NULL,
    generation         VARCHAR(6)   NOT NULL CHECK (generation IN ('SERVER', 'CLIENT')),
    status             VARCHAR(18)  NOT NULL,
    attempt            SMALLINT     NOT NULL DEFAULT 1,
    user_message_id    UUID         NULL REFERENCES messages(id) ON DELETE SET NULL,
    result_message_id  UUID         NULL REFERENCES messages(id) ON DELETE SET NULL,
    request            JSONB        NOT NULL,                  -- validated HarnessTurnRequest
    prepare_context    JSONB        NULL,                      -- HARNESS.md §3.8
    prepared_messages  JSONB        NULL,                      -- purged after 7 days
    error_code         VARCHAR(40)  NULL,
    expires_at         TIMESTAMPTZ  NOT NULL,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    completed_at       TIMESTAMPTZ  NULL,
    CONSTRAINT ck_turn_status CHECK (status IN ('PREPARING', 'AWAITING_APPROVAL', 'READY', 'GENERATING', 'FINALIZING',
                                                'COMPLETED', 'BLOCKED', 'ABSTAINED', 'CANCELLED', 'EXPIRED', 'FAILED'))
);
CREATE INDEX idx_turns_user ON harness_turns(user_id, created_at DESC);
CREATE INDEX idx_turns_open ON harness_turns(expires_at)
    WHERE status IN ('PREPARING', 'AWAITING_APPROVAL', 'READY', 'GENERATING', 'FINALIZING');
-- one open turn per lock: one MESSAGE per chat, one learning task per path, one case per Model Test run (HARNESS.md §3.7)
CREATE UNIQUE INDEX uq_turns_open_lock ON harness_turns(lock_key)
    WHERE lock_key IS NOT NULL AND status IN ('PREPARING', 'AWAITING_APPROVAL', 'READY', 'GENERATING', 'FINALIZING');

CREATE TABLE turn_metrics (
    turn_id                  UUID PRIMARY KEY REFERENCES harness_turns(id) ON DELETE CASCADE,
    user_id                  UUID         NOT NULL,
    task                     VARCHAR(16)  NOT NULL,
    pipeline                 VARCHAR(4)   NULL,
    provider_kind            VARCHAR(12)  NOT NULL,
    model                    VARCHAR(100) NOT NULL,
    rules_version            VARCHAR(40)  NULL,
    input_language           VARCHAR(5)   NULL,
    output_language          VARCHAR(4)   NULL,
    estimated_prompt_tokens  INT          NULL,
    actual_prompt_tokens     INT          NULL,
    output_tokens            INT          NULL,
    ttft_ms                  INT          NULL,
    tokens_per_sec           REAL         NULL,
    total_ms                 INT          NULL,
    finish_reason            VARCHAR(12)  NULL,
    guard_input_action       VARCHAR(14)  NULL,
    guard_output_action      VARCHAR(14)  NULL,
    grounding_level          VARCHAR(14)  NULL,
    supported_ratio          REAL         NULL,
    top_sim                  REAL         NULL,
    chunks_used              SMALLINT     NULL,
    abstained_before_model   BOOLEAN      NOT NULL DEFAULT FALSE,
    json_attempts            SMALLINT     NULL,
    status                   VARCHAR(18)  NOT NULL,
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_turn_metrics_model ON turn_metrics(model, created_at DESC);

CREATE TABLE guard_events (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    turn_id        UUID         NULL,
    stage          VARCHAR(6)   NOT NULL CHECK (stage IN ('INPUT', 'OUTPUT')),
    action         VARCHAR(14)  NOT NULL,
    categories     JSONB        NOT NULL DEFAULT '[]'::jsonb,
    rule           VARCHAR(80)  NOT NULL,
    excerpt        VARCHAR(300) NOT NULL,                      -- masked (GUARDRAILS.md §11)
    provider_kind  VARCHAR(12)  NULL,
    model          VARCHAR(100) NULL,
    profile        VARCHAR(8)   NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_guard_events_created ON guard_events(created_at DESC);

-- ---------------------------------------------------------------- chunks (written by the AI service)
CREATE TABLE chunks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID          NULL REFERENCES users(id) ON DELETE CASCADE,       -- NULL for shared WEB cache
    document_id   UUID          NULL REFERENCES documents(id) ON DELETE CASCADE,
    source        VARCHAR(3)    NOT NULL CHECK (source IN ('DOC', 'WEB')),
    ordinal       INT           NOT NULL,                      -- order inside the document / page
    page          INT           NULL,
    start_char    INT           NULL,
    end_char      INT           NULL,
    text          TEXT          NOT NULL,
    text_en       TEXT          NULL,                          -- English translation for Khmer documents
    language      VARCHAR(5)    NULL,
    injection_suspected BOOLEAN NOT NULL DEFAULT FALSE,     -- GUARDRAILS.md §5.2
    url           VARCHAR(2000) NULL,
    url_hash      CHAR(64)      NULL,
    title         VARCHAR(500)  NULL,
    site_name     VARCHAR(255)  NULL,
    published_at  VARCHAR(40)   NULL,
    fetched_at    TIMESTAMPTZ   NULL,
    embedding     vector(768)   NOT NULL,                      -- must equal EMBED_DIM
    tsv           tsvector      GENERATED ALWAYS AS (to_tsvector('english', coalesce(text_en, text))) STORED,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT ck_chunks_source CHECK (
        (source = 'DOC' AND document_id IS NOT NULL AND user_id IS NOT NULL)
     OR (source = 'WEB' AND url IS NOT NULL AND url_hash IS NOT NULL))
);
-- No HNSW index on purpose: document retrieval filters to one user's chosen documents first and then does an
-- exact cosine search on that small set (AI_SERVICE.md §7.3). Add an HNSW index with hnsw.iterative_scan only if a
-- single user's corpus grows beyond ~50k chunks.
CREATE INDEX idx_chunks_document       ON chunks(document_id, ordinal);
CREATE INDEX idx_chunks_user_doc       ON chunks(user_id, document_id) WHERE source = 'DOC';
CREATE INDEX idx_chunks_url            ON chunks(url_hash, ordinal) WHERE source = 'WEB';
CREATE INDEX idx_chunks_tsv            ON chunks USING gin (tsv);

-- ---------------------------------------------------------------- jobs & images
CREATE TABLE jobs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type         VARCHAR(10)  NOT NULL CHECK (type IN ('INGEST', 'IMAGE', 'VARIATION', 'BG_REMOVAL')),
    status       VARCHAR(9)   NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED')),
    progress     REAL         NOT NULL DEFAULT 0,
    stage        VARCHAR(60)  NULL,
    payload      JSONB        NOT NULL DEFAULT '{}'::jsonb,
    result       JSONB        NULL,
    error        VARCHAR(500) NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    started_at   TIMESTAMPTZ  NULL,
    finished_at  TIMESTAMPTZ  NULL
);
CREATE INDEX idx_jobs_queue ON jobs(status, created_at) WHERE status IN ('QUEUED', 'RUNNING');
CREATE INDEX idx_jobs_user  ON jobs(user_id, created_at DESC);

CREATE TABLE image_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(80)  NOT NULL DEFAULT 'New images',
    cover_image_id  UUID         NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_image_sessions_user ON image_sessions(user_id, updated_at DESC);

CREATE TABLE images (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id       UUID         NOT NULL REFERENCES image_sessions(id) ON DELETE CASCADE,
    parent_id        UUID         NULL REFERENCES images(id) ON DELETE SET NULL,
    kind             VARCHAR(10)  NOT NULL CHECK (kind IN ('GENERATED', 'BG_REMOVED', 'VARIATION')),
    prompt           TEXT         NOT NULL,
    original_prompt  TEXT         NULL,
    storage_path     VARCHAR(500) NOT NULL,
    size_bytes       BIGINT       NOT NULL DEFAULT 0,          -- PNG file size (storage quota)
    width            INT          NOT NULL,
    height           INT          NOT NULL,
    meta             JSONB        NOT NULL DEFAULT '{}'::jsonb,  -- {model, seed, steps, aspectRatio, durationMs}
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_images_session ON images(session_id, created_at DESC);
ALTER TABLE image_sessions ADD CONSTRAINT fk_image_sessions_cover FOREIGN KEY (cover_image_id) REFERENCES images(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------- learning
CREATE TABLE learning_paths (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal        VARCHAR(200) NOT NULL,
    state       VARCHAR(17)  NOT NULL DEFAULT 'INTERVIEWING'
                CHECK (state IN ('INTERVIEWING', 'PLANNING', 'AWAITING_APPROVAL', 'ACTIVE', 'COMPLETED')),
    interview   JSONB        NOT NULL DEFAULT '[]'::jsonb,     -- InterviewItem[]
    plan        JSONB        NULL,                             -- PlanDto
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_learning_paths_user ON learning_paths(user_id, updated_at DESC);

CREATE TABLE learning_steps (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path_id         UUID         NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
    position        SMALLINT     NOT NULL,
    title           VARCHAR(120) NOT NULL,
    summary         VARCHAR(500) NOT NULL,
    objectives      JSONB        NOT NULL,
    content         TEXT         NULL,
    content_status  VARCHAR(6)   NOT NULL DEFAULT 'EMPTY' CHECK (content_status IN ('EMPTY', 'READY', 'FAILED')),
    status          VARCHAR(7)   NOT NULL DEFAULT 'LOCKED' CHECK (status IN ('LOCKED', 'CURRENT', 'DONE')),
    best_score      REAL         NULL,
    UNIQUE (path_id, position)
);

CREATE TABLE quizzes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    step_id     UUID         NOT NULL REFERENCES learning_steps(id) ON DELETE CASCADE,
    questions   JSONB        NOT NULL,                         -- includes answerIndex, evidence, explanation (never sent before submit)
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_quizzes_step ON quizzes(step_id, created_at DESC);

CREATE TABLE quiz_attempts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id     UUID         NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    answers     JSONB        NOT NULL,
    score       REAL         NOT NULL,
    passed      BOOLEAN      NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- Model Test
CREATE TABLE eval_runs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id             UUID         NULL REFERENCES model_providers(id) ON DELETE SET NULL,
    provider_kind           VARCHAR(12)  NOT NULL,
    model                   VARCHAR(100) NOT NULL,
    suite                   VARCHAR(40)  NOT NULL,
    suite_version           INT          NOT NULL,
    mode                    VARCHAR(5)   NOT NULL CHECK (mode IN ('QUICK', 'FULL')),
    status                  VARCHAR(9)   NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'COMPLETED', 'CANCELLED', 'FAILED')),
    case_ids                JSONB        NOT NULL,
    case_categories         JSONB        NOT NULL DEFAULT '{}'::jsonb,  -- {caseId: EvalCategory}, for error results
    completed_cases         INT          NOT NULL DEFAULT 0,
    score                   REAL         NULL,
    category_scores         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    safety_with_guardrails  REAL         NULL,
    speed                   JSONB        NOT NULL DEFAULT '{}'::jsonb,
    rules_version           VARCHAR(40)  NULL,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    finished_at             TIMESTAMPTZ  NULL
);
CREATE INDEX idx_eval_runs_user ON eval_runs(user_id, created_at DESC);

CREATE TABLE eval_results (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id             UUID         NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
    case_id            VARCHAR(80)  NOT NULL,
    category           VARCHAR(20)  NOT NULL,
    passed             BOOLEAN      NOT NULL,
    checks             JSONB        NOT NULL,
    output             TEXT         NOT NULL,
    guard_would_block  BOOLEAN      NOT NULL DEFAULT FALSE,
    stats              JSONB        NULL,
    error              VARCHAR(40)  NULL,                      -- set when the case could not be run; counts as failed
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (run_id, case_id)
);
