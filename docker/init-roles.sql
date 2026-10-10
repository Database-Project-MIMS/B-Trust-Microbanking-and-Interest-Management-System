-- Fresh Docker volume only. psql quotes environment values as SQL literals.
-- Separate bootstrap superuser, schema owner and restricted runtime login.
\getenv owner_password MIMS_OWNER_PASSWORD
\getenv app_password MIMS_APP_PASSWORD
CREATE ROLE mims_owner LOGIN PASSWORD :'owner_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE mims_app LOGIN PASSWORD :'app_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
ALTER DATABASE mims_dev OWNER TO mims_owner;
ALTER SCHEMA public OWNER TO mims_owner;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO mims_app;
