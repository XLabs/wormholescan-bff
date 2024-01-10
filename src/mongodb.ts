import mongoose from "mongoose";

const assetSchema = new mongoose.Schema({
  network: String,
  tokenAddress: { type: String, index: true },
  tokenChain: String,
  targetChain: String,
  gatewayChain: String,
  data: mongoose.Schema.Types.Mixed,
});

export const Asset = mongoose.model("Asset", assetSchema);

const transactionSchema = new mongoose.Schema({
  txHash: { type: String, index: true },
  data: mongoose.Schema.Types.Mixed,
});

export const Transaction = mongoose.model("Transaction", transactionSchema);

const algoInfoSchema = new mongoose.Schema({
  network: String,
  tokenAddress: { type: String, index: true },
  data: mongoose.Schema.Types.Mixed,
});

export const AlgoInfo = mongoose.model("AlgoInfo", algoInfoSchema);
