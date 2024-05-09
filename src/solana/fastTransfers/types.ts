// from https://github.com/wormhole-foundation/example-liquidity-layer/blob/e7a987323756218a5c4d6d8ebc4a00a92291a935/solana/ts/src/matchingEngine/state/Auction.ts
import { BN, web3 } from "@coral-xyz/anchor";

export type MessageProtocol = {
  local?: { programId: PublicKey };
  cctp?: { domain: number };
  none?: {};
};

type PublicKey = web3.PublicKey;

export type AuctionStatus = {
  notStarted?: {};
  active?: {};
  completed?: { slot: BN; executePenalty: BN | null };
  settled?: {
    fee: BN;
    totalPenalty: BN | null;
  };
};

export type AuctionDestinationAssetInfo = {
  custodyTokenBump: number;
  amountOut: BN;
};

export type AuctionInfo = {
  configId: number;
  custodyTokenBump: number;
  vaaSequence: BN;
  sourceChain: number;
  bestOfferToken: PublicKey;
  initialOfferToken: PublicKey;
  startSlot: BN;
  amountIn: BN;
  securityDeposit: BN;
  offerPrice: BN;
  destinationAssetInfo: AuctionDestinationAssetInfo | null;
};

export type Auction = {
  bump: number;
  vaaHash: number[];
  vaaTimestamp: number;
  targetProtocol: MessageProtocol;
  status: AuctionStatus;
  info: AuctionInfo | null;
};
