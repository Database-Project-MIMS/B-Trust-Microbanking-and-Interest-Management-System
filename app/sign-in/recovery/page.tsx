"use client"

import * as React from "react"
import Link from "next/link"

export default function KeyRecoveryPage() {
  const [selectedVector, setSelectedVector] = React.useState<'telecom' | 'mnemonic' | null>(null)

  return (
    <main className="w-full min-h-screen flex flex-col bg-background selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-50 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
        <div className="h-20 max-w-[1360px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop flex items-center justify-between">
          <div className="flex items-center gap-space-md">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary text-[20px]">account_balance</span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline text-lg text-primary leading-none tracking-tight font-semibold">B-Trust</span>
              <span className="font-mono text-[10px] text-outline uppercase tracking-widest mt-0.5 font-bold">Spatial Banking</span>
            </div>
            <div className="hidden sm:flex items-center gap-space-xs ml-space-sm pl-space-md border-l border-outline-variant/30">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-dot" />
            </div>
          </div>
          <div className="flex items-center gap-space-md">
            <nav className="flex items-center gap-space-md">
              <Link href="/sign-in" className="font-body text-sm text-on-surface-variant hover:text-on-surface transition-colors">Access Portal</Link>
              <Link href="/sign-in/hardware" className="font-body text-sm text-on-surface-variant hover:text-on-surface transition-colors">Hardware Key</Link>
              <Link href="/sign-in/established" className="font-body text-sm text-on-surface-variant hover:text-on-surface transition-colors">Security Attestation</Link>
              <span className="font-body text-sm text-primary font-semibold transition-colors">Custody Desk</span>
            </nav>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full pt-20 flex-1 flex flex-col justify-center items-center">
        <div className="flex flex-col w-full items-center justify-center py-space-xl px-margin md:px-margin-tablet relative overflow-hidden">
          
          <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-primary-fixed/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-secondary-fixed/25 blur-3xl pointer-events-none" />
          
          <div className="w-full max-w-[820px] flex flex-col items-center relative z-10">
            
            <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm mb-space-lg">
              <Link href="/sign-in" className="inline-flex items-center gap-space-xs text-on-surface-variant hover:text-primary transition-colors group">
                <span className="material-symbols-outlined text-[18px] transition-transform group-hover:-translate-x-1">arrow_back</span>
                <span className="font-body text-sm tracking-tight font-medium">Back to Sovereign Login</span>
              </Link>
            </div>
            
            <div className="w-full bg-surface-container-lowest rounded-xl shadow-xl p-space-md sm:p-space-lg lg:p-space-xl transition-all border border-outline-variant/30">
              
              <div className="flex flex-col text-left mb-space-lg">
                <div className="flex items-center gap-2 mb-space-xs">
                  <span className="text-outline-variant font-mono text-sm">•</span>
                </div>
                <h1 className="font-headline text-[3rem] text-on-surface tracking-tight mb-space-xs leading-tight">
                  Cryptographic Key Recovery
                </h1>
                <p className="font-body text-lg text-on-surface-variant max-w-2xl leading-relaxed">
                  Initiate statutory multi-signature enclave key restoration for institutional sovereign treasury accounts.
                </p>
              </div>

              <form className="space-y-space-md" onSubmit={e => e.preventDefault()}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                  <div className="flex flex-col space-y-1.5">
                    <label htmlFor="corporate-email" className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant flex items-center justify-between font-bold">
                      Registered Corporate Email
                    </label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-4 text-outline text-[20px] pointer-events-none">corporate_fare</span>
                      <input 
                        id="corporate-email"
                        type="email" 
                        defaultValue="custody-officer@apexholdings.ch" 
                        placeholder="custody-officer@apexholdings.ch"
                        className="w-full bg-surface-container-low text-on-surface placeholder:text-outline/60 font-body text-md rounded-lg py-3.5 pl-12 pr-4 outline-none transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 border border-transparent focus:border-primary/30"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col space-y-1.5">
                    <label htmlFor="enclave-id" className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant flex items-center justify-between font-bold">
                      Enclave Hardware ID
                    </label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-4 text-outline text-[20px] pointer-events-none">vpn_key</span>
                      <input 
                        id="enclave-id"
                        type="text" 
                        defaultValue="ENC-ZRH-8809-COL" 
                        placeholder="ENC-ZRH-8809-COL"
                        className="w-full bg-surface-container-low text-on-surface placeholder:text-outline/60 font-mono text-sm rounded-lg py-3.5 pl-12 pr-4 outline-none transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 border border-transparent focus:border-primary/30"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-space-md pb-space-xs">
                  <div className="flex items-center justify-between mb-space-sm">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface font-bold">
                      Choose your recovery vector to guides:
                    </span>
                  </div>
                  <div className="flex flex-col gap-space-sm">
                    <button 
                      type="button" 
                      onClick={() => setSelectedVector('telecom')}
                      className={`w-full text-left p-space-md rounded-lg transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm group border ${selectedVector === 'telecom' ? 'bg-primary-fixed/20 border-primary/30' : 'bg-surface-container-low hover:bg-surface-container border-transparent'}`}
                    >
                      <div className="flex items-center gap-space-md">
                        <div className="w-12 h-12 rounded-lg bg-primary-fixed/50 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <span className="material-symbols-outlined text-[24px]">phonelink_lock</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-headline text-xl text-on-surface">Verify Encrypted Phone</span>
                          </div>
                          <p className="font-body text-sm text-on-surface-variant mt-0.5">
                            Hardware-attested eSIM / Signal Enclave ephemeral cryptographic challenge
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <span className="font-mono text-[10px] text-primary uppercase font-bold tracking-wider hidden group-hover:inline">Authenticate</span>
                        <span className="material-symbols-outlined text-primary text-[20px] transition-transform group-hover:translate-x-1">chevron_right</span>
                      </div>
                    </button>
                    
                    <div className="relative flex py-1 items-center justify-center">
                      <div className="w-full h-px bg-surface-container-highest" />
                      <span className="absolute bg-surface-container-lowest px-4 font-mono text-[10px] text-outline uppercase tracking-widest font-bold">or</span>
                    </div>

                    <button 
                      type="button" 
                      onClick={() => setSelectedVector('mnemonic')}
                      className={`w-full text-left p-space-md rounded-lg transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm group border ${selectedVector === 'mnemonic' ? 'bg-secondary-fixed/30 border-secondary/30' : 'bg-surface-container-low hover:bg-surface-container border-transparent'}`}
                    >
                      <div className="flex items-center gap-space-md">
                        <div className="w-12 h-12 rounded-lg bg-secondary-fixed/50 text-secondary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <span className="material-symbols-outlined text-[24px]">password</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-headline text-xl text-on-surface">Initiate BIP-39 Mnemonic Seed Phrase Recovery</span>
                          </div>
                          <p className="font-body text-sm text-on-surface-variant mt-0.5">
                            Physical cold metal ledger restoration via post-quantum threshold shamir split
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <span className="font-mono text-[10px] text-secondary uppercase font-bold tracking-wider hidden group-hover:inline">Restore</span>
                        <span className="material-symbols-outlined text-secondary text-[20px] transition-transform group-hover:translate-x-1">chevron_right</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="rounded-lg bg-secondary-container/15 p-space-md flex flex-col sm:flex-row items-start gap-space-md mt-space-md border border-secondary-container/20">
                  <div className="w-10 h-10 rounded-lg bg-secondary-container/40 text-secondary flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[22px]">lock_clock</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-headline text-xl text-on-secondary-container leading-tight">
                        7-Day Cooldown Protocol Initiated on Sovereign Account to Protect Corporate Reserves
                      </span>
                    </div>
                    <p className="font-body text-sm text-on-surface-variant leading-relaxed">
                      Per Swiss FINMA Article 44 and CBSL Sovereign Liquidity Directives, all cold enclave key restorations impose a mandatory 168-hour time-lock. All automated outbound settlement sweeps and high-velocity float disbursements are temporarily frozen during this cooling period to safeguard custodial reserve balances.
                    </p>
                  </div>
                </div>
              </form>
              
              <div className="mt-space-lg pt-space-md border-t border-surface-container-highest flex flex-col md:flex-row items-center justify-between gap-space-sm text-on-surface-variant">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                </div>
                <div className="flex items-center gap-space-md">
                  <a href="#" className="inline-flex items-center gap-1.5 font-body text-sm text-primary hover:text-primary-container transition-colors font-medium">
                    <span className="material-symbols-outlined text-[16px]">file_download</span>
                    Download Key Recovery Declaration PDF
                  </a>
                </div>
              </div>
              
            </div>
            
            {/* Concierge Desk */}
            <div className="w-full mt-space-lg p-space-md rounded-xl bg-surface-container-low flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md shadow-sm border border-outline-variant/10">
              <div className="flex items-center gap-space-sm">
                <div className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">headset_mic</span>
                </div>
                <div>
                  <span className="font-headline text-lg text-on-surface block">Senior Treasury Director & Private Concierge Desk</span>
                  <span className="font-body text-sm text-outline">Dedicated dual-custody verification team available 24/7/365</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-space-sm">
                <a href="tel:+41442158800" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-mono text-sm font-semibold">
                  <span className="material-symbols-outlined text-[16px] text-primary">call</span>
                  +41 44 215 8800
                </a>
                <a href="mailto:concierge@btrust-vault.ch" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors font-body text-sm font-medium">
                  <span className="material-symbols-outlined text-[16px]">mail</span>
                  Dispatch Secure Line
                </a>
              </div>
            </div>
            
            <div className="mt-space-md flex items-center gap-space-sm text-outline font-mono text-[10px] uppercase font-bold">
              <span>ZURICH CAMPUS</span>
              <span>/</span>
              <span>GENEVA VAULT II</span>
              <span>/</span>
              <span>SINGAPORE AIR GAP</span>
            </div>
            
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="w-full bg-surface-container-low py-space-md border-t border-outline-variant/20 mt-auto">
        <div className="max-w-[1360px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop flex flex-col md:flex-row items-center justify-between gap-space-sm">
          <div className="flex flex-wrap items-center gap-space-md">
            <span className="font-mono text-sm text-outline tracking-wider">B-TRUST ARCHITECTURAL CUSTODY GROUP</span>
            <span className="hidden md:inline text-outline-variant">•</span>
            <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">ZERO-KNOWLEDGE ATTESTATION STACK ACTIVE</span>
          </div>
          <div className="flex items-center gap-space-md">
            <span className="font-mono text-[10px] text-outline uppercase font-bold">ISO-27001 / FIPS 140-3 LEVEL 4 COMPLIANT</span>
            <span className="font-mono text-sm text-on-surface-variant">© 2025 B-Trust N.A.</span>
          </div>
        </div>
      </footer>
    </main>
  )
}
