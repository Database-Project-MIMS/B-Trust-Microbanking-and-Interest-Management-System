BEGIN;
CREATE FUNCTION fn_preserve_active_administrator() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF OLD.status='ACTIVE' AND (NEW.status<>'ACTIVE' OR NEW.role_id<>OLD.role_id)
 AND EXISTS(SELECT 1 FROM role WHERE role_id=OLD.role_id AND role_name='ADMIN') THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('active-administrator',0));
  IF NOT EXISTS(SELECT 1 FROM app_user u JOIN role r USING(role_id) WHERE u.user_id<>OLD.user_id AND u.status='ACTIVE' AND r.status='ACTIVE' AND r.role_name='ADMIN') THEN
   RAISE EXCEPTION 'LAST_ADMINISTRATOR' USING ERRCODE='P0001';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION fn_preserve_active_administrator() FROM PUBLIC;
CREATE TRIGGER trg_last_administrator BEFORE UPDATE OF status,role_id ON app_user FOR EACH ROW EXECUTE FUNCTION fn_preserve_active_administrator();
COMMIT;
