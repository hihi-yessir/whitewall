import type { Metadata } from "next";
import { FeedPage } from "./client";

export const metadata: Metadata = {
  title: "Agent Feed — Whitewall",
  description: "Live registry of licensed AI agents. See real-time registrations, verifications, and generation activity on Base Sepolia.",
  openGraph: {
    title: "Whitewall Agent Feed",
    description: "Live registry of verified AI agents and their on-chain activity.",
  },
};

export default function Page() {
  return <FeedPage />;
}
