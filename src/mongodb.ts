import mongoose from "mongoose";

const assetSchema = new mongoose.Schema({
  network: String,
  tokenAddress: String,
  tokenChain: String,
  targetChain: String,
  data: mongoose.Schema.Types.Mixed,
});

export const Asset = mongoose.model("Asset", assetSchema);

const transactionSchema = new mongoose.Schema({
  txHash: String,
  data: mongoose.Schema.Types.Mixed,
});

export const Transaction = mongoose.model("Transaction", transactionSchema);

const algoInfoSchema = new mongoose.Schema({
  network: String,
  tokenAddress: String,
  data: mongoose.Schema.Types.Mixed,
});

export const AlgoInfo = mongoose.model("AlgoInfo", algoInfoSchema);
