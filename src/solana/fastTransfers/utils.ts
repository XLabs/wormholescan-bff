import { Program, web3 } from "@coral-xyz/anchor";
import { Network } from "@wormhole-foundation/sdk";
import { SolanaZeroAddress } from "@wormhole-foundation/sdk-solana";
import { getSolanaRpc } from "../../utils.js";
import { MatchingEngine } from "./idl/matching_engine.js";
import MatchingEngineIDL from "./idl/matching_engine.json";
import { Auction } from "./types.js";

export const IX_DATA_EXECUTE_CCTP = "b0261e11e64ece9d";
export const IX_DATA_EXECUTE_LOCAL = "8cce1af3f34218f0";
export const SOLANA_SEQ_LOG = "Program log: Sequence: ";

export const mapAuctionStatus = (auction?: Auction) => {
  if (!auction || !!auction.status.notStarted) return { notStarted: {} };
  if (!!auction.status.active) return { active: {} };
  if (!!auction.status.completed) {
    return {
      completed: {
        slot: auction.status.completed.slot.toString(),
        executePenalty: auction.status.completed.executePenalty?.toString(),
      },
    };
  }
  if (!!auction.status.settled) {
    return {
      settled: {
        fee: auction.status.settled.fee.toString(),
        totalPenalty: auction.status.settled.totalPenalty?.toString(),
      },
    };
  }

  // TODO: how to handle when there was no auction created? Assume notStarted?
  return { notStarted: {} };
};

export const mapTargetProtocol = (auction?: Auction) => {
  if (!!auction?.targetProtocol?.local)
    return { local: { programId: auction.targetProtocol.local.programId.toString() } };
  if (!!auction?.targetProtocol?.cctp) return { cctp: { domain: auction.targetProtocol.cctp.domain } };
  return { none: {} };
};

export const normalizeNetwork = (network: string): Network =>
  network.toLowerCase() === "mainnet" ? "Mainnet" : "Testnet";

export const buildProgramAndConnection = (requestedNetwork: string) => {
  const network = normalizeNetwork(requestedNetwork);
  const programId = matchingEngineProgramId(network);

  const rpc = getSolanaRpc(network);
  const connection = new web3.Connection(rpc);
  const program = new Program<MatchingEngine>(
    { ...(MatchingEngineIDL as any), address: programId },
    { connection },
  );

  return { program, connection, network, programId };
};

export function deriveAuctionAddress(programId: web3.PublicKey, vaaHash: Array<number> | Buffer | Uint8Array) {
  return web3.PublicKey.findProgramAddressSync([Buffer.from("auction"), Buffer.from(vaaHash)], programId)[0];
}

export const matchingEngineProgramId = (network: Network) => {
  if (network === "Mainnet")
    return new web3.PublicKey(process.env.LIQUIDITY_LAYER_PROGRAM_ID_MAINNET || SolanaZeroAddress);
  return new web3.PublicKey(
    process.env.LIQUIDITY_LAYER_PROGRAM_ID_TESTNET || "mPydpGUWxzERTNpyvTKdvS7v8kvw5sgwfiP8WQFrXVS",
  );
};

export const findExecuteOrderLog = (program: Program<MatchingEngine>, tx: web3.VersionedTransactionResponse) => {
  const executeOrderIx = tx?.transaction.message.compiledInstructions.find(ix =>
    [IX_DATA_EXECUTE_CCTP, IX_DATA_EXECUTE_LOCAL].includes(Buffer.from(ix.data).toString("hex")),
  );
  if (!executeOrderIx) return null;

  // check that the OrderExecuted event was emitted
  const log = tx?.meta?.logMessages
    ?.filter(l => l.startsWith("Program data: "))
    .map(l => {
      const cleantLog = l.substring("Program data: ".length).trim();
      return program.coder.events.decode(cleantLog);
    })
    .find(l => l.name === "orderExecuted");

  return log;
};
