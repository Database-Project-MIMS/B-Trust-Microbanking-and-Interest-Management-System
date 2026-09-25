"use client"

import * as React from "react"
import Link from "next/link"

export default function MFAPage() {
  const [activeTab, setActiveTab] = React.useState<'webauthn' | 'totp'>('webauthn')
  const [isScanning, setIsScanning] = React.useState(false)
  const [attestationStatus, setAttestationStatus] = React.useState<{message: string, success: boolean}>({
    message: "Awaiting touch attestation... Entropy: 99.98%",
    success: false
  })
  
  const [otp, setOtp] = React.useState(['', '', '', '', '', ''])
  const otpRefs = [
    React.useRef<HTMLInputElement>(null),
    React.useRef<HTMLInputElement>(null),
    React.useRef<HTMLInputElement>(null),
    React.useRef<HTMLInputElement>(null),
    React.useRef<HTMLInputElement>(null),
    React.useRef<HTMLInputElement>(null),
  ]

  const [secondsLeft, setSecondsLeft] = React.useState(24)

  React.useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft(prev => prev > 0 ? prev - 1 : 30)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const triggerAttestation = () => {
    if (isScanning) return
    setIsScanning(true)
    setAttestationStatus({ message: "Negotiating cryptographic handshake...", success: false })

    setTimeout(() => {
      setAttestationStatus({ message: "Signature Verified: Ed25519-Signed (Hash: 0x98f..2a)", success: true })
      setIsScanning(false)
      setTimeout(() => {
        window.location.href = "/sign-in/hardware"
      }, 500)
    }, 1600)
  }

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    
    if (value && index < 5) {
      otpRefs[index + 1]?.current?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1]?.current?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const data = e.clipboardData.getData('text').trim()
    if (/^\d+$/.test(data)) {
      const chars = data.slice(0, 6).split('')
      const newOtp = [...otp]
      chars.forEach((c, idx) => {
        if (idx < 6) newOtp[idx] = c
      })
      setOtp(newOtp)
      const nextIdx = Math.min(chars.length, 5)
      otpRefs[nextIdx]?.current?.focus()
    }
  }

  return (
    <main className="w-full min-h-screen flex flex-col bg-surface selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
        <div className="h-20 max-w-[1360px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop flex items-center justify-between">
          <div className="flex items-center gap-space-md">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary text-[20px]">account_balance</span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline text-lg tracking-tight text-primary font-semibold leading-none">B-Trust</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/80 font-bold">Spatial Banking</span>
            </div>
          </div>
          <div className="flex items-center gap-space-md">
            <div className="hidden sm:flex items-center gap-space-xs px-space-sm py-1 bg-surface-container rounded-full text-on-surface-variant">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-dot" />
            </div>
            <a href="#" className="font-body text-sm text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1.5 px-space-sm py-space-xs">
              <span className="material-symbols-outlined text-[18px]">help_outline</span>
              <span>Help & Support</span>
            </a>
          </div>
        </div>
      </header>

      <div className="flex flex-col w-full flex-1 pt-20">
        <div className="relative w-full overflow-hidden flex-1 flex flex-col items-center">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-gradient-to-b from-primary-fixed-dim/20 via-surface-container-low/40 to-transparent rounded-full blur-3xl pointer-events-none" />
          
          <div className="max-w-[1360px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop pt-8 pb-16 relative z-10 flex flex-col items-center w-full">
            
            <div className="flex flex-col items-center text-center max-w-3xl mb-10">
              <h1 className="font-headline text-[3rem] text-primary tracking-tight mb-3">
                Dual-Key Attestation
              </h1>
              <p className="font-body text-lg text-on-surface-variant max-w-xl text-center leading-relaxed">
                Session handshake requires secondary cryptographic signature for institutional identity verification.
              </p>
            </div>

            <div className="w-full max-w-2xl bg-surface-container-lowest rounded-xl p-6 md:p-10 shadow-2xl border border-outline-variant/30 relative flex flex-col">
              
              {/* Tabs */}
              <div className="flex items-center justify-between p-1 bg-surface-container rounded-lg mb-8">
                <button 
                  onClick={() => setActiveTab('webauthn')}
                  className={`flex-1 py-2.5 px-4 rounded-md font-body text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'webauthn' ? 'bg-primary-container text-on-primary font-semibold shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  <span className="material-symbols-outlined text-[18px]">fingerprint</span>
                  <span>Hardware Passkey / WebAuthn</span>
                </button>
                <button 
                  onClick={() => setActiveTab('totp')}
                  className={`flex-1 py-2.5 px-4 rounded-md font-body text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'totp' ? 'bg-primary-container text-on-primary font-semibold shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  <span className="material-symbols-outlined text-[18px]">key</span>
                  <span>Time-Based Token (TOTP)</span>
                </button>
              </div>

              {/* WebAuthn Panel */}
              {activeTab === 'webauthn' && (
                <div className="flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300">
                  <div className="relative w-64 h-64 flex items-center justify-center my-4 select-none cursor-pointer group" onClick={triggerAttestation}>
                    <svg className="absolute inset-0 w-full h-full text-primary" fill="none" viewBox="0 0 240 240">
                      <circle className="text-outline-variant/40 animate-[spin_60s_linear_infinite]" cx="120" cy="120" r="110" stroke="currentColor" strokeDasharray="4 6" strokeWidth="1" />
                      <circle className="text-primary-fixed-dim/60" cx="120" cy="120" r="88" stroke="currentColor" strokeWidth="1.2" />
                      <circle className="text-primary-container/30 animate-[spin_25s_linear_infinite_reverse]" cx="120" cy="120" r="68" stroke="currentColor" strokeDasharray="6 8" strokeWidth="1.5" />
                      <circle className={`text-primary-fixed transition-all duration-700 ${isScanning ? 'stroke-primary scale-110' : ''}`} cx="120" cy="120" r="48" stroke="currentColor" strokeWidth="2" style={{transformOrigin: 'center'}} />
                      <line className="text-outline-variant/30" stroke="currentColor" strokeWidth="0.5" x1="120" x2="120" y1="10" y2="230" />
                      <line className="text-outline-variant/30" stroke="currentColor" strokeWidth="0.5" x1="10" x2="230" y1="120" y2="120" />
                    </svg>
                    <div className="relative z-10 w-24 h-24 rounded-full bg-surface-container flex flex-col items-center justify-center shadow-inner group-hover:bg-primary-fixed/30 transition-all duration-300">
                      <span className={`material-symbols-outlined text-[42px] transition-transform duration-300 group-hover:scale-110 ${attestationStatus.success ? 'text-primary' : (isScanning ? 'text-secondary' : 'text-primary')}`}>
                        {attestationStatus.success ? 'verified' : 'fingerprint'}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-wider text-primary font-bold mt-1">YubiKey / Bio</span>
                    </div>
                    <div className={`absolute w-32 h-32 rounded-full bg-primary-fixed/20 blur-xl transition-opacity duration-500 pointer-events-none ${isScanning ? 'opacity-100' : 'opacity-0'}`} />
                  </div>
                  
                  <div className="mt-2 mb-6 flex flex-col items-center">
                    <h3 className="font-headline text-xl text-on-surface mb-1">Touch security key or biometric sensor</h3>
                    <p className="font-mono text-xs text-on-surface-variant flex items-center gap-1.5">
                      {attestationStatus.success ? (
                        <span className="material-symbols-outlined text-[16px] text-primary">check_circle</span>
                      ) : (
                        <span className={`w-1.5 h-1.5 rounded-full ${isScanning ? 'bg-secondary animate-ping' : 'bg-primary animate-pulse-dot'}`} />
                      )}
                      {attestationStatus.message}
                    </p>
                  </div>
                  
                  <div className="w-full flex flex-col sm:flex-row items-center gap-3">
                    <button onClick={triggerAttestation} className="w-full sm:flex-1 py-3 px-6 bg-primary-container hover:bg-primary text-on-primary font-body text-sm font-semibold rounded-lg transition-all shadow-sm active:scale-[0.985] flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[20px]">sensors</span>
                      <span>Trigger Biometric Prompt</span>
                    </button>
                    <button onClick={() => {
                      setAttestationStatus({ message: "Hardware Key Interrogated: YubiKey 5C NFC found on Enclave bus.", success: false })
                      triggerAttestation()
                    }} className="w-full sm:w-auto py-3 px-5 bg-surface-container hover:bg-surface-container-high text-on-surface font-body text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm border border-outline-variant/10">
                      <span className="material-symbols-outlined text-[18px]">usb</span>
                      <span>Detect FIDO2 NFC/USB</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TOTP Panel */}
              {activeTab === 'totp' && (
                <div className="flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300">
                  <div className="my-4 w-full flex flex-col items-center">
                    <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center mb-4 border border-outline-variant/20">
                      <span className="material-symbols-outlined text-primary text-[28px]">timer</span>
                    </div>
                    <h3 className="font-headline text-xl text-on-surface mb-1">Enter Institutional Authenticator Code</h3>
                    <p className="font-body text-sm text-on-surface-variant max-w-sm mb-6">
                      Input the 6-digit sync sequence from your enterprise hardware enclave or B-Trust Mobile Vault.
                    </p>
                    
                    <div className="flex items-center gap-2 sm:gap-3 mb-6">
                      {[0,1,2].map(i => (
                        <input 
                          key={i}
                          ref={otpRefs[i]}
                          value={otp[i]}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(i, e)}
                          onPaste={handleOtpPaste}
                          maxLength={1}
                          inputMode="numeric"
                          className="w-11 h-14 sm:w-12 sm:h-16 text-center font-mono text-2xl text-primary bg-surface-container rounded-lg focus:bg-surface-container-lowest focus:outline-none shadow-sm transition-all focus:shadow-[0_0_0_2px_#2e5c50] border border-outline-variant/20"
                        />
                      ))}
                      <span className="text-outline-variant font-headline text-xl">-</span>
                      {[3,4,5].map(i => (
                        <input 
                          key={i}
                          ref={otpRefs[i]}
                          value={otp[i]}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(i, e)}
                          onPaste={handleOtpPaste}
                          maxLength={1}
                          inputMode="numeric"
                          className="w-11 h-14 sm:w-12 sm:h-16 text-center font-mono text-2xl text-primary bg-surface-container rounded-lg focus:bg-surface-container-lowest focus:outline-none shadow-sm transition-all focus:shadow-[0_0_0_2px_#2e5c50] border border-outline-variant/20"
                        />
                      ))}
                    </div>
                    
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-3.5 h-3.5 rounded-full bg-surface-container-high relative flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 24 24">
                          <circle className="text-surface-container-high fill-none" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                          <circle 
                            className="text-secondary fill-none transition-all duration-1000" 
                            cx="12" cy="12" r="10" 
                            stroke="currentColor" 
                            strokeDasharray={2 * Math.PI * 10} 
                            strokeDashoffset={2 * Math.PI * 10 - (secondsLeft / 30) * (2 * Math.PI * 10)} 
                            strokeWidth="2.5" 
                          />
                        </svg>
                      </div>
                      <span className="font-mono text-xs text-on-surface-variant">Code refreshes in {secondsLeft}s</span>
                    </div>
                    
                    <button 
                      onClick={() => {
                        if (otp.join('').length === 6) {
                          window.location.href = "/sign-in/hardware"
                        } else {
                          alert('Please provide the full 6-digit cryptographic TOTP token.')
                        }
                      }}
                      className="w-full py-3 px-6 bg-primary-container hover:bg-primary text-on-primary font-body text-sm font-semibold rounded-lg transition-all shadow-sm active:scale-[0.985] mb-4"
                    >
                      Authorize Ledger Entry
                    </button>
                    <button className="font-body text-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5" onClick={(e) => {
                      const btn = e.currentTarget
                      const prevHtml = btn.innerHTML
                      btn.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-spin">sync</span> Dispatching SMS & Enclave notification...'
                      setTimeout(() => {
                        btn.innerHTML = '<span class="material-symbols-outlined text-[16px] text-primary">done_all</span> Payload re-sent to trusted device (+41 ** *** 8920)'
                        setTimeout(() => btn.innerHTML = prevHtml, 3000)
                      }, 1200)
                    }}>
                      <span className="material-symbols-outlined text-[16px]">forward_to_inbox</span>
                      <span>Resend authorization payload via encrypted SMS / Email</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-8 pt-6 flex flex-col items-center gap-4 bg-surface-container-low/50 rounded-lg p-4 border border-outline-variant/10">
                <div className="flex items-center justify-between w-full flex-wrap gap-2 text-on-surface-variant">
                  <span className="font-mono text-[10px] uppercase font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-tertiary">vpn_lock</span>
                    ECDSA-P384 SHIELDED
                  </span>
                  <button onClick={() => alert('Corporate recovery workflow initiated: Emergency FinSA ledger unlock dispatched to board compliance officers.')} className="font-body text-sm text-secondary hover:text-secondary-container transition-colors font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">key_off</span>
                    <span>Use Encrypted Corporate Recovery Code</span>
                  </button>
                </div>
              </div>

            </div>

            <div className="w-full max-w-2xl mt-4 flex items-center justify-center">
              <Link href="/sign-in" className="font-body text-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2 py-2 px-4 rounded-lg hover:bg-surface-container">
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                <span>Back to Sovereign Login</span>
              </Link>
            </div>

            <div className="w-full max-w-2xl mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-surface-container-low flex flex-col gap-1 border border-outline-variant/20 shadow-sm">
                <div className="flex items-center gap-2 text-primary font-body text-sm font-semibold">
                  <span className="material-symbols-outlined text-[18px]">security</span>
                  Hardware Binding
                </div>
                <p className="font-body text-sm text-on-surface-variant/80">Secured via cryptographic Secure Enclave chip pair on current device.</p>
              </div>
              <div className="p-4 rounded-lg bg-surface-container-low flex flex-col gap-1 border border-outline-variant/20 shadow-sm">
                <div className="flex items-center gap-2 text-primary font-body text-sm font-semibold">
                  <span className="material-symbols-outlined text-[18px]">encrypted</span>
                  Post-Quantum Ready
                </div>
                <p className="font-body text-sm text-on-surface-variant/80">NIST Kyber-768 hybrid key encapsulation enabled on live stream.</p>
              </div>
              <div className="p-4 rounded-lg bg-surface-container-low flex flex-col gap-1 border border-outline-variant/20 shadow-sm">
                <div className="flex items-center gap-2 text-primary font-body text-sm font-semibold">
                  <span className="material-symbols-outlined text-[18px]">verified_user</span>
                  FINMA Audited
                </div>
                <p className="font-body text-sm text-on-surface-variant/80">Multi-signature authorization complies with Swiss Capital Rules 2024.</p>
              </div>
            </div>

          </div>
        </div>
      </div>

      <footer className="w-full bg-surface-container-low border-t border-outline-variant/20 mt-auto z-10">
        <div className="max-w-[1360px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop py-space-lg">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md pb-space-md">
            <div className="flex flex-wrap items-center gap-space-md">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-primary text-[16px]">lock</span>
                <span className="font-mono text-[10px] uppercase font-bold text-on-surface-variant">SHA-256 LEDGER SEALED</span>
              </div>
              <span className="hidden sm:inline text-outline-variant">•</span>
              <span className="font-mono text-[10px] font-bold text-on-surface-variant">BLOCK #914,204</span>
              <span className="hidden sm:inline text-outline-variant">•</span>
              <span className="font-mono text-[10px] uppercase font-bold text-on-surface-variant">SWISS FINMA COMPLIANT // BASEL III FRAMEWORK</span>
            </div>
            <div className="flex items-center gap-space-sm">
              <span className="w-2 h-2 rounded-full bg-tertiary-container" />
              <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">CBSL TIER-1 CUSTODY STATUS: OPERATIONAL</span>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-space-sm text-on-surface-variant pt-space-md border-t border-outline-variant/20">
            <p className="font-body text-xs max-w-4xl text-on-surface-variant/90 leading-relaxed">
              B-Trust (Switzerland) AG is authorized and regulated by the Swiss Financial Market Supervisory Authority (FINMA) as a tier-1 banking institution and securities firm. Spatial custody nodes are operated under strict multi-jurisdictional enclave attestation. All cryptographic transaction manifests are permanently archived across verified Swiss alpine data sanctuaries.
            </p>
            <div className="flex items-center gap-space-md shrink-0 font-mono text-[10px] uppercase font-bold text-on-surface-variant">
              <span className="hover:text-on-surface transition-colors cursor-pointer">PRIVACY DIRECTIVE</span>
              <span className="hover:text-on-surface transition-colors cursor-pointer">SECURITY DISCLOSURES</span>
              <span>© 2025 B-TRUST</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
