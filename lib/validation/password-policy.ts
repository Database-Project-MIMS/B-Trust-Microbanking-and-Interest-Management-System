/** Shared creation/change policy; never apply this to sign-in verification. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_REQUIREMENTS =
  "Use 8–128 characters with at least one uppercase letter, one lowercase letter, one number, and one symbol. Spaces do not count as symbols.";

// Native HTML patterns use the v flag; the same expression works with server u.
export const PASSWORD_PATTERN =
  String.raw`(?=[\s\S]*[A-Z])(?=[\s\S]*[a-z])(?=[\s\S]*[0-9])(?=[\s\S]*[^\p{L}\p{N}\s])[\s\S]+`;
