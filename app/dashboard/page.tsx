"use client"

import * as React from "react"
import Link from "next/link"

export default function DashboardHome() {
  const [simModalOpen, setSimModalOpen] = React.useState(false)
  const [simPrincipal, setSimPrincipal] = React.useState(10000000)
  const [isFlipped, setIsFlipped] = React.useState(false)
  const [isFrozen, setIsFrozen] = React.useState(false)
  const [showDetails, setShowDetails] = React.useState(false)

  const projectedYield = Math.round(simPrincipal * 0.124)

  return (
    <>
      <div className="relative w-full overflow-visible">
        {/* Ambient Blooms */}
        <div className="absolute -top-32 right-1/4 w-96 h-96 rounded-full bg-primary-fixed/20 blur-3xl pointer-events-none" />
        <div className="absolute top-48 left-12 w-80 h-80 rounded-full bg-secondary-fixed/25 blur-3xl pointer-events-none" />
        
        <div className="pt-space-md pb-space-lg flex flex-col gap-space-xl">
          {/* Top Utility & Sanctuary Meta */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pt-space-xs">
            <div className="flex items-center gap-space-xs">
              <span className="font-mono text-label-caps uppercase text-on-surface-variant">Stewardship Ledger</span>
              <span className="text-outline-variant font-mono text-label-caps">/</span>
              <span className="font-mono text-label-caps uppercase text-primary font-semibold">Horizon Audit 2025.Q2</span>
            </div>
            <div className="flex items-center gap-space-sm">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-low text-on-surface font-mono text-body-sm shadow-sm border border-surface-container">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse-dot" />
                Sync: Colombo Central Feed (0.42s)
              </span>
            </div>
          </div>

          {/* Hero Typographic Monolith */}
          <div className="flex flex-col items-center text-center relative z-10 max-w-4xl mx-auto">
            <span className="font-mono text-label-caps uppercase text-on-surface-variant tracking-[0.2em] mb-space-xs">Consolidated Horizon</span>
            <div className="flex flex-col items-center gap-space-xs my-space-xs">
              <div className="flex items-baseline justify-center gap-space-xs flex-wrap">
                <span className="font-mono text-body-lg text-on-surface-variant">LKR</span>
                <h1 className="font-headline text-[5.5rem] leading-[1] tracking-tight text-on-surface select-none">
                  48,290,140
                </h1>
              </div>
              <div className="flex items-center gap-space-xs mt-space-xs">
                <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-tertiary-fixed text-tertiary font-mono text-label-caps">
                  <span className="material-symbols-outlined text-[14px]">trending_up</span>
                  <span>+14.2% ANNUALIZED GAIN</span>
                </div>
                <span className="font-body text-body-sm text-on-surface-variant">vs. prev quarter</span>
              </div>
            </div>

            {/* Prominent Bespoke Action Duo */}
            <div className="flex items-center justify-center gap-space-md mt-space-lg flex-wrap">
              <Link href="/dashboard/transactions" className="px-7 py-3.5 rounded-xl bg-primary text-on-primary font-body text-body-md hover:bg-primary-container transition-all active:scale-[0.985] shadow-[0_4px_14px_rgba(46,92,80,0.25)] flex items-center gap-2 group">
                <span>Initiate Transfer</span>
                <span className="material-symbols-outlined text-[18px] group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
              </Link>
              <button onClick={() => setSimModalOpen(true)} className="px-7 py-3.5 rounded-xl bg-surface-container text-on-surface font-body text-body-md hover:bg-surface-container-high transition-all active:scale-[0.985] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">auto_graph</span>
                <span>Simulate Yield</span>
              </button>
            </div>
          </div>

          {/* Spatial Interactive Grid: Fluid Float Canvas & Spatial Allocation Artifacts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-stretch mt-4">
            
            {/* Interactive Liquid Treasury Vessel */}
            <div className="lg:col-span-8 rounded-xl bg-surface-container-low p-space-md md:p-space-lg relative overflow-hidden shadow-sm flex flex-col justify-between min-h-[380px] group border border-outline-variant/30 hover:border-primary-fixed/50 transition-colors">
              <div className="absolute inset-0 bg-gradient-to-br from-primary-fixed/20 via-surface-container-low/40 to-secondary-fixed/15 opacity-70 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
              
              {/* Liquid Organic Wave Vector (Parametric float simulation) */}
              <div className="absolute -right-16 -bottom-16 w-96 h-96 pointer-events-none opacity-40 group-hover:scale-105 transition-transform duration-700">
                <svg className="w-full h-full text-primary fill-current" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                  <path d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,79.6,-45.8C87.4,-32.5,90,-16.3,87.6,-0.8C85.2,14.6,77.7,29.2,68.9,42.2C60.1,55.1,49.9,66.4,37.3,73.5C24.7,80.7,9.7,83.6,-4.8,81.9C-19.4,80.1,-33.5,73.7,-46.8,65.3C-60,57,-72.5,46.7,-79.8,33.2C-87.1,19.6,-89.2,2.8,-86.3,-13.2C-83.4,-29.2,-75.4,-44.4,-63.9,-54.6C-52.4,-64.7,-37.4,-69.8,-23.1,-75.4C-8.8,-80.9,4.7,-86.9,20.6,-85.4C36.4,-83.9,30.6,-83.6,44.7,-76.4Z" transform="translate(100 100)"></path>
                </svg>
              </div>

              {/* Top Meta Row inside Card */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-space-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary-container" />
                  <span className="font-mono text-label-caps uppercase text-on-surface tracking-wider">Treasury Float Equilibrium</span>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-surface-container font-mono text-label-numeric text-on-surface-variant text-xs">Realtime Algorithmic Rebalance</span>
              </div>

              {/* Mid Fluid Metric & Visual Indicator */}
              <div className="relative z-10 my-space-lg max-w-lg">
                <span className="font-mono text-label-caps uppercase text-on-surface-variant">Autonomous Liquidity Dispersion</span>
                <div className="font-headline text-[3rem] leading-none text-on-surface mt-space-xs mb-space-sm">
                  99.82<span className="text-primary">%</span>
                </div>
                <p className="font-body text-body-md text-on-surface-variant">
                  Multi-tiered reserves positioned across central clearinghouses with instantaneous intra-day settlement bandwidth.
                </p>
              </div>

              {/* Bottom Metric Strips */}
              <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 gap-space-md pt-space-md">
                <div className="flex flex-col">
                  <span className="font-mono text-label-caps uppercase text-on-surface-variant">Velocity Ratio</span>
                  <span className="font-mono text-headline-sm text-primary">1.48x</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-label-caps uppercase text-on-surface-variant">Stress Buffer</span>
                  <span className="font-mono text-headline-sm text-on-surface">32.4 Days</span>
                </div>
                <div className="flex flex-col col-span-2 sm:col-span-1">
                  <span className="font-mono text-label-caps uppercase text-on-surface-variant">Sovereign Hedging</span>
                  <span className="font-mono text-headline-sm text-tertiary">Optimal</span>
                </div>
              </div>
            </div>

            {/* Interactive Minimal Credit Card 3D Component */}
            <div className="lg:col-span-4 rounded-xl bg-surface-container-low p-space-md flex flex-col justify-between relative overflow-hidden shadow-sm border border-outline-variant/30">
              <div className="flex items-center justify-between z-10 mb-space-xs">
                <div className="flex items-center gap-space-xs">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse-dot" />
                  <span className="font-mono text-label-caps uppercase text-on-surface tracking-wider">Titanium Prime Card</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-surface text-primary font-mono text-label-caps border border-outline-variant/30 text-[10px]">Sector VII</span>
              </div>
              
              {/* 3D Perspective Stage */}
              <div className="w-full py-6 flex flex-col items-center justify-center relative cursor-pointer" style={{ perspective: '1200px' }} onClick={() => setIsFlipped(!isFlipped)}>
                <div className="animate-card-float w-full max-w-[320px] transition-transform duration-700 ease-out relative aspect-[1.586/1]" style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                  
                  {/* Front of Card */}
                  <div className="absolute inset-0 w-full h-full rounded-2xl bg-gradient-to-br from-[#12231e] via-[#0b1814] to-[#040907] p-5 shadow-[0_20px_45px_-10px_rgba(10,30,24,0.35),0_0_0_1px_rgba(160,208,193,0.18)] flex flex-col justify-between overflow-hidden text-surface" style={{ backfaceVisibility: 'hidden' }}>
                    <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.06)_50%,transparent_75%)] bg-[length:6px_6px]" />
                    <div className="relative z-10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary-fixed/30 to-primary-container/40 border border-primary-fixed/30 flex items-center justify-center">
                          <span className="font-headline text-[12px] font-bold text-primary-fixed tracking-tighter">B</span>
                        </div>
                        <span className="font-mono text-[10px] tracking-[0.22em] text-primary-fixed uppercase font-semibold">B-Trust</span>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-80">
                        <span className="material-symbols-outlined text-[17px] text-primary-fixed rotate-90">contactless</span>
                      </div>
                    </div>
                    <div className="relative z-10 flex items-center gap-3 my-auto">
                      <div className="w-11 h-8 rounded-md bg-gradient-to-br from-[#d4af37] via-[#f7e7a9] to-[#997920] p-0.5 shadow-sm border border-[#fff2b2]/40 relative overflow-hidden">
                        <div className="w-full h-full border border-[#856514]/30 rounded-[3px] grid grid-cols-2 grid-rows-2">
                          <div className="border-r border-b border-[#856514]/40" />
                          <div className="border-b border-[#856514]/40" />
                          <div className="border-r border-[#856514]/40" />
                          <div />
                        </div>
                      </div>
                      <span className="font-mono text-[13px] tracking-[0.25em] text-primary-fixed/80 select-none">
                        {showDetails ? "4829 3910 2004 8831" : "•••• •••• •••• 8831"}
                      </span>
                    </div>
                    <div className="relative z-10 flex items-end justify-between pt-1">
                      <div>
                        <span className="block font-mono text-[7px] text-primary-fixed-dim/60 uppercase tracking-[0.2em] leading-none mb-1">Cardholder</span>
                        <span className="font-headline text-[12px] text-[#f2f3fb] tracking-wider uppercase font-medium">H. V. DE SILVA</span>
                      </div>
                      <div className="text-right">
                        <span className="block font-mono text-[7px] text-primary-fixed-dim/60 uppercase tracking-[0.2em] leading-none mb-1">Valid Thru</span>
                        <span className="font-mono text-[11px] text-[#eff0f8] tracking-widest">09/29</span>
                      </div>
                    </div>
                  </div>

                  {/* Back of Card */}
                  <div className="absolute inset-0 w-full h-full rounded-2xl bg-gradient-to-br from-[#0c1915] via-[#050b09] to-[#020504] py-5 shadow-[0_20px_45px_-10px_rgba(10,30,24,0.35),0_0_0_1px_rgba(160,208,193,0.18)] flex flex-col justify-between overflow-hidden text-surface" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                    <div className="w-full h-10 bg-black/80 my-1" />
                    <div className="px-5 flex items-center justify-between">
                      <div className="bg-surface-container-high/90 h-7 px-3 rounded flex items-center justify-end w-3/4">
                        <span className="font-mono text-[11px] text-on-surface italic font-bold tracking-widest">
                          {showDetails ? "CVV • 714" : "CVV • ***"}
                        </span>
                      </div>
                      <span className="font-mono text-[8px] text-primary-fixed/70 uppercase tracking-widest">Mastercard</span>
                    </div>
                    <div className="px-5 text-[8px] text-outline-variant font-mono leading-tight">
                      Encrypted private key signature enclave ID: BT-LK-8831-SEC. Authorized signature only. Subject to B-Trust custodian charter.
                    </div>
                  </div>
                </div>
              </div>

              {/* Telemetry Controls Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-surface-container">
                <button onClick={() => setIsFlipped(!isFlipped)} className="p-2.5 rounded-xl bg-surface hover:bg-surface-container-high transition-colors flex flex-col items-center text-center gap-1 border border-outline-variant/20">
                  <span className="material-symbols-outlined text-primary text-[20px]">flip</span>
                  <span className="font-body text-[10px] font-medium text-on-surface">Flip Card</span>
                </button>
                <button onClick={() => setIsFrozen(!isFrozen)} className={`p-2.5 rounded-xl transition-colors flex flex-col items-center text-center gap-1 border border-outline-variant/20 ${isFrozen ? 'bg-primary-container' : 'bg-surface hover:bg-surface-container-high'}`}>
                  <span className={`material-symbols-outlined text-[20px] ${isFrozen ? 'text-on-primary' : 'text-primary'}`}>
                    {isFrozen ? "lock" : "lock_open"}
                  </span>
                  <span className={`font-body text-[10px] font-medium ${isFrozen ? 'text-on-primary' : 'text-on-surface'}`}>
                    {isFrozen ? "Frozen" : "Freeze Card"}
                  </span>
                </button>
                <button onClick={() => setShowDetails(!showDetails)} className={`p-2.5 rounded-xl transition-colors flex flex-col items-center text-center gap-1 border border-outline-variant/20 ${showDetails ? 'bg-surface-container-high' : 'bg-surface hover:bg-surface-container-high'}`}>
                  <span className="material-symbols-outlined text-primary text-[20px]">
                    {showDetails ? "visibility_off" : "vpn_key"}
                  </span>
                  <span className="font-body text-[10px] font-medium text-on-surface">
                    {showDetails ? "Hide Details" : "Reveal Details"}
                  </span>
                </button>
                <div className="p-2.5 rounded-xl bg-surface flex flex-col items-center justify-center text-center gap-0.5 border border-outline-variant/20">
                  <span className="font-mono text-[8px] uppercase text-on-surface-variant">Daily Limit</span>
                  <span className="font-mono text-[11px] font-semibold text-primary">LKR 5.0M</span>
                </div>
              </div>
            </div>
          </div>

          {/* Ultra-simplified Summary Trio with Airy Whitespace */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            {/* Summary 01 */}
            <div className="p-space-lg rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors shadow-sm border border-outline-variant/30 flex flex-col justify-between min-h-[220px]">
              <div className="flex items-center justify-between mb-space-md">
                <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed">
                  <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
                </div>
                <span className="font-mono text-label-caps uppercase text-on-surface-variant tracking-wider text-xs">Unrestricted</span>
              </div>
              <div>
                <span className="font-body text-body-sm text-on-surface-variant block mb-1">Available Liquidity</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-body-sm text-on-surface-variant">LKR</span>
                  <span className="font-headline text-headline-md text-on-surface">12.45M</span>
                </div>
              </div>
              <div className="mt-space-md flex items-center justify-between pt-space-sm border-t border-surface-container">
                <span className="font-mono text-label-caps text-on-surface-variant uppercase text-[10px]">Instant Settle</span>
                <span className="font-mono text-body-sm text-primary text-xs">T+0 Available</span>
              </div>
            </div>

            {/* Summary 02 */}
            <div className="p-space-lg rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors shadow-sm border border-outline-variant/30 flex flex-col justify-between min-h-[220px]">
              <div className="flex items-center justify-between mb-space-md">
                <div className="w-10 h-10 rounded-full bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed">
                  <span className="material-symbols-outlined text-[20px]">chart_data</span>
                </div>
                <span className="font-mono text-label-caps uppercase text-tertiary tracking-wider font-semibold text-xs">MTD Compounding</span>
              </div>
              <div>
                <span className="font-body text-body-sm text-on-surface-variant block mb-1">Yield Accrual</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-body-sm text-on-surface-variant">LKR</span>
                  <span className="font-headline text-headline-md text-on-surface">612.4K</span>
                </div>
              </div>
              <div className="mt-space-md flex items-center justify-between pt-space-sm border-t border-surface-container">
                <span className="font-mono text-label-caps text-on-surface-variant uppercase text-[10px]">Blended APY</span>
                <span className="font-mono text-body-sm text-on-surface text-xs">11.85%</span>
              </div>
            </div>

            {/* Summary 03 */}
            <div className="p-space-lg rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors shadow-sm border border-outline-variant/30 flex flex-col justify-between min-h-[220px]">
              <div className="flex items-center justify-between mb-space-md">
                <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface">
                  <span className="material-symbols-outlined text-[20px]">lock</span>
                </div>
                <span className="font-mono text-label-caps uppercase text-on-surface-variant tracking-wider text-xs">Maturity 2026</span>
              </div>
              <div>
                <span className="font-body text-body-sm text-on-surface-variant block mb-1">Fixed Sovereign Reserves</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-body-sm text-on-surface-variant">LKR</span>
                  <span className="font-headline text-headline-md text-on-surface">35.84M</span>
                </div>
              </div>
              <div className="mt-space-md flex items-center justify-between pt-space-sm border-t border-surface-container">
                <span className="font-mono text-label-caps text-on-surface-variant uppercase text-[10px]">Sovereign Treasury</span>
                <span className="font-mono text-body-sm text-on-surface-variant text-xs">AA- Rated</span>
              </div>
            </div>
          </div>

          {/* Recent Stewardship Activity Ledger Preview */}
          <div className="rounded-xl bg-surface-container-low p-space-md md:p-space-lg shadow-sm border border-outline-variant/30 mt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm mb-space-lg">
              <div>
                <span className="font-mono text-label-caps uppercase text-on-surface-variant tracking-wider">Attested Transactions</span>
                <h2 className="font-headline text-headline-sm text-on-surface mt-1">Recent Capital Flow</h2>
              </div>
              <Link href="/dashboard/transactions" className="inline-flex items-center gap-1 font-body text-body-sm text-primary hover:underline self-start sm:self-auto">
                <span>Explore Global Ledger</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </Link>
            </div>
            
            {/* Minimal List */}
            <div className="flex flex-col gap-space-sm">
              {/* Activity 1 */}
              <div className="flex items-center justify-between p-space-sm hover:bg-surface rounded-lg transition-colors border border-transparent hover:border-surface-container">
                <div className="flex items-center gap-space-md min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary-fixed-dim/40 flex items-center justify-center shrink-0 text-primary">
                    <span className="material-symbols-outlined text-[20px]">north_east</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-body text-body-md text-on-surface font-medium truncate">Ceylon sovereign bond tranche coupon</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-body-sm text-on-surface-variant text-xs">Today, 09:42</span>
                      <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-mono text-[10px] uppercase font-bold">Credited</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 pl-space-sm">
                  <span className="font-mono text-headline-sm text-primary block">+ LKR 248,000</span>
                  <span className="font-mono text-[10px] text-on-surface-variant uppercase">Settled</span>
                </div>
              </div>

              {/* Activity 2 */}
              <div className="flex items-center justify-between p-space-sm hover:bg-surface rounded-lg transition-colors border border-transparent hover:border-surface-container">
                <div className="flex items-center gap-space-md min-w-0">
                  <div className="w-10 h-10 rounded-full bg-secondary-fixed/40 flex items-center justify-center shrink-0 text-secondary">
                    <span className="material-symbols-outlined text-[20px]">sync_alt</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-body text-body-md text-on-surface font-medium truncate">Automated Liquidity Sweeper to Prime EUR</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-body-sm text-on-surface-variant text-xs">Yesterday, 16:15</span>
                      <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-mono text-[10px] uppercase font-bold">FX Desks</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 pl-space-sm">
                  <span className="font-mono text-headline-sm text-on-surface block">- LKR 1,500,000</span>
                  <span className="font-mono text-[10px] text-on-surface-variant uppercase">€ 4,280.12</span>
                </div>
              </div>

              {/* Activity 3 */}
              <div className="flex items-center justify-between p-space-sm hover:bg-surface rounded-lg transition-colors border border-transparent hover:border-surface-container">
                <div className="flex items-center gap-space-md min-w-0">
                  <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center shrink-0 text-on-surface">
                    <span className="material-symbols-outlined text-[20px]">credit_card</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-body text-body-md text-on-surface font-medium truncate">Centurion Black Concierge • London Clearing</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-body-sm text-on-surface-variant text-xs">May 21, 21:04</span>
                      <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-mono text-[10px] uppercase font-bold">Discreet</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 pl-space-sm">
                  <span className="font-mono text-headline-sm text-on-surface block">- LKR 84,200</span>
                  <span className="font-mono text-[10px] text-on-surface-variant uppercase">Authorized</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Yield Simulator Modal */}
      {simModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/30 backdrop-blur-md p-margin">
          <div className="bg-surface rounded-xl max-w-lg w-full p-space-lg shadow-xl relative animate-fade-up">
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container">
              <span className="font-headline text-headline-sm text-on-surface">Yield Simulator</span>
              <button onClick={() => setSimModalOpen(false)} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <p className="font-body text-body-md text-on-surface-variant mt-4">
              Project horizon compound earnings across multi-asset custody envelopes.
            </p>
            
            <div className="mt-space-md flex flex-col gap-space-sm">
              <label className="font-mono text-label-caps uppercase text-on-surface-variant">Principal Capital (LKR)</label>
              <div className="bg-surface-container-low rounded-xl px-4 py-3 flex items-center justify-between border border-outline-variant/30 focus-within:border-primary/50 transition-colors">
                <span className="font-mono text-body-md text-on-surface-variant">LKR</span>
                <input 
                  type="number" 
                  step="500000" 
                  value={simPrincipal}
                  onChange={(e) => setSimPrincipal(Number(e.target.value))}
                  className="bg-transparent text-right font-headline text-headline-sm text-on-surface focus:outline-none w-full ml-2" 
                />
              </div>
              
              <div className="flex items-center justify-between text-body-sm text-on-surface-variant font-mono pt-2">
                <span>Projected 12M Return (+12.4%):</span>
                <span className="text-primary font-bold">LKR {projectedYield.toLocaleString()}</span>
              </div>
            </div>
            
            <div className="mt-space-lg flex justify-end gap-space-sm">
              <button onClick={() => setSimModalOpen(false)} className="px-5 py-2.5 rounded-lg bg-primary text-on-primary font-body text-body-sm hover:bg-primary-container transition-colors shadow-sm">
                Commit Allocation Scenario
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
