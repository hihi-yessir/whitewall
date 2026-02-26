"use client";

import dynamic from "next/dynamic";

const BondingPage = dynamic(() => import("@/components/bonding/BondingPage"), {
  ssr: false,
});

export default function Bonding() {
  return <BondingPage />;
}
