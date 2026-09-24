-- Shared accounts for MCA and EWI. Passwords are hashes, never plaintext.

CREATE SCHEMA IF NOT EXISTS platform;

CREATE TYPE platform."PlatformRoleName" AS ENUM (
    'super_admin',
    'admin',
    'attorney',
    'paralegal',
    'medical_expert',
    'user'
);

CREATE TABLE platform.users (
    id UUID NOT NULL,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,
    CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX users_email_key ON platform.users(email);

CREATE TABLE platform.roles (
    id UUID NOT NULL,
    name platform."PlatformRoleName" NOT NULL,
    CONSTRAINT roles_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX roles_name_key ON platform.roles(name);

CREATE TABLE platform.user_roles (
    user_id UUID NOT NULL,
    role_id UUID NOT NULL,
    CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id)
);

ALTER TABLE platform.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES platform.users(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE platform.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey
    FOREIGN KEY (role_id) REFERENCES platform.roles(id) ON DELETE CASCADE ON UPDATE CASCADE;
