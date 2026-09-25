"use client"

import * as React from "react"
import Link from "next/link"

export default function SessionEstablishedPage() {
  const [seconds, setSeconds] = React.useState(4 * 3600)
  const [revoking, setRevoking] = React.useState(false)

  React.useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(prev => prev > 0 ? prev - 1 : 0)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (totalSec: number) => {
    const hrs = String(Math.floor(totalSec / 3600)).padStart(2, '0')
    const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0')
    const secs = String(totalSec % 60).padStart(2, '0')
    return `${hrs}:${mins}:${secs}`
  }

  const handleRevoke = () => {
    if (window.confirm('Disconnect secure sovereign partition handshake immediately?')) {
      setRevoking(true)
      setTimeout(() => {
        window.location.href = "/sign-in"
      }, 900)
    }
  }

  return (
    <main className="w-full min-h-screen flex items-center justify-center bg-surface p-margin md:p-margin-tablet lg:p-margin-desktop selection:bg-primary-fixed selection:text-on-primary-fixed">
      <div className="flex flex-col w-full items-center justify-center relative">
        <div className="absolute -top-36 left-1/2 -translate-x-1/2 w-[720px] h-[520px] bg-gradient-to-b from-primary-fixed/30 via-tertiary-fixed/20 to-transparent blur-3xl pointer-events-none rounded-full -z-10" />
        
        <div className="w-full max-w-2xl flex flex-col items-center text-center">
          
          <div className="relative flex items-center justify-center mb-space-lg">
            <div className="absolute w-36 h-36 rounded-full bg-primary-fixed/40 animate-ping opacity-60 pointer-events-none" style={{animationDuration: '3.5s'}} />
            <div className="absolute w-28 h-28 rounded-full bg-tertiary-fixed-dim/40 animate-pulse pointer-events-none" style={{animationDuration: '2.4s'}} />
            <div className="relative w-20 h-20 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-xl shadow-primary/10">
              <svg className="w-10 h-10 text-on-primary transition-transform duration-700 hover:scale-105" fill="none" viewBox="0 0 48 48">
                <path d="M24 4L9 9.5V21.8C9 31.2 15.4 39.9 24 43.5C32.6 39.9 39 31.2 39 21.8V9.5L24 4Z" fill="currentColor" fillOpacity="0.16" />
                <path d="M24 6.2L11 11V21.8C11 29.8 16.6 37.3 24 40.5C31.4 37.3 37 29.8 37 21.8V11L24 6.2Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" />
                <path d="M18 23.5L22.2 27.7L30.5 18.5" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
              </svg>
            </div>
            <div className="absolute -bottom-2 px-space-xs py-0.5 rounded-full bg-surface-container-lowest text-primary font-mono text-[10px] uppercase shadow-sm tracking-widest flex items-center gap-1.5 font-bold border border-outline-variant/20">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse-dot" />
              Attested Live
            </div>
          </div>
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high/60 text-tertiary font-mono text-[10px] tracking-wider uppercase mb-space-sm font-bold border border-outline-variant/10">
            <span className="material-symbols-outlined text-sm">lock</span>
            Quantum Safe Kyber-1024
          </div>
          
          <h1 className="font-headline text-[3rem] text-on-surface tracking-tight max-w-xl mx-auto mb-space-xs leading-tight">
            Session Handshake Established
          </h1>
          <p className="font-body text-md text-on-surface-variant max-w-lg mb-space-xl leading-relaxed">
            Cryptographic credentials verified. Authorizing sovereign enclave node partition.
          </p>
          
          <div className="w-full bg-surface-container-low rounded-xl p-space-md md:p-space-lg shadow-sm text-left mb-space-lg border border-outline-variant/20">
            <div className="flex items-center justify-between pb-space-sm mb-space-sm border-b border-surface-container-highest">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base">verified_user</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Sovereign Node Ledger</span>
              </div>
              <span className="font-mono text-xs text-primary-container font-semibold">PARTITION #8812</span>
            </div>
            
            <div className="space-y-space-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1.5">
                <span className="font-body text-sm text-on-surface-variant">Session Token</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-on-surface bg-surface-container-lowest px-2 py-0.5 rounded border border-outline-variant/10">0x9AF8...244C</span>
                  <span className="font-mono text-[10px] uppercase text-primary px-1.5 py-0.5 rounded bg-tertiary-fixed font-bold border border-primary-fixed">Kyber-1024</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1.5">
                <span className="font-body text-sm text-on-surface-variant">Verification Node</span>
                <span className="font-body text-sm font-medium text-on-surface text-left sm:text-right">CH-Zurich Vault II / CBSL LankaSettle Bridge</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1.5">
                <span className="font-body text-sm text-on-surface-variant">Clearance Level</span>
                <span className="font-body text-sm font-medium text-primary-container text-left sm:text-right">Sovereign Treasury Officer (Dual-Signatory)</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1.5">
                <span className="font-body text-sm text-on-surface-variant">Session Lifetime</span>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-on-surface-variant">schedule</span>
                  <span className="font-mono text-sm text-on-surface font-semibold">{formatTime(seconds)}</span>
                  <span className="font-body text-xs text-on-surface-variant">(Auto-lock on idle)</span>
                </div>
              </div>
            </div>
            
            <div className="mt-space-md pt-space-sm flex items-center justify-between border-t border-surface-container-highest">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                <span className="font-mono text-[10px] uppercase text-on-surface-variant font-bold">Zero-Trust Telemetry Active</span>
              </div>
              <span className="font-mono text-[10px] uppercase text-on-surface-variant font-bold">Latency: 14ms</span>
            </div>
          </div>
          
          <div className="w-full flex flex-col items-center gap-space-md">
            <Link href="/dashboard" className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-3.5 rounded-xl bg-primary-container hover:bg-primary text-on-primary font-headline text-lg shadow-md hover:shadow-lg transition-all duration-200 group">
              <span>Enter Sovereign Horizon Dashboard</span>
              <span className="material-symbols-outlined transition-transform duration-200 group-hover:translate-x-1">arrow_forward</span>
            </Link>
            <button 
              onClick={handleRevoke}
              disabled={revoking}
              className="inline-flex items-center gap-1.5 font-body text-sm text-secondary hover:text-on-secondary-container transition-colors py-1 disabled:opacity-80 disabled:cursor-not-allowed"
            >
              {revoking ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">refresh</span>
                  <span>Revoking Enclave Access...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">power_settings_new</span>
                  <span>Revoke Node Session & Disconnect</span>
                </>
              )}
            </button>
          </div>
          
          <div className="mt-space-xl flex items-center justify-center gap-8 text-on-surface-variant">
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold">
              <span className="material-symbols-outlined text-sm text-primary">security</span>
              FINMA Compliant
            </div>
            <div className="h-3 w-px bg-outline-variant" />
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold">
              <span className="material-symbols-outlined text-sm text-primary">hub</span>
              EAL6+ HSM Partition
            </div>
            <div className="h-3 w-px bg-outline-variant" />
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold">
              <span className="material-symbols-outlined text-sm text-primary">sync</span>
              Iso 20022 Direct
            </div>
          </div>
          
        </div>
      </div>
    </main>
  )
}
