import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import fs from "fs";

import { createServer as createHttpServer } from "http";
import { createServer as createHttpsServer } from "https";
import { ethers } from "ethers";
import { JSONPreset } from "lowdb/node";

import { getChainInfo, getEthersProvider } from "./src/environment";
import { findBlockRangeByTimestamp, makeSolanaRpcRequest, wait } from "./src/utils";
import { Network, ChainId, Wormhole, chainIdToChain } from "@wormhole-foundation/connect-sdk";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { CosmwasmPlatform } from "@wormhole-foundation/connect-sdk-cosmwasm";

import "@wormhole-foundation/connect-sdk-evm-tokenbridge";
import "@wormhole-foundation/connect-sdk-solana-tokenbridge";
import "@wormhole-foundation/connect-sdk-cosmwasm-tokenbridge";

dotenv.config();

interface InfoRequest {
  network: Network;
  chain: string;
  address: string;
  tokenAddress: string;
  timestamp: string;
  amount: string;
  txHash: string;
}

type Data = {
  transactions: Record<string, string>;
};

interface WrappedAssetRequest {
  network: Network;
  tokenChain: string;
  tokenAddress: string;
  targetChain: string;
}

const initialData: Data = { transactions: {} };
const db = await JSONPreset<Data>("txns.json", initialData);
const { transactions } = db.data;

async function runServer() {
  // EXPRESS ENDPOINTS CONNECTIONS
  const app = express();
  app.use(express.json({ strict: false }));
  app.use(cors());

  app.get("/", (req, res) => {
    res.send("hey there");
  });

  app.get("/getRedeemTxn", async (req, res) => {
    const request = { ...req.query } as unknown as InfoRequest;
    console.log("Request getRedeemTxn with parameters:", JSON.stringify(request));

    if (
      !request.network ||
      !request.chain ||
      !request.address ||
      !request.tokenAddress ||
      !request.timestamp ||
      !request.amount ||
      !request.txHash
    ) {
      res.send("Missing parameters, we need to have: network, chain, address, tokenAddress, timestamp, amount");
      return;
    }

    try {
      const { address, chain, network, tokenAddress, timestamp, amount, txHash } = request;

      if (transactions[txHash]) {
        console.log("returning tx already saved");
        res.send({ redeemTxHash: transactions[txHash] });
        return;
      }

      // SOLANA GET REDEEM TXN HASH
      if (chain === "1") {
        // get transfers for the address
        const { result } = await makeSolanaRpcRequest(network, "getSignaturesForAddress", [address]);

        // filter the ones that have more than 20 min difference with transfer timestamp
        const TIME_DIFFERENCE_TOLERANCE = 2000;
        const signaturesDetails = result?.filter(
          a => Math.abs((a.blockTime || 0) - Date.parse(timestamp) / 1000) < TIME_DIFFERENCE_TOLERANCE,
        );

        console.log("amount of txs on time (amount of rpc request we gonna do):", signaturesDetails?.length);

        let redeemTxHash: string | null = null;

        if (signaturesDetails) {
          // list of tx hashes
          const signatures = signaturesDetails.map(tx => tx.signature);

          for (const sig of signatures) {
            await wait(500);
            const { result: txInfo } = await makeSolanaRpcRequest(network, "getTransaction", [sig, "jsonParsed"]);

            if (!!txInfo?.meta?.innerInstructions?.length) {
              for (const innerInstruction of txInfo?.meta?.innerInstructions) {
                if (!!innerInstruction?.instructions?.length) {
                  for (const instruction of innerInstruction.instructions) {
                    if (
                      instruction.parsed?.info?.account?.toLowerCase() === address.toLowerCase() &&
                      instruction.parsed?.type === "mintTo" &&
                      Math.abs(instruction.parsed.info.amount - +amount) < 10000 &&
                      instruction.program === "spl-token"
                    ) {
                      if (txInfo.transaction?.signatures && txInfo.transaction?.signatures.length === 1) {
                        redeemTxHash = txInfo.transaction.signatures[0];
                        console.log("redeemTxHash found!", redeemTxHash);

                        transactions[txHash] = redeemTxHash!;
                        await db.write();

                        res.send({ redeemTxHash });
                        return;
                      }
                    }
                  }
                }
              }
            }
          }
        }

        res.status(404).send("redeem txn not found");
        return;
      }

      // EVM GET REDEEM TXN HASH
      const evmChainInfo = getChainInfo(network, +chain as ChainId);
      if (!!evmChainInfo) {
        const ethersProvider = getEthersProvider(evmChainInfo);
        const blockRanges = await findBlockRangeByTimestamp(ethersProvider!, timestamp);

        if (!blockRanges) {
          res.send("unable to find block range for timestamp");
          return null;
        }

        const transferEventSignature = "Transfer(address,address,uint256)";
        const addressToFilter = ethers.zeroPadValue(ethers.getAddress(address), 32);

        let redeemTxHash: string | null = null;
        let logs: Array<ethers.Log> = [];

        for (const blockRange of blockRanges) {
          const filter = {
            fromBlock: blockRange[0],
            toBlock: blockRange[1],
            address: tokenAddress,
            topics: [ethers.id(transferEventSignature), null, addressToFilter],
          };

          if (ethersProvider) {
            logs = [...logs, ...(await ethersProvider.getLogs(filter))];
          }
        }

        for (const log of logs) {
          const parsedLog = ethers.AbiCoder.defaultAbiCoder().decode(
            ["uint256"],
            ethers.zeroPadValue(log.data, 32),
          );

          const tokenAmount = BigInt(parsedLog?.[0])?.toString();
          console.log({ tokenAmount });

          if (Math.abs(+tokenAmount - +amount) < 200000) {
            redeemTxHash = log.transactionHash;

            transactions[txHash] = redeemTxHash!;
            await db.write();
          }
        }

        if (redeemTxHash) {
          res.send({ redeemTxHash });
          return;
        }
      }

      res.status(404).send("redeem txn not found");
    } catch (err) {
      console.error("catch!!", err);
      res.status(404).send(`error getting info: ${err}`);
    }
  });

  app.get("/getWrappedAsset", async (req, res) => {
    const request = { ...req.query } as unknown as WrappedAssetRequest;
    console.log("Request getWrappedAsset with parameters:", JSON.stringify(request));

    if (!request.tokenChain || !request.tokenAddress || !request.network || !request.targetChain) {
      res.send("Missing parameters, we need to have: tokenChain, tokenAddress, network, targetChain");
      return;
    }

    try {
      const { network, tokenChain, tokenAddress, targetChain } = request;

      const wh = new Wormhole(network.toLowerCase() === "mainnet" ? "Mainnet" : "Testnet", [
        EvmPlatform,
        SolanaPlatform,
        CosmwasmPlatform,
      ]);

      const tokenID = Wormhole.chainAddress(chainIdToChain(+tokenChain as ChainId), tokenAddress);
      const tokenInfo = await wh.getWrappedAsset(chainIdToChain(+targetChain as ChainId), tokenID);

      const tokenList: any = fs.readFileSync("./tokenList.json");
      const parsedTokens = JSON.parse(tokenList);

      const wrappedToken = tokenInfo.address.toString();
      const tokenSymbol = parsedTokens?.[targetChain]?.[wrappedToken.toLowerCase()]?.symbol || "";

      if (wrappedToken) {
        console.log(`FOUND: address ${wrappedToken}${tokenSymbol ? ` with symbol ${tokenSymbol}` : ""}`);
        res.send({
          wrappedToken,
          tokenSymbol,
        });
        return;
      }

      res.status(404).send("unable to get wrappedAsset");
    } catch (e) {
      res.status(404).send(`error getWrappedAsset: ${e}`);
    }
  });

  const port = process.env.NODE_ENV === "DEV" ? 8080 : 443;
  console.log(process.env.NODE_ENV);
  const server =
    process.env.NODE_ENV === "DEV"
      ? createHttpServer(app)
      : createHttpsServer(
          {
            key: fs.readFileSync("/etc/letsencrypt/live/cryptotruco.com/privkey.pem"),
            cert: fs.readFileSync("/etc/letsencrypt/live/cryptotruco.com/fullchain.pem"),
          },
          app,
        );

  server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

runServer();
