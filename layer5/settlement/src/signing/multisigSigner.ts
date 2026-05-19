import type { SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { MultiSigPublicKey } from "@mysten/sui/multisig";
import { MultiSigSigner } from "@mysten/sui/multisig";
import type { Signer } from "@mysten/sui/cryptography";
import type { Transaction } from "@mysten/sui/transactions";

function memberKeypair(): Ed25519Keypair {
  const secret = process.env.SUI_SIGNER_SECRET_KEY;
  if (!secret) throw new Error("SUI_SIGNER_SECRET_KEY required");
  return Ed25519Keypair.fromSecretKey(secret.startsWith("0x") ? secret.slice(2) : secret);
}

/** Single-key or multisig signer from environment. */
export function resolveSigner(): Signer {
  const raw = process.env.SUI_MULTISIG_PUBLIC_KEY;
  if (raw) {
    const pk = new MultiSigPublicKey(raw);
    return new MultiSigSigner(pk, [memberKeypair()]);
  }
  return memberKeypair();
}

export async function signAndExecute(
  client: SuiClient,
  transaction: Transaction,
  signer: Signer = resolveSigner(),
): Promise<string> {
  const { digest } = await client.signAndExecuteTransaction({
    transaction,
    signer,
    options: { showEffects: true },
  });
  return digest;
}
