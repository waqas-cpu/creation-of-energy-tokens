import { describe, expect, it } from "vitest";
import { recoverTypedDataAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  buildExecutionAuthMessage,
  EXECUTION_AUTH_DOMAIN,
  EXECUTION_AUTH_EIP712_TYPES,
} from "../src/safeAuth.js";
import type { ContractId, ExecutionId } from "../src/types.js";

describe("SafeAuth EIP-712", () => {
  const account = privateKeyToAccount(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  );

  it("recovers signer from ExecutionAuthorization typed data", async () => {
    const contractId = ("0x" + "aa".repeat(32)) as ContractId;
    const obligationHash = ("0x" + "bb".repeat(32)) as `0x${string}`;
    const executionId = ("0x" + "cc".repeat(32)) as ExecutionId;
    const verifyingContract = "0x0000000000000000000000000000000000000001";

    const message = buildExecutionAuthMessage(contractId, obligationHash, executionId);
    const signature = await account.signTypedData({
      domain: {
        ...EXECUTION_AUTH_DOMAIN,
        chainId: 1,
        verifyingContract,
      },
      types: EXECUTION_AUTH_EIP712_TYPES,
      primaryType: "ExecutionAuthorization",
      message,
    });

    const recovered = await recoverTypedDataAddress({
      domain: {
        ...EXECUTION_AUTH_DOMAIN,
        chainId: 1,
        verifyingContract,
      },
      types: EXECUTION_AUTH_EIP712_TYPES,
      primaryType: "ExecutionAuthorization",
      message,
      signature,
    });

    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
  });
});
