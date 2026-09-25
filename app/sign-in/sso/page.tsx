"use client"

import * as React from "react"
import Link from "next/link"

export default function SSOPage() {
  const [loading, setLoading] = React.useState(false)
  const [status, setStatus] = React.useState("Authenticate via Enterprise SSO")
  const [domain, setDomain] = React.useState("apexholdings.okta.com")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    
    setLoading(true)
    setStatus("Delegating to Okta IDP...")
    
    setTimeout(() => {
      setStatus("Federated Handshake Established")
      setTimeout(() => {
        setStatus("Authenticate via Enterprise SSO")
        setLoading(false)
      }, 2200)
    }, 1400)
  }

  return (
    <main className="w-full min-h-screen flex items-center justify-center bg-surface p-margin md:p-margin-tablet lg:p-margin-desktop selection:bg-primary-fixed selection:text-on-primary-fixed">
      <div className="flex flex-col w-full items-center justify-center py-space-md md:py-space-xl">
        
        {/* Ambient Atmospheric Backing Glow */}
        <div className="relative w-full max-w-xl flex flex-col items-center">
          <div className="absolute -top-16 -left-16 w-80 h-80 rounded-full bg-primary-fixed/20 blur-3xl pointer-events-none -z-10" />
          <div className="absolute -bottom-20 -right-16 w-80 h-80 rounded-full bg-tertiary-fixed/30 blur-3xl pointer-events-none -z-10" />
          
          {/* Security Monolith Status Tag */}
          <div className="flex items-center gap-space-xs px-space-md py-1.5 rounded-full bg-surface-container-low shadow-sm mb-space-lg transition-transform hover:scale-[1.01] border border-outline-variant/30">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-dot" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-primary-container font-bold">
              Encrypted Federation Active <span className="opacity-40 px-1">//</span> TLS 1.3 Strict Mutual Auth
            </span>
          </div>
          
          {/* Main Architectural Identity Portal Card */}
          <div className="w-full bg-surface-container-lowest rounded-xl shadow-2xl border border-outline-variant/30 p-space-md sm:p-space-lg md:p-space-xl relative">
            
            {/* Top Crest & Vault Header */}
            <div className="flex flex-col items-center text-center mb-space-lg">
              <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-primary mb-space-md shadow-sm border border-outline-variant/20">
                <span className="material-symbols-outlined text-2xl" style={{fontVariationSettings: "'FILL' 1"}}>shield_with_house</span>
              </div>
              <h1 className="font-headline text-[2rem] text-on-surface mb-2 font-semibold">
                Enterprise Identity Gateway
              </h1>
              <p className="font-body text-md text-on-surface-variant max-w-sm">
                Single sign-on authorization via Okta Enterprise & Decentralized ID (Ok-kina).
              </p>
            </div>
            
            {/* Federation Form */}
            <form className="flex flex-col gap-space-md" onSubmit={handleSubmit}>
              
              {/* Input 1: Enterprise Domain */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-baseline">
                  <label htmlFor="tenant-domain" className="font-body text-sm font-semibold text-on-surface">
                    Enterprise Domain / Tenant URL
                  </label>
                  <span className="font-mono text-[10px] uppercase text-outline font-bold tracking-wider">DNS VERIFIED</span>
                </div>
                <div className="relative flex items-center bg-surface-container-low rounded-lg transition-all focus-within:bg-surface-container-lowest focus-within:shadow-md border border-transparent focus-within:border-primary/30">
                  <span className="pl-4 pr-1 text-outline select-none font-mono text-sm font-bold">https://</span>
                  <input 
                    id="tenant-domain"
                    type="text"
                    spellCheck="false"
                    autoComplete="off"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="w-full py-3.5 pr-4 bg-transparent font-mono text-sm text-on-surface focus:outline-none"
                  />
                  <span className="material-symbols-outlined pr-3.5 text-primary text-lg" title="Tenant Validated">verified</span>
                </div>
              </div>
              
              {/* Input 2: Corporate Identity Provider Selector */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-baseline">
                  <label htmlFor="idp-provider" className="font-body text-sm font-semibold text-on-surface">
                    Corporate Identity Provider
                  </label>
                  <span className="font-mono text-[10px] uppercase text-outline font-bold tracking-wider">PROTO: OIDC-SAML</span>
                </div>
                <div className="relative bg-surface-container-low rounded-lg transition-all focus-within:bg-surface-container-lowest focus-within:shadow-md border border-transparent focus-within:border-primary/30">
                  <select id="idp-provider" className="w-full appearance-none py-3.5 pl-4 pr-10 bg-transparent font-body text-sm text-on-surface focus:outline-none cursor-pointer">
                    <option value="okta-universal">Okta Universal Directory (SAML 2.0 / OIDC)</option>
                    <option value="azure-ad">Microsoft Entra ID (Federated Sovereign)</option>
                    <option value="ping-fed">PingFederate Hardware Token Bridge</option>
                    <option value="ok-kina-did">Ok-kina Sovereign Ledger DID Enclave</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-outline">
                    unfold_more
                  </span>
                </div>
              </div>
              
              {/* Technical Telemetry Well: Partition ID */}
              <div className="p-3.5 bg-surface-container-low rounded-lg flex items-center justify-between text-on-surface-variant mt-1 border border-outline-variant/10">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-outline text-base">domain_verification</span>
                  <div className="flex flex-col">
                    <span className="font-mono text-[10px] uppercase text-outline font-bold">Enclave Partition ID</span>
                    <span className="font-mono text-xs text-on-surface font-bold tracking-tight">ENC-ZRH-8809-COL</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 py-1 px-2.5 rounded bg-surface-container-lowest text-primary shadow-sm border border-outline-variant/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="font-mono text-xs font-bold">ZURICH_9</span>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex flex-col gap-3 pt-space-xs">
                <button 
                  id="sso-btn"
                  type="submit"
                  disabled={loading}
                  className="group w-full py-3.5 px-6 rounded-lg bg-primary-container text-on-primary font-body text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary transition-all duration-200 active:scale-[0.985] shadow-sm disabled:opacity-90 disabled:pointer-events-none"
                >
                  {loading && <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>}
                  {status === "Federated Handshake Established" && <span className="material-symbols-outlined text-lg">check_circle</span>}
                  <span>{status}</span>
                  {!loading && status === "Authenticate via Enterprise SSO" && <span className="transition-transform group-hover:translate-x-1 duration-200">→</span>}
                </button>
                <Link href="/sign-in" className="w-full py-3 px-6 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container font-body text-sm font-semibold transition-all duration-200 active:scale-[0.985] text-center border border-outline-variant/10">
                  Sign in with Corporate Password instead
                </Link>
              </div>
            </form>
            
            {/* Editorial Footer Note */}
            <div className="mt-space-lg pt-space-sm flex flex-col sm:flex-row items-center justify-between text-center gap-2 border-t border-surface-container-highest">
              <Link href="/sign-in" className="font-body text-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 group">
                <span className="transition-transform group-hover:-translate-x-0.5">←</span>
                <span>Return to Sovereign Login</span>
              </Link>
              <div className="flex items-center gap-2 text-outline">
                <span className="material-symbols-outlined text-sm">lock</span>
                <span className="font-mono text-xs font-bold">HSM Cluster v4.11</span>
              </div>
            </div>
          </div>
          
          {/* Outer Security Metadata Micro-bar */}
          <div className="w-full mt-space-md px-4 flex flex-col sm:flex-row items-center justify-between font-mono text-[10px] text-outline uppercase font-bold gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-tertiary" />
              <span>GATEWAY: NODE-04.ST-MORITZ</span>
            </div>
            <div className="flex items-center gap-4">
              <span>SESSION NONCE: 0x9AF8...2C1</span>
              <span className="hover:text-on-surface cursor-pointer transition-colors underline decoration-outline-variant">Telemetry Policy</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
