BEGIN;
CREATE TABLE password_reset_token(
 reset_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES app_user(user_id) ON DELETE RESTRICT,
 token_hash varchar(64) NOT NULL UNIQUE CHECK(token_hash ~ '^[0-9a-f]{64}$'),expires_at timestamptz NOT NULL,
 used_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),CHECK(expires_at>created_at));
CREATE INDEX ix_password_reset_user ON password_reset_token(user_id);
ALTER TABLE password_reset_token ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION fn_issue_password_reset(p_user uuid,p_token_hash varchar) RETURNS timestamptz
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_expiry timestamptz:=clock_timestamp()+interval '30 minutes';
BEGIN
 IF NOT EXISTS(SELECT 1 FROM app_user u JOIN role r USING(role_id) WHERE u.user_id=fn_rls_user_id()
  AND u.status='ACTIVE' AND r.status='ACTIVE' AND r.role_name='ADMIN' AND fn_rls_role()='ADMIN') THEN
  RAISE EXCEPTION 'RESET_DENIED' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM app_user u JOIN role r USING(role_id) WHERE u.user_id=p_user AND u.status='ACTIVE'
  AND r.status='ACTIVE' AND r.role_name<>'SYSTEM' FOR UPDATE OF u;
 IF NOT FOUND THEN RAISE EXCEPTION 'RESET_USER_NOT_FOUND' USING ERRCODE='P0002';END IF;
 UPDATE password_reset_token SET used_at=clock_timestamp() WHERE user_id=p_user AND used_at IS NULL;
 INSERT INTO password_reset_token(user_id,token_hash,expires_at) VALUES(p_user,p_token_hash,v_expiry);
 INSERT INTO audit_log(user_id,actor_type,entity_type,entity_id,action,new_values)
  VALUES(fn_rls_user_id(),'USER','app_user',p_user,'PASSWORD_RESET_ISSUED',jsonb_build_object('expires_at',v_expiry));
 RETURN v_expiry;
END $$;
CREATE FUNCTION fn_password_reset_valid(p_token_hash varchar) RETURNS boolean LANGUAGE sql STABLE
 SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM password_reset_token t JOIN app_user u USING(user_id) JOIN role r USING(role_id)
  WHERE t.token_hash=p_token_hash AND t.used_at IS NULL AND t.expires_at>clock_timestamp()
   AND u.status='ACTIVE' AND r.status='ACTIVE' AND r.role_name<>'SYSTEM')
$$;
CREATE FUNCTION fn_consume_password_reset(p_token_hash varchar,p_password_hash text) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_user uuid;v_reset uuid;
BEGIN
 IF p_password_hash NOT LIKE '$argon2id$%' THEN RAISE EXCEPTION 'RESET_INVALID_HASH' USING ERRCODE='22023';END IF;
 -- User then token is the same order as issuance; parallel consume attempts serialize.
 SELECT user_id INTO v_user FROM password_reset_token WHERE token_hash=p_token_hash;
 IF v_user IS NULL THEN RAISE EXCEPTION 'RESET_INVALID' USING ERRCODE='P0001';END IF;
 PERFORM 1 FROM app_user u JOIN role r USING(role_id) WHERE u.user_id=v_user AND u.status='ACTIVE'
  AND r.status='ACTIVE' AND r.role_name<>'SYSTEM' FOR UPDATE OF u;
 IF NOT FOUND THEN RAISE EXCEPTION 'RESET_INVALID' USING ERRCODE='P0001';END IF;
 SELECT reset_id INTO v_reset FROM password_reset_token WHERE token_hash=p_token_hash
  AND used_at IS NULL AND expires_at>clock_timestamp() FOR UPDATE;
 IF v_reset IS NULL THEN RAISE EXCEPTION 'RESET_INVALID' USING ERRCODE='P0001';END IF;
 PERFORM set_config('app.current_user_id',v_user::text,true);
 UPDATE app_user SET password_hash=p_password_hash WHERE user_id=v_user;
 UPDATE password_reset_token SET used_at=clock_timestamp() WHERE user_id=v_user AND used_at IS NULL;
 DELETE FROM user_session WHERE user_id=v_user;
 INSERT INTO audit_log(user_id,actor_type,entity_type,entity_id,action)
  VALUES(v_user,'USER','app_user',v_user,'PASSWORD_RESET_COMPLETED');
END $$;
REVOKE ALL ON FUNCTION fn_issue_password_reset(uuid,varchar),fn_password_reset_valid(varchar),fn_consume_password_reset(varchar,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_issue_password_reset(uuid,varchar),fn_password_reset_valid(varchar),fn_consume_password_reset(varchar,text) TO mims_app;
CREATE FUNCTION fn_invalidate_password_resets() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF OLD.password_hash IS DISTINCT FROM NEW.password_hash OR OLD.status IS DISTINCT FROM NEW.status OR OLD.role_id IS DISTINCT FROM NEW.role_id THEN
 UPDATE password_reset_token SET used_at=clock_timestamp() WHERE user_id=NEW.user_id AND used_at IS NULL;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION fn_invalidate_password_resets() FROM PUBLIC;
CREATE TRIGGER trg_invalidate_password_resets AFTER UPDATE OF password_hash,status,role_id ON app_user
 FOR EACH ROW EXECUTE FUNCTION fn_invalidate_password_resets();
COMMIT;
