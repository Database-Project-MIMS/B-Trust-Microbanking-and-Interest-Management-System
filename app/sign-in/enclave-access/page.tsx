"use client"

import * as React from "react"
import Link from "next/link"

export default function EnclaveAccessPage() {
  const [isAuthenticating, setIsAuthenticating] = React.useState(false)
  const [isAuthenticated, setIsAuthenticated] = React.useState(false)
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [recoveryCode, setRecoveryCode] = React.useState("")
  const [recoveryVerified, setRecoveryVerified] = React.useState(false)

  const triggerSuccess = () => {
    setIsAuthenticated(true)
    setIsAuthenticating(false)
    setTimeout(() => {
      window.location.href = "/dashboard"
    }, 1500)
  }

  const startAuthFlow = () => {
    if (isAuthenticating || isAuthenticated) return
    setIsAuthenticating(true)
    setTimeout(() => {
      triggerSuccess()
    }, 1200)
  }

  const handleRecoveryInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    let formatted = ''
    for (let i = 0; i < val.length; i++) {
      if (i > 0 && i % 4 === 0) formatted += '-'
      formatted += val[i]
    }
    setRecoveryCode(formatted)
  }

  const verifyRecovery = () => {
    if (recoveryCode.length >= 10) {
      setRecoveryVerified(true)
      setTimeout(() => {
        triggerSuccess()
      }, 400)
    }
  }

  return (
    <main className="w-full min-h-screen bg-surface flex flex-col justify-center selection:bg-primary-fixed selection:text-on-primary-fixed">
      <div className="flex flex-col w-full items-center justify-center p-4 md:p-12 relative">
        <div className="absolute w-[680px] h-[680px] rounded-full bg-gradient-to-tr from-primary-fixed-dim/20 via-tertiary-fixed/15 to-transparent blur-3xl pointer-events-none -z-10 -translate-y-[5%]" />
        
        <div className="w-full max-w-[1040px] flex flex-col items-center">
          
          <div className="w-full flex items-center justify-between mb-8 md:mb-12 px-2">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse-dot" />
              <span className="font-mono text-[10px] uppercase text-on-surface-variant tracking-widest font-bold">ENCLAVE SECURE LAYER 4.9</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono text-xs text-outline font-medium">SESSION ID // 0x8892•44B</span>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-mono text-[10px] uppercase font-bold">
                <span className="material-symbols-outlined text-[14px]">shield_lock</span>
                <span>FIPS 140-3 LEVEL 4</span>
              </div>
            </div>
          </div>
          
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-5 flex flex-col justify-between p-8 md:p-10 rounded-xl bg-surface-container-low shadow-sm relative overflow-hidden border border-outline-variant/20">
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full bg-tertiary-fixed text-tertiary font-mono text-[10px] uppercase font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  ZERO-KNOWLEDGE AUTH
                </div>
                <h1 className="font-headline text-[3rem] text-on-surface tracking-tight leading-none mb-4">
                  Sovereign Enclave Access
                </h1>
                <p className="font-body text-md text-on-surface-variant max-w-sm mb-8 leading-relaxed">
                  Touch or present credential to attest ownership of private root telemetry. Ambient zero-knowledge handshakes resolve in enclave memory.
                </p>
                
                <div className="space-y-4 mb-8">
                  <div className="p-4 rounded-lg bg-surface-container flex items-center justify-between transition-all hover:bg-surface-container-high border border-outline-variant/10">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm border border-outline-variant/10">
                        <span className="material-symbols-outlined text-[20px]">fingerprint</span>
                      </div>
                      <div>
                        <div className="font-body text-sm font-semibold text-on-surface">WebAuthn PRF Core</div>
                        <div className="font-mono text-xs text-outline font-medium">ED25519-SK • Hardware bound</div>
                      </div>
                    </div>
                    <span className={`font-mono text-[10px] uppercase px-2.5 py-1 rounded-full font-bold ${isAuthenticated ? 'bg-primary text-on-primary' : 'bg-primary-fixed text-primary'}`}>
                      {isAuthenticated ? 'AUTHENTICATED' : 'READY'}
                    </span>
                  </div>
                  <div className="p-4 rounded-lg bg-surface-container flex items-center justify-between transition-all hover:bg-surface-container-high border border-outline-variant/10">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm border border-outline-variant/10">
                        <span className="material-symbols-outlined text-[20px]">vpn_key</span>
                      </div>
                      <div>
                        <div className="font-body text-sm font-semibold text-on-surface">Secure Element Token</div>
                        <div className="font-mono text-xs text-outline font-medium">Apple T2 / YubiHSM 2 sync</div>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] uppercase px-2.5 py-1 rounded-full bg-surface-container-highest text-on-surface-variant font-bold">
                      PAIRED
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="relative z-10 pt-6 flex items-center justify-between border-t border-surface-container-highest">
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] uppercase text-outline font-bold">Institutional Vault</span>
                  <span className="font-mono text-sm text-on-surface font-medium">B-TRUST CUSTODIAL #09</span>
                </div>
                <div className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-[18px]">verified_user</span>
                </div>
              </div>
              
              <div className="absolute -right-12 -bottom-12 w-64 h-64 opacity-5 pointer-events-none text-primary">
                <svg fill="none" stroke="currentColor" strokeWidth="0.75" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" strokeDasharray="2 3" />
                  <circle cx="50" cy="50" r="32" />
                  <circle cx="50" cy="50" r="18" />
                  <line x1="50" x2="50" y1="5" y2="95" />
                  <line x1="5" x2="95" y1="50" y2="50" />
                </svg>
              </div>
            </div>
            
            <div className="lg:col-span-7 flex flex-col justify-between p-8 md:p-12 rounded-xl bg-surface-container-lowest shadow-md relative border border-outline-variant/30">
              
              <div className="w-full flex items-center justify-between pb-6 border-b border-surface-container-highest">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${isAuthenticated ? 'bg-primary' : 'bg-primary-container'} ${isAuthenticating ? 'animate-ping' : ''}`} />
                  <span className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider font-bold">
                    {isAuthenticated ? 'Sovereign Enclave Unlocked' : 'Awaiting Touch Attestation'}
                  </span>
                </div>
                <div className="flex items-center gap-1 font-mono text-xs text-outline font-medium">
                  <span>ENTROPY:</span>
                  <span className="text-primary font-bold">99.98%</span>
                </div>
              </div>
              
              <div className="relative py-12 flex flex-col items-center justify-center">
                <div className="relative w-64 h-64 md:w-72 md:h-72 flex items-center justify-center">
                  <div className={`absolute inset-0 rounded-full bg-primary-fixed-dim/20 pointer-events-none transition-all duration-1000 ease-out ${isAuthenticating ? 'scale-110' : ''} ${isAuthenticated ? 'scale-125 opacity-0' : 'scale-100'}`} />
                  <div className={`absolute inset-4 rounded-full bg-tertiary-fixed/30 pointer-events-none transition-all duration-700 ease-out ${isAuthenticating ? 'scale-105' : ''} ${isAuthenticated ? 'scale-110 opacity-50' : 'scale-100'}`} />
                  <div className={`absolute inset-8 rounded-full bg-surface-container-low scale-100 transition-all duration-500 ease-out pointer-events-none`} />
                  
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 288 288">
                    <circle className="text-surface-container-high" cx="144" cy="144" fill="none" r="138" stroke="currentColor" strokeWidth="1.5" />
                    <circle 
                      className="text-primary transition-all duration-700" 
                      cx="144" cy="144" fill="none" r="138" 
                      stroke="currentColor" 
                      strokeDasharray="867" 
                      strokeDashoffset={isAuthenticating ? '0' : (isAuthenticated ? '0' : '867')} 
                      strokeLinecap="round" strokeWidth="2.5" 
                    />
                  </svg>
                  
                  <button 
                    onClick={startAuthFlow}
                    className="relative group z-20 w-40 h-40 md:w-44 md:h-44 rounded-full bg-surface-container-low hover:bg-surface-container transition-all duration-300 flex flex-col items-center justify-center cursor-pointer shadow-sm active:scale-95 border border-outline-variant/10"
                  >
                    <div className="w-24 h-24 rounded-full bg-surface-container-lowest flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-105">
                      <span className={`material-symbols-outlined text-[48px] select-none transition-colors ${isAuthenticated ? 'text-primary-container' : 'text-primary'}`} style={isAuthenticated ? {fontVariationSettings: "'FILL' 1"} : {}}>
                        {isAuthenticated ? 'check_circle' : 'fingerprint'}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-on-surface-variant uppercase mt-3 tracking-widest font-bold">
                      {isAuthenticated ? 'VERIFIED' : (isAuthenticating ? 'SCANNING...' : 'TAP SENSOR')}
                    </span>
                  </button>
                </div>
                
                <div className="text-center mt-6 h-6">
                  <span className={`font-body text-sm transition-opacity ${isAuthenticated ? 'text-primary font-medium' : 'text-on-surface-variant'}`}>
                    {isAuthenticated 
                      ? 'Cryptographic attestation successful. Rerouting to enclave balance...'
                      : (isAuthenticating ? 'Hold finger still. Negotiating zero-knowledge proof...' : 'Touch sensor or insert YubiKey / Security Key')
                    }
                  </span>
                </div>
              </div>
              
              <div className="w-full pt-8 flex flex-col gap-4 border-t border-surface-container-highest">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button onClick={startAuthFlow} className="flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-lg bg-primary text-on-primary font-body text-md hover:opacity-95 transition-all shadow-sm active:scale-[0.985]">
                    <span className="material-symbols-outlined text-[18px]">key</span>
                    <span className="font-semibold">Hardware Passkey</span>
                  </button>
                  <Link href="/sign-in/sso" className="flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-lg bg-surface-container text-on-surface font-body text-md hover:bg-surface-container-high transition-all active:scale-[0.985]">
                    <span className="material-symbols-outlined text-[18px]">domain_verification</span>
                    <span className="font-semibold">Institutional SSO</span>
                  </Link>
                </div>
                
                <div className="w-full pt-2">
                  <button 
                    onClick={() => setDrawerOpen(!drawerOpen)}
                    className="w-full py-2.5 px-4 rounded-lg bg-transparent hover:bg-surface-container-low transition-colors flex items-center justify-center gap-2 text-on-surface-variant font-mono text-[10px] uppercase font-bold"
                  >
                    <span className="material-symbols-outlined text-[16px]">lock_reset</span>
                    <span>Use Encrypted Corporate Recovery Code</span>
                    <span className={`material-symbols-outlined text-[16px] transition-transform duration-200 ${drawerOpen ? 'rotate-180' : ''}`}>expand_more</span>
                  </button>
                  
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${drawerOpen ? 'max-h-[280px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="mt-4 p-5 rounded-lg bg-surface-container-low space-y-4 border border-outline-variant/10">
                      <div className="flex items-center justify-between">
                        <label className="font-mono text-[10px] uppercase text-on-surface-variant font-bold">Emergency Dual-Custody Code</label>
                        <span className="font-mono text-xs text-outline font-medium">SHAMIR SHARES (3 OF 5)</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs text-outline font-medium">RC-</span>
                          <input 
                            type="text" 
                            maxLength={19}
                            value={recoveryCode}
                            onChange={handleRecoveryInput}
                            placeholder="XXXX-XXXX-XXXX-XXXX" 
                            className="w-full pl-10 pr-4 py-3 rounded-lg bg-surface-container-lowest text-on-surface font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm border border-transparent focus:border-primary/30 uppercase"
                          />
                        </div>
                        <button 
                          onClick={verifyRecovery}
                          className={`px-5 py-3 rounded-lg font-body text-sm font-semibold transition-all ${recoveryVerified ? 'bg-primary text-on-primary' : 'bg-surface-container-highest hover:bg-surface-dim text-on-surface'}`}
                        >
                          {recoveryVerified ? 'Verified' : 'Verify'}
                        </button>
                      </div>
                      <p className="font-body text-sm text-outline">
                        Attestation requires cryptographic endorsement from at least two delegated institutional officers.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
            </div>
          </div>
          
          <div className="w-full mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 px-3 text-outline font-mono text-xs font-medium">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px]">terminal</span>
              <span>ATTESTATION // HARDENED RISC-V SEED VALIDATOR</span>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <span>LATENCY: 18MS</span>
              <span>REGION: ZRH-CH (SWISS ALPS VAULT)</span>
              <a href="#" className="hover:text-primary transition-colors flex items-center gap-1 font-body text-sm">
                <span>Security Ledger</span>
                <span className="material-symbols-outlined text-[14px]">arrow_outward</span>
              </a>
            </div>
          </div>
          
        </div>
      </div>
    </main>
  )
}
