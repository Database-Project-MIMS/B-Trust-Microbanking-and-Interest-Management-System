"use client"

import * as React from "react"
import Link from "next/link"

export default function HardwareKeyPage() {
  const [authenticated, setAuthenticated] = React.useState(false)
  const [status, setStatus] = React.useState("Awaiting Touch Attestation...")

  const triggerSuccess = () => {
    if (authenticated) return
    setAuthenticated(true)
    setStatus("Signature Attested. Relaying proof...")
    setTimeout(() => {
      window.location.href = "/sign-in/established"
    }, 1200)
  }

  return (
    <main className="w-full min-h-screen flex items-center justify-center bg-surface p-margin md:p-margin-tablet lg:p-margin-desktop selection:bg-primary-fixed selection:text-on-primary-fixed">
      <div className="flex flex-col w-full items-center justify-center py-space-md lg:py-space-xl px-margin md:px-margin-tablet">
        <div className="w-full max-w-[680px] flex flex-col items-center">
          
          {/* Top Monolithic Ledger Tag */}
          <div className="flex items-center gap-space-xs mb-space-lg px-space-sm py-1 bg-surface-container-low rounded-full shadow-sm border border-outline-variant/30">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
            <span className="font-mono text-[10px] uppercase text-on-surface-variant tracking-widest font-bold">
              Session Protocol SEC-9182
            </span>
            <span className="text-outline-variant font-mono text-[10px] uppercase">/</span>
            <span className="font-mono text-[10px] uppercase text-primary font-bold">FINMA CL-IV</span>
          </div>

          {/* Main Architectural Card Surface */}
          <div className="w-full bg-surface-container-lowest rounded-xl shadow-2xl p-space-md md:p-space-lg flex flex-col items-center relative overflow-hidden transition-all duration-500 border border-outline-variant/30">
            
            {/* Ambient Celadon Diffused Radial Glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-primary-fixed/30 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 right-10 w-60 h-60 bg-tertiary-fixed/25 rounded-full blur-3xl pointer-events-none" />
            
            {/* Header Content */}
            <div className="text-center relative z-10 max-w-xl">
              <h1 className="font-headline text-[2.5rem] text-on-surface tracking-tight mb-space-xs leading-tight">
                Hardware Security Key Verification
              </h1>
              <p className="font-body text-md text-on-surface-variant max-w-md mx-auto leading-relaxed">
                Touch your physical FIDO2 / YubiKey or authenticate via biometric enclave sensor to grant cryptographic session clearance.
              </p>
            </div>

            {/* Interactive Sensor Artifact / Sculptural Touchpoint */}
            <div className="my-space-lg relative flex flex-col items-center justify-center">
              
              {/* Pulse Echo Rings */}
              <div className="relative w-44 h-44 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-primary-fixed-dim/20 animate-ping opacity-40 duration-1000" />
                <div className="absolute inset-3 rounded-full bg-primary-fixed/30 animate-pulse duration-700" />
                
                {/* Concentric Precision Ring SVG */}
                <svg className="absolute inset-0 w-full h-full text-surface-tint opacity-20 pointer-events-none" fill="none" viewBox="0 0 176 176">
                  <circle cx="88" cy="88" r="86" stroke="currentColor" strokeDasharray="4 6" strokeWidth="1" />
                  <circle cx="88" cy="88" r="70" stroke="currentColor" strokeWidth="1" />
                  <circle cx="88" cy="88" r="54" stroke="currentColor" strokeDasharray="2 4" strokeWidth="1" />
                </svg>
                
                {/* Core Interactive Sensor Button */}
                <button 
                  onClick={triggerSuccess}
                  className={`relative z-10 w-28 h-28 rounded-full flex flex-col items-center justify-center cursor-pointer transition-transform duration-300 active:scale-95 shadow-md group ${authenticated ? 'bg-primary-fixed shadow-lg' : 'bg-surface-container-low hover:bg-surface-container'}`}
                >
                  <span className={`material-symbols-outlined text-4xl group-hover:scale-110 transition-transform ${authenticated ? 'text-primary' : 'text-primary'}`}>
                    {authenticated ? 'check_circle' : 'fingerprint'}
                  </span>
                  <span className="font-mono text-[10px] text-on-surface-variant uppercase mt-1 tracking-wider opacity-80 font-bold">
                    NFC / USB
                  </span>
                </button>
              </div>

              {/* Sensor Real-time Telemetry */}
              <div className="mt-space-sm flex flex-col items-center space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-secondary-container" />
                  <span className={`font-mono text-[10px] uppercase font-bold ${authenticated ? 'text-primary' : 'text-on-surface'}`}>
                    {status}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-on-surface-variant">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-outline font-bold">Entropy</span>
                  <span className="font-mono text-xs text-primary font-bold">99.98%</span>
                </div>
              </div>
            </div>

            {/* Monolithic Node Data Slab */}
            <div className="w-full bg-surface-container-low rounded-lg p-space-md mb-space-lg flex flex-col gap-space-xs text-left border border-outline-variant/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between py-1 gap-1">
                <span className="font-mono text-[10px] uppercase text-outline font-bold">Physical Node Target</span>
                <span className="font-mono text-xs text-on-surface font-bold tracking-wide">Node-ZRH-8809 (Zurich-IX)</span>
              </div>
              <div className="w-full h-px bg-surface-container-highest" />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between py-1 gap-1">
                <span className="font-mono text-[10px] uppercase text-outline font-bold">Authenticated Identity</span>
                <span className="font-mono text-xs text-on-surface">custody-node.sg@btrust-vault.ch</span>
              </div>
              <div className="w-full h-px bg-surface-container-highest" />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between py-1 gap-1">
                <span className="font-mono text-[10px] uppercase text-outline font-bold">Enclave Challenge</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-primary font-bold">ECDSA-P384</span>
                  <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-bold">FIPS 140-3 L4</span>
                </div>
              </div>
            </div>

            {/* Action Stack */}
            <div className="w-full flex flex-col gap-space-xs">
              <button 
                onClick={triggerSuccess}
                className={`w-full py-space-sm px-space-md text-on-primary rounded-xl font-body text-sm font-semibold tracking-tight shadow-sm transition-all duration-200 active:scale-[0.985] flex items-center justify-center gap-2 ${authenticated ? 'bg-primary-container' : 'bg-primary hover:bg-primary-container'}`}
              >
                {authenticated ? (
                  <>
                    <span className="material-symbols-outlined text-lg">check</span>
                    <span>Clearance Granted (384-bit)</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">verified_user</span>
                    <span>Confirm Physical Touch</span>
                  </>
                )}
              </button>
              <div className="flex flex-col sm:flex-row gap-space-xs w-full pt-1">
                <button className="flex-1 py-space-xs px-space-sm bg-surface-container-low hover:bg-surface-container text-on-surface rounded-xl font-body text-sm font-medium transition-all text-center">
                  Switch to Signal / SMS Vector
                </button>
                <Link href="/sign-in" className="py-space-xs px-space-md bg-transparent hover:bg-surface-container-low text-secondary rounded-xl font-body text-sm font-medium transition-all text-center">
                  Cancel Verification
                </Link>
              </div>
            </div>

          </div>
          
          {/* Editorial Footer Anchor */}
          <div className="mt-space-md text-center flex flex-col sm:flex-row items-center justify-center gap-2 text-outline font-mono text-[10px] uppercase font-bold opacity-80">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-base text-primary">lock_clock</span>
              Quantum-Shielded Kyber-1024 Handshake
            </span>
            <span className="hidden sm:inline">•</span>
            <span>CBSL & Swiss FINMA Regulated</span>
          </div>

        </div>
      </div>
    </main>
  )
}
