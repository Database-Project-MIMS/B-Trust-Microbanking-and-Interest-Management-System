"use client"

import * as React from "react"
import Link from "next/link"

export default function ConciergePage() {
  const [selectedDay, setSelectedDay] = React.useState(17)
  const [messages, setMessages] = React.useState([
    { text: "Good morning. Treasury yield curve on 1-year Sri Lanka T-Bills cleared at 10.42%. Shall we shift the $2.4M tranche from overnight repo?", time: "08:14 CET • Henri V.", isOwn: false },
    { text: "Proceed with the sovereign allocation. Please ensure dual-custody verification is dispatched to my ledger key.", time: "08:19 CET • Delivered (Encrypted)", isOwn: true },
    { text: "Smart contract payload primed. Multi-sig prompt dispatched to your authenticated device now.", time: "08:21 CET • Henri V.", isOwn: false }
  ])
  const [inputMsg, setInputMsg] = React.useState("")
  const [showOverrideModal, setShowOverrideModal] = React.useState(false)
  const chatEndRef = React.useRef<HTMLDivElement>(null)

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMsg.trim()) return
    setMessages(prev => [...prev, { text: inputMsg, time: "Just now • Encrypted Relay", isOwn: true }])
    setInputMsg("")
  }

  React.useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  return (
    <div className="flex flex-col w-full relative">
      
      {/* Sovereign Desk Header & Contact Card */}
      <section className="relative w-full overflow-hidden pt-space-lg lg:pt-space-xl">
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute -top-32 right-10 w-96 h-96 rounded-full bg-primary-fixed blur-3xl" />
          <div className="absolute top-1/2 -left-20 w-80 h-80 rounded-full bg-tertiary-fixed blur-3xl" />
        </div>
        
        <div className="relative z-10 flex flex-col lg:flex-row items-start justify-between gap-gutter-desktop">
          
          <div className="flex-1 max-w-2xl">
            <div className="inline-flex items-center gap-space-xs px-3 py-1 rounded-full bg-surface-container-low mb-space-md border border-outline-variant/20">
              <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
              <span className="font-mono text-[10px] uppercase text-primary tracking-widest font-bold">Sovereign Desk • Tier 1 Clearance</span>
            </div>
            <h1 className="font-headline text-[3.5rem] text-primary tracking-tight mb-space-md leading-none">
              Dedicated Private Stewardship
            </h1>
            <p className="font-body text-lg text-on-surface-variant max-w-xl mb-space-lg">
              A bespoke custodial relationship with direct access to senior capital strategists, tailored macro-allocations, and cryptographic emergency governance channels.
            </p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-sm">
              <div className="bg-surface-container-low rounded-xl p-space-sm border border-outline-variant/30">
                <span className="font-mono text-[10px] uppercase text-on-surface-variant block mb-1">Response SLA</span>
                <span className="font-mono text-xs text-primary font-bold">&lt; 180 Seconds</span>
              </div>
              <div className="bg-surface-container-low rounded-xl p-space-sm border border-outline-variant/30">
                <span className="font-mono text-[10px] uppercase text-on-surface-variant block mb-1">Channel Security</span>
                <span className="font-mono text-xs text-primary font-bold">MLS 256-bit GCM</span>
              </div>
              <div className="bg-surface-container-low rounded-xl p-space-sm col-span-2 sm:col-span-1 border border-outline-variant/30">
                <span className="font-mono text-[10px] uppercase text-on-surface-variant block mb-1">Global Vault Desk</span>
                <span className="font-mono text-xs text-primary font-bold">Geneva / Singapore</span>
              </div>
            </div>
          </div>
          
          <div className="w-full lg:w-[480px] bg-surface-container-low rounded-xl p-space-md lg:p-space-lg shadow-xl border border-outline-variant/30 mt-8 lg:mt-0">
            <div className="flex items-center justify-between pb-space-sm mb-space-md border-b border-surface-container-highest">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-primary text-[20px]" style={{fontVariationSettings: "'FILL' 1"}}>lock</span>
                <span className="font-mono text-[10px] uppercase text-on-surface-variant font-bold">Active Ephemeral Link</span>
              </div>
              <span className="font-mono text-[10px] text-on-surface-variant bg-surface px-2.5 py-1 rounded-full border border-outline-variant/10">#EST-8902-G</span>
            </div>
            
            <div className="flex items-start gap-space-md mb-space-md">
              <div className="relative shrink-0">
                <div className="w-20 h-20 rounded-xl bg-surface-container-highest shadow-md overflow-hidden bg-[url('https://lh3.googleusercontent.com/aida-public/AB6AXuDx0hgrPl4EpY-LsKXSwreul4ywtSR-uL1yNaT_1tC8fMT1LXxf-fHH4F7b8_t8_54NYBLMCHdJvkTaQI24T8-ccgqHOCWuSUzDRMfHtlL3i_WWz5IexcdJ4bGZIeRe4J37hMKQ_UU9Rst3aHI3KjF2HiUIQfJisktTcWj5OhkfuMJZQ3bVs3aE0pTs3Et7Iv58Oj7dXVusq_Chg9Y2xeB_Fy8M8Gp4eI97vgbmhnqiGJwCkQxtI9Cu')] bg-cover bg-center" />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-primary ring-4 ring-surface-container-low" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h2 className="font-headline text-xl text-on-surface truncate font-semibold">Henri V. d'Orsay</h2>
                  <span className="font-mono text-[10px] text-primary uppercase bg-primary-fixed/60 px-2 py-0.5 rounded-full font-bold">Lead Steward</span>
                </div>
                <p className="font-body text-sm text-on-surface-variant mt-0.5">Senior Treasury & Sovereign Allocations Director</p>
                <div className="flex items-center gap-space-xs mt-2 text-primary font-body text-sm font-semibold">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse-dot" />
                  <span>Available for Video Call & Encrypted Session</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-space-xs">
              <div className="flex items-center gap-space-xs text-on-surface-variant text-sm font-body">
                <span className="material-symbols-outlined text-[18px]">verified_user</span>
                <span>Swiss FINMA & MAS Class 1 Custody Authorization</span>
              </div>
              <div className="flex items-center gap-space-xs text-on-surface-variant text-sm font-body">
                <span className="material-symbols-outlined text-[18px]">schedule</span>
                <span>Direct Timezone: CET (Zurich) • 07:00 – 21:00 CEST</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-space-sm mt-space-md pt-space-sm border-t border-surface-container-highest">
              <button className="flex items-center justify-center gap-space-xs bg-primary text-on-primary py-3 px-4 rounded-xl hover:opacity-95 active:scale-[0.985] transition-all shadow-md">
                <span className="material-symbols-outlined text-[18px]">videocam</span>
                <span className="font-body text-sm font-medium">Video Link</span>
              </button>
              <button className="flex items-center justify-center gap-space-xs bg-surface text-on-surface py-3 px-4 rounded-xl hover:bg-surface-container transition-all active:scale-[0.985] shadow-sm border border-outline-variant/10">
                <span className="material-symbols-outlined text-[18px]">terminal</span>
                <span className="font-body text-sm font-medium">Encrypted Chat</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="w-full pt-space-xl pb-space-lg">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-desktop items-start">
          
          {/* Left Column - Appointments & Desks (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-space-lg">
            
            <div>
              <div className="flex items-center justify-between mb-space-xs">
                <span className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider">Priority Governance Portal</span>
                <span className="font-mono text-[10px] text-secondary uppercase font-bold">High Demand Vault Cycle</span>
              </div>
              <h2 className="font-headline text-[2rem] text-primary">Reserve Advisory & Sovereign Allocation</h2>
              <p className="font-body text-md text-on-surface-variant mt-1">
                Select an institutional allocation desk or schedule an in-depth private consultation regarding LKR/USD liquidity hedges, sovereign syndication, or off-market bonds.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
              <label className="cursor-pointer">
                <input type="radio" name="allocation_desk" className="peer sr-only" defaultChecked />
                <div className="p-space-md rounded-xl bg-surface-container-low peer-checked:bg-primary peer-checked:text-on-primary transition-all shadow-sm flex flex-col justify-between h-40 border border-outline-variant/20 peer-checked:border-primary">
                  <div className="flex items-start justify-between">
                    <span className="material-symbols-outlined text-[24px]">account_balance</span>
                    <span className="font-mono text-[10px] uppercase opacity-80 font-bold">Desk A</span>
                  </div>
                  <div>
                    <div className="font-headline text-lg">Sovereign Debt & T-Bills</div>
                    <div className="font-body text-sm opacity-80 mt-1">LKR Primary Auction • USD Swaps</div>
                  </div>
                </div>
              </label>
              
              <label className="cursor-pointer">
                <input type="radio" name="allocation_desk" className="peer sr-only" />
                <div className="p-space-md rounded-xl bg-surface-container-low peer-checked:bg-primary peer-checked:text-on-primary transition-all shadow-sm flex flex-col justify-between h-40 border border-outline-variant/20 peer-checked:border-primary">
                  <div className="flex items-start justify-between">
                    <span className="material-symbols-outlined text-[24px]">token</span>
                    <span className="font-mono text-[10px] uppercase opacity-80 font-bold">Desk B</span>
                  </div>
                  <div>
                    <div className="font-headline text-lg">Private Liquidity Vaults</div>
                    <div className="font-body text-sm opacity-80 mt-1">Bespoke yield routing &gt; $5M</div>
                  </div>
                </div>
              </label>
            </div>
            
            <div className="bg-surface-container-low rounded-xl p-space-md md:p-space-lg shadow-sm border border-outline-variant/30">
              <div className="flex items-center justify-between mb-space-md">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary">calendar_today</span>
                  <span className="font-headline text-xl text-on-surface">Available Stewardship Slots</span>
                </div>
                <div className="flex items-center gap-1 font-mono text-[10px] text-on-surface-variant font-bold">
                  <span className="px-2 py-1 rounded bg-surface text-primary border border-outline-variant/10">OCTOBER 2025</span>
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-1.5 text-center mb-space-sm font-mono text-[10px] text-on-surface-variant">
                <div>MON</div><div>TUE</div><div>WED</div><div>THU</div><div>FRI</div><div>SAT</div><div>SUN</div>
              </div>
              
              <div className="grid grid-cols-7 gap-1.5">
                {[13,14].map(d => (
                  <div key={d} className="h-11 rounded flex items-center justify-center font-mono text-xs text-on-surface-variant/40 bg-surface/30">{d}</div>
                ))}
                {[15,16,17,18,19,20,21,22,23,24].map(d => {
                  if (d === 18 || d === 19) return <div key={d} className="h-11 rounded flex items-center justify-center font-mono text-xs text-on-surface-variant/30 bg-surface/20">{d}</div>
                  
                  const isSelected = selectedDay === d;
                  const isSecondary = d === 23;
                  
                  return (
                    <button 
                      key={d}
                      onClick={() => setSelectedDay(d)}
                      className={`h-11 rounded flex flex-col items-center justify-center font-mono text-xs transition-colors shadow-sm
                        ${isSelected ? 'bg-primary text-on-primary' : 'bg-surface text-on-surface hover:bg-primary-fixed'}
                      `}
                    >
                      <span>{d}</span>
                      <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-on-primary' : (isSecondary ? 'bg-secondary' : 'bg-primary')}`} />
                    </button>
                  )
                })}
                {[25,26].map(d => (
                  <div key={d} className="h-11 rounded flex items-center justify-center font-mono text-xs text-on-surface-variant/30 bg-surface/20">{d}</div>
                ))}
              </div>
              
              <div className="mt-space-md pt-space-sm flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm border-t border-surface-container-highest">
                <div className="flex items-center gap-space-xs text-sm font-body text-on-surface-variant">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <span>Open Priority Slots</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-secondary ml-2" />
                  <span>Board Syndicate Only</span>
                </div>
                <div className="flex items-center gap-space-xs">
                  <button className="px-3 py-1.5 rounded-lg bg-surface text-on-surface font-body text-sm hover:bg-surface-container transition-colors shadow-sm">10:30 CET</button>
                  <button className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-body text-sm shadow-sm">14:00 CET</button>
                  <button className="px-3 py-1.5 rounded-lg bg-surface text-on-surface font-body text-sm hover:bg-surface-container transition-colors shadow-sm">16:30 CET</button>
                </div>
              </div>
              
              <div className="mt-space-md">
                <button className="w-full py-3.5 px-6 rounded-xl bg-primary text-on-primary font-headline text-lg flex items-center justify-center gap-space-xs hover:opacity-95 active:scale-[0.99] transition-all shadow-md">
                  <span className="material-symbols-outlined text-[20px]">calendar_add_on</span>
                  <span>Confirm Reserved Advisory Briefing</span>
                </button>
              </div>
            </div>
            
          </div>
          
          {/* Right Column - Chat & Hardware Security (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-space-md">
            
            <div className="bg-surface-container-low rounded-xl p-space-md lg:p-space-lg shadow-sm border border-outline-variant/30">
              <div className="flex items-center justify-between mb-space-sm">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary text-[20px]">enhanced_encryption</span>
                  <h3 className="font-headline text-xl text-on-surface">Secure Channel</h3>
                </div>
                <span className="font-mono text-[10px] text-primary bg-primary-fixed px-2 py-0.5 rounded font-bold uppercase tracking-wider">SESSION ACTIVE</span>
              </div>
              
              <div className="bg-surface rounded-xl p-space-sm mb-space-md flex items-center justify-between border border-outline-variant/10">
                <div className="min-w-0">
                  <span className="font-mono text-[10px] text-on-surface-variant uppercase block font-bold">Forward Secrecy Key Signature</span>
                  <span className="font-mono text-xs text-primary truncate block mt-0.5">0x89EF•45A0•23F1•DC88•991B</span>
                </div>
                <button className="p-2 rounded-lg hover:bg-surface-container transition-colors text-on-surface-variant" title="Rotate Session Key">
                  <span className="material-symbols-outlined text-[18px]">sync</span>
                </button>
              </div>
              
              <div className="space-y-space-sm mb-space-md h-60 overflow-y-auto pr-2 custom-scrollbar">
                {messages.map((m, i) => (
                  <div key={i} className={`flex flex-col max-w-[85%] ${m.isOwn ? 'items-end ml-auto' : 'items-start'}`}>
                    <div className={`p-space-sm rounded-xl text-sm font-body shadow-sm ${m.isOwn ? 'bg-primary text-on-primary' : 'bg-surface text-on-surface'}`}>
                      {m.text}
                    </div>
                    <span className={`font-mono text-[10px] text-on-surface-variant mt-1 ${m.isOwn ? 'pr-1' : 'pl-1'}`}>{m.time}</span>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              
              <form className="relative flex items-center" onSubmit={handleSendMessage}>
                <input 
                  type="text"
                  value={inputMsg}
                  onChange={(e) => setInputMsg(e.target.value)}
                  placeholder="Compose encrypted directive..." 
                  className="w-full bg-surface text-on-surface placeholder:text-on-surface-variant/50 text-sm font-body rounded-xl py-3 pl-4 pr-12 outline-none focus:ring-1 focus:ring-primary shadow-sm border border-outline-variant/20" 
                />
                <button type="submit" className="absolute right-2 p-1.5 bg-primary text-on-primary rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50" disabled={!inputMsg.trim()}>
                  <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                </button>
              </form>
            </div>
            
            <div className="bg-surface-container-high rounded-xl p-space-md flex items-center justify-between shadow-sm border border-outline-variant/20">
              <div className="flex items-center gap-space-sm">
                <div className="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm">
                  <span className="material-symbols-outlined text-[20px]">fingerprint</span>
                </div>
                <div>
                  <span className="font-headline text-lg text-on-surface block font-semibold">Biometric Authorization</span>
                  <span className="font-body text-xs text-on-surface-variant">Hardware Security Module v4.8 Active</span>
                </div>
              </div>
              <span className="font-mono text-[10px] uppercase bg-primary/10 text-primary px-2.5 py-1 rounded-full font-bold tracking-wider">Linked</span>
            </div>
            
          </div>
        </div>
      </section>

      {/* Emergency Concierge Lower Banner */}
      <section className="w-full pb-space-xl">
        <div className="rounded-xl bg-gradient-to-br from-surface-container-low via-surface-container to-surface-container-low p-space-lg lg:p-space-xl relative overflow-hidden shadow-sm border border-outline-variant/30">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none hidden md:block">
            <svg className="w-full h-full stroke-primary fill-none" preserveAspectRatio="none" viewBox="0 0 100 100">
              <line strokeWidth="0.5" x1="0" x2="100" y1="0" y2="100" />
              <line strokeWidth="0.5" x1="20" x2="100" y1="0" y2="80" />
              <line strokeWidth="0.5" x1="40" x2="100" y1="0" y2="60" />
              <line strokeWidth="0.5" x1="60" x2="100" y1="0" y2="40" />
            </svg>
          </div>
          
          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-gutter">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-space-xs px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-mono text-[10px] uppercase tracking-wider mb-space-xs font-bold shadow-sm">
                <span className="material-symbols-outlined text-[14px]">bolt</span>
                <span>Ultra-High Net Worth Protocol</span>
              </div>
              <h2 className="font-headline text-[2.5rem] text-on-surface mt-1 leading-tight">
                VIP Branch Override & Emergency Concierge
              </h2>
              <p className="font-body text-md text-on-surface-variant mt-2">
                Instant physical vault escort dispatch, direct satellite wire routing, or emergency liquidity access across our flagship branches in Colombo, London, and Singapore.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-sm shrink-0 w-full lg:w-auto mt-6 lg:mt-0">
              <a href="tel:+41228190000" className="flex items-center justify-center gap-space-xs px-5 py-3.5 rounded-xl bg-secondary text-on-secondary font-headline text-lg shadow-sm hover:opacity-90 active:scale-[0.985] transition-all">
                <span className="material-symbols-outlined text-[20px]">phone_in_talk</span>
                <span>Direct Red Phone: +41 22 819 0000</span>
              </a>
              <button 
                onClick={() => setShowOverrideModal(true)}
                className="flex items-center justify-center gap-space-xs px-5 py-3.5 rounded-xl bg-surface-container-lowest text-primary font-headline text-lg hover:bg-surface-container-high active:scale-[0.985] transition-all shadow-sm border border-outline-variant/20"
              >
                <span className="material-symbols-outlined text-[20px]">vpn_key</span>
                <span>Request Branch Override</span>
              </button>
            </div>
          </div>
          
          <div className="mt-space-lg pt-space-md grid grid-cols-1 md:grid-cols-3 gap-space-md border-t border-surface-container-highest relative z-10">
            <div className="flex items-start gap-space-xs">
              <span className="material-symbols-outlined text-secondary mt-0.5 text-[20px]">near_me</span>
              <div>
                <span className="font-headline text-[1rem] text-on-surface block font-semibold">Colombo Head Office Hub</span>
                <span className="font-body text-sm text-on-surface-variant">Private Level 14, World Trade Center. Armed Escort & Cash Despatch.</span>
              </div>
            </div>
            <div className="flex items-start gap-space-xs">
              <span className="material-symbols-outlined text-secondary mt-0.5 text-[20px]">shield_with_heart</span>
              <div>
                <span className="font-headline text-[1rem] text-on-surface block font-semibold">Airfield & Maritime Escort</span>
                <span className="font-body text-sm text-on-surface-variant">Customs airside bullion clearance via Bandaranaike & Mattala private terminals.</span>
              </div>
            </div>
            <div className="flex items-start gap-space-xs">
              <span className="material-symbols-outlined text-secondary mt-0.5 text-[20px]">contactless</span>
              <div>
                <span className="font-headline text-[1rem] text-on-surface block font-semibold">Sub-Second Satellite SWIFT</span>
                <span className="font-body text-sm text-on-surface-variant">Redundant Starlink & Iridium point-to-point interbank telemetry.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl max-w-lg w-full p-space-lg shadow-2xl relative border border-outline-variant/20 animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowOverrideModal(false)}
              className="absolute top-space-md right-space-md text-on-surface-variant hover:text-on-surface bg-surface-container-low w-8 h-8 rounded-full flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
            <div className="flex items-center gap-space-sm mb-space-md">
              <div className="w-12 h-12 rounded-full bg-secondary-fixed flex items-center justify-center text-secondary shadow-inner">
                <span className="material-symbols-outlined text-[24px]">crisis_alert</span>
              </div>
              <div>
                <h3 className="font-headline text-2xl text-on-surface font-semibold">VIP Branch Override Requested</h3>
                <span className="font-mono text-[10px] uppercase text-secondary font-bold tracking-wider">Priority Dispatch Protocol #901</span>
              </div>
            </div>
            <p className="font-body text-md text-on-surface-variant mb-space-md">
              Your assigned private stewards in Colombo and Zurich have been alerted via silent cryptographic pager. Armed facility access code will generate via biometric confirmation.
            </p>
            <div className="bg-surface-container-low p-space-sm rounded-xl mb-space-md font-mono text-sm text-primary flex items-center justify-between border border-outline-variant/30">
              <span className="font-bold uppercase">One-Time Emergency OTP:</span>
              <span className="tracking-widest font-bold text-lg">894 • 201 • 773</span>
            </div>
            <button 
              onClick={() => setShowOverrideModal(false)}
              className="w-full py-3.5 bg-primary hover:bg-primary-container transition-colors text-on-primary rounded-xl font-headline text-lg shadow-md"
            >
              Acknowledge Protocol
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
