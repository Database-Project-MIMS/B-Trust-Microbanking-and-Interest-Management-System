"use client"

import * as React from "react"
import Link from "next/link"

export default function OnboardingPage() {
  return (
    <main className="w-full min-h-screen bg-surface flex flex-col justify-center selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 w-full z-50 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
        <div className="h-20 max-w-[1360px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary text-[20px]">account_balance</span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline text-lg text-primary tracking-tight leading-none font-semibold">B-Trust</span>
              <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest mt-0.5 font-bold">Spatial Banking</span>
            </div>
          </div>
          <div className="flex items-center gap-space-md">
            <div className="hidden sm:flex items-center gap-2 bg-surface-container-low px-space-sm py-1.5 rounded-full shadow-sm border border-outline-variant/20">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse-dot" />
            </div>
            <nav className="flex items-center gap-space-sm">
              <a href="#" className="font-body text-sm text-on-surface-variant hover:text-on-surface transition-colors duration-150">Help Support</a>
            </nav>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full pt-20 flex-1 flex flex-col justify-center">
        <div className="flex flex-col w-full">
          {/* Interactive Ambient Atmospheric Canvas */}
          <div className="max-w-xl w-full mx-auto px-margin md:px-space-md py-space-md lg:py-space-lg flex flex-col gap-space-md items-center">
            
            <div className="w-full flex flex-col items-center gap-space-xs text-center">
              <div className="flex items-center gap-2 font-mono text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
                <span>Step 1 of 3: Entity Classification</span>
              </div>
              <div className="w-48 h-1 bg-surface-container-high rounded-full overflow-hidden mt-1">
                <div className="bg-primary h-full rounded-full w-1/3" />
              </div>
            </div>
            
            <div className="w-full bg-surface-container-lowest p-space-md md:p-space-lg rounded-xl shadow-2xl flex flex-col gap-space-md border border-outline-variant/30">
              
              <div className="flex flex-col gap-1 text-center">
                <span className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">Institutional Enclave</span>
                <h1 className="font-headline text-[2rem] text-on-surface tracking-tight leading-tight">Entity Classification</h1>
                <p className="font-body text-sm text-on-surface-variant mt-1">Provide corporate charter details to initialize partition allocation.</p>
              </div>

              <form className="flex flex-col gap-space-md mt-2" onSubmit={e => e.preventDefault()}>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="corp-name" className="font-mono text-[10px] uppercase text-on-surface tracking-wider font-bold">Corporate Legal Name</label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-4 text-on-surface-variant text-[20px]">domain</span>
                    <input 
                      id="corp-name"
                      type="text" 
                      defaultValue="Apex Sovereign Holdings Ltd" 
                      placeholder="Apex Sovereign Holdings Ltd"
                      className="w-full bg-surface-container-low text-on-surface font-body text-md rounded-xl pl-12 pr-4 py-3.5 focus:bg-surface-container-lowest focus:shadow-[0_0_0_2px_#144439] outline-none transition-all placeholder:text-outline-variant border border-transparent focus:border-primary/20"
                    />
                    <span className="material-symbols-outlined absolute right-4 text-primary text-[20px]" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="reg-num" className="font-mono text-[10px] uppercase text-on-surface tracking-wider font-bold">Registration Number</label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-4 text-on-surface-variant text-[20px]">pin</span>
                    <input 
                      id="reg-num"
                      type="text" 
                      defaultValue="PV-00294810-LK / CHE-193.840.219" 
                      placeholder="PV-00294810-LK / CHE-193.840.219"
                      className="w-full bg-surface-container-low text-on-surface font-mono text-sm rounded-xl pl-12 pr-4 py-3.5 focus:bg-surface-container-lowest focus:shadow-[0_0_0_2px_#144439] outline-none transition-all border border-transparent focus:border-primary/20"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="jurisdiction-select" className="font-mono text-[10px] uppercase text-on-surface tracking-wider font-bold">Primary Jurisdiction</label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-4 text-on-surface-variant text-[20px]">account_balance</span>
                    <select 
                      id="jurisdiction-select"
                      className="w-full appearance-none bg-surface-container-low text-on-surface font-body text-md rounded-xl pl-12 pr-10 py-3.5 focus:bg-surface-container-lowest focus:shadow-[0_0_0_2px_#144439] outline-none transition-all cursor-pointer border border-transparent focus:border-primary/20"
                    >
                      <option>Central Bank of Sri Lanka (CBSL)</option>
                      <option>Swiss FINMA (Zurich Enclave)</option>
                      <option>Monetary Authority of Singapore (MAS)</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-4 text-on-surface-variant pointer-events-none">expand_more</span>
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-3">
                  <button type="submit" className="w-full py-3.5 px-6 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-body text-md font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all transform active:scale-[0.985]">
                    <span>Continue to Authorized Signatory</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                  <div className="flex items-center justify-between text-body-sm pt-1">
                    <Link href="/sign-in" className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1 font-body text-sm">
                      <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                      <span>Return to Sovereign Login</span>
                    </Link>
                    <button type="button" className="text-on-surface-variant hover:text-on-surface transition-colors font-body text-sm font-medium">
                      Save Draft
                    </button>
                  </div>
                </div>
              </form>

            </div>
            
            <div className="flex items-center gap-2 text-on-surface-variant font-mono text-[10px] uppercase tracking-wider text-center font-bold">
              <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
              <span>Verification Node: Colombo-CBSL-09 // TLS v1.3</span>
            </div>
            
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full bg-surface-container-low/70 py-space-lg border-t border-outline-variant/20 mt-auto z-10">
        <div className="max-w-[1360px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop flex flex-col md:flex-row items-center justify-between gap-space-md text-on-surface-variant">
          <div className="flex flex-col md:flex-row items-center gap-space-sm md:gap-space-md text-center md:text-left">
            <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">© 2025 B-Trust Spatial Banking N.A. Member FDIC.</span>
            <span className="hidden md:inline text-outline-variant">•</span>
            <span className="font-body text-sm text-on-surface-variant">Sovereign Institutional Custody & Asset Protocol</span>
          </div>
          <div className="flex items-center gap-space-md font-body text-sm">
            <a href="#" className="text-on-surface-variant hover:text-on-surface transition-colors duration-150">Disclosures</a>
            <a href="#" className="text-on-surface-variant hover:text-on-surface transition-colors duration-150">Privacy Enclave</a>
            <a href="#" className="text-on-surface-variant hover:text-on-surface transition-colors duration-150">Security</a>
          </div>
        </div>
      </footer>
    </main>
  )
}
