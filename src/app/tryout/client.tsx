"use client";
import dynamic from "next/dynamic";
export const TryoutPage = dynamic(() => import("@/components/tryout/TryoutPage"), { ssr: false });
