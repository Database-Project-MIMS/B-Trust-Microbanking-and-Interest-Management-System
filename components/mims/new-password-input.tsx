"use client";

import { useId, type InputHTMLAttributes } from "react";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
  PASSWORD_REQUIREMENTS,
} from "@/lib/validation/password-policy";

/** Native validation and accessible guidance for password creation/change forms. */
export function NewPasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const helpId = useId();
  return <>
    <input {...props} className={props.className ?? "input"} type="password"
      autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH}
      maxLength={PASSWORD_MAX_LENGTH} pattern={PASSWORD_PATTERN}
      title={PASSWORD_REQUIREMENTS}
      aria-describedby={[props["aria-describedby"], helpId].filter(Boolean).join(" ")} />
    <small id={helpId}>{PASSWORD_REQUIREMENTS}</small>
  </>;
}
