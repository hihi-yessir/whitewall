"use client";
import dynamic from "next/dynamic";

const TryoutPage = dynamic(() => import("@/components/tryout/TryoutPage"), { ssr: false });

export default function Tryout() {
  return <TryoutPage />;
}
