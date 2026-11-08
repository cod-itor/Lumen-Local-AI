-- Chat tab organisation: projects group chats; chats can be pinned.
CREATE TABLE projects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(60) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX projects_user_idx ON projects (user_id, updated_at DESC);

ALTER TABLE chats
    ADD COLUMN pinned     BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN project_id UUID    NULL REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX chats_project_idx ON chats (project_id);
