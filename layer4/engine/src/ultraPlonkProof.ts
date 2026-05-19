import { encodePacked, keccak256, type Hex } from "viem";

export const ULTRAPLONK_PROOF_BYTES = 2144;
export const ULTRAPLONK_VERSION_BYTE = "0x01" as const;

/** Craft a bound UltraPlonk proof for MockPlonkPairingEngine / local Anvil */
export function craftUltraPlonkProof(
  publicInputs: readonly Hex[],
  vkHash: Hex,
): Hex {
  const commitment = keccak256(encodePacked(["string", "bytes32"], ["layer4-commitment", vkHash]));
  const pubHash =
    publicInputs.length >= 3
      ? keccak256(
          encodePacked(
            ["bytes32", "bytes32", "bytes32"],
            [publicInputs[0]!, publicInputs[1]!, publicInputs[2]!],
          ),
        )
      : keccak256(encodePacked(["bytes32"], [publicInputs[0]!]));
  const binding = keccak256(encodePacked(["bytes32", "bytes32", "bytes32"], [pubHash, vkHash, commitment]));

  const head = (ULTRAPLONK_VERSION_BYTE +
    commitment.slice(2) +
    binding.slice(2)) as Hex;
  const padLen = ULTRAPLONK_PROOF_BYTES * 2 - (head.length - 2);
  return `${head}${"00".repeat(padLen / 2)}` as Hex;
}
