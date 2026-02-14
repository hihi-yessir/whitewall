"use client";

import dynamic from "next/dynamic";

const WhitewallLanding = dynamic(() => import("@/components/WhitewallLanding"), {
  ssr: false,
});

export default function Home() {
  return <WhitewallLanding />;
}
