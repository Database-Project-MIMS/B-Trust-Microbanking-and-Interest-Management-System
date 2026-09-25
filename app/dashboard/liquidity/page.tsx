"use client"

import * as React from "react"
import Link from "next/link"

const paths = {
  '1M': {
    inflow: "M 0 340 C 200 300, 400 240, 600 220 C 750 200, 880 130, 1000 110 L 1000 400 L 0 400 Z",
    inflowLine: "M 0 340 C 200 300, 400 240, 600 220 C 750 200, 880 130, 1000 110",
    outflow: "M 0 370 C 220 330, 450 300, 650 280 C 800 270, 920 250, 1000 230 L 1000 400 L 0 400 Z",
    outflowLine: "M 0 370 C 220 330, 450 300, 650 280 C 800 270, 920 250, 1000 230",
    peak: "LKR 14.80M",
    settle: "LKR 1.20s",
    surplus: "3.10x"
  },
  '3M': {
    inflow: "M 0 360 C 180 260, 360 190, 520 200 C 690 210, 840 110, 1000 90 L 1000 400 L 0 400 Z",
    inflowLine: "M 0 360 C 180 260, 360 190, 520 200 C 690 210, 840 110, 1000 90",
    outflow: "M 0 380 C 210 320, 420 270, 580 260 C 750 250, 880 240, 1000 210 L 1000 400 L 0 400 Z",
    outflowLine: "M 0 380 C 210 320, 420 270, 580 260 C 750 250, 880 240, 1000 210",
    peak: "LKR 32.40M",
    settle: "LKR 1.54s",
    surplus: "2.84x"
  },
  '6M': {
    inflow: "M 0 380 C 150 280, 240 120, 420 140 C 580 160, 720 70, 850 60 C 930 55, 980 90, 1000 110 L 1000 400 L 0 400 Z",
    inflowLine: "M 0 380 C 150 280, 240 120, 420 140 C 580 160, 720 70, 850 60 C 930 55, 980 90, 1000 110",
    outflow: "M 0 390 C 180 340, 310 260, 480 270 C 650 280, 780 220, 890 240 C 940 250, 980 290, 1000 310 L 1000 400 L 0 400 Z",
    outflowLine: "M 0 390 C 180 340, 310 260, 480 270 C 650 280, 780 220, 890 240 C 940 250, 980 290, 1000 310",
    peak: "LKR 51.20M",
    settle: "LKR 1.84s",
    surplus: "2.57x"
  },
  '1Y': {
    inflow: "M 0 320 C 120 200, 200 280, 380 220 C 500 180, 650 240, 800 150 C 880 100, 940 60, 1000 50 L 1000 400 L 0 400 Z",
    inflowLine: "M 0 320 C 120 200, 200 280, 380 220 C 500 180, 650 240, 800 150 C 880 100, 940 60, 1000 50",
    outflow: "M 0 350 C 140 260, 260 300, 420 260 C 550 230, 680 280, 820 210 C 880 180, 940 140, 1000 120 L 1000 400 L 0 400 Z",
    outflowLine: "M 0 350 C 140 260, 260 300, 420 260 C 550 230, 680 280, 820 210 C 880 180, 940 140, 1000 120",
    peak: "LKR 94.80M",
    settle: "LKR 2.40s",
    surplus: "1.95x"
  }
}

export default function LiquidityPage() {
  const [range, setRange] = React.useState<'1M'|'3M'|'6M'|'1Y'>('6M')
  const activePaths = paths[range]

  return (
    <div className="flex flex-col w-full max-w-[1360px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop py-space-xl gap-space-xl relative">
      <div className="absolute top-10 right-0 w-[540px] h-[540px] rounded-full bg-surface-container-high/40 blur-[130px] pointer-events-none -z-10" />
      <div className="absolute top-1/2 left-1/4 w-[420px] h-[420px] rounded-full bg-primary-fixed/20 blur-[110px] pointer-events-none -z-10" />
      
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-gutter pt-space-md">
        <div className="flex flex-col gap-space-xs max-w-2xl">
          <div className="flex items-center gap-space-xs text-on-surface-variant font-mono text-[10px] uppercase tracking-widest font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span>Capital Orchestration • Series 02</span>
          </div>
          <h1 className="font-headline text-[3rem] text-on-surface tracking-tight leading-none">
            Treasury Velocity & Fluidity
          </h1>
          <p className="font-body text-md text-on-surface-variant max-w-lg mt-space-xs leading-relaxed">
            A living topography of sovereign capital equilibrium. Cash flows rendered as harmonic tides rather than rigid ledger rows.
          </p>
        </div>
        
        <div className="flex items-center self-start md:self-end bg-surface-container-low p-1 rounded-full shadow-sm border border-outline-variant/10">
          {(['1M', '3M', '6M', '1Y'] as const).map(r => (
            <button 
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-1.5 rounded-full font-mono text-[10px] uppercase transition-all duration-300 ${range === r ? 'bg-primary-container text-on-primary font-bold shadow-sm' : 'text-on-surface-variant hover:text-on-surface font-semibold'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </section>
      
      <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <div className="bg-surface-container-low/70 backdrop-blur-md rounded-xl p-space-lg flex flex-col justify-between transition-all duration-500 hover:bg-surface-container-low shadow-sm border border-outline-variant/10 group">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider font-bold">Apex Liquidity</span>
            <span className="material-symbols-outlined text-primary text-[20px] transition-transform duration-300 group-hover:translate-y-[-2px]">north_east</span>
          </div>
          <div className="mt-space-lg">
            <div className="font-headline text-[2rem] text-on-surface tracking-tight">{activePaths.peak}</div>
            <div className="flex items-center gap-space-xs mt-space-xs">
              <span className="font-mono text-[10px] uppercase font-bold text-primary bg-primary-fixed/60 px-2 py-0.5 rounded-full">+14.8%</span>
              <span className="font-body text-sm text-on-surface-variant">vs trailing period</span>
            </div>
          </div>
        </div>
        
        <div className="bg-surface-container-low/70 backdrop-blur-md rounded-xl p-space-lg flex flex-col justify-between transition-all duration-500 hover:bg-surface-container-low shadow-sm border border-outline-variant/10 group">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider font-bold">Settlement Latency</span>
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">timelapse</span>
          </div>
          <div className="mt-space-lg">
            <div className="font-headline text-[2rem] text-on-surface tracking-tight">{activePaths.settle}</div>
            <div className="flex items-center gap-space-xs mt-space-xs">
              <span className="font-mono text-[10px] uppercase font-bold text-primary bg-primary-fixed/60 px-2 py-0.5 rounded-full">Real-time</span>
              <span className="font-body text-sm text-on-surface-variant">RTGS / SLIPS corridor</span>
            </div>
          </div>
        </div>
        
        <div className="bg-surface-container-low/70 backdrop-blur-md rounded-xl p-space-lg flex flex-col justify-between transition-all duration-500 hover:bg-surface-container-low shadow-sm border border-outline-variant/10 group">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider font-bold">Surplus Ratio</span>
            <span className="material-symbols-outlined text-secondary text-[20px]">toll</span>
          </div>
          <div className="mt-space-lg">
            <div className="font-headline text-[2rem] text-on-surface tracking-tight">{activePaths.surplus}</div>
            <div className="flex items-center gap-space-xs mt-space-xs">
              <span className="font-mono text-[10px] uppercase font-bold text-on-secondary-container bg-secondary-fixed px-2 py-0.5 rounded-full">Solvent</span>
              <span className="font-body text-sm text-on-surface-variant">buffer over liabilities</span>
            </div>
          </div>
        </div>
      </section>
      
      <section className="bg-surface-container-low/50 backdrop-blur-lg rounded-xl p-space-md md:p-space-lg shadow-2xl flex flex-col gap-space-md relative overflow-hidden border border-outline-variant/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm z-10">
          <div className="flex items-center gap-space-sm">
            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface font-bold">Spatial Cashflow Continuum</span>
            <span className="text-outline-variant font-mono text-sm">•</span>
            <span className="font-mono text-[10px] uppercase text-on-surface-variant font-bold">B-Trust Harmonic Projection</span>
          </div>
          <div className="flex items-center gap-space-md">
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 rounded-full bg-primary" />
              <span className="font-mono text-[10px] uppercase text-on-surface-variant font-bold">Aggregated Inflows</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 rounded-full bg-secondary" />
              <span className="font-mono text-[10px] uppercase text-on-surface-variant font-bold">Allocated Outflows</span>
            </div>
          </div>
        </div>
        
        <div className="relative w-full h-[360px] md:h-[440px] flex items-center justify-center overflow-hidden select-none">
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 1000 420">
            <defs>
              <linearGradient id="inflow-grad" x1="0%" x2="0%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="#2e5c50" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#2e5c50" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="outflow-grad" x1="0%" x2="0%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="#fe8b6d" stopOpacity="0.20" />
                <stop offset="100%" stopColor="#fe8b6d" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="curve-stroke-in" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="#144439" />
                <stop offset="50%" stopColor="#2e5c50" />
                <stop offset="100%" stopColor="#a0d0c1" />
              </linearGradient>
              <linearGradient id="curve-stroke-out" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="#9e4229" />
                <stop offset="50%" stopColor="#fe8b6d" />
                <stop offset="100%" stopColor="#ffb4a1" />
              </linearGradient>
            </defs>
            <g className="text-surface-container-highest/60 stroke-current stroke-1" strokeDasharray="4 8">
              <line x1="0" x2="1000" y1="80" y2="80" />
              <line x1="0" x2="1000" y1="180" y2="180" />
              <line x1="0" x2="1000" y1="280" y2="280" />
              <line x1="0" x2="1000" y1="380" y2="380" />
            </g>
            <path className="transition-all duration-700 ease-out" d={activePaths.inflow} fill="url(#inflow-grad)" />
            <path className="transition-all duration-700 ease-out" d={activePaths.outflow} fill="url(#outflow-grad)" />
            <path className="transition-all duration-700 ease-out" d={activePaths.outflowLine} fill="none" stroke="url(#curve-stroke-out)" strokeWidth="2.5" />
            <path className="transition-all duration-700 ease-out" d={activePaths.inflowLine} fill="none" stroke="url(#curve-stroke-in)" strokeWidth="3" />
            
            <g className="cursor-pointer">
              <circle className="fill-surface" cx="850" cy="60" r="7" stroke="#144439" strokeWidth="3" />
              <circle className="fill-primary/10 animate-ping" cx="850" cy="60" r="14" />
              <line opacity="0.4" stroke="#144439" strokeDasharray="2 4" strokeWidth="1" x1="850" x2="850" y1="60" y2="390" />
            </g>
            <g className="cursor-pointer">
              <circle className="fill-surface" cx="480" cy="270" r="5" stroke="#9e4229" strokeWidth="2.5" />
            </g>
          </svg>
          
          <div className="absolute top-12 right-24 pointer-events-none bg-surface/95 backdrop-blur-md rounded-xl p-space-sm shadow-xl flex flex-col gap-1 z-20 border border-outline-variant/20">
            <span className="font-mono text-[10px] uppercase text-on-surface-variant font-bold">May 18 • Apex Influx</span>
            <span className="font-headline text-xl text-primary leading-tight">LKR +18.40M</span>
            <span className="font-body text-sm text-on-surface-variant">Sovereign Debt Repurchase</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between text-on-surface-variant font-mono text-sm px-2 pt-space-xs font-semibold">
          <span>NOV</span>
          <span>DEC</span>
          <span>JAN</span>
          <span>FEB</span>
          <span>MAR</span>
          <span className="text-primary font-bold">APR (PRESENT)</span>
        </div>
      </section>
      
      <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <div className="bg-surface-container-low/70 rounded-xl p-space-lg flex flex-col justify-between shadow-sm border border-outline-variant/10">
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider font-bold">Source: Tea & Rubber Export Yields</span>
              <span className="font-mono text-[10px] uppercase text-primary bg-primary-fixed/50 px-2 py-0.5 rounded-full font-bold">Primary</span>
            </div>
            <div className="mt-space-md">
              <div className="font-headline text-xl text-on-surface">LKR 28.45M</div>
              <p className="font-body text-sm text-on-surface-variant mt-1">
                Automated clearance via Colombo Port Terminal Escrow.
              </p>
            </div>
          </div>
          <div className="mt-space-lg flex flex-col gap-2">
            <div className="flex justify-between font-mono text-sm text-on-surface-variant font-medium">
              <span>Target Velocity</span>
              <span className="text-on-surface font-semibold">88%</span>
            </div>
            <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{width: '88%'}} />
            </div>
          </div>
        </div>
        
        <div className="bg-surface-container-low/70 rounded-xl p-space-lg flex flex-col justify-between shadow-sm border border-outline-variant/10">
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider font-bold">Statutory IRD Remittance</span>
              <span className="font-mono text-[10px] uppercase text-secondary bg-secondary-fixed/60 px-2 py-0.5 rounded-full font-bold">Withholding</span>
            </div>
            <div className="mt-space-md">
              <div className="font-headline text-xl text-on-surface">LKR 4.12M</div>
              <p className="font-body text-sm text-on-surface-variant mt-1">
                Inland Revenue Dept auto-provisioned reserve vault.
              </p>
            </div>
          </div>
          <div className="mt-space-lg flex flex-col gap-2">
            <div className="flex justify-between font-mono text-sm text-on-surface-variant font-medium">
              <span>Quarterly Quota</span>
              <span className="text-on-surface font-semibold">62%</span>
            </div>
            <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-secondary rounded-full" style={{width: '62%'}} />
            </div>
          </div>
        </div>
        
        <div className="bg-surface-container-low/70 rounded-xl p-space-lg flex flex-col justify-between shadow-sm border border-outline-variant/10">
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider font-bold">Treasury Bill Reinvestments</span>
              <span className="font-mono text-[10px] uppercase text-tertiary bg-tertiary-fixed/70 px-2 py-0.5 rounded-full font-bold">CBSL 91-Day</span>
            </div>
            <div className="mt-space-md">
              <div className="font-headline text-xl text-on-surface">LKR 18.63M</div>
              <p className="font-body text-sm text-on-surface-variant mt-1">
                Rollover yielding 10.42% APY secured custody.
              </p>
            </div>
          </div>
          <div className="mt-space-lg flex flex-col gap-2">
            <div className="flex justify-between font-mono text-sm text-on-surface-variant font-medium">
              <span>Allocation Cap</span>
              <span className="text-on-surface font-semibold">94%</span>
            </div>
            <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-tertiary rounded-full" style={{width: '94%'}} />
            </div>
          </div>
        </div>
      </section>
      
      <section className="mt-space-sm bg-surface-container-lowest/80 rounded-xl p-space-lg flex flex-col md:flex-row items-center justify-between gap-gutter shadow-sm border border-outline-variant/10">
        <div className="flex items-center gap-space-md">
          <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[24px]">account_balance</span>
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase text-on-surface-variant font-bold">Statutory Custody Reserve</span>
            <span className="font-headline text-xl text-on-surface">LKR 120.00M Unencumbered Liquidity Floor</span>
          </div>
        </div>
        <div className="flex items-center gap-space-sm shrink-0">
          <span className="font-mono text-[10px] uppercase text-on-surface-variant font-bold">Central Bank Monitored</span>
          <button className="px-5 py-2 rounded-full bg-primary text-on-primary font-body text-sm hover:bg-primary-container transition-all shadow-sm font-semibold">
            Export Sovereign Audit
          </button>
        </div>
      </section>
      
    </div>
  )
}
