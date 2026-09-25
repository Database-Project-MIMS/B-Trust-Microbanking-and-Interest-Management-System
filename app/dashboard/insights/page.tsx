"use client"

import * as React from "react"
import Link from "next/link"

export default function InsightsPage() {
  const [forecastMode, setForecastMode] = React.useState<'annual' | 'triennial'>('annual')
  
  const [milestone, setMilestone] = React.useState({
    title: 'Target Milestone Realization',
    val: 'LKR 418.9M',
    sub: '+18.4% YoY'
  })

  const [toastMessage, setToastMessage] = React.useState<{title: string, sub: string} | null>(null)
  
  const [generatingCustom, setGeneratingCustom] = React.useState(false)

  const handleInspectMilestone = (title: string, val: string, sub: string) => {
    setMilestone({ title, val, sub })
  }

  const triggerToast = (title: string, sub: string) => {
    setToastMessage({ title, sub })
    setTimeout(() => setToastMessage(null), 3200)
  }

  const simulatePdfExport = (month: string) => {
    triggerToast('Audited Statement Ready', `${month} Comprehensive Ledger exported.`)
  }

  const generateCustomAuditPdf = () => {
    setGeneratingCustom(true)
    setTimeout(() => {
      setGeneratingCustom(false)
      triggerToast('Solvency Dossier Exported', 'Live snapshot cryptographically sealed & sent to vault.')
    }, 1000)
  }

  return (
    <div className="flex flex-col w-full relative">
      <div className="py-space-xl flex flex-col gap-space-xl relative">
        
        {/* Header Stage */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-gutter">
          <div className="flex flex-col gap-space-xs max-w-2xl">
            <div className="flex items-center gap-space-xs">
              <span className="font-mono text-label-caps uppercase text-primary tracking-widest">Actuarial Intelligence • Tier 1 Ledger</span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-dot" />
            </div>
            <h1 className="font-headline text-[3rem] text-on-surface tracking-tight mt-1">Spatial Insights & Yield Trajectories</h1>
            <p className="font-body text-body-lg text-on-surface-variant">Calibrated capital projections, sovereign risk telemetry, and deterministic wealth horizons computed continuously via central bank settlement APIs.</p>
          </div>
          <div className="flex items-center gap-space-sm self-start md:self-auto shrink-0 mt-4 md:mt-0">
            <div className="flex items-center bg-surface-container-low p-1 rounded-full border border-outline-variant/20">
              <button 
                onClick={() => setForecastMode('annual')}
                className={`px-4 py-1.5 rounded-full font-mono text-xs uppercase transition-all shadow-sm ${forecastMode === 'annual' ? 'bg-surface text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface bg-transparent'}`}
              >
                12M Projection
              </button>
              <button 
                onClick={() => setForecastMode('triennial')}
                className={`px-4 py-1.5 rounded-full font-mono text-xs uppercase transition-all shadow-sm ${forecastMode === 'triennial' ? 'bg-surface text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface bg-transparent'}`}
              >
                36M Horizon
              </button>
            </div>
          </div>
        </div>

        {/* Core Telemetry Stat Band (Porcelain Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          <div className="p-space-lg rounded-xl bg-surface-container-low flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:shadow-md border border-outline-variant/30">
            <div className="flex items-start justify-between">
              <span className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider">Capital Efficiency</span>
              <span className="material-symbols-outlined text-primary text-xl">auto_graph</span>
            </div>
            <div className="my-space-md flex flex-col relative z-10">
              <div className="flex items-baseline gap-space-xs">
                <span className="font-headline text-[2.5rem] text-primary tracking-tight">94.2%</span>
                <span className="font-mono text-[10px] text-primary uppercase bg-tertiary-fixed px-2 py-0.5 rounded-full">+2.8% opt</span>
              </div>
              <p className="font-body text-sm text-on-surface-variant mt-2">Unutilized overnight reserves deployed to short-tenor Colombo & Euro repo lines.</p>
            </div>
            <div className="w-full bg-surface-container-high h-1 rounded-full overflow-hidden mt-auto">
              <div className="bg-primary h-full w-[94.2%] transition-all duration-1000" />
            </div>
          </div>
          
          <div className="p-space-lg rounded-xl bg-surface-container-low flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:shadow-md border border-outline-variant/30">
            <div className="flex items-start justify-between">
              <span className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider">Sovereign Exposure</span>
              <span className="material-symbols-outlined text-primary text-xl">security</span>
            </div>
            <div className="my-space-md flex flex-col relative z-10">
              <div className="flex items-baseline gap-space-xs">
                <span className="font-headline text-[2.5rem] text-on-surface tracking-tight">Low Risk</span>
                <span className="font-mono text-[10px] text-primary uppercase bg-primary-fixed px-2 py-0.5 rounded-full">AAA Tier</span>
              </div>
              <p className="font-body text-sm text-on-surface-variant mt-2">0% unhedged emerging bonds. 82% multilateral & supra-national indexed securities.</p>
            </div>
            <div className="flex items-center gap-1.5 mt-auto">
              <div className="h-1 flex-1 bg-primary rounded-full" />
              <div className="h-1 flex-1 bg-primary rounded-full" />
              <div className="h-1 flex-1 bg-primary rounded-full" />
              <div className="h-1 flex-1 bg-surface-container-high rounded-full" />
            </div>
          </div>

          <div className="p-space-lg rounded-xl bg-surface-container-low flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:shadow-md border border-outline-variant/30">
            <div className="flex items-start justify-between">
              <span className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider">Reserve Cushion</span>
              <span className="material-symbols-outlined text-primary text-xl">shield_locked</span>
            </div>
            <div className="my-space-md flex flex-col relative z-10">
              <div className="flex items-baseline gap-space-xs">
                <span className="font-headline text-[2.5rem] text-primary tracking-tight">3.8x</span>
                <span className="font-mono text-[10px] text-on-surface-variant uppercase">Basel III Ref</span>
              </div>
              <p className="font-body text-sm text-on-surface-variant mt-2">Statutory liquidity buffer held in dedicated segregated central depository accounts.</p>
            </div>
            <div className="flex items-center justify-between text-on-surface-variant mt-auto">
              <span className="font-mono text-xs">Min: 1.0x</span>
              <span className="font-mono text-xs text-primary font-bold">Actual: 3.84x</span>
            </div>
          </div>
        </div>

        {/* Editorial Interactive Yield Trajectory Canvas */}
        <div className="p-space-lg md:p-space-xl rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-space-lg relative overflow-hidden border border-outline-variant/30">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary-fixed/30 blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-gutter relative z-10">
            <div className="flex flex-col">
              <span className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider">Dynamic Valuation Curve</span>
              <div className="flex items-baseline gap-space-sm mt-1">
                <h2 className="font-headline text-[3rem] md:text-[3.5rem] text-primary leading-none">
                  {forecastMode === 'annual' ? 'LKR 418.9M' : 'LKR 612.4M'}
                </h2>
                <div className="flex items-center gap-1 text-primary">
                  <span className="material-symbols-outlined text-base">north_east</span>
                  <span className="font-mono text-sm font-bold">+18.4% YoY</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-space-sm mt-4 md:mt-0">
              <div className="flex items-center gap-space-xs bg-surface-container-low px-3 py-1.5 rounded-full border border-outline-variant/20">
                <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                <span className="font-mono text-[10px] uppercase text-on-surface font-bold">Optimized Model</span>
              </div>
              <div className="flex items-center gap-space-xs bg-surface-container-low px-3 py-1.5 rounded-full border border-outline-variant/20">
                <span className="w-2.5 h-2.5 rounded-full bg-outline-variant" />
                <span className="font-mono text-[10px] uppercase text-on-surface-variant">Conservative Baseline</span>
              </div>
              <div className="flex items-center gap-space-xs bg-surface-container-low px-3 py-1.5 rounded-full border border-outline-variant/20">
                <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
                <span className="font-mono text-[10px] uppercase text-secondary font-bold">Inflation Benchmark</span>
              </div>
            </div>
          </div>

          <div className="w-full relative z-10 pt-space-md">
            <div className="w-full h-72 md:h-96 relative">
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 1000 360">
                <defs>
                  <linearGradient id="curveFill" x1="0%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="var(--primary-container)" stopOpacity="0.16" />
                    <stop offset="100%" stopColor="var(--primary-container)" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="strokeGradient" x1="0%" x2="100%" y1="0%" y2="0%">
                    <stop offset="0%" stopColor="var(--primary-container)" />
                    <stop offset="70%" stopColor="var(--primary)" />
                    <stop offset="100%" stopColor="var(--inverse-primary)" />
                  </linearGradient>
                </defs>
                
                <line stroke="currentColor" className="text-outline-variant/25" strokeDasharray="4 6" x1="0" x2="1000" y1="90" y2="90" />
                <line stroke="currentColor" className="text-outline-variant/25" strokeDasharray="4 6" x1="0" x2="1000" y1="180" y2="180" />
                <line stroke="currentColor" className="text-outline-variant/25" strokeDasharray="4 6" x1="0" x2="1000" y1="270" y2="270" />
                
                <path d="M 0 310 C 200 290, 450 260, 700 230 C 850 210, 950 195, 1000 185" fill="none" stroke="currentColor" className="text-outline-variant/40" strokeDasharray="6 6" strokeWidth="1.75" />
                <path d="M 0 330 C 250 315, 500 295, 750 270 C 900 255, 960 245, 1000 238" fill="none" stroke="currentColor" className="text-secondary/60" strokeDasharray="3 3" strokeWidth="1.25" />
                
                <path 
                  d={forecastMode === 'annual' ? "M 0 300 C 180 275, 340 230, 520 170 C 680 120, 840 70, 1000 35 L 1000 360 L 0 360 Z" : "M 0 310 C 220 280, 420 200, 600 130 C 760 70, 880 30, 1000 15 L 1000 360 L 0 360 Z"} 
                  fill="url(#curveFill)" 
                  className="transition-all duration-700 ease-out"
                />
                
                <path 
                  d={forecastMode === 'annual' ? "M 0 300 C 180 275, 340 230, 520 170 C 680 120, 840 70, 1000 35" : "M 0 310 C 220 280, 420 200, 600 130 C 760 70, 880 30, 1000 15"} 
                  fill="none" 
                  stroke="url(#strokeGradient)" 
                  strokeLinecap="round" 
                  strokeWidth="3" 
                  className="transition-all duration-700 ease-out"
                />
                
                {/* Milestones */}
                <g 
                  className="transition-transform duration-300 hover:scale-110 cursor-pointer" 
                  onClick={() => handleInspectMilestone('Q1: Sri Lanka T-Bill Repositioning', 'LKR 362.4M', '+4.2% annualized')}
                  style={{ transformOrigin: '280px 245px' }}
                >
                  <circle cx="280" cy="245" fill="var(--surface)" r="5" stroke="var(--primary)" strokeWidth="3" />
                  <circle cx="280" cy="245" fill="var(--primary)" fillOpacity="0.08" r="14" />
                </g>
                <g 
                  className="transition-transform duration-300 hover:scale-110 cursor-pointer" 
                  onClick={() => handleInspectMilestone('Q3: Sovereign Bond Rollover', 'LKR 389.1M', 'Reinvested at 11.4% Fixed')}
                  style={{ transformOrigin: '580px 150px' }}
                >
                  <circle cx="580" cy="150" fill="var(--primary)" r="6" />
                  <circle cx="580" cy="150" fill="var(--primary)" fillOpacity="0.12" r="16" />
                </g>
                <g 
                  className="transition-transform duration-300 hover:scale-110 cursor-pointer" 
                  onClick={() => handleInspectMilestone('Target Realization: Peak Harvest', 'LKR 418.9M', '+18.4% Outperformance vs CBSL')}
                  style={{ transformOrigin: '940px 50px' }}
                >
                  <circle cx="940" cy="50" fill="var(--secondary-container)" r="7" />
                  <circle cx="940" cy="50" fill="var(--secondary-container)" fillOpacity="0.25" r="18" className="animate-ping" />
                </g>
              </svg>

              {/* Floating Bubble Callout */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-[58%] md:top-12 bg-surface p-space-sm px-space-md rounded-lg shadow-xl border border-outline-variant/20 flex items-center gap-space-sm pointer-events-auto">
                <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] uppercase text-on-surface">{milestone.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-headline text-lg text-primary">{milestone.val}</span>
                    <span className="font-mono text-[10px] text-on-surface-variant font-bold">{milestone.sub}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-space-md font-mono text-[10px] text-on-surface-variant uppercase">
              <span>Current Base (Jan)</span>
              <span>Apr • Sovereign Audit</span>
              <span>Jul • Dividend Sweep</span>
              <span>Oct • Yield Convexity</span>
              <span className="text-primary font-bold">Dec • Target Harvest</span>
            </div>
          </div>
        </div>

        {/* Editorial Split: Visual Allocation & Sovereign Report Vault */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mt-4">
          
          {/* Allocation Matrix (7 cols) */}
          <div className="lg:col-span-7 p-space-lg rounded-xl bg-surface-container-low flex flex-col justify-between gap-space-lg border border-outline-variant/30">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase text-on-surface-variant">Asset Topology</span>
                <h3 className="font-headline text-2xl text-on-surface mt-1">Capital Allocation Matrix</h3>
              </div>
              <span className="font-mono text-xs text-primary bg-surface px-3 py-1 rounded-full shadow-sm font-bold">100.0% Deployed</span>
            </div>

            <div className="flex flex-col gap-space-md">
              {[
                { title: 'Treasury & Sovereign Repurchase', desc: 'CBSL Liquidity Framework • Fixed 11.25%', val: 'LKR 217.8M', pct: '52.0%', numPct: 52, color: 'bg-primary' },
                { title: 'Synthetics & Indexed FX Swaps', desc: 'USD/LKR Multi-Hedging • Target Carry 6.4%', val: 'LKR 117.3M', pct: '28.0%', numPct: 28, color: 'bg-primary-container' },
                { title: 'Private Equity • Agricultural Yield Trusts', desc: 'Organic Export Plantation Deeds • ESG Prime', val: 'LKR 54.4M', pct: '13.0%', numPct: 13, color: 'bg-secondary' },
                { title: 'Instant Central Liquidity • Demand Wells', desc: 'Continuous automated clearing • 0 sec settlement', val: 'LKR 29.4M', pct: '7.0%', numPct: 7, color: 'bg-tertiary' }
              ].map((a, i) => (
                <div key={i} className="p-space-sm rounded-lg bg-surface flex flex-col gap-space-xs transition-transform hover:-translate-y-0.5 border border-outline-variant/10 hover:shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-space-sm">
                      <span className={`w-3 h-3 rounded-full ${a.color} shrink-0`} />
                      <div className="flex flex-col">
                        <span className="font-headline text-lg font-semibold text-on-surface">{a.title}</span>
                        <span className="font-body text-xs text-on-surface-variant">{a.desc}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`font-headline text-lg font-semibold ${a.color.replace('bg-', 'text-')}`}>{a.val}</span>
                      <span className="block font-mono text-[10px] text-on-surface-variant uppercase">{a.pct}</span>
                    </div>
                  </div>
                  <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden mt-1">
                    <div className={`${a.color} h-full transition-all duration-1000`} style={{ width: a.pct }} />
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex items-center justify-between pt-space-xs text-on-surface-variant">
              <span className="font-mono text-[10px] uppercase">Quarterly Rebalancing Interval: 14 Days Remaining</span>
              <span className="font-mono text-[10px] uppercase text-primary hover:underline cursor-pointer flex items-center gap-1 font-bold">
                Simulation Modeler <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </span>
            </div>
          </div>

          {/* Audited Monthly Reports (5 cols) */}
          <div className="lg:col-span-5 p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between gap-space-lg border border-outline-variant/30">
            <div className="flex flex-col gap-space-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase text-on-surface-variant">Custody Documentation</span>
                <span className="material-symbols-outlined text-primary">verified_user</span>
              </div>
              <h3 className="font-headline text-2xl text-on-surface mt-1">Audited Statements</h3>
              <p className="font-body text-sm text-on-surface-variant mt-1">Tamper-proof cryptographically signed attestation statements certified by independent statutory auditors.</p>
            </div>

            <div className="flex flex-col gap-space-sm">
              {['October 2025', 'September 2025', 'August 2025'].map((m, i) => (
                <div key={i} className="p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container transition-all flex items-center justify-between group border border-outline-variant/10">
                  <div className="flex items-center gap-space-sm">
                    <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
                      <span className="material-symbols-outlined text-xl">description</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-headline text-lg font-semibold text-on-surface">{m} Comprehensive</span>
                      <span className="font-mono text-[10px] uppercase text-on-surface-variant">SHA-256 • Verified • {(Math.random() * 2 + 3).toFixed(1)} MB</span>
                    </div>
                  </div>
                  <button onClick={() => simulatePdfExport(m)} className="p-2 rounded-full hover:bg-surface text-primary transition-all flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">download</span>
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-space-xs">
              <button 
                onClick={generateCustomAuditPdf}
                className="w-full py-4 px-6 rounded-xl bg-primary text-on-primary font-body text-sm font-medium hover:bg-primary-container transition-all flex items-center justify-center gap-space-xs shadow-sm active:scale-[0.985]"
              >
                {generatingCustom ? (
                  <>
                    <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                    <span>Compiling SHA-256 Ledger...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                    <span>Generate Real-Time Solvency Dossier</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>

      {toastMessage && (
        <div className="fixed bottom-8 right-8 bg-inverse-surface text-inverse-on-surface px-space-md py-space-sm rounded-xl shadow-2xl flex items-center gap-space-sm z-50 transition-all duration-300">
          <span className="material-symbols-outlined text-inverse-primary text-[28px]">check_circle</span>
          <div className="flex flex-col">
            <span className="font-body text-sm font-bold">{toastMessage.title}</span>
            <span className="font-mono text-xs opacity-80 mt-1">{toastMessage.sub}</span>
          </div>
        </div>
      )}
    </div>
  )
}
