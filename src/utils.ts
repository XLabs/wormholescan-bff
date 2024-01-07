import { Network } from "@wormhole-foundation/connect-sdk";
import { JsonRpcProvider } from "ethers";

export const findBlockRangeByTimestamp = async (ethersProvider: JsonRpcProvider, targetTimestamp) => {
  const lastBlock = await ethersProvider.getBlockNumber();
  let startBlock = 0;
  let endBlock = lastBlock;
  const maxBlockDifference = 1000; // Max difference between blocks

  while (startBlock <= endBlock) {
    const midBlock = Math.floor((startBlock + endBlock) / 2);
    const midBlockInfo = await ethersProvider.getBlock(midBlock);

    // Check if the timestamp is within a certain threshold of the target timestamp
    const timestampDiff = Math.abs(midBlockInfo?.timestamp! - Date.parse(targetTimestamp) / 1000);

    console.log({ timestampDiff });

    if (timestampDiff <= 1000) {
      console.log({ midBlock });

      const blockRanges = [
        // [Math.max(0, midBlock - maxBlockDifference * 9), Math.min(lastBlock, midBlock - maxBlockDifference * 7)],
        // [Math.max(0, midBlock - maxBlockDifference * 7), Math.min(lastBlock, midBlock - maxBlockDifference * 5)],
        // [Math.max(0, midBlock - maxBlockDifference * 5), Math.min(lastBlock, midBlock - maxBlockDifference * 3)],
        [Math.max(0, midBlock - maxBlockDifference * 3), Math.min(lastBlock, midBlock - maxBlockDifference)],
        [Math.max(0, midBlock - maxBlockDifference), Math.min(lastBlock, midBlock + maxBlockDifference)],
        [Math.max(0, midBlock + maxBlockDifference), Math.min(lastBlock, midBlock + maxBlockDifference * 3)],
        [Math.max(0, midBlock + maxBlockDifference * 3), Math.min(lastBlock, midBlock + maxBlockDifference * 5)],
        [Math.max(0, midBlock + maxBlockDifference * 5), Math.min(lastBlock, midBlock + maxBlockDifference * 7)],
        [Math.max(0, midBlock + maxBlockDifference * 7), Math.min(lastBlock, midBlock + maxBlockDifference * 9)],
        [Math.max(0, midBlock + maxBlockDifference * 9), Math.min(lastBlock, midBlock + maxBlockDifference * 10)],
      ];

      return blockRanges;
    }

    if (midBlockInfo?.timestamp! < Date.parse(targetTimestamp) / 1000) {
      startBlock = midBlock - 1;
    } else {
      endBlock = midBlock + 1;
    }
  }

  // If no matching block is found, return null
  return null;
};

// Function to make a Solana RPC request
export async function makeSolanaRpcRequest(network: Network, method: string, params: any[] = []) {
  const rpcUrl =
    network.toLowerCase() === "mainnet"
      ? process.env.SOLANA_RPC_URL
        ? process.env.SOLANA_RPC_URL
        : "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com";

  const rpcRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: method,
    params: params,
  };

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(rpcRequest),
  });

  const result: any = await response.json();
  return result;
}

// General Utils
export const compareNumbersTrailingZeros = (num1: number, num2: number) => {
  let count = 30;
  while (count > 0 && num1 % 10 === 0) {
    num1 /= 10;
    count--;
  }

  count = 30;
  while (count > 0 && num2 % 10 === 0) {
    num2 /= 10;
    count--;
  }
  return num1 === num2;
};

export const uint8ArrayToHex = (a: Uint8Array): string => Buffer.from(a).toString("hex");

export const hexToUint8Array = (h: string): Uint8Array => {
  if (h.startsWith("0x")) h = h.slice(2);
  return new Uint8Array(Buffer.from(h, "hex"));
};

export const ensureHexPrefix = (x: string): string => {
  return x.substring(0, 2) !== "0x" ? `0x${x}` : x;
};
