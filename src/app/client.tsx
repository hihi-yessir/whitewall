"use client";
import dynamic from "next/dynamic";
export const WhitewallLanding = dynamic(() => import("@/components/WhitewallLanding"), { ssr: false });
