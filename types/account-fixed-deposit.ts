import type { CustomerFixedDeposit } from "@/types/customer-fixed-deposit";

/** One fixed deposit on an account: M2's customer-level DTO without the account fields, so the two cannot drift apart. */
export type AccountFixedDeposit = Omit<CustomerFixedDeposit, "accountId" | "accountNumber">;
