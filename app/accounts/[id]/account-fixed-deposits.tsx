import Link from "next/link";
import type { AccountFixedDeposit } from "@/types/account-fixed-deposit";
import { displayDate, displayMoney, displayRate, fixedDepositPanel } from "../account-format";

/** Read-only fixed-deposit section of the account page. `fixedDeposits` is null when the list could not be read. */
export function AccountFixedDeposits({ accountId, accountStatus, fixedDeposits, canOpenFd }: {
  accountId: string; accountStatus: string; fixedDeposits: readonly AccountFixedDeposit[] | null; canOpenFd: boolean;
}) {
  const panel = fixedDepositPanel({ accountStatus, fixedDeposits, canOpenFd });
  return <section className="card mt-6 min-w-0" aria-labelledby="account-fd-heading"><h2 id="account-fd-heading">Fixed deposits</h2>
    <p className="muted">Rates are fixed when each deposit is opened. An account can hold one active fixed deposit at a time.</p>
    {panel.closureNote && <p role="status" className="mt-4">{panel.closureNote}</p>}
    {fixedDeposits === null ? <p role="status" className="mt-4">Fixed deposits could not be loaded. The rest of this account is shown.</p>
      : !fixedDeposits.length ? <p role="status" className="mt-4">No fixed deposits on this account.</p>
        : <div className="table-wrap mt-4"><table className="data-table">
          <caption className="sr-only">Fixed deposits on this account, newest opening date first</caption>
          <thead><tr><th scope="col">Product</th><th scope="col">Principal</th><th scope="col">Rate at opening</th><th scope="col">Opened</th>
            <th scope="col">Maturity</th><th scope="col">Next interest</th><th scope="col">Status</th></tr></thead>
          <tbody>{fixedDeposits.map(fd => <tr key={fd.fdId}>
            <th scope="row" className="font-normal">{fd.planName}</th>
            <td className="amount whitespace-nowrap">{displayMoney(fd.principalAmount)}</td>
            <td className="amount">{displayRate(fd.interestRateAtOpening)}</td>
            <td className="whitespace-nowrap">{displayDate(fd.startDate)}</td>
            <td className="whitespace-nowrap">{displayDate(fd.maturityDate)}</td>
            <td className="whitespace-nowrap">{displayDate(fd.nextInterestDate)}</td>
            <td><span className="status-pill">{fd.status}</span></td>
          </tr>)}</tbody></table></div>}
    {panel.canOpen && <Link className="btn btn-primary mt-4" href={`/fixed-deposits/new?accountId=${encodeURIComponent(accountId)}`}>Open a fixed deposit</Link>}
    {!panel.canOpen && panel.openNote && canOpenFd && <p className="muted mt-4">{panel.openNote}</p>}
  </section>;
}
