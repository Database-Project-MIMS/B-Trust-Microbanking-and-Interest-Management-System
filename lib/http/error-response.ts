import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "@/lib/db/errors";

/** Converts known route errors to the project's safe JSON error envelope. */
export function errorResponse(error: unknown): Response {
  if (error instanceof Response) {
    return error;
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_FAILED",
          message: "The request contains invalid or missing fields.",
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "The request body must be valid JSON." } },
      { status: 400 },
    );
  }

  if (error instanceof DomainError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
    { status: 500 },
  );
}
