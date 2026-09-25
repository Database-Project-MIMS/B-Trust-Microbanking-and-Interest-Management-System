"use client"

import * as React from "react"
import Link from "next/link"

export default function SecurityPage() {
  const [timeoutMinutes, setTimeoutMinutes] = React.useState(15)
  const [autoRotate, setAutoRotate] = React.useState(true)
  
  const [revokedDevices, setRevokedDevices] = React.useState<Record<string, boolean>>({})

  const toggleDevice = (id: string) => {
    setRevokedDevices(prev => ({...prev, [id]: true}))
  }

  return (
    <div className="flex flex-col w-full relative">
      <div className="relative w-full overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary-fixed/20 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -left-48 w-[32rem] h-[32rem] rounded-full bg-secondary-fixed/15 blur-3xl pointer-events-none" />
        
        <div className="py-space-xl relative z-10 flex flex-col gap-space-xl">
          
          {/* Monolith Editorial Header */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg">
            <div className="max-w-3xl">
              <div className="flex items-center gap-space-xs mb-space-sm border border-outline-variant/20 bg-surface-container-low px-3 py-1 rounded-full w-fit">
                <span className="inline-block w-2 h-2 rounded-full bg-primary animate-ping" />
                <span className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider font-bold">Protocol Tier 4 Enclave • Zero Trust</span>
              </div>
              <h1 className="font-headline text-[3.5rem] text-primary tracking-tight leading-none">
                Cryptographic Security & Device Keys
              </h1>
              <p className="font-body text-lg text-on-surface-variant mt-4 max-w-2xl leading-relaxed">
                Multi-party computation (MPC) vault infrastructure protected by cold physical enclaves, post-quantum asymmetric ratchets, and verifiable biometric quorum signatures.
              </p>
            </div>
            
            <div className="flex items-center gap-space-sm bg-surface-container-low px-space-md py-space-sm rounded-xl self-start lg:self-end shadow-sm border border-outline-variant/30">
              <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary border border-outline-variant/20">
                <span className="material-symbols-outlined text-[20px]" style={{fontVariationSettings: "'FILL' 1"}}>lock</span>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase text-on-surface-variant font-bold">Attestation Heartbeat</div>
                <div className="font-mono text-xs text-primary font-bold">100.0% Verified Sync</div>
              </div>
            </div>
          </div>

          {/* Main Asymmetric Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
            
            {/* Left Column: HSM Status Card & Post-Quantum Controls (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-gutter">
              
              <div className="relative overflow-hidden rounded-xl bg-surface-container-low p-space-lg shadow-sm flex flex-col justify-between min-h-[440px] border border-outline-variant/30">
                <div className="flex items-start justify-between relative z-10">
                  <div>
                    <div className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Hardware Security Module</div>
                    <h2 className="font-headline text-2xl text-on-surface mt-1">FIPS 140-3 Level 4 Enclave</h2>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant font-mono text-[10px] font-bold border border-tertiary-fixed-dim/50 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    ACTIVE ATTESTATION
                  </span>
                </div>
                
                <div className="relative my-space-md flex flex-col md:flex-row items-center justify-between gap-space-md bg-surface-container-lowest rounded-xl p-space-md border border-outline-variant/20 z-10">
                  <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                      <circle className="text-surface-container-high" cx="60" cy="60" fill="none" r="52" stroke="currentColor" strokeWidth="4" />
                      <circle className="text-primary" cx="60" cy="60" fill="none" r="52" stroke="currentColor" strokeDasharray="326.72" strokeDashoffset="32.6" strokeLinecap="round" strokeWidth="4" />
                      <circle className="text-surface-container-high" cx="60" cy="60" fill="none" r="42" stroke="currentColor" strokeDasharray="4 6" strokeWidth="2" />
                      <circle className="text-secondary-container" cx="60" cy="60" fill="none" r="32" stroke="currentColor" strokeDasharray="201.06" strokeDashoffset="50.2" strokeLinecap="round" strokeWidth="3" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                      <span className="font-mono text-[10px] uppercase text-on-surface-variant font-bold">L-Entropy</span>
                      <span className="font-headline text-2xl text-primary font-bold mt-0.5">99.8%</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-space-xs w-full">
                    <div className="flex items-center justify-between font-mono text-[10px] uppercase text-on-surface-variant">
                      <span className="font-bold">Enclave Identity Fingerprint</span>
                      <span className="text-primary font-bold">Zk-SNARK 7.1.0</span>
                    </div>
                    <div className="font-mono text-xs bg-surface-container-low px-3 py-2 rounded-lg text-on-surface truncate border border-outline-variant/10">
                      SHA-384: 8f4e229...da19b33a270f90e
                    </div>
                    <div className="grid grid-cols-2 gap-space-xs mt-2">
                      <div className="bg-surface-container-low p-2 rounded-lg border border-outline-variant/10">
                        <div className="font-mono text-[10px] uppercase text-on-surface-variant font-bold">Physical Tamper</div>
                        <div className="font-body text-sm text-primary font-semibold">Zero Variance</div>
                      </div>
                      <div className="bg-surface-container-low p-2 rounded-lg border border-outline-variant/10">
                        <div className="font-mono text-[10px] uppercase text-on-surface-variant font-bold">Biometric Mesh</div>
                        <div className="font-body text-sm text-primary font-semibold">Tri-Facial Verified</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-sm relative z-10 border-t border-outline-variant/20">
                  <div className="flex items-center gap-space-xs text-on-surface-variant font-body text-sm">
                    <span className="material-symbols-outlined text-[18px] text-primary" style={{fontVariationSettings: "'FILL' 1"}}>verified_user</span>
                    <span>Cold HSM: Zurich Alpine Facility B4</span>
                  </div>
                  <button className="px-space-md py-space-xs rounded-full bg-primary text-on-primary font-body text-sm font-semibold hover:bg-primary-container transition-colors shadow-sm flex items-center gap-1.5 h-10">
                    <span className="material-symbols-outlined text-[16px]">refresh</span>
                    <span>Trigger Biometric Scan</span>
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-surface-container-low p-space-lg shadow-sm border border-outline-variant/30">
                <div className="flex items-start justify-between mb-space-md">
                  <div>
                    <div className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Cryptographic Lifecycle</div>
                    <h3 className="font-headline text-xl text-on-surface mt-1">Session & Ratchet Protocols</h3>
                  </div>
                  <span className="font-mono text-[10px] text-primary uppercase bg-surface-container px-2.5 py-1 rounded-full font-bold shadow-sm">Kyber-1024</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                  <div className="bg-surface-container-lowest p-space-md rounded-xl flex flex-col justify-between border border-outline-variant/20 shadow-sm">
                    <div>
                      <div className="flex items-center justify-between mb-space-xs">
                        <span className="font-body text-sm font-semibold text-on-surface">Session Auto-Revoke</span>
                        <span className="font-mono text-xs text-primary font-bold">{timeoutMinutes} min</span>
                      </div>
                      <p className="font-body text-xs text-on-surface-variant leading-normal">
                        Aggressive zero-trust purge of all ephemeral memory enclaves upon inactivity.
                      </p>
                    </div>
                    <div className="mt-space-md">
                      <input 
                        type="range" 
                        min="5" 
                        max="60" 
                        step="5" 
                        value={timeoutMinutes}
                        onChange={(e) => setTimeoutMinutes(parseInt(e.target.value))}
                        className="w-full accent-primary cursor-pointer" 
                      />
                      <div className="flex justify-between font-mono text-[10px] uppercase text-on-surface-variant mt-1">
                        <span>5m</span>
                        <span>30m</span>
                        <span>60m</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-surface-container-lowest p-space-md rounded-xl flex flex-col justify-between border border-outline-variant/20 shadow-sm">
                    <div>
                      <div className="flex items-center justify-between mb-space-xs">
                        <span className="font-body text-sm font-semibold text-on-surface">Lattice Ratchet Cycle</span>
                        <span className="font-mono text-[10px] text-secondary font-bold uppercase">72 Hours Left</span>
                      </div>
                      <p className="font-body text-xs text-on-surface-variant leading-normal">
                        Continuous asynchronous seed re-keying across all multi-signatory state partitions.
                      </p>
                    </div>
                    <div className="mt-space-md pt-space-xs flex items-center justify-between border-t border-outline-variant/10">
                      <span className="font-mono text-[10px] uppercase text-on-surface-variant font-bold">Auto-Rotation</span>
                      <button 
                        onClick={() => setAutoRotate(!autoRotate)}
                        className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${autoRotate ? 'bg-primary' : 'bg-surface-container-high'}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-surface shadow-sm transform transition-transform duration-200 ${autoRotate ? 'right-1' : 'left-1'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Authorized Devices (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-gutter">
              
              <div className="rounded-xl bg-surface-container-low p-space-lg shadow-sm flex flex-col border border-outline-variant/30">
                <div className="flex items-center justify-between mb-space-md">
                  <div>
                    <div className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">M-of-N Quorum</div>
                    <h3 className="font-headline text-xl text-on-surface mt-1">Dual-Signatory Hardware</h3>
                  </div>
                  <span className="font-mono text-xs font-semibold text-on-surface bg-surface-container px-2.5 py-1 rounded-full shadow-sm">2/3 Required</span>
                </div>
                
                <div className="flex flex-col gap-space-sm">
                  
                  <div className="bg-surface-container-lowest p-space-md rounded-xl transition-all hover:shadow-sm border border-outline-variant/20">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-space-sm">
                        <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                          <span className="material-symbols-outlined text-[22px]">laptop_mac</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-body text-sm font-bold text-on-surface">MacBook Pro Enclave T2</span>
                            <span className="font-mono text-[10px] uppercase text-primary bg-primary-fixed/40 px-1.5 py-0.5 rounded font-bold">This Node</span>
                          </div>
                          <div className="font-mono text-[10px] text-on-surface-variant mt-1">Key ID: BTR-SEC-9904</div>
                        </div>
                      </div>
                      <span className="w-2.5 h-2.5 rounded-full bg-primary mt-2 animate-pulse-dot" />
                    </div>
                    <div className="mt-space-sm pt-space-xs flex items-center justify-between text-on-surface-variant font-mono text-[10px] uppercase border-t border-outline-variant/10">
                      <span>Secure Enclave Biometric • Paired</span>
                      <span className="text-on-surface font-bold">Last Active: Now</span>
                    </div>
                  </div>

                  <div className={`bg-surface-container-lowest p-space-md rounded-xl transition-all border border-outline-variant/20 ${revokedDevices['yubi'] ? 'opacity-40 grayscale' : 'hover:shadow-sm'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-space-sm">
                        <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                          <span className="material-symbols-outlined text-[22px]">usb</span>
                        </div>
                        <div>
                          <div className="font-body text-sm font-bold text-on-surface">YubiKey 5C FIPS Dual</div>
                          <div className="font-mono text-[10px] text-on-surface-variant mt-1">Key ID: YBK-SEC-0128</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => toggleDevice('yubi')}
                        disabled={revokedDevices['yubi']}
                        className="px-2.5 py-1 rounded-md bg-surface-container-highest text-error font-mono text-[10px] uppercase hover:bg-error-container transition-colors disabled:bg-surface-container-low font-bold"
                      >
                        {revokedDevices['yubi'] ? 'REVOKED' : 'REVOKE'}
                      </button>
                    </div>
                    <div className="mt-space-sm pt-space-xs flex items-center justify-between text-on-surface-variant font-mono text-[10px] uppercase border-t border-outline-variant/10">
                      <span>FIDO2 WebAuthn Physical Pin</span>
                      <span className="text-on-surface font-bold">2h ago (Zurich)</span>
                    </div>
                  </div>

                  <div className={`bg-surface-container-lowest p-space-md rounded-xl transition-all border border-outline-variant/20 ${revokedDevices['iphone'] ? 'opacity-40 grayscale' : 'hover:shadow-sm'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-space-sm">
                        <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                          <span className="material-symbols-outlined text-[22px]">smartphone</span>
                        </div>
                        <div>
                          <div className="font-body text-sm font-bold text-on-surface">iPhone 16 Pro Max Secure Enclave</div>
                          <div className="font-mono text-[10px] text-on-surface-variant mt-1">Key ID: APL-IOS-8491</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => toggleDevice('iphone')}
                        disabled={revokedDevices['iphone']}
                        className="px-2.5 py-1 rounded-md bg-surface-container-highest text-error font-mono text-[10px] uppercase hover:bg-error-container transition-colors disabled:bg-surface-container-low font-bold"
                      >
                        {revokedDevices['iphone'] ? 'REVOKED' : 'REVOKE'}
                      </button>
                    </div>
                    <div className="mt-space-sm pt-space-xs flex items-center justify-between text-on-surface-variant font-mono text-[10px] uppercase border-t border-outline-variant/10">
                      <span>FaceID Liveness Sensor v2</span>
                      <span className="text-on-surface font-bold">Yesterday (Geneva)</span>
                    </div>
                  </div>

                </div>
                
                <button className="mt-space-md w-full py-3 rounded-xl bg-surface-container text-on-surface font-body text-sm font-semibold hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2 border border-outline-variant/20 shadow-sm">
                  <span className="material-symbols-outlined text-[18px]">add_moderator</span>
                  <span>Register New Hardware Security Key</span>
                </button>
              </div>

              <div className="relative overflow-hidden rounded-xl h-64 bg-surface-container shadow-sm group border border-outline-variant/30">
                <div className="absolute inset-0 bg-[url('https://lh3.googleusercontent.com/aida-public/AB6AXuDn0cHsPXdEfWPF-phwlOavzgccHxxdHna0YLCp5uxJ0OUlUc_dY86YN4z_yYYiwGCUoaItzoUXbUct1cKhn3mZpHwzTdaLSA59zOH3IfB-Hvg4EXxJFnC3722lQu4mOKJ7actONCMcc0_sU8HwaFw1K3TytOjUyg8G1JOcEyyu51DzeqvAChNmHOfIcvNysj8tHBvd3RA1_DslLu82ORjkhH6tsBjjea52taq4JZ6HBYzzdb8prpUg')] bg-cover bg-center transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/40 to-transparent p-space-md flex flex-col justify-end text-on-primary">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-primary-fixed font-bold">Deep Storage Custody</span>
                  <h4 className="font-headline text-xl text-on-primary mt-1">Air-Gapped Bunker Key Store</h4>
                  <p className="font-body text-sm text-on-primary-container mt-1">Multi-redundant offline shard distribution.</p>
                </div>
              </div>

            </div>
          </div>

          {/* Activity Audit Trail Section */}
          <div className="mt-space-lg">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-space-md gap-space-sm">
              <div>
                <div className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Immutable Verification Log</div>
                <h3 className="font-headline text-2xl text-on-surface mt-1">Cryptographic Audit Trail</h3>
              </div>
              <div className="flex items-center gap-space-xs font-mono text-[10px] uppercase text-on-surface-variant font-bold">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span>Tamper-Evident Merkle Tree Block #19,402,118</span>
              </div>
            </div>

            <div className="bg-surface-container-low rounded-xl overflow-hidden shadow-sm border border-outline-variant/30">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-highest text-on-surface-variant font-mono text-[10px] uppercase">
                      <th className="py-3 px-space-md">Timestamp</th>
                      <th className="py-3 px-space-md">Operation</th>
                      <th className="py-3 px-space-md">Signatory Key</th>
                      <th className="py-3 px-space-md">IP Location</th>
                      <th className="py-3 px-space-md">Attestation Proof</th>
                      <th className="py-3 px-space-md text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-highest font-body text-sm">
                    <tr className="hover:bg-surface-container transition-colors">
                      <td className="py-space-sm px-space-md font-mono text-xs text-on-surface whitespace-nowrap">10:42:19.882 UTC</td>
                      <td className="py-space-sm px-space-md">
                        <div className="font-semibold text-on-surface">Liquidity Relocation Quorum</div>
                        <div className="text-on-surface-variant text-xs">Allocation to Zurich Prime Vault</div>
                      </td>
                      <td className="py-space-sm px-space-md font-mono text-[10px]">BTR-SEC-9904</td>
                      <td className="py-space-sm px-space-md text-xs">Geneva, CH (194.230.14.88)</td>
                      <td className="py-space-sm px-space-md"><span className="font-mono text-[10px] bg-surface-container px-2 py-1 rounded text-primary border border-outline-variant/20">0x7fa2...9a12</span></td>
                      <td className="py-space-sm px-space-md text-right">
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase text-primary font-bold">
                          <span className="material-symbols-outlined text-[16px]">check_circle</span> Validated
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-surface-container transition-colors">
                      <td className="py-space-sm px-space-md font-mono text-xs text-on-surface whitespace-nowrap">08:14:02.110 UTC</td>
                      <td className="py-space-sm px-space-md">
                        <div className="font-semibold text-on-surface">Lattice Key Rotation Checkpoint</div>
                        <div className="text-on-surface-variant text-xs">Kyber-1024 Deterministic Seed Refresh</div>
                      </td>
                      <td className="py-space-sm px-space-md font-mono text-[10px]">SYSTEM-HSM-AUTO</td>
                      <td className="py-space-sm px-space-md text-xs">Zurich Bunker (Internal Enclave)</td>
                      <td className="py-space-sm px-space-md"><span className="font-mono text-[10px] bg-surface-container px-2 py-1 rounded text-primary border border-outline-variant/20">0x3eb1...cc48</span></td>
                      <td className="py-space-sm px-space-md text-right">
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase text-primary font-bold">
                          <span className="material-symbols-outlined text-[16px]">check_circle</span> Validated
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-surface-container transition-colors">
                      <td className="py-space-sm px-space-md font-mono text-xs text-on-surface whitespace-nowrap">Yesterday, 22:50 UTC</td>
                      <td className="py-space-sm px-space-md">
                        <div className="font-semibold text-on-surface">Hardware Key Pairing</div>
                        <div className="text-on-surface-variant text-xs">YubiKey 5C FIPS enrollment</div>
                      </td>
                      <td className="py-space-sm px-space-md font-mono text-[10px]">YBK-SEC-0128</td>
                      <td className="py-space-sm px-space-md text-xs">London, UK (82.165.197.1)</td>
                      <td className="py-space-sm px-space-md"><span className="font-mono text-[10px] bg-surface-container px-2 py-1 rounded text-primary border border-outline-variant/20">0x11bb...5501</span></td>
                      <td className="py-space-sm px-space-md text-right">
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase text-primary font-bold">
                          <span className="material-symbols-outlined text-[16px]">check_circle</span> Validated
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="p-space-md bg-surface-container flex flex-col sm:flex-row items-center justify-between gap-space-sm font-mono text-[10px] text-on-surface-variant border-t border-outline-variant/20">
                <span className="font-bold">Cryptographic Proof: All state transitions committed to immutable cold ledger.</span>
                <button className="px-space-md py-2 rounded-full bg-surface-container-lowest text-primary font-bold hover:bg-surface hover:text-on-surface transition-colors shadow-sm">
                  Export Signed Verification Bundle (.sig)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
