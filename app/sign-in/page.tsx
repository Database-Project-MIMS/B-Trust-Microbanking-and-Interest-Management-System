"use client"

import * as React from "react"
import Link from "next/link"

export default function SignInPage() {
  const [passwordVisible, setPasswordVisible] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [statusMessage, setStatusMessage] = React.useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setStatusMessage("Exchanging Kyber-1024 quantum-safe certificates...")

    // Simulate auth for now, later map to /api/auth/login
    setTimeout(() => {
      setStatusMessage("Identity attested. Decrypting sovereign vault partition...")
      setTimeout(() => {
        window.location.href = "/sign-in/mfa"
      }, 800)
    }, 1200)
  }

  return (
    <main className="w-full min-h-screen bg-surface flex items-center justify-center">
      <div className="flex flex-col w-full">
        <div className="relative w-full max-w-[1360px] mx-auto px-5 sm:px-8 md:px-12 lg:px-20 py-8 lg:py-12 flex flex-col min-h-screen justify-between">
          
          {/* Ambient Background Blooms */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />
          <div className="absolute bottom-12 right-1/4 w-[380px] h-[380px] bg-secondary-container/10 rounded-full blur-3xl pointer-events-none -z-10" />
          
          {/* Header */}
          <header className="w-full flex flex-col md:flex-row items-center justify-between gap-6 pb-8">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-primary text-[20px]">account_balance</span>
                </div>
                <span className="font-headline-sm text-headline-sm text-primary tracking-tight">B-Trust</span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-body-sm font-body-sm">
              <a href="#" className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5 group">
                <span className="material-symbols-outlined text-[18px] text-outline group-hover:text-primary transition-colors">support_agent</span>
                <span>Concierge Support</span>
              </a>
              <span className="text-outline-variant font-mono text-xs">/</span>
              <span className="font-mono text-outline tracking-widest text-[10px] uppercase font-bold">CH-ZURICH ENCLAVE 04</span>
            </div>
          </header>

          {/* Main Auth Container */}
          <section className="w-full flex flex-col items-center justify-center my-auto py-4">
            <div className="w-full max-w-[560px] bg-surface-container-lowest rounded-xl shadow-[0_20px_48px_-12px_rgba(14,17,22,0.08)] border border-outline-variant/30 p-8 sm:p-12 transition-all relative">
              
              {/* Top Meta */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span className="font-mono text-on-surface-variant uppercase tracking-widest text-xs font-bold">Enclave Identity Gateway</span>
                </div>
                <div className="font-mono text-[11px] text-outline">SESSION // 0x9AF8...44C</div>
              </div>

              {/* Title */}
              <div className="space-y-2 mb-8">
                <h1 className="font-headline text-[2.5rem] leading-[1.1] text-on-surface tracking-tight">Sovereign Login</h1>
                <p className="font-body text-on-surface-variant">Cryptographic enclave handshake for verified institutional node operators.</p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Username / Node ID */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label htmlFor="corporateNodeId" className="font-body text-sm text-on-surface font-semibold tracking-wide">
                      Registered Corporate Node / Email
                    </label>
                    <span className="font-mono text-outline text-[10px] uppercase font-bold">PKI IDENTITY</span>
                  </div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[20px]">hub</span>
                    <input 
                      id="corporateNodeId" 
                      type="text" 
                      required 
                      defaultValue="custody-node.sg@btrust-vault.ch"
                      className="w-full pl-12 pr-4 py-3.5 bg-surface-container-low text-on-surface placeholder:text-outline/60 rounded-lg font-body focus:bg-surface-container focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border border-transparent focus:border-primary/30"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label htmlFor="sovereignPass" className="font-body text-sm text-on-surface font-semibold tracking-wide">
                      Sovereign Password
                    </label>
                    <span className="font-mono text-outline text-[10px] uppercase font-bold">ZERO-KNOWLEDGE PROOF</span>
                  </div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[20px]">shield</span>
                    <input 
                      id="sovereignPass" 
                      type={passwordVisible ? "text" : "password"} 
                      required 
                      defaultValue="••••••••••••••••••••"
                      className="w-full pl-12 pr-12 py-3.5 bg-surface-container-low text-on-surface placeholder:text-outline/60 rounded-lg font-body tracking-wider focus:bg-surface-container focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border border-transparent focus:border-primary/30"
                    />
                    <button 
                      type="button" 
                      onClick={() => setPasswordVisible(!passwordVisible)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface p-1 transition-colors flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {passwordVisible ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Bind toggle */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex flex-col">
                    <span className="font-body text-sm text-on-surface font-semibold">Remember Hardware Node</span>
                    <span className="font-body text-xs text-on-surface-variant mt-0.5">Bind cryptographic enclave token to current hardware</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-surface-container-lowest after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface-container-lowest after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container border border-outline-variant/20"></div>
                  </label>
                </div>

                {/* Submit */}
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full mt-2 py-4 px-6 bg-primary-container hover:bg-primary disabled:opacity-80 disabled:cursor-wait text-on-primary rounded-lg font-body font-medium flex items-center justify-center gap-3 transition-all duration-200 active:scale-[0.985] group shadow-[0_4px_14px_rgba(46,92,80,0.3)]"
                >
                  <span className="tracking-wide">
                    {loading ? "Negotiating Enclave Handshake..." : "Authenticate Sovereign Session"}
                  </span>
                  <span className={`material-symbols-outlined text-[19px] transition-transform ${loading ? "animate-spin" : "group-hover:translate-x-1"}`}>
                    {loading ? "sync" : "arrow_forward"}
                  </span>
                </button>
              </form>

              {/* Status Toast */}
              {statusMessage && (
                <div className="mt-6 p-3 bg-tertiary-fixed text-tertiary rounded-lg text-sm font-body flex items-start gap-3 transition-all border border-tertiary/10 animate-fade-up">
                  <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">verified</span>
                  <span>{statusMessage}</span>
                </div>
              )}
            </div>
          </section>

          {/* Footer Meta */}
          <footer className="w-full pt-8 pb-4 space-y-6">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-surface-container rounded-full text-on-surface-variant font-mono text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" /> SHA-256 LEDGER SEALED
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-surface-container rounded-full text-on-surface-variant font-mono text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-outline" /> SWISS FINMA COMPLIANT // BASEL III FRAMEWORK
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-surface-container rounded-full text-on-surface-variant font-mono text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary-container" /> CBSL TIER-1 CUSTODY STATUS: OPERATIONAL
              </div>
            </div>
            <div className="text-center max-w-3xl mx-auto space-y-2">
              <p className="font-body text-outline text-xs leading-relaxed">
                B-Trust (Switzerland) AG is a regulated entity authorized under the Swiss Financial Market Supervisory Authority (FINMA) for digital institutional custody and fiduciary asset segregation. Multi-jurisdictional clearing services in South Asia are held under Central Bank of Sri Lanka (CBSL) Tier-1 institutional custodial licensure guidelines. Access restricted strictly to pre-authorized node signatories.
              </p>
              <p className="font-mono text-[11px] text-outline-variant">
                NODE: NODE-CH-048 // RUNTIME: SE-2024.11-QUANTUM // SHA: 8f02ba94a48c12b7
              </p>
            </div>
          </footer>
        </div>
      </div>
    </main>
  )
}
