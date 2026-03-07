import type { Metadata } from "next";
import { TryoutPage } from "./client";

export const metadata: Metadata = {
  title: "Register Your Agent — Whitewall",
  description: "Register an AI agent on-chain, verify with World ID, complete KYC and TEE-verified credit scoring, and get your license plate.",
  openGraph: {
    title: "Get Your Agent License",
    description: "On-chain agent registration with World ID, KYC, and TEE-attested credit verification.",
  },
};

export default function Tryout() {
  return <TryoutPage />;
}
