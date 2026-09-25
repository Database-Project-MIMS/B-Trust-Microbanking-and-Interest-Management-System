"use client"

import * as React from "react"
import Link from "next/link"

export default function YieldVaultsPage() {
  const [principal, setPrincipal] = React.useState(2500000)
  const [tenor, setTenor] = React.useState(12)
  const [rate, setRate] = React.useState(0.1525)
  const [isLocking, setIsLocking] = React.useState(false)
  const [locked, setLocked] = React.useState(false)

  const timeFraction = tenor / 12
  const gross = principal * rate * timeFraction
  const tax = gross * 0.05
  const net = gross - tax
  const total = principal + net

  const handleLock = () => {
    setIsLocking(true)
    setTimeout(() => {
      setIsLocking(false)
      setLocked(true)
    }, 1200)
  }

  return (
    <div className="flex flex-col w-full relative">
      <div className="py-space-lg flex flex-col gap-space-xl relative">
        
        {/* Architectural Insulating Header & Editorial Statement */}
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-gutter">
          <div className="max-w-3xl space-y-space-xs">
            <div className="flex items-center gap-space-sm">
              <span className="font-mono text-label-caps text-primary uppercase tracking-widest">Sovereign Treasury Depository</span>
              <span className="w-1 h-1 rounded-full bg-outline-variant" />
              <span className="font-mono text-label-caps text-on-surface-variant uppercase">Regulated Escrow Protocol</span>
            </div>
            <h1 className="font-headline text-[3rem] lg:text-[4rem] text-on-surface tracking-tight leading-none">
              Capital Compounding & Sovereign Vaults
            </h1>
          </div>
          <div className="flex items-center gap-space-sm pb-1">
            <div className="px-space-sm py-1.5 rounded-full bg-surface-container-low text-primary flex items-center gap-2 border border-outline-variant/20">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse-dot" />
              <span className="font-mono text-label-numeric font-bold">CBSL Benchmark: 13.50%</span>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-on-surface-variant font-mono text-label-caps uppercase">
              <span>Tier-1 Collateralized</span>
            </div>
          </div>
        </section>

        {/* Tactile Interactive Calculator & Live Yield Monolith */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-stretch">
          
          {/* Calculator Controls Console */}
          <div className="lg:col-span-7 bg-surface-container-low rounded-xl p-space-md md:p-space-lg flex flex-col justify-between shadow-sm relative overflow-hidden border border-outline-variant/30">
            <div className="absolute -right-16 -top-16 w-64 h-64 bg-primary-fixed/20 rounded-full blur-3xl pointer-events-none" />
            <div className="space-y-space-lg relative z-10">
              <div className="flex items-center justify-between">
                <span className="font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Deployment Calibration</span>
                <span className="font-mono text-label-numeric text-primary font-bold">Zero Slippage Guarantee</span>
              </div>
              
              {/* Principal Slider Area */}
              <div className="space-y-space-sm">
                <div className="flex items-baseline justify-between">
                  <label className="font-body text-body-sm text-on-surface-variant">Principal Capital</label>
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-label-numeric text-on-surface-variant">LKR</span>
                    <span className="font-headline text-headline-md text-on-surface tracking-tight">{principal.toLocaleString()}</span>
                  </div>
                </div>
                <div className="py-2">
                  <input 
                    type="range" 
                    min="500000" 
                    max="25000000" 
                    step="250000" 
                    value={principal} 
                    onChange={(e) => setPrincipal(Number(e.target.value))}
                    className="w-full h-2 bg-surface-container-high rounded-full appearance-none cursor-pointer accent-primary" 
                  />
                </div>
                {/* Precision Quick Add Chips */}
                <div className="flex flex-wrap items-center gap-space-xs pt-1">
                  <span className="font-mono text-label-caps uppercase text-on-surface-variant mr-1">Inject:</span>
                  <button onClick={() => setPrincipal(Math.min(principal + 500000, 25000000))} className="px-3 py-1.5 rounded-full bg-surface text-on-surface font-mono text-xs hover:bg-primary hover:text-on-primary transition-all shadow-sm border border-outline-variant/20">+500K</button>
                  <button onClick={() => setPrincipal(Math.min(principal + 1000000, 25000000))} className="px-3 py-1.5 rounded-full bg-surface text-on-surface font-mono text-xs hover:bg-primary hover:text-on-primary transition-all shadow-sm border border-outline-variant/20">+1.0M</button>
                  <button onClick={() => setPrincipal(Math.min(principal + 5000000, 25000000))} className="px-3 py-1.5 rounded-full bg-surface text-on-surface font-mono text-xs hover:bg-primary hover:text-on-primary transition-all shadow-sm border border-outline-variant/20">+5.0M</button>
                  <button onClick={() => setPrincipal(2500000)} className="px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant hover:text-on-surface font-mono text-xs uppercase ml-auto transition-colors border border-outline-variant/20">Reset</button>
                </div>
              </div>

              {/* Tenor Selection Grid */}
              <div className="space-y-space-sm">
                <div className="flex items-center justify-between">
                  <span className="font-body text-body-sm text-on-surface-variant">Select Horizon & Coupon</span>
                  <span className="font-mono text-label-caps uppercase text-on-surface-variant">Annualized Yield (AER)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-xs">
                  {[
                    { t: 3, r: 0.128, label: "3 Months", desc: "Quarterly", hl: "12.80%" },
                    { t: 6, r: 0.139, label: "6 Months", desc: "Semi-Annual", hl: "13.90%" },
                    { t: 12, r: 0.1525, label: "12 Months", desc: "Prime Sovereign", hl: "15.25%" },
                    { t: 24, r: 0.1600, label: "24 Months", desc: "Compounded", hl: "16.00%" }
                  ].map((item) => (
                    <div 
                      key={item.t}
                      onClick={() => { setTenor(item.t); setRate(item.r) }}
                      className={`cursor-pointer p-space-sm rounded-lg transition-all flex flex-col justify-between h-24 border ${tenor === item.t ? "bg-primary-container text-on-primary shadow-sm border-primary/50" : "bg-surface text-on-surface hover:bg-surface-container-high border-outline-variant/20"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-mono text-label-caps uppercase ${tenor === item.t ? "text-on-primary-container font-bold" : "text-on-surface-variant"}`}>{item.label}</span>
                        {tenor === item.t && <span className="w-1.5 h-1.5 rounded-full bg-secondary-container" />}
                      </div>
                      <div>
                        <div className={`font-headline text-headline-sm ${tenor === item.t ? "text-on-primary" : "text-primary"}`}>{item.hl}</div>
                        <span className={`font-mono text-label-caps ${tenor === item.t ? "text-on-primary-container font-bold" : "text-on-surface-variant"}`}>{item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Footnote Audit Compliance */}
            <div className="pt-space-md mt-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs text-on-surface-variant font-mono text-label-caps border-t border-surface-container">
              <span>Custodial Escrow: Bank of Ceylon Trustee</span>
              <span>SL-CBSL Reg: #9042-FD</span>
            </div>
          </div>

          {/* Real-Time Outcome Monolith Card */}
          <div className="lg:col-span-5 bg-surface-container rounded-xl p-space-md md:p-space-lg flex flex-col justify-between relative shadow-sm overflow-hidden border border-outline-variant/30">
            <div className="space-y-space-md relative z-10">
              <div className="flex items-center justify-between">
                <span className="font-mono text-label-caps uppercase tracking-wider text-primary font-bold">Maturity Certificate Summary</span>
                <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-mono text-label-caps font-bold">Guaranteed</span>
              </div>
              
              <div className="space-y-1">
                <span className="font-body text-body-sm text-on-surface-variant">Projected Payout at Horizon</span>
                <div className="flex items-baseline gap-space-xs">
                  <span className="font-headline text-headline-md text-primary">LKR</span>
                  <span className="font-headline text-[3rem] lg:text-[3.5rem] leading-none text-on-surface tracking-tight">{Math.round(total).toLocaleString()}</span>
                </div>
              </div>

              {/* Mathematical Breakdown Ledger */}
              <div className="space-y-space-xs p-space-sm rounded-lg bg-surface/80 backdrop-blur-sm border border-outline-variant/20">
                <div className="flex justify-between items-center font-body text-body-sm">
                  <span className="text-on-surface-variant">Gross Accrued Yield</span>
                  <span className="font-mono text-label-numeric text-on-surface font-semibold">+ LKR {Math.round(gross).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center font-body text-body-sm">
                  <div className="flex items-center gap-1.5 text-on-surface-variant">
                    <span>Withholding Tax (WHT)</span>
                    <span className="px-1 py-0.5 rounded bg-surface-container text-on-surface-variant font-mono text-[10px]">5.0% Pre-deducted</span>
                  </div>
                  <span className="font-mono text-label-numeric text-secondary">- LKR {Math.round(tax).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center font-body text-body-sm pt-1 border-t border-surface-container/50 mt-1">
                  <span className="text-on-surface font-medium">Net Realized Surplus</span>
                  <span className="font-mono text-label-numeric text-primary font-semibold">+ LKR {Math.round(net).toLocaleString()}</span>
                </div>
              </div>

              {/* Kinetic Yield Arc Graphic */}
              <div className="flex items-center gap-space-sm p-space-sm bg-surface-container-lowest rounded-lg border border-outline-variant/10">
                <div className="w-12 h-12 shrink-0 relative flex items-center justify-center">
                  <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                    <path className="text-surface-container" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.5" />
                    <path className="text-primary transition-all duration-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="82, 100" strokeLinecap="round" strokeWidth="3.5" />
                  </svg>
                  <span className="material-symbols-outlined text-primary text-[18px] absolute">lock</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-body text-body-sm text-on-surface font-medium">Fixed Maturity Assurance</span>
                  <span className="font-mono text-label-caps text-on-surface-variant">Instant Liquidity Line available at 90% LTV</span>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="pt-space-md relative z-10 space-y-space-xs">
              <button 
                onClick={handleLock}
                disabled={isLocking || locked}
                className={`w-full py-3.5 px-space-md rounded-lg font-body text-body-md font-medium transition-all shadow-md flex items-center justify-center gap-space-xs ${locked ? "bg-tertiary text-on-tertiary" : "bg-primary hover:bg-primary-container text-on-primary active:scale-[0.985]"} disabled:opacity-90`}
              >
                {isLocking ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
                    <span>Securing Vault Escrow...</span>
                  </>
                ) : locked ? (
                  <>
                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                    <span>Vault Executed & Collateralized</span>
                  </>
                ) : (
                  <>
                    <span>Lock & Open Vault</span>
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </>
                )}
              </button>
              <p className="text-center font-mono text-label-caps text-on-surface-variant uppercase">
                Funds routed to segregated Sri Lanka sovereign ledger
              </p>
            </div>
          </div>
        </section>

        {/* Editorial Section Divider */}
        <section className="pt-space-xl pb-space-sm border-t border-surface-container/60 mt-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-sm">
            <div>
              <span className="font-mono text-label-caps uppercase text-on-surface-variant tracking-wider">Active Depository Portfolios</span>
              <h2 className="font-headline text-headline-md text-on-surface tracking-tight">Active Vault Certificates</h2>
            </div>
            <div className="flex items-center gap-space-sm">
              <span className="font-mono text-label-numeric text-on-surface-variant">Total Vaulted: LKR 48,250,000</span>
              <button className="px-3 py-1 rounded-full bg-surface-container text-on-surface font-body text-body-sm hover:bg-surface-container-high transition-colors">
                Export Certs (PDF)
              </button>
            </div>
          </div>
        </section>

        {/* Active Certificates Showcase Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {/* Cert 1 */}
          <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col justify-between relative shadow-sm hover:shadow-md transition-all group border border-outline-variant/30">
            <div className="space-y-space-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-space-xs">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span className="font-mono text-label-caps uppercase text-on-surface font-bold">VLT-88219</span>
                </div>
                <span className="font-mono text-label-numeric text-primary font-bold">15.50% AER</span>
              </div>
              <div>
                <h3 className="font-headline text-headline-sm text-on-surface">Platinum Sovereign</h3>
                <span className="font-body text-body-sm text-on-surface-variant">LKR 18,000,000 Principal</span>
              </div>
              <div className="flex items-center gap-space-md pt-2">
                <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                    <path className="text-surface-container" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                    <path className="text-primary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="72, 100" strokeLinecap="round" strokeWidth="3" />
                  </svg>
                  <span className="font-mono text-label-numeric text-primary font-bold absolute">72%</span>
                </div>
                <div className="space-y-0.5">
                  <span className="font-mono text-label-caps uppercase text-on-surface-variant block">Remaining Horizon</span>
                  <div className="font-body text-body-md font-medium text-on-surface">78 Days Left</div>
                  <span className="font-mono text-label-numeric text-on-surface-variant text-[10px]">Matures 14 May 2025</span>
                </div>
              </div>
            </div>
            <div className="pt-space-md mt-space-md border-t border-surface-container/60">
              <div className="p-space-sm rounded-lg bg-surface flex items-center justify-between border border-outline-variant/20">
                <div className="flex flex-col">
                  <span className="font-body text-body-sm text-on-surface font-medium">Auto-Rollover</span>
                  <span className="font-mono text-label-caps text-on-surface-variant">Principal + Interest</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-9 h-5 bg-surface-container peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-on-primary after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                </label>
              </div>
            </div>
          </div>
          
          {/* Cert 2 */}
          <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col justify-between relative shadow-sm hover:shadow-md transition-all group border border-outline-variant/30">
            <div className="space-y-space-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-space-xs">
                  <span className="w-2 h-2 rounded-full bg-secondary" />
                  <span className="font-mono text-label-caps uppercase text-on-surface font-bold">VLT-44912</span>
                </div>
                <span className="font-mono text-label-numeric text-secondary font-bold">14.75% AER</span>
              </div>
              <div>
                <h3 className="font-headline text-headline-sm text-on-surface">Corporate Yield Depository</h3>
                <span className="font-body text-body-sm text-on-surface-variant">LKR 20,250,000 Principal</span>
              </div>
              <div className="flex items-center gap-space-md pt-2">
                <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                    <path className="text-surface-container" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                    <path className="text-secondary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="35, 100" strokeLinecap="round" strokeWidth="3" />
                  </svg>
                  <span className="font-mono text-label-numeric text-secondary font-bold absolute">35%</span>
                </div>
                <div className="space-y-0.5">
                  <span className="font-mono text-label-caps uppercase text-on-surface-variant block">Remaining Horizon</span>
                  <div className="font-body text-body-md font-medium text-on-surface">244 Days Left</div>
                  <span className="font-mono text-label-numeric text-on-surface-variant text-[10px]">Matures 28 Oct 2025</span>
                </div>
              </div>
            </div>
            <div className="pt-space-md mt-space-md border-t border-surface-container/60">
              <div className="p-space-sm rounded-lg bg-surface flex items-center justify-between border border-outline-variant/20">
                <div className="flex flex-col">
                  <span className="font-body text-body-sm text-on-surface font-medium">Auto-Rollover</span>
                  <span className="font-mono text-label-caps text-on-surface-variant">Principal Only</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-9 h-5 bg-surface-container peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-on-primary after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary" />
                </label>
              </div>
            </div>
          </div>
          
          {/* Cert 3 */}
          <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col justify-between relative shadow-sm hover:shadow-md transition-all group border border-outline-variant/30">
            <div className="space-y-space-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-space-xs">
                  <span className="w-2 h-2 rounded-full bg-primary-container" />
                  <span className="font-mono text-label-caps uppercase text-on-surface font-bold">VLT-11003</span>
                </div>
                <span className="font-mono text-label-numeric text-primary font-bold">16.00% AER</span>
              </div>
              <div>
                <h3 className="font-headline text-headline-sm text-on-surface">Heritage Horizon 24M</h3>
                <span className="font-body text-body-sm text-on-surface-variant">LKR 10,000,000 Principal</span>
              </div>
              <div className="flex items-center gap-space-md pt-2">
                <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                    <path className="text-surface-container" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                    <path className="text-primary-container" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="94, 100" strokeLinecap="round" strokeWidth="3" />
                  </svg>
                  <span className="font-mono text-label-numeric text-primary-container font-bold absolute">94%</span>
                </div>
                <div className="space-y-0.5">
                  <span className="font-mono text-label-caps uppercase text-on-surface-variant block">Maturity Imminent</span>
                  <div className="font-body text-body-md font-medium text-on-surface">12 Days Left</div>
                  <span className="font-mono text-label-numeric text-on-surface-variant text-[10px]">Matures 12 Mar 2025</span>
                </div>
              </div>
            </div>
            <div className="pt-space-md mt-space-md border-t border-surface-container/60">
              <div className="p-space-sm rounded-lg bg-surface flex items-center justify-between border border-outline-variant/20">
                <div className="flex flex-col">
                  <span className="font-body text-body-sm text-on-surface font-medium">Discharge to Liquidity</span>
                  <span className="font-mono text-label-caps text-on-surface-variant">LKR Settlement Desk</span>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant text-[20px]">account_balance</span>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
