import type { Metadata } from "next";
import { WhitewallLanding } from "./client";

export const metadata: Metadata = {
  title: "Whitewall — A billion agents. Every one accountable.",
  description: "On-chain identity, verification, and license plates for AI agents. Powered by Chainlink CRE, World ID, and TEE.",
  openGraph: {
    title: "Whitewall OS",
    description: "License plates for the agentic economy.",
    siteName: "Whitewall",
  },
};

export default function Home() {
  return <WhitewallLanding />;
}
