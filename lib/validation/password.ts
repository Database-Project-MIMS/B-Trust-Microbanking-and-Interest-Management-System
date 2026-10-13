import { z } from "zod";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
  PASSWORD_REQUIREMENTS,
} from "./password-policy";

export const passwordSchema = z.string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENTS)
  .max(PASSWORD_MAX_LENGTH, PASSWORD_REQUIREMENTS)
  .regex(new RegExp(`^(?:${PASSWORD_PATTERN})$`, "u"), PASSWORD_REQUIREMENTS);
