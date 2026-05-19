import { keccak256, toHex } from "viem";
import { log } from "../observability/logger.js";

export interface IpfsPinResult {
  readonly ipfsCid: string;
  /** On-chain–compatible content reference (keccak of `ipfs://{cid}`). */
  readonly contentHash: `0x${string}`;
}

/** Pins JSON payloads to IPFS (Kubo HTTP API or Pinata). */
export class IpfsPinClient {
  private readonly provider: "kubo" | "pinata" | "none";
  private readonly kuboUrl: string;
  private readonly pinataJwt: string | undefined;

  constructor() {
    const explicit = process.env.IPFS_PROVIDER?.trim().toLowerCase();
    this.pinataJwt = process.env.PINATA_JWT?.trim() || process.env.IPFS_PINATA_JWT?.trim();
    this.kuboUrl = (process.env.IPFS_KUBO_API_URL ?? "http://127.0.0.1:5001").replace(/\/$/, "");

    if (explicit === "none") {
      this.provider = "none";
    } else if (explicit === "pinata" || (explicit !== "kubo" && this.pinataJwt)) {
      this.provider = "pinata";
    } else if (explicit === "kubo" || process.env.IPFS_KUBO_API_URL) {
      this.provider = "kubo";
    } else {
      this.provider = "none";
    }
  }

  isEnabled(): boolean {
    return this.provider !== "none";
  }

  async pinJson(label: string, payload: unknown): Promise<IpfsPinResult> {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    if (this.provider === "pinata") {
      return this.pinViaPinata(label, payload);
    }
    if (this.provider === "kubo") {
      return this.pinViaKubo(label, bytes);
    }
    throw new Error("IPFS not configured — set IPFS_PROVIDER=kubo|pinata and credentials");
  }

  private contentHashForCid(cid: string): `0x${string}` {
    return keccak256(toHex(new TextEncoder().encode(`ipfs://${cid}`))) as `0x${string}`;
  }

  private async pinViaKubo(label: string, bytes: Uint8Array): Promise<IpfsPinResult> {
    const form = new FormData();
    form.append(
      "file",
      new Blob([Buffer.from(bytes)], { type: "application/json" }),
      `${label}.json`,
    );
    const res = await fetch(`${this.kuboUrl}/api/v0/add?pin=true&cid-version=1`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      throw new Error(`Kubo pin failed ${res.status}: ${await res.text()}`);
    }
    const text = await res.text();
    const lastLine = text.trim().split("\n").pop() ?? "{}";
    const parsed = JSON.parse(lastLine) as { Hash?: string };
    const cid = parsed.Hash;
    if (!cid) throw new Error("Kubo response missing Hash");
    log("info", "ipfs_pinned_kubo", { label, cid });
    return { ipfsCid: cid, contentHash: this.contentHashForCid(cid) };
  }

  private async pinViaPinata(label: string, payload: unknown): Promise<IpfsPinResult> {
    if (!this.pinataJwt) {
      throw new Error("PINATA_JWT required for Pinata IPFS provider");
    }
    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.pinataJwt}`,
      },
      body: JSON.stringify({
        pinataContent: payload,
        pinataMetadata: { name: label },
      }),
    });
    if (!res.ok) {
      throw new Error(`Pinata pin failed ${res.status}: ${await res.text()}`);
    }
    const body = (await res.json()) as { IpfsHash?: string };
    const cid = body.IpfsHash;
    if (!cid) throw new Error("Pinata response missing IpfsHash");
    log("info", "ipfs_pinned_pinata", { label, cid });
    return { ipfsCid: cid, contentHash: this.contentHashForCid(cid) };
  }
}

export function createIpfsPinClient(): IpfsPinClient {
  return new IpfsPinClient();
}
