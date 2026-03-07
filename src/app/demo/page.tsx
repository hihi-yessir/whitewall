import type { Metadata } from "next";
import { DemoPage } from "./client";

export const metadata: Metadata = {
  title: "Architecture Demo — Whitewall",
  description: "Interactive visualization of the Whitewall verification pipeline: agent registration, World ID, KYC, credit scoring, and x402 payment flow.",
  openGraph: {
    title: "Whitewall Architecture Demo",
    description: "See how AI agents get verified and licensed on-chain.",
  },
};

export default function Demo() {
  return <DemoPage />;
}
