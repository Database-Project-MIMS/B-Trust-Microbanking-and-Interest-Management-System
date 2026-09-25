"use client"

import * as React from "react"
import Link from "next/link"

export default function FXDesksPage() {
  const [usdInput, setUsdInput] = React.useState(25000)
  const exchangeRate = 312.45
  
  const [isAuthorizing, setIsAuthorizing] = React.useState(false)

  const handleAuthorize = () => {
    setIsAuthorizing(true)
    setTimeout(() => {
      setIsAuthorizing(false)
      // Show success modal
    }, 1500)
  }

  return (
    <div className="flex flex-col w-full relative">
      <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary-fixed/20 via-surface to-transparent" />
      <div className="absolute -top-32 -left-20 w-96 h-96 rounded-full bg-tertiary-fixed/30 blur-3xl pointer-events-none" />
      
      <div className="py-8 pb-12 relative z-10 flex flex-col gap-space-lg">
        
        {/* Top Micro Bar / Spatial Status */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-10 border-b border-surface-container/50">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-primary animate-pulse-dot" />
            <span className="font-mono text-label-caps uppercase text-on-surface-variant tracking-wider">Treasury Liquidity Desk • Continuous Interbank Matching</span>
          </div>
          <div className="flex items-center gap-2 bg-surface-container-low px-4 py-2 rounded-full shadow-sm border border-outline-variant/20">
            <span className="material-symbols-outlined text-primary text-[18px]">verified_user</span>
            <span className="font-mono text-label-caps uppercase text-on-surface-variant">Tier-1 Institutional Clearing</span>
            <span className="text-outline-variant text-[12px]">•</span>
            <span className="font-mono text-label-numeric text-primary font-medium">SLIPS & RTGS Connected</span>
          </div>
        </div>

        {/* Headline Block */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-baseline">
          <div className="lg:col-span-8 space-y-4">
            <span className="font-mono text-label-caps text-secondary uppercase tracking-widest block font-bold">Desk 04 / Multi-Asset FX & Settlement</span>
            <h1 className="font-headline text-[3rem] lg:text-[4rem] text-primary tracking-tight font-normal max-w-2xl leading-none">
              Global Currency Desks & Treasury Arbitrage
            </h1>
          </div>
          <div className="lg:col-span-4 flex flex-col justify-end">
            <p className="font-body text-body-md text-on-surface-variant leading-relaxed">
              Real-time multi-sovereign holding vaults with automated yield accrual, dynamic liquidity rebalancing, and direct settlement rails into the Central Bank of Sri Lanka.
            </p>
          </div>
        </div>

        {/* Live Exchange Rate Ticker Tape */}
        <div className="w-full bg-surface-container-low rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border border-outline-variant/30 mt-4">
          <div className="flex items-center gap-3 shrink-0 px-2">
            <span className="font-mono text-label-caps uppercase text-on-surface tracking-wider font-bold">Interbank Spot</span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full divide-y sm:divide-y-0 sm:divide-x divide-outline-variant/30">
            {/* USD */}
            <div className="flex items-center justify-between sm:justify-start gap-4 px-3 pt-2 sm:pt-0">
              <span className="font-mono text-label-caps text-on-surface-variant font-bold">USD / LKR</span>
              <span className="font-headline text-xl text-on-surface tracking-tight">312.45</span>
              <span className="inline-flex items-center gap-0.5 font-mono text-label-numeric text-primary font-medium bg-tertiary-fixed px-2 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-[14px]">trending_down</span> -0.18%
              </span>
            </div>
            {/* EUR */}
            <div className="flex items-center justify-between sm:justify-start gap-4 px-3 pt-2 sm:pt-0">
              <span className="font-mono text-label-caps text-on-surface-variant font-bold">EUR / LKR</span>
              <span className="font-headline text-xl text-on-surface tracking-tight">338.80</span>
              <span className="inline-flex items-center gap-0.5 font-mono text-label-numeric text-secondary font-medium bg-secondary-fixed px-2 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-[14px]">trending_up</span> +0.42%
              </span>
            </div>
            {/* GBP */}
            <div className="flex items-center justify-between sm:justify-start gap-4 px-3 pt-2 sm:pt-0">
              <span className="font-mono text-label-caps text-on-surface-variant font-bold">GBP / LKR</span>
              <span className="font-headline text-xl text-on-surface tracking-tight">396.15</span>
              <span className="inline-flex items-center gap-0.5 font-mono text-label-numeric text-primary font-medium bg-tertiary-fixed px-2 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-[14px]">trending_up</span> +0.06%
              </span>
            </div>
          </div>
          <div className="hidden xl:flex items-center gap-2 pl-4 shrink-0 text-on-surface-variant font-mono text-label-caps">
            <span className="material-symbols-outlined text-[16px]">sync</span>
            <span>500ms Feed</span>
          </div>
        </div>

        {/* Multi-currency Vault Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          
          {/* USD Holding */}
          <div className="bg-surface-container-low rounded-xl p-8 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow border border-outline-variant/30 hover:border-primary-fixed/50 min-h-[360px]">
            <div className="absolute top-0 right-0 p-8 pointer-events-none opacity-10">
              <span className="font-headline text-[8rem] text-primary leading-none">$</span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-8 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center font-mono font-bold text-primary text-xs">USD</div>
                  <div>
                    <h3 className="font-headline text-lg text-on-surface">US Dollar Reserve</h3>
                    <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">Treasury Vault #01</span>
                  </div>
                </div>
                <span className="bg-tertiary-fixed text-primary px-3 py-1 rounded-full font-mono text-[10px] uppercase font-bold">5.2% APY</span>
              </div>
              <div className="mb-6 relative z-10">
                <span className="font-mono text-[10px] uppercase text-on-surface-variant block mb-1">Available Custodial Balance</span>
                <div className="font-headline text-[3rem] text-on-surface tracking-tight leading-none">$240,000<span className="text-on-surface-variant font-body text-lg">.00</span></div>
              </div>
              
              {/* Mini Sparkline for USD */}
              <div className="w-full h-12 mb-6 relative z-10">
                <svg className="w-full h-full text-primary" fill="none" viewBox="0 0 200 40">
                  <path d="M0 32 Q 40 30, 70 22 T 130 18 T 170 10 T 200 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" />
                  <path d="M0 32 Q 40 30, 70 22 T 130 18 T 170 10 T 200 6 L 200 40 L 0 40 Z" fill="currentColor" fillOpacity="0.06" />
                </svg>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 bg-surface-container-lowest/50 -mx-8 -mb-8 px-8 py-5 border-t border-surface-container/50">
              <span className="font-body text-sm text-on-surface-variant">Est. 30D Accrual: <strong className="text-primary font-medium">+$1,040.00</strong></span>
              <button className="text-primary font-body text-sm font-semibold flex items-center gap-1 hover:underline">
                Allocate <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>

          {/* EUR Holding */}
          <div className="bg-surface-container-low rounded-xl p-8 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow border border-outline-variant/30 hover:border-secondary-fixed/50 min-h-[360px]">
            <div className="absolute top-0 right-0 p-8 pointer-events-none opacity-10">
              <span className="font-headline text-[8rem] text-primary leading-none">€</span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-8 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center font-mono font-bold text-primary text-xs">EUR</div>
                  <div>
                    <h3 className="font-headline text-lg text-on-surface">Euro Overnight</h3>
                    <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">ECB Liquidity Corridor</span>
                  </div>
                </div>
                <span className="bg-tertiary-fixed text-primary px-3 py-1 rounded-full font-mono text-[10px] uppercase font-bold">3.8% APY</span>
              </div>
              <div className="mb-6 relative z-10">
                <span className="font-mono text-[10px] uppercase text-on-surface-variant block mb-1">Available Custodial Balance</span>
                <div className="font-headline text-[3rem] text-on-surface tracking-tight leading-none">€180,000<span className="text-on-surface-variant font-body text-lg">.00</span></div>
              </div>
              
              {/* Mini Sparkline for EUR */}
              <div className="w-full h-12 mb-6 relative z-10">
                <svg className="w-full h-full text-primary" fill="none" viewBox="0 0 200 40">
                  <path d="M0 28 Q 50 32, 90 26 T 150 16 T 200 12" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" />
                  <path d="M0 28 Q 50 32, 90 26 T 150 16 T 200 12 L 200 40 L 0 40 Z" fill="currentColor" fillOpacity="0.06" />
                </svg>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 bg-surface-container-lowest/50 -mx-8 -mb-8 px-8 py-5 border-t border-surface-container/50">
              <span className="font-body text-sm text-on-surface-variant">Est. 30D Accrual: <strong className="text-primary font-medium">+€570.00</strong></span>
              <button className="text-primary font-body text-sm font-semibold flex items-center gap-1 hover:underline">
                Allocate <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>

          {/* LKR Primary Pool */}
          <div className="bg-surface-container-low rounded-xl p-8 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow border border-outline-variant/30 hover:border-secondary-fixed/50 min-h-[360px]">
            <div className="absolute top-0 right-0 p-8 pointer-events-none opacity-10">
              <span className="font-headline text-[8rem] text-secondary leading-none">₨</span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-8 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center font-mono font-bold text-secondary text-xs">LKR</div>
                  <div>
                    <h3 className="font-headline text-lg text-on-surface">LKR Primary Pool</h3>
                    <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">Domestic Settlement Hub</span>
                  </div>
                </div>
                <span className="bg-secondary-fixed text-secondary px-3 py-1 rounded-full font-mono text-[10px] uppercase font-bold">On-Demand RTGS</span>
              </div>
              <div className="mb-6 relative z-10">
                <span className="font-mono text-[10px] uppercase text-on-surface-variant block mb-1">Total Clearable Capital</span>
                <div className="font-headline text-[3rem] text-on-surface tracking-tight leading-none">LKR 38.50<span className="text-on-surface-variant font-body text-lg">M</span></div>
              </div>
              
              {/* Mini Level Indicator */}
              <div className="w-full h-12 mb-6 flex flex-col justify-end relative z-10">
                <div className="flex justify-between font-mono text-[10px] uppercase text-on-surface-variant mb-1">
                  <span>Central Clearing Buffer</span>
                  <span className="font-bold text-on-surface">94.2% Optimal</span>
                </div>
                <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                  <div className="bg-secondary h-full rounded-full" style={{ width: '94.2%' }} />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 bg-surface-container-lowest/50 -mx-8 -mb-8 px-8 py-5 border-t border-surface-container/50">
              <span className="font-body text-sm text-on-surface-variant">Equivalent: <strong className="text-on-surface font-medium font-mono text-label-numeric">$123,219 USD</strong></span>
              <button className="text-secondary font-body text-sm font-semibold flex items-center gap-1 hover:underline">
                Rebalance <span className="material-symbols-outlined text-[16px]">swap_vert</span>
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Zone: Split View for Frictionless Conversion & Swift Clearing Routing */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
          
          {/* Conversion Calculator */}
          <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-8 md:p-10 shadow-sm relative border border-outline-variant/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-8">
              <div>
                <span className="font-mono text-[10px] text-primary uppercase font-bold tracking-wider">Zero-Spread Matching Engine</span>
                <h2 className="font-headline text-[2rem] text-on-surface leading-tight mt-1">One-Click Arbitrage & Conversion</h2>
              </div>
              <div className="inline-flex items-center gap-1.5 bg-tertiary-fixed/60 text-primary px-3 py-1 rounded-full font-mono text-[10px] font-bold">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Institutional Spread 0.000%
              </div>
            </div>

            <div className="space-y-4 relative">
              {/* Sell Side */}
              <div className="bg-surface-container-low p-5 rounded-xl border border-outline-variant/20 focus-within:border-primary/50 transition-colors">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-mono text-[10px] text-on-surface-variant uppercase font-bold">You Debit From Vault</span>
                  <span className="font-body text-sm text-on-surface-variant">Available: <strong className="text-on-surface font-mono">$240,000.00</strong></span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <input 
                      type="number" 
                      value={usdInput} 
                      onChange={(e) => setUsdInput(Number(e.target.value))}
                      className="w-full bg-transparent font-headline text-[2.5rem] md:text-[3rem] text-on-surface focus:outline-none tracking-tight placeholder:text-outline-variant border-none" 
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-surface px-4 py-2 rounded-full shadow-sm border border-outline-variant/10">
                    <span className="font-headline text-lg font-bold text-primary">USD</span>
                    <span className="font-mono text-[10px] text-on-surface-variant uppercase">Custody</span>
                  </div>
                </div>
              </div>

              {/* Central Swap Action Pill */}
              <div className="relative flex justify-center -my-4 z-10">
                <button className="w-12 h-12 rounded-full bg-primary text-on-primary shadow-[0_4px_14px_rgba(46,92,80,0.25)] flex items-center justify-center hover:scale-105 transition-transform" title="Invert Currency Direction">
                  <span className="material-symbols-outlined text-[24px]">swap_vert</span>
                </button>
              </div>

              {/* Buy Side */}
              <div className="bg-surface-container-low p-5 rounded-xl border border-outline-variant/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-mono text-[10px] text-on-surface-variant uppercase font-bold">You Credit To Pool (Direct RTGS)</span>
                  <span className="font-body text-sm text-on-surface-variant">Guaranteed Fill</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-headline text-[2.5rem] md:text-[3rem] text-on-surface tracking-tight">
                      {(usdInput * exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-surface px-4 py-2 rounded-full shadow-sm border border-outline-variant/10">
                    <span className="font-headline text-lg font-bold text-secondary">LKR</span>
                    <span className="font-mono text-[10px] text-on-surface-variant uppercase">Primary</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Execution Specs */}
            <div className="mt-6 pt-6 space-y-3 border-t border-surface-container/50">
              <div className="flex justify-between items-center text-sm font-body">
                <span className="text-on-surface-variant">Locked Mid-Market Fix</span>
                <span className="font-mono text-on-surface font-medium">1 USD = 312.4500 LKR</span>
              </div>
              <div className="flex justify-between items-center text-sm font-body">
                <span className="text-on-surface-variant">Settlement Speed</span>
                <span className="text-primary font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">bolt</span> Instant (CBSL RTGS Core)
                </span>
              </div>
              <div className="flex justify-between items-center text-sm font-body">
                <span className="text-on-surface-variant">Conversion Fee Matrix</span>
                <span className="text-on-surface font-medium">Zero Fee / Tier-1 Rebate</span>
              </div>
            </div>

            <button 
              onClick={handleAuthorize}
              disabled={isAuthorizing}
              className="w-full mt-8 py-4 px-8 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-body text-lg font-semibold tracking-wide transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-90 active:scale-[0.985]"
            >
              {isAuthorizing ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[24px]">sync</span>
                  <span>Executing Trade...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[24px]">price_change</span>
                  <span>Execute Block Trade</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Routing Paths & Liquidity Providers */}
          <div className="lg:col-span-5 flex flex-col gap-space-md">
            
            <div className="bg-surface-container-low rounded-xl p-space-md shadow-sm border border-outline-variant/30 flex flex-col gap-space-sm">
              <div className="flex items-center gap-2 border-b border-surface-container pb-2 mb-2">
                <span className="material-symbols-outlined text-primary text-[20px]">account_balance</span>
                <span className="font-headline text-lg text-on-surface">Institutional Order Book</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-surface border border-transparent hover:border-outline-variant/20 transition-all cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center">
                    <span className="font-mono text-[10px] font-bold">HSBC</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-body text-sm font-medium text-on-surface">HSBC Sovereign Clearing</span>
                    <span className="font-mono text-[10px] text-on-surface-variant uppercase">Limit: $15M • LKR Pool</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-outline-variant text-[18px]">chevron_right</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-surface border border-transparent hover:border-outline-variant/20 transition-all cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center">
                    <span className="font-mono text-[10px] font-bold">StanC</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-body text-sm font-medium text-on-surface">Standard Chartered OTC</span>
                    <span className="font-mono text-[10px] text-on-surface-variant uppercase">Limit: $25M • Block Trades</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-outline-variant text-[18px]">chevron_right</span>
              </div>
            </div>

            <div className="bg-secondary-fixed/30 rounded-xl p-space-md shadow-sm border border-secondary-fixed/50 flex flex-col gap-space-sm">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-secondary text-[24px]">warning</span>
                <div className="flex flex-col">
                  <span className="font-headline text-lg text-on-surface mb-1">Volatile Market Warning</span>
                  <span className="font-body text-sm text-on-surface-variant leading-relaxed">
                    LKR volatility has triggered the CBSL macro-prudential safeguard. Spreads wider than 150 basis points on retail corridors. Sovereign interbank routing maintained at 0.00%.
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
