export interface CustomerFixedDeposit {
  fdId: string;
  accountId: string;
  accountNumber: string;
  fdPlanId: string;
  planName: string;
  principalAmount: string;
  interestRateAtOpening: string;
  startDate: string;
  maturityDate: string;
  nextInterestDate: string;
  status: "ACTIVE" | "MATURED" | "CLOSED";
}

export interface CustomerFixedDeposits {
  customerId: string;
  fixedDeposits: CustomerFixedDeposit[];
}
