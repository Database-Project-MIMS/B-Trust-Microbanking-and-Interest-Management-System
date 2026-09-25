"use client"

import * as React from "react"
import Link from "next/link"

export default function CardsPage() {
  const [cvvTitanium, setCvvTitanium] = React.useState('•••')
  const [cvvEmerald, setCvvEmerald] = React.useState('•••')
  const [toggles, setToggles] = React.useState({
    freeze: false,
    international: true,
    atm: true,
    contactless: true
  })
  
  const [toastMessage, setToastMessage] = React.useState<null | {title: string, message: string}>(null)

  const toggleCVVTitanium = () => {
    if (cvvTitanium === '•••') {
      setCvvTitanium('884')
      setTimeout(() => setCvvTitanium('•••'), 3500)
    } else {
      setCvvTitanium('•••')
    }
  }

  const toggleCVVEmerald = () => {
    if (cvvEmerald === '•••') {
      setCvvEmerald('412')
      setTimeout(() => setCvvEmerald('•••'), 3500)
    } else {
      setCvvEmerald('•••')
    }
  }

  const triggerToast = (title: string, message: string) => {
    setToastMessage({ title, message })
    setTimeout(() => setToastMessage(null), 4000)
  }

  return (
    <div className="flex flex-col w-full relative">
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-primary-fixed/20 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/2 right-1/4 w-80 h-80 bg-secondary-fixed/25 rounded-full blur-3xl pointer-events-none -z-10" />
      
      <div className="py-space-lg relative z-10 flex flex-col gap-space-lg">
        
        {/* Editorial Header Stage */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-gutter pb-space-lg border-b border-surface-container/50">
          <div className="max-w-2xl flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-xs">
              <span className="font-mono text-label-caps uppercase text-primary tracking-widest">Section 06 // Custody Vectors</span>
              <span className="text-outline-variant">•</span>
              <span className="font-mono text-label-caps uppercase text-on-surface-variant">L1 & L2 Bearer Tokens</span>
            </div>
            <h1 className="font-headline text-[3rem] text-on-surface leading-none tracking-tight mt-2">
              Architectural Cards & Digital Vault Keys
            </h1>
            <p className="font-body text-body-lg text-on-surface-variant mt-space-xs">
              Physical monolithic weight paired with ephemeral cryptographic access. Designed for spatial capital mobilization and seamless global settlement.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-space-sm mt-4 md:mt-0">
            <button 
              onClick={() => triggerToast('Ephemeral Vault Key Issued', 'Key 7091 activated with 24-hour liquidity authorization.')}
              className="flex items-center gap-space-sm px-6 py-3.5 rounded-xl bg-primary text-on-primary font-headline text-lg hover:bg-primary-container active:scale-[0.985] transition-all shadow-md"
            >
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
              <span>Issue New Virtual Key</span>
            </button>
          </div>
        </div>

        {/* Spatial 3D Card Showcase & Bento Canvas Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
          
          {/* Left Column */}
          <div className="lg:col-span-7 flex flex-col gap-space-lg">
            
            {/* Infinite Black Titanium */}
            <div className="relative group p-space-lg rounded-xl bg-inverse-surface text-inverse-on-surface overflow-hidden shadow-xl transition-all duration-500 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-tr from-black via-inverse-surface to-[#3c3e44] opacity-90 pointer-events-none" />
              <div className="absolute -right-16 -top-16 w-64 h-64 bg-surface-tint/10 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10 flex flex-col justify-between h-[320px]">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col">
                    <span className="font-mono text-label-caps uppercase tracking-widest text-inverse-primary">B-Trust Infinite</span>
                    <span className="font-headline text-xl text-on-primary font-normal mt-1">Black Titanium • Bespoke Tier</span>
                  </div>
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-inverse-primary text-[28px]">contactless</span>
                  </div>
                </div>
                <div className="flex items-center gap-space-md my-auto">
                  <div className="w-12 h-9 rounded-md bg-gradient-to-br from-[#c8b27a] via-[#e5d5a2] to-[#9c824c] p-0.5 shadow-inner flex items-center justify-center">
                    <svg className="w-full h-full opacity-60 text-[#45371c]" fill="none" viewBox="0 0 48 36">
                      <rect height="32" rx="3" stroke="currentColor" strokeWidth="1.5" width="44" x="2" y="2" />
                      <line stroke="currentColor" strokeWidth="1.5" x1="2" x2="46" y1="18" y2="18" />
                      <line stroke="currentColor" strokeWidth="1.5" x1="16" x2="16" y1="2" y2="34" />
                      <line stroke="currentColor" strokeWidth="1.5" x1="32" x2="32" y1="2" y2="34" />
                      <circle cx="24" cy="18" fill="currentColor" r="4" />
                    </svg>
                  </div>
                  <span className="font-mono text-xs text-surface-dim/70 uppercase">L1 Cold-Storage Key Token</span>
                </div>
                <div className="flex items-end justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-lg tracking-widest text-inverse-on-surface">
                      4920 •••• •••• 8831
                    </span>
                    <div className="flex items-center gap-space-md text-sm font-body text-inverse-on-surface/70 mt-2">
                      <span>H. V. DE SILVA</span>
                      <span>EXP 09/29</span>
                    </div>
                  </div>
                  <button onClick={toggleCVVTitanium} className="group/cvv flex items-center gap-space-xs px-3 py-1.5 rounded-full bg-surface-container-highest/20 hover:bg-surface-container-highest/30 transition-all text-inverse-on-surface">
                    <span className="font-mono text-xs uppercase text-surface-dim">CVV</span>
                    <span className="font-mono text-sm font-bold text-inverse-primary w-6 text-center">{cvvTitanium}</span>
                    <span className="material-symbols-outlined text-[16px] text-surface-dim group-hover/cvv:text-inverse-primary">visibility</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Corporate Emerald */}
            <div className="relative group p-space-lg rounded-xl bg-primary-container text-on-primary overflow-hidden shadow-xl transition-all duration-500 hover:-translate-y-1 mt-4">
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-container to-tertiary-container opacity-95 pointer-events-none" />
              <div className="absolute -left-12 -bottom-12 w-60 h-60 bg-primary-fixed/20 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10 flex flex-col justify-between h-[300px]">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col">
                    <span className="font-mono text-label-caps uppercase tracking-widest text-on-primary-container">B-Trust Commercial</span>
                    <span className="font-headline text-xl font-normal text-on-primary mt-1">Corporate Emerald • Multi-Entity</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-surface-container-lowest/15 font-mono text-[10px] text-on-primary uppercase tracking-wider">
                    Virtual Only
                  </span>
                </div>
                <div className="flex items-center gap-space-md my-auto">
                  <div className="w-12 h-9 rounded-md bg-gradient-to-br from-primary-fixed via-inverse-primary to-surface-tint p-0.5 shadow-inner flex items-center justify-center">
                    <svg className="w-full h-full opacity-70 text-on-primary-fixed" fill="none" viewBox="0 0 48 36">
                      <rect height="32" rx="3" stroke="currentColor" strokeWidth="1.5" width="44" x="2" y="2" />
                      <line stroke="currentColor" strokeWidth="1.5" x1="2" x2="46" y1="18" y2="18" />
                      <circle cx="24" cy="18" fill="currentColor" r="5" />
                    </svg>
                  </div>
                  <span className="font-mono text-[10px] text-primary-fixed uppercase tracking-wider">Instant Routing Protocol</span>
                </div>
                <div className="flex items-end justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-lg tracking-widest text-on-primary">
                      5218 •••• •••• 1049
                    </span>
                    <div className="flex items-center gap-space-md text-sm font-body text-primary-fixed mt-2">
                      <span>SILVA ENTERPRISES PLC</span>
                      <span>EXP 12/28</span>
                    </div>
                  </div>
                  <button onClick={toggleCVVEmerald} className="group/cvv flex items-center gap-space-xs px-3 py-1.5 rounded-full bg-surface-container-lowest/15 hover:bg-surface-container-lowest/25 transition-all text-on-primary">
                    <span className="font-mono text-xs uppercase text-primary-fixed">CVV</span>
                    <span className="font-mono text-sm font-bold text-on-primary w-6 text-center">{cvvEmerald}</span>
                    <span className="material-symbols-outlined text-[16px] text-primary-fixed group-hover/cvv:text-on-primary">visibility</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Architectural Visual Break */}
            <div className="grid grid-cols-2 gap-space-md mt-4">
              <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col justify-between border border-outline-variant/30">
                <span className="font-mono text-[10px] uppercase text-on-surface-variant">Material Casting</span>
                <p className="font-headline text-lg text-primary my-space-xs">22g Grade 5 Titanium</p>
                <span className="font-body text-sm text-on-surface-variant">Milled in La Chaux-de-Fonds, Switzerland with dual laser acoustic shielding.</span>
              </div>
              <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col justify-between border border-outline-variant/30">
                <span className="font-mono text-[10px] uppercase text-on-surface-variant">Cryptographic Enclave</span>
                <p className="font-headline text-lg text-primary my-space-xs">CC EAL6+ Certified</p>
                <span className="font-body text-sm text-on-surface-variant">Zero-knowledge proof validation for off-chain sovereign signing.</span>
              </div>
            </div>
            
          </div>

          {/* Right Column */}
          <div className="lg:col-span-5 flex flex-col gap-space-lg">
            
            {/* Spend Dynamics Ledger Card */}
            <div className="p-space-lg rounded-xl bg-surface-container-low shadow-sm flex flex-col gap-space-md border border-outline-variant/30">
              <div className="flex items-center justify-between">
                <span className="font-mono text-label-caps uppercase text-on-surface-variant tracking-wider">Aggregated Spending Cap</span>
                <span className="px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-tertiary font-mono text-[10px] uppercase">Healthy Velocity</span>
              </div>
              <div className="flex flex-col gap-space-xs mt-2">
                <div className="flex items-baseline justify-between">
                  <span className="font-headline text-2xl text-primary tracking-tight">LKR 1,200,000</span>
                  <span className="font-body text-sm text-on-surface-variant font-medium">of LKR 5,000,000 Limit</span>
                </div>
                <div className="w-full h-3 rounded-full bg-surface-container-highest overflow-hidden p-0.5 mt-2">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary-container to-surface-tint transition-all duration-1000" style={{ width: '24%' }} />
                </div>
                <div className="flex items-center justify-between text-sm font-body text-on-surface-variant mt-2">
                  <span>24% Allocated</span>
                  <span className="font-mono text-[10px] text-primary">LKR 3,800,000 Reserve Remaining</span>
                </div>
              </div>
              <div className="p-space-sm rounded-lg bg-surface flex items-center justify-between mt-4 border border-outline-variant/20">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-surface-tint text-[18px]">verified_user</span>
                  <span className="font-body text-sm text-on-surface">Auto-replenish from High-Yield Vault</span>
                </div>
                <span className="font-mono text-[10px] uppercase text-primary">Active</span>
              </div>
            </div>

            {/* Tactile Switch Control Board */}
            <div className="p-space-lg rounded-xl bg-surface-container-low shadow-sm flex flex-col gap-space-md border border-outline-variant/30">
              <div className="flex items-center justify-between pb-space-xs">
                <span className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider">Operational Toggles</span>
                <span className="font-mono text-[10px] text-on-surface-variant">Live Synchronized</span>
              </div>

              {[
                { id: 'freeze', label: 'Freeze Card', desc: 'Immediately suspend bearer authorization' },
                { id: 'international', label: 'International E-Commerce', desc: 'Permit cross-border settlement in USD/EUR' },
                { id: 'atm', label: 'ATM Withdrawals', desc: 'Physical cash dispensations via global CIRRUS' },
                { id: 'contactless', label: 'Contactless Velocity Guard', desc: 'Enforce biometric challenge over LKR 50,000' }
              ].map((t, idx) => (
                <React.Fragment key={t.id}>
                  {idx > 0 && <div className="h-[1px] bg-surface-container-high w-full" />}
                  <div className="flex items-center justify-between py-space-xs">
                    <div className="flex flex-col">
                      <span className="font-headline text-lg text-on-surface">{t.label}</span>
                      <span className="font-body text-sm text-on-surface-variant">{t.desc}</span>
                    </div>
                    <button 
                      onClick={() => setToggles(prev => ({...prev, [t.id]: !prev[t.id as keyof typeof toggles]}))}
                      className={`w-12 h-7 rounded-full p-1 transition-colors relative focus:outline-none ${toggles[t.id as keyof typeof toggles] ? "bg-primary-container" : "bg-surface-container-highest"}`}
                    >
                      <div className={`w-5 h-5 rounded-full shadow-md transform transition-transform ${toggles[t.id as keyof typeof toggles] ? "bg-on-primary translate-x-5" : "bg-surface"}`} />
                    </button>
                  </div>
                </React.Fragment>
              ))}
            </div>

            {/* Wallet Provisioning Tile */}
            <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-space-sm border border-outline-variant/20">
              <div className="flex items-center gap-space-sm">
                <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-headline text-lg text-on-surface">Instant Provisioning Hub</span>
                  <span className="font-body text-sm text-on-surface-variant">One-tap push tokens for portable enclaves</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-space-sm pt-space-xs mt-2">
                <button 
                  onClick={() => triggerToast('Apple Wallet Synchronized', 'Instant cryptographic push pass established.')}
                  className="flex items-center justify-center gap-space-xs py-3 px-4 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface active:scale-[0.98] transition-all border border-outline-variant/20"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 170 170">
                    <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.08-7.77-7.94-12.24-14.58-6.19-9.18-11.13-19.8-14.82-31.87-3.69-12.07-5.54-23.49-5.54-34.25 0-14.34 3.73-26.01 11.19-35.01 7.46-9 16.71-13.57 27.75-13.72 5.04 0 10.74 1.34 17.1 4.02 6.36 2.68 10.22 4.07 11.58 4.17 1.72-.1 5.92-1.61 12.6-4.52 6.68-2.92 12.38-4.25 17.1-4.01 12.77.62 22.84 5.39 30.21 14.32-11.22 6.84-16.71 16.27-16.47 28.3.26 9.4 3.97 17.3 11.13 23.7 7.16 6.4 15.68 10.02 25.56 10.87-2.15 6.64-4.73 13.06-7.73 19.26zM119.22 33.64c0-7.35 2.64-14.36 7.92-21.03 5.28-6.67 11.89-11.08 19.83-13.23.43 1.5.65 3.01.65 4.52 0 7.32-2.73 14.52-8.19 21.61-5.46 7.09-12.18 11.45-20.21 13.08-.22-1.61-.34-3.26-.34-4.95z" />
                  </svg>
                  <span className="font-body text-sm font-semibold">Apple Pay</span>
                </button>
                <button 
                  onClick={() => triggerToast('Google Wallet Synchronized', 'Instant cryptographic push pass established.')}
                  className="flex items-center justify-center gap-space-xs py-3 px-4 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface active:scale-[0.98] transition-all border border-outline-variant/20"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" fill="#4285F4" />
                    <path d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" fill="#34A853" />
                    <path d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" fill="#FBBC05" />
                    <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" fill="#EA4335" />
                  </svg>
                  <span className="font-body text-sm font-semibold">G-Wallet</span>
                </button>
              </div>
            </div>

          </div>

        </div>

        {/* Monolithic Ledger / Terminal Activity Logs Section */}
        <div className="mt-space-lg p-space-lg rounded-xl bg-surface-container-low shadow-sm border border-outline-variant/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm mb-space-md">
            <div>
              <span className="font-mono text-[10px] uppercase text-on-surface-variant">Cryptographic Log</span>
              <h2 className="font-headline text-xl text-on-surface mt-1">Recent Virtual Key Authorizations</h2>
            </div>
            <div className="flex items-center gap-space-xs text-sm font-body text-on-surface-variant">
              <span className="w-2 h-2 rounded-full bg-surface-tint" />
              <span>End-to-End HSM Signed</span>
            </div>
          </div>
          
          <div className="flex flex-col">
            {[
              { icon: 'flight_takeoff', color: 'text-primary', merchant: 'Singapore Airlines Sovereign Desk', keyInfo: 'Key 4920 • Changi SG • 14:22:09 UTC', amount: '- LKR 842,500.00', status: 'Settled • Level 3 Data' },
              { icon: 'cloud_done', color: 'text-primary', merchant: 'Amazon Web Services High-Compute', keyInfo: 'Key 5218 • Dublin IE • 08:11:45 UTC', amount: '- LKR 245,190.00', status: 'Recurring Enterprise' },
              { icon: 'diamond', color: 'text-secondary', merchant: 'Galerie Perrotin Curatorial Acq.', keyInfo: 'Key 4920 • Paris FR • Yesterday', amount: '- LKR 112,310.00', status: 'Dual PIN Authenticated' }
            ].map((tx, idx) => (
              <div key={idx} className="py-4 flex items-center justify-between border-b border-outline-variant/20 hover:bg-surface-container/50 px-2 rounded-lg transition-colors last:border-0">
                <div className="flex items-center gap-space-md">
                  <div className={`w-10 h-10 rounded-full bg-surface-container flex items-center justify-center ${tx.color}`}>
                    <span className="material-symbols-outlined text-[20px]">{tx.icon}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-body text-body-md font-semibold text-on-surface">{tx.merchant}</span>
                    <span className="font-mono text-[10px] uppercase text-on-surface-variant">{tx.keyInfo}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-headline text-lg text-on-surface">{tx.amount}</span>
                  <span className="font-mono text-[10px] uppercase text-surface-tint">{tx.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 transition-all duration-300">
          <div className="p-space-md rounded-xl bg-inverse-surface text-inverse-on-surface shadow-2xl flex items-center gap-space-md">
            <span className="material-symbols-outlined text-inverse-primary text-[24px]">verified</span>
            <div className="flex flex-col">
              <span className="font-headline text-lg font-semibold">{toastMessage.title}</span>
              <span className="font-body text-sm text-surface-dim">{toastMessage.message}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
