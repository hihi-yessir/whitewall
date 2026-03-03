import { keccak256, encodePacked, type Address } from "viem";

// ValidationRegistry: confirmed on-chain at Base Sepolia
export const VALIDATION_REGISTRY_ADDRESS: Address = "0x8004Cb1BF31DAf7788923b405b754f57acEB4272";

// USDC on Base Sepolia
export const USDC_ADDRESS: Address = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

// Minimal ABI for validationRequest (write function not in SDK)
export const validationRequestAbi = [{
  inputs: [
    { name: "validatorAddress", type: "address" },
    { name: "agentId", type: "uint256" },
    { name: "requestURI", type: "string" },
    { name: "requestHash", type: "bytes32" },
  ],
  name: "validationRequest",
  outputs: [],
  stateMutability: "nonpayable",
  type: "function",
}] as const;

export function computeRequestHash(requestURI: string): `0x${string}` {
  return keccak256(encodePacked(["string"], [requestURI]));
}
