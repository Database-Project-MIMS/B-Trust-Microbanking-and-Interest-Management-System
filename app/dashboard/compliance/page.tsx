"use client"

import * as React from "react"
import Link from "next/link"

export default function CompliancePage() {
  const [filter, setFilter] = React.useState('all')
  
  const [certModal, setCertModal] = React.useState<{
    id: string;
    asset: string;
    taxAmount: string;
    hash: string;
  } | null>(null)

  const [verificationResult, setVerificationResult] = React.useState<{input: string, time: string} | null>(null)
  const [verifying, setVerifying] = React.useState(false)
  const [hashInput, setHashInput] = React.useState('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')

  const verifyHash = () => {
    if (!hashInput.trim()) return
    setVerifying(true)
    setTimeout(() => {
      setVerificationResult({ input: hashInput, time: new Date().toISOString() })
      setVerifying(false)
    }, 400)
  }

  const ledgerData = [
    {
      cat: 'yield',
      icon: 'account_balance_wallet',
      title: 'T-Bill Repo Ser. 4928-CBSL',
      dateInfo: '24 FEB 2025 • IRD-TX-84920',
      gross: 'LKR 12,450,000.00',
      wht: '-LKR 622,500.00',
      net: 'LKR 11,827,500.00',
      certId: 'CERT-2025-02-84920',
      hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    },
    {
      cat: 'custody',
      icon: 'savings',
      title: 'Prime Liquidity Vault Q1',
      dateInfo: '15 FEB 2025 • IRD-TX-84711',
      gross: 'LKR 8,910,200.00',
      wht: '-LKR 445,510.00',
      net: 'LKR 8,464,690.00',
      certId: 'CERT-2025-02-84711',
      hash: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb'
    },
    {
      cat: 'fx',
      icon: 'currency_exchange',
      title: 'USD/LKR Cross Arbitrage Desk',
      dateInfo: '02 FEB 2025 • IRD-TX-83901',
      gross: 'LKR 21,500,000.00',
      wht: '-LKR 1,075,000.00',
      net: 'LKR 20,425,000.00',
      certId: 'CERT-2025-02-83901',
      hash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a'
    },
    {
      cat: 'yield',
      icon: 'account_balance_wallet',
      title: 'Sovereign Bond Allocation 2029',
      dateInfo: '18 JAN 2025 • IRD-TX-82904',
      gross: 'LKR 16,800,000.00',
      wht: '-LKR 840,000.00',
      net: 'LKR 15,960,000.00',
      certId: 'CERT-2025-01-82904',
      hash: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d'
    }
  ]

  const filteredLedger = filter === 'all' ? ledgerData : ledgerData.filter(x => x.cat === filter)

  return (
    <div className="flex flex-col w-full relative">
      <div className="py-space-md flex flex-col gap-space-xl">
        
        {/* Top Meta Ledger Line & Atmospheric Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-gutter pb-space-lg">
          <div className="flex flex-col gap-space-xs max-w-2xl">
            <div className="flex items-center gap-space-xs">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse-dot" />
              <span className="font-mono text-label-caps uppercase tracking-widest text-primary font-bold">CBSL Statutory Registry • Fiscal Year 2024/25</span>
            </div>
            <h1 className="font-headline text-[3rem] text-primary tracking-tight mt-1">Central Bank Stewardship & Tax Governance</h1>
            <p className="font-body text-body-lg text-on-surface-variant leading-relaxed">
              Verifiable institutional custody, autonomous withholding tax settlement, and cryptographic solvency archives under Central Bank of Sri Lanka (CBSL) oversight.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-space-xs mt-4 lg:mt-0">
            <div className="flex items-center gap-space-xs bg-surface-container-low px-4 py-2 rounded-full shadow-sm border border-outline-variant/20">
              <span className="material-symbols-outlined text-primary text-[18px]">verified_user</span>
              <span className="font-mono text-[10px] uppercase text-on-surface tracking-wider font-bold">IRD RAMIS Linked</span>
            </div>
            <div className="flex items-center gap-space-xs bg-surface-container-low px-4 py-2 rounded-full shadow-sm border border-outline-variant/20">
              <span className="material-symbols-outlined text-primary text-[18px]">token</span>
              <span className="font-mono text-[10px] uppercase text-on-surface tracking-wider font-bold">SHA-256 Validated</span>
            </div>
            <div className="flex items-center gap-space-xs bg-primary-fixed text-on-primary-fixed px-4 py-2 rounded-full shadow-sm font-mono text-[10px] font-bold tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              TIER-1 BASEL III OPTIMAL
            </div>
          </div>
        </div>

        {/* Architectural Bento Grid: Pillar Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
          
          {/* Card 1: CBSL Tier-1 Capital Adequacy Status Meter (7 cols) */}
          <div className="md:col-span-7 bg-surface-container-low rounded-xl p-space-lg shadow-sm flex flex-col justify-between relative overflow-hidden group border border-outline-variant/30">
            <div className="absolute -right-16 -top-16 w-64 h-64 bg-primary-fixed/20 rounded-full blur-3xl pointer-events-none" />
            <div>
              <div className="flex items-center justify-between gap-space-sm mb-space-md relative z-10">
                <div>
                  <span className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider">Statutory Capital Adequacy Ratio (CAR)</span>
                  <h2 className="font-headline text-2xl text-primary mt-1">Tier-1 Capital Resilience</h2>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs text-primary font-bold block">BASEL III REQUIREMENT: 12.5%</span>
                  <p className="font-mono text-[10px] text-on-surface-variant">AUDITED Q4 2024</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-gutter items-center my-space-md relative z-10">
                <div className="sm:col-span-5 flex flex-col items-center justify-center relative">
                  <svg className="w-44 h-44 -rotate-90 transform" viewBox="0 0 120 120">
                    <circle className="stroke-surface-container-highest" cx="60" cy="60" fill="none" r="50" strokeDasharray="314.16" strokeDashoffset="0" strokeWidth="8" />
                    <circle className="stroke-primary" cx="60" cy="60" fill="none" r="50" strokeDasharray="314.16" strokeDashoffset="65" strokeLinecap="round" strokeWidth="9" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="font-headline text-[2.5rem] text-primary leading-none">18.4<span className="text-xl">%</span></span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant mt-1">Solvency Tier</span>
                  </div>
                </div>
                
                <div className="sm:col-span-7 flex flex-col gap-space-sm">
                  <div className="bg-surface p-4 rounded-lg shadow-sm flex items-center justify-between border border-outline-variant/10">
                    <div>
                      <p className="font-mono text-[10px] uppercase text-on-surface-variant">Core Tier 1 Equity Buffer</p>
                      <p className="font-headline text-lg text-on-surface font-semibold mt-0.5">+590 bps surplus</p>
                    </div>
                    <span className="material-symbols-outlined text-primary text-[28px]">shield_lock</span>
                  </div>
                  <div className="bg-surface p-4 rounded-lg shadow-sm flex items-center justify-between border border-outline-variant/10">
                    <div>
                      <p className="font-mono text-[10px] uppercase text-on-surface-variant">CBSL Liquidity Coverage (LCR)</p>
                      <p className="font-headline text-lg text-on-surface font-semibold mt-0.5">248.6% (Min. 100%)</p>
                    </div>
                    <span className="material-symbols-outlined text-primary text-[28px]">account_balance</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-space-sm border-t border-surface-container-highest text-on-surface-variant font-mono text-[10px] uppercase tracking-wider relative z-10">
              <span>Official Custodian: CBSL Ref #CUS-8829-T</span>
              <span className="text-primary font-bold">Unencumbered Reserves</span>
            </div>
          </div>

          {/* Card 2: Section 84 IRD Compliance Badge & Entity Dossier (5 cols) */}
          <div className="md:col-span-5 bg-primary-container text-on-primary rounded-xl p-space-lg shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-container to-tertiary-container opacity-95 pointer-events-none" />
            <div className="flex flex-col gap-space-sm relative z-10">
              <div className="flex items-start justify-between">
                <div className="inline-flex items-center gap-space-xs bg-primary px-3 py-1.5 rounded-full border border-primary-fixed/20">
                  <span className="w-2 h-2 rounded-full bg-secondary-container" />
                  <span className="font-mono text-[10px] tracking-wider text-on-primary uppercase font-bold">IRD Section 84 Verified</span>
                </div>
                <span className="material-symbols-outlined text-on-primary-container text-[32px]">verified</span>
              </div>
              <div className="pt-space-xs">
                <span className="font-mono text-[10px] uppercase text-on-primary-container tracking-wider">Inland Revenue Act No. 24 of 2017</span>
                <h3 className="font-headline text-2xl text-on-primary mt-1">Corporate Withholding Tax Steward</h3>
              </div>
              <p className="font-body text-sm text-on-primary-container font-normal leading-relaxed">
                Directly coupled to the Inland Revenue Department (RAMIS 2.0). All withholding obligations under Section 84 are automatically deducted at statutory credit source, reconciled, and remitted in sovereign clearing windows.
              </p>
              
              <div className="bg-primary/50 p-4 rounded-lg flex flex-col gap-2 mt-2 font-mono text-xs text-on-primary border border-primary-fixed/10">
                <div className="flex justify-between items-center">
                  <span className="text-on-primary-container uppercase">TIN Identification</span>
                  <span className="font-semibold tracking-wider">800293819-0000</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-on-primary-container uppercase">Certificate Hash</span>
                  <span className="text-secondary-container">0x9F4C...B820A</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-on-primary-container uppercase">Statutory Clearing Period</span>
                  <span className="font-semibold">M+15 Sovereign SLA</span>
                </div>
              </div>
            </div>
            
            <div className="pt-space-md flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-fixed text-[20px]">policy</span>
                <span className="font-body text-sm text-on-primary-container">Exemption Category 4(A) Compliant</span>
              </div>
              <button 
                onClick={() => alert('Redirecting to Inland Revenue Department (RAMIS 2.0) verification gateway for TIN: 800293819-0000')}
                className="bg-surface-container-lowest text-primary font-body text-sm font-semibold px-4 py-2 rounded-full hover:bg-surface transition-colors shadow-sm"
              >
                View Filing Record
              </button>
            </div>
          </div>
        </div>

        {/* Editorial Interactive Section: Statutory 5% Withholding Tax (WHT) Ledger */}
        <div className="flex flex-col gap-space-md">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-space-sm">
            <div>
              <span className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider">Statutory 5% Deductions & Remittances</span>
              <h2 className="font-headline text-2xl text-primary mt-1">Withholding Tax (WHT) Audit Ledger</h2>
            </div>
            <div className="flex items-center gap-space-xs flex-wrap">
              <div className="bg-surface-container-low p-1 rounded-full flex items-center gap-1 font-mono text-xs border border-outline-variant/20">
                {[
                  { id: 'all', label: 'All Entries' },
                  { id: 'yield', label: 'Treasury Yields' },
                  { id: 'fx', label: 'FX Desks' },
                  { id: 'custody', label: 'Custody Interest' }
                ].map(f => (
                  <button 
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={`px-3 py-1.5 rounded-full transition-colors ${filter === f.id ? 'bg-primary text-on-primary shadow-sm font-bold' : 'hover:text-primary text-on-surface-variant bg-transparent'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => alert('Compiling Q1 2025 certified deduction archive with IRD cryptographic hashes. Download initialized.')}
                className="flex items-center gap-space-xs bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-body text-sm px-4 py-2 rounded-full transition-all border border-outline-variant/20"
              >
                <span className="material-symbols-outlined text-[18px]">cloud_download</span>
                <span>Export Archive (.ZIP)</span>
              </button>
            </div>
          </div>
          
          <div className="bg-surface-container-low rounded-xl p-space-md md:p-space-lg shadow-sm border border-outline-variant/30">
            <div className="grid grid-cols-12 gap-space-sm pb-space-sm text-on-surface-variant font-mono text-[10px] uppercase tracking-wider">
              <div className="col-span-4 md:col-span-3">Filing Event / Asset</div>
              <div className="col-span-3 md:col-span-2 text-right">Gross Earnings</div>
              <div className="hidden md:block md:col-span-2 text-right">5% WHT Deducted</div>
              <div className="col-span-3 md:col-span-2 text-right">Net Remitted</div>
              <div className="col-span-2 md:col-span-3 text-right">Certified Docket</div>
            </div>

            <div className="flex flex-col gap-space-xs">
              {filteredLedger.map((row, idx) => (
                <div key={idx} className="bg-surface p-4 rounded-lg transition-transform hover:-translate-y-0.5 shadow-sm flex flex-col md:grid md:grid-cols-12 gap-space-sm items-center border border-outline-variant/10">
                  <div className="col-span-4 md:col-span-3 w-full flex items-center gap-space-sm">
                    <div className="w-10 h-10 rounded-full bg-primary-fixed/30 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-primary text-[20px]">{row.icon}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-headline text-lg text-on-surface font-semibold truncate">{row.title}</p>
                      <span className="font-mono text-[10px] text-on-surface-variant">{row.dateInfo}</span>
                    </div>
                  </div>
                  
                  <div className="col-span-3 md:col-span-2 w-full text-left md:text-right font-mono text-sm text-on-surface">
                    <span className="md:hidden font-mono text-[10px] text-on-surface-variant block">Gross:</span>
                    {row.gross}
                  </div>
                  
                  <div className="col-span-3 md:col-span-2 w-full text-left md:text-right font-mono text-sm text-secondary font-bold">
                    <span className="md:hidden font-mono text-[10px] text-on-surface-variant block">5% WHT:</span>
                    {row.wht}
                  </div>
                  
                  <div className="col-span-3 md:col-span-2 w-full text-left md:text-right font-headline text-lg text-primary font-semibold">
                    <span className="md:hidden font-mono text-[10px] text-on-surface-variant block">Net:</span>
                    {row.net}
                  </div>
                  
                  <div className="col-span-2 md:col-span-3 w-full flex items-center justify-end gap-2">
                    <span className="hidden xl:inline-flex px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-mono text-[10px] tracking-wider uppercase font-bold">RAMIS Cleared</span>
                    <button 
                      onClick={() => setCertModal({ id: row.certId, asset: row.title, taxAmount: row.wht.replace('-', ''), hash: row.hash })}
                      className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-primary flex items-center gap-1" 
                      title="Download Certified Certificate"
                    >
                      <span className="material-symbols-outlined text-[20px]">download</span>
                      <span className="text-xs font-semibold font-body hidden lg:inline">Cert. PDF</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-space-md pt-space-sm border-t border-surface-container-highest flex flex-col md:flex-row items-center justify-between gap-space-sm">
              <div className="flex items-center gap-space-xs text-on-surface-variant font-mono text-xs uppercase">
                <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
                <span>Total Statutory Deductions (YTD): <strong className="text-on-surface">LKR 2,983,010.00</strong></span>
              </div>
              <span className="font-mono text-[10px] text-on-surface-variant uppercase">Authenticated against RAMIS Central Hub Batch #9194</span>
            </div>
          </div>
        </div>

        {/* Cryptographic Verification Sanctuary & Certificate Drawer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
          
          {/* Live Verification (7 cols) */}
          <div className="lg:col-span-7 bg-surface-container-low rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md border border-outline-variant/30">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider">Cryptographic Proof of Solvency</span>
                <h3 className="font-headline text-2xl text-primary mt-1">SHA-256 Audit Verification</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[22px]">fingerprint</span>
              </div>
            </div>
            
            <p className="font-body text-sm text-on-surface-variant">
              Every tax deduction, balance allocation, and Central Bank filing generates an immutable 256-bit cryptographic digest signed with the custodian's master sovereign key. Test any certificate hash locally.
            </p>
            
            <div className="flex flex-col gap-space-xs">
              <label className="font-mono text-[10px] uppercase text-on-surface-variant font-bold">Enter SHA-256 Hash or Certificate UUID</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input 
                  type="text" 
                  value={hashInput}
                  onChange={(e) => setHashInput(e.target.value)}
                  className="flex-1 bg-surface font-mono text-sm text-on-surface px-4 py-3 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-outline-variant shadow-sm border border-outline-variant/20"
                  placeholder="e.g. e3b0c442..."
                />
                <button 
                  onClick={verifyHash}
                  className="bg-primary hover:bg-primary-container text-on-primary font-body text-sm font-semibold px-6 py-3 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  {verifying ? (
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">gavel</span>
                  )}
                  Verify Proof
                </button>
              </div>
            </div>

            {verificationResult && (
              <div className="bg-surface p-space-md rounded-lg shadow-sm flex flex-col gap-space-xs border border-outline-variant/20 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
                    <span className="font-mono text-[10px] uppercase text-primary font-bold">Digest Authenticated: Validated</span>
                  </div>
                  <span className="font-mono text-xs text-on-surface-variant">Timestamp: {verificationResult.time}</span>
                </div>
                <div className="p-3 bg-surface-container-lowest rounded font-mono text-xs text-on-surface-variant break-all mt-1">
                  <span className="text-primary font-bold">QUERY:</span> {verificationResult.input}<br/>
                  <span className="text-primary font-bold">CBSL-SIGNATURE:</span> MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC3sLz1...8f0QIDAQAB
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 font-mono text-[10px] uppercase text-on-surface font-bold">
                  <div><span className="text-on-surface-variant block font-normal">Issuer:</span> Central Bank of SL</div>
                  <div><span className="text-on-surface-variant block font-normal">State:</span> IRD Section 84 Conforming</div>
                  <div><span className="text-on-surface-variant block font-normal">Zero Knowledge:</span> Verified</div>
                </div>
              </div>
            )}
          </div>

          {/* Context Side-Dossier (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-space-md">
            
            <div className="bg-surface-container-low rounded-xl p-space-lg shadow-sm flex flex-col gap-space-sm relative overflow-hidden border border-outline-variant/30">
              <div className="flex items-center gap-space-xs text-primary font-mono text-[10px] uppercase font-bold">
                <span className="material-symbols-outlined text-[20px]">account_balance</span>
                <span>Statutory Legal Framework</span>
              </div>
              <h4 className="font-headline text-xl text-on-surface font-semibold mt-1">Inland Revenue RAMIS v2.0 Protocol</h4>
              <p className="font-body text-sm text-on-surface-variant mt-1">
                B-Trust holds direct automated clearing protocol access under the Ministry of Finance & Planning, ensuring client assets remain free of liens and retroactive withholding encumbrances.
              </p>
              
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center justify-between font-mono text-[10px] uppercase py-1 border-b border-surface-container-highest">
                  <span className="text-on-surface-variant">Annual Compliance Filing</span>
                  <span className="text-primary font-bold">Unconditional Pass (PwC)</span>
                </div>
                <div className="flex items-center justify-between font-mono text-[10px] uppercase py-1 border-b border-surface-container-highest">
                  <span className="text-on-surface-variant">Basel III Liquidity Surplus</span>
                  <span className="text-primary font-bold">+LKR 42.1 Billion</span>
                </div>
                <div className="flex items-center justify-between font-mono text-[10px] uppercase py-1">
                  <span className="text-on-surface-variant">Automatic Certificate Minting</span>
                  <span className="text-primary font-bold">Instant SHA-256</span>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-high rounded-xl p-space-md flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm border border-outline-variant/20">
              <div className="flex items-center gap-space-sm">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-on-primary">
                  <span className="material-symbols-outlined text-[20px]">support_agent</span>
                </div>
                <div>
                  <p className="font-headline text-lg text-on-surface font-semibold">Statutory Tax Officer</p>
                  <p className="font-body text-sm text-on-surface-variant">Dedicated IRD Liaison Desk</p>
                </div>
              </div>
              <button className="px-4 py-2 rounded-full bg-surface text-primary font-body text-sm font-semibold hover:bg-surface-container-lowest transition-colors shadow-sm w-full sm:w-auto">
                Request Filing Brief
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Cert Modal */}
      {certModal && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-xl w-full rounded-2xl p-space-lg shadow-2xl relative flex flex-col gap-space-md border border-outline-variant/20 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase text-primary font-bold tracking-wider">Certified Tax Deduction Certificate</span>
                <h3 className="font-headline text-2xl text-on-surface">{certModal.id}</h3>
              </div>
              <button 
                onClick={() => setCertModal(null)}
                className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            
            <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col gap-space-sm relative overflow-hidden border border-outline-variant/30">
              <div className="flex justify-between items-center text-[10px] font-mono uppercase text-on-surface-variant font-bold">
                <span>Democratic Socialist Republic of Sri Lanka</span>
                <span>Form IRD/WHT/CERT/19</span>
              </div>
              <div className="pt-2 flex flex-col gap-1">
                <p className="font-body text-sm text-on-surface-variant">Deduction Asset:</p>
                <p className="font-headline text-xl text-primary font-semibold">{certModal.asset}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 py-2">
                <div>
                  <p className="font-mono text-[10px] uppercase text-on-surface-variant font-bold">Withholding Tax (5%)</p>
                  <p className="font-headline text-lg text-secondary font-bold mt-1">LKR {certModal.taxAmount}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase text-on-surface-variant font-bold">Filing Status</p>
                  <p className="font-mono text-[10px] text-primary font-bold mt-2">DIRECT RAMIS SETTLED</p>
                </div>
              </div>
              <div className="pt-2 border-t border-surface-container-highest">
                <p className="font-mono text-[10px] text-on-surface-variant uppercase font-bold">Cryptographic SHA-256 Digest:</p>
                <p className="font-mono text-xs text-primary break-all mt-1">{certModal.hash}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <span className="font-mono text-[10px] text-on-surface-variant uppercase font-bold">Signed under Section 84 Seal</span>
              <div className="flex gap-2 w-full sm:w-auto">
                <button 
                  onClick={() => setCertModal(null)}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-full font-body text-sm text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  Dismiss
                </button>
                <button 
                  onClick={() => {
                    alert(`Generating digitally signed PDF docket with sovereign key for: ${certModal.id}`)
                    setCertModal(null)
                  }}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-full bg-primary hover:bg-primary-container text-on-primary font-body text-sm font-semibold shadow-md flex items-center justify-center gap-1.5 transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  Download Signed PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
