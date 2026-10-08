"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";

export function MotionSurface({ children, className = "" }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        gsap.from("[data-reveal]", { y: 22, opacity: 0, duration: 0.75, stagger: 0.09, ease: "power3.out", clearProps: "all" });
        gsap.to(".orbital-ring", { rotation: 360, duration: 100, repeat: -1, ease: "none" });
      }, root);
      return () => context.revert();
    });
    return () => media.revert();
  }, []);
  return <div ref={root} className={className}>{children}</div>;
}
