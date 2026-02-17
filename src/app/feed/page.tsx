"use client";

import dynamic from "next/dynamic";

const FeedPage = dynamic(() => import("@/components/feed/FeedPage"), { ssr: false });

export default function Page() {
  return <FeedPage />;
}
