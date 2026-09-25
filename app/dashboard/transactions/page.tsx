"use client"

import * as React from "react"

export default function TransactionsPage() {
  const [amount, setAmount] = React.useState("250,000")
  const [channel, setChannel] = React.useState("ceft")
  const [activeBeneficiary, setActiveBeneficiary] = React.useState({
    name: "Senaka Senanayake Estates",
    bank: "Commercial Bank of Ceylon • Colombo Main City Branch",
    account: "0089 4410 9921 002",
    routeId: "CEFT-LK-7782-X"
  })
  const [isAuthorizing, setIsAuthorizing] = React.useState(false)

  const handleAuthorize = () => {
    setIsAuthorizing(true)
    setTimeout(() => {
      setIsAuthorizing(false)
      // Success modal or toast would go here
    }, 2000)
  }

  return (
    <div className="flex flex-col w-full">
      <div className="py-space-md lg:py-space-lg flex flex-col gap-space-lg">
        {/* Editorial Spatial Subheader */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-sm">
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-xs">
              <span className="font-mono text-label-caps text-primary uppercase tracking-widest">Protocol 04 // Velocity Desk</span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container" />
              <span className="font-mono text-body-sm text-on-surface-variant">RTGS / LankaPay Active</span>
            </div>
            <h1 className="font-headline text-[3rem] leading-none text-on-surface tracking-tight">Instant Capital Routing</h1>
          </div>
          <div className="flex items-center gap-space-md">
            <div className="hidden sm:flex flex-col items-end">
              <span className="font-mono text-label-caps uppercase text-on-surface-variant">Cleared Daily Limit</span>
              <span className="font-mono text-body-sm text-primary font-bold">LKR 45,000,000.00</span>
            </div>
            <div className="px-3.5 py-1.5 rounded-full bg-surface-container-low text-primary flex items-center gap-space-xs border border-surface-container">
              <span className="material-symbols-outlined text-[16px]">verified_user</span>
              <span className="font-mono text-label-caps uppercase">Quantum Key E2E</span>
            </div>
          </div>
        </div>

        {/* Main Spatial Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
          
          {/* Primary Transfer Canvas */}
          <div className="lg:col-span-8 flex flex-col gap-space-md">
            <div className="relative bg-surface-container-low rounded-xl p-space-md md:p-space-lg shadow-sm overflow-hidden flex flex-col gap-space-lg border border-outline-variant/30">
              {/* Ambient Glow */}
              <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-primary-fixed opacity-40 blur-3xl pointer-events-none" />
              
              {/* Channel Selection */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm z-10">
                <span className="font-mono text-label-caps text-on-surface-variant uppercase tracking-wider">Settlement Highway</span>
                <div className="inline-flex p-1 bg-surface rounded-full shadow-sm border border-outline-variant/20">
                  <button 
                    onClick={() => setChannel("ceft")}
                    className={`px-4 py-1.5 rounded-full font-body text-sm transition-all ${channel === "ceft" ? "bg-primary text-on-primary font-medium shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                  >Instant CEFT</button>
                  <button 
                    onClick={() => setChannel("internal")}
                    className={`px-4 py-1.5 rounded-full font-body text-sm transition-all ${channel === "internal" ? "bg-primary text-on-primary font-medium shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                  >B-Trust Internal</button>
                  <button 
                    onClick={() => setChannel("swift")}
                    className={`px-4 py-1.5 rounded-full font-body text-sm transition-all ${channel === "swift" ? "bg-primary text-on-primary font-medium shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                  >SWIFT Cross-Border</button>
                </div>
              </div>

              {/* Amount Well */}
              <div className="flex flex-col items-center justify-center py-space-lg bg-surface rounded-xl shadow-sm border border-outline-variant/20 relative z-10 px-4">
                <div className="flex items-center justify-center gap-space-xs mb-2">
                  <span className="font-mono text-label-caps uppercase text-on-surface-variant tracking-widest">Liquid Asset Pool: LKR Primary Treasury</span>
                  <span className="material-symbols-outlined text-primary text-[14px]">lock_open_right</span>
                </div>
                <div className="flex items-baseline justify-center gap-3 w-full max-w-xl text-center">
                  <span className="font-headline text-headline-md text-on-surface-variant select-none tracking-tight">LKR</span>
                  <input 
                    type="text" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full font-headline text-[5.5rem] leading-[1] text-primary bg-transparent text-center focus:outline-none tracking-tight selection:bg-primary-fixed border-none" 
                  />
                </div>
                <div className="flex items-center gap-space-sm mt-3">
                  <span className="font-mono text-body-sm text-on-surface-variant">≈ $ {((parseInt(amount.replace(/,/g, '')) || 0) / 307).toFixed(2)} USD</span>
                  <span className="text-outline-variant">•</span>
                  <span className="font-mono text-[10px] text-primary bg-primary-fixed/40 px-2.5 py-0.5 rounded-full uppercase font-bold tracking-widest">Zero Surcharge Zero Slippage</span>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-space-xs mt-4 pt-4 border-t border-surface-container">
                  {['50,000', '100,000', '250,000', '1,000,000', '5,000,000'].map(val => (
                    <button 
                      key={val}
                      onClick={() => setAmount(val)}
                      className={`px-3 py-1 rounded-full font-mono text-body-sm transition-colors border border-outline-variant/20 ${amount === val ? "bg-surface-container-high text-primary font-bold" : "bg-surface-container text-on-surface-variant hover:text-on-surface"}`}
                    >{val.includes('000,000') ? val.replace(',000,000', '.0M') : val.replace(',000', 'k')}</button>
                  ))}
                </div>
              </div>

              {/* Beneficiary Rail */}
              <div className="flex flex-col gap-space-sm z-10">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-label-caps uppercase text-on-surface-variant tracking-wider">Designated Beneficiary Vaults</span>
                  <span className="font-mono text-label-caps text-primary cursor-pointer hover:underline">Manage Entitlements</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm">
                  {/* Beneficiary 1 */}
                  <div 
                    onClick={() => setActiveBeneficiary({
                      name: "Senaka Senanayake Estates",
                      bank: "Commercial Bank of Ceylon • Colombo Main City Branch",
                      account: "0089 4410 9921 002",
                      routeId: "CEFT-LK-7782-X"
                    })}
                    className={`cursor-pointer bg-surface p-space-sm rounded-lg shadow-sm hover:shadow-md transition-all flex flex-col gap-space-xs border-2 ${activeBeneficiary.name.includes("Senaka") ? "border-primary" : "border-transparent"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface font-headline font-bold">SE</div>
                        {activeBeneficiary.name.includes("Senaka") && (
                          <span className="absolute -bottom-0.5 -right-0.5 bg-primary text-on-primary rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                            <span className="material-symbols-outlined text-[10px]">check</span>
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-primary bg-primary-fixed/50 px-1.5 py-0.5 rounded font-bold">CEFT</span>
                    </div>
                    <div className="flex flex-col mt-1">
                      <span className="font-body text-sm text-on-surface font-semibold truncate">Senaka Estates</span>
                      <span className="font-mono text-[10px] text-on-surface-variant">ComBank • 9921</span>
                    </div>
                  </div>

                  {/* Beneficiary 2 */}
                  <div 
                    onClick={() => setActiveBeneficiary({
                      name: "Dilmah Conservation Trust",
                      bank: "Standard Chartered Colombo",
                      account: "7721 9022 1400 001",
                      routeId: "INT-LK-4412-Y"
                    })}
                    className={`cursor-pointer bg-surface p-space-sm rounded-lg shadow-sm hover:shadow-md transition-all flex flex-col gap-space-xs border-2 ${activeBeneficiary.name.includes("Dilmah") ? "border-primary" : "border-transparent"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface font-headline font-bold">DC</div>
                        {activeBeneficiary.name.includes("Dilmah") && (
                          <span className="absolute -bottom-0.5 -right-0.5 bg-primary text-on-primary rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                            <span className="material-symbols-outlined text-[10px]">check</span>
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded font-bold">B-Trust</span>
                    </div>
                    <div className="flex flex-col mt-1">
                      <span className="font-body text-sm text-on-surface font-semibold truncate">Dilmah Trust</span>
                      <span className="font-mono text-[10px] text-on-surface-variant">StanChart • 1400</span>
                    </div>
                  </div>
                  
                  {/* Beneficiary 3 */}
                  <div 
                    onClick={() => setActiveBeneficiary({
                      name: "Geneva Vault Custody SA",
                      bank: "UBS Switzerland AG",
                      account: "CH93 0024 0240 8821 99",
                      routeId: "SWIFT-CH-0021-G"
                    })}
                    className={`cursor-pointer bg-surface p-space-sm rounded-lg shadow-sm hover:shadow-md transition-all flex flex-col gap-space-xs border-2 ${activeBeneficiary.name.includes("Geneva") ? "border-primary" : "border-transparent"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container">
                          <span className="material-symbols-outlined text-[20px]">account_balance</span>
                        </div>
                        {activeBeneficiary.name.includes("Geneva") && (
                          <span className="absolute -bottom-0.5 -right-0.5 bg-primary text-on-primary rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                            <span className="material-symbols-outlined text-[10px]">check</span>
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-secondary bg-secondary-fixed px-1.5 py-0.5 rounded font-bold">SWIFT</span>
                    </div>
                    <div className="flex flex-col mt-1">
                      <span className="font-body text-sm text-on-surface font-semibold truncate">Geneva Vault</span>
                      <span className="font-mono text-[10px] text-on-surface-variant">UBS AG • 8821</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Beneficiary Summary Card */}
              <div className="bg-surface rounded-lg p-space-md shadow-sm border border-outline-variant/20 flex flex-col gap-space-sm z-10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs">
                  <div className="flex items-center gap-space-xs">
                    <span className="font-mono text-label-caps uppercase text-on-surface-variant">Authenticated Counterparty</span>
                    <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-tertiary font-mono text-[10px] font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse-dot" /> LankaPay Real-Time Resolved
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-on-surface-variant">Route ID: {activeBeneficiary.routeId}</span>
                </div>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md pt-space-xs">
                  <div className="flex flex-col">
                    <span className="font-headline text-xl text-on-surface">{activeBeneficiary.name}</span>
                    <span className="font-body text-sm text-on-surface-variant">{activeBeneficiary.bank}</span>
                    <span className="font-mono text-body-md text-primary tracking-wide mt-1 font-bold">{activeBeneficiary.account}</span>
                  </div>
                  
                  {/* Security Status */}
                  <div className="flex items-center gap-space-sm bg-surface-container-low p-space-sm rounded-lg border border-outline-variant/20">
                    <span className="material-symbols-outlined text-primary text-[32px]">shield_person</span>
                    <div className="flex flex-col">
                      <span className="font-mono text-[10px] uppercase text-primary font-bold tracking-widest">256-Bit Hardware Enclave</span>
                      <span className="font-body text-xs text-on-surface-variant mt-0.5">Biometric Session Pin Active</span>
                    </div>
                  </div>
                </div>
                
                {/* Memo */}
                <div className="pt-space-xs flex flex-col sm:flex-row gap-space-xs sm:items-center mt-2 border-t border-surface-container pt-4">
                  <span className="font-mono text-label-caps uppercase text-on-surface-variant shrink-0">Execution Purpose:</span>
                  <input 
                    type="text" 
                    defaultValue="Estate Land Title Stewardship & Preservation Tranche 04"
                    className="w-full bg-surface-container-low px-3 py-1.5 rounded text-sm font-body text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/40 border border-transparent transition-colors"
                  />
                </div>
              </div>

              {/* Authorize CTA */}
              <div className="flex flex-col sm:flex-row items-center gap-space-md z-10">
                <button 
                  onClick={handleAuthorize}
                  disabled={isAuthorizing}
                  className="w-full sm:flex-1 py-4 px-8 rounded-lg bg-secondary text-on-secondary font-body text-lg font-semibold tracking-wide hover:bg-secondary/90 active:scale-[0.985] shadow-[0_4px_14px_rgba(158,66,41,0.25)] transition-all flex items-center justify-center gap-space-sm group disabled:opacity-80 disabled:cursor-wait"
                >
                  <span className={`material-symbols-outlined text-[24px] transition-transform ${isAuthorizing ? "animate-spin" : "group-hover:scale-110"}`}>
                    {isAuthorizing ? "sync" : "fingerprint"}
                  </span>
                  <span>{isAuthorizing ? "Authorizing Transfer..." : "Authorize Instant Transfer"}</span>
                  <span className="font-headline font-normal leading-none group-hover:translate-x-1.5 transition-transform">→</span>
                </button>
                <div className="flex items-center gap-space-xs text-on-surface-variant font-mono text-label-caps uppercase shrink-0 font-bold">
                  <span className="material-symbols-outlined text-[18px] text-primary">speed</span>
                  <span>Sub-40ms Settlement</span>
                </div>
              </div>
            </div>

            {/* Macro Security Note */}
            <div className="flex items-center justify-between px-space-sm py-2 text-on-surface-variant">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="font-body text-xs">Dual Signatory Threshold: Below LKR 50M transfers authorize on singular sovereign key.</span>
              </div>
              <span className="font-mono text-xs">CBSL Reg: 1988/P-22</span>
            </div>
          </div>

          {/* Right Ledger Panel */}
          <div className="lg:col-span-4 flex flex-col gap-space-md">
            <div className="bg-surface-container-low rounded-xl p-space-md shadow-sm border border-outline-variant/30 flex flex-col gap-space-md">
              <div className="flex items-center justify-between border-b border-surface-container pb-2">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary text-[20px]">history</span>
                  <span className="font-headline text-xl text-on-surface">Recent Receipts</span>
                </div>
                <span className="font-mono text-label-caps uppercase text-primary cursor-pointer hover:underline font-bold">Full Archive</span>
              </div>
              
              {/* Receipt List */}
              <div className="flex flex-col gap-space-sm">
                
                {/* Item 1 */}
                <div className="bg-surface p-space-sm rounded-lg shadow-sm hover:shadow-md transition-all flex flex-col gap-space-xs group border border-outline-variant/20">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col">
                      <span className="font-body text-sm text-on-surface font-semibold group-hover:text-primary transition-colors">Colombo Harbor Silo Lease</span>
                      <span className="font-mono text-[10px] uppercase text-on-surface-variant">14 Oct 2025 • 11:24 AM</span>
                    </div>
                    <span className="font-headline text-lg text-on-surface font-medium tracking-tight">LKR 4,200,000</span>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-bold">CEFT Cleared</span>
                    <div className="flex items-center gap-space-xs opacity-80 group-hover:opacity-100 transition-opacity">
                      <button className="px-2 py-1 rounded bg-surface-container text-primary font-mono text-[10px] font-bold uppercase hover:bg-primary hover:text-on-primary transition-colors">Repeat</button>
                      <button className="p-1 rounded bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center">
                        <span className="material-symbols-outlined text-[16px]">download</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Item 2 */}
                <div className="bg-surface p-space-sm rounded-lg shadow-sm hover:shadow-md transition-all flex flex-col gap-space-xs group border border-outline-variant/20">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col">
                      <span className="font-body text-sm text-on-surface font-semibold group-hover:text-primary transition-colors">Victoria Golf Sanctuary Maint.</span>
                      <span className="font-mono text-[10px] uppercase text-on-surface-variant">12 Oct 2025 • 04:12 PM</span>
                    </div>
                    <span className="font-headline text-lg text-on-surface font-medium tracking-tight">LKR 850,000</span>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-bold">Internal Desk</span>
                    <div className="flex items-center gap-space-xs opacity-80 group-hover:opacity-100 transition-opacity">
                      <button className="px-2 py-1 rounded bg-surface-container text-primary font-mono text-[10px] font-bold uppercase hover:bg-primary hover:text-on-primary transition-colors">Repeat</button>
                      <button className="p-1 rounded bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center">
                        <span className="material-symbols-outlined text-[16px]">download</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
