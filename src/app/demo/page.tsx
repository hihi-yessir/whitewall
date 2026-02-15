"use client";

import dynamic from "next/dynamic";

const DemoPage = dynamic(() => import("@/components/demo/DemoPage"), {
  ssr: false,
});

export default function Demo() {
  return <DemoPage />;
}
