import "server-only";
import { after } from "next/server";
import { dispatchPending } from "@/services/notification-service";

/**
 * Asks the runtime to drain a few pending notifications once the response is sent.
 * Transaction boundary: none; call it only AFTER the business transaction has committed.
 * Never throws: outside a request scope (tests, scripts) it is a no-op, and a send failure
 * is left in the outbox for the next sweep.
 */
export function kickNotificationDispatch(): void {
  try {
    after(async () => {
      try {
        await dispatchPending({ limit: 10 });
      } catch {
        // Redacted on purpose; the outbox row keeps its own retry state.
      }
    });
  } catch {
    // after() is unavailable outside a request.
  }
}
