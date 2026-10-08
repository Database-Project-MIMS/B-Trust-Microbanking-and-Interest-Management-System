CREATE OR REPLACE FUNCTION fn_calculate_fd_interest(
    p_principal  numeric(15,2),
    p_rate       numeric(6,4),
    p_days       int DEFAULT 30
) RETURNS numeric(15,2) AS $$
BEGIN
    -- interest = round(principal × rate × days / 365, 2)
    -- Exact NUMERIC throughout — never floats (SRS §4.10)
    RETURN round(p_principal * p_rate * p_days / 365, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
