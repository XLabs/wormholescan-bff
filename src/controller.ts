import { Context, Next } from "koa";
import { ethers } from "ethers";
import { AlgoInfo, Asset, Transaction } from "./mongodb.js";
import { ChainId, chainIdToChain, Network, toNative, Wormhole } from "@wormhole-foundation/connect-sdk";
import algosdk from "algosdk";
import { getChainInfo, getEthersProvider } from "./environment.js";
import {
  MAX_BLOCK_DIFFERENCE,
  compareNumbersTrailingZeros,
  findBlockRangeByTimestamp,
  hexToUint8Array,
  makeSolanaRpcRequest,
} from "./utils.js";
import { AlgoAssetRequest, InfoRequest, WrappedAssetRequest } from "../index.js";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { SolanaPlatform } from "@wormhole-foundation/connect-sdk-solana";
import {
  CosmwasmAddress,
  CosmwasmChains,
  CosmwasmPlatform,
  Gateway,
} from "@wormhole-foundation/connect-sdk-cosmwasm";
import { AlgorandPlatform } from "@wormhole-foundation/connect-sdk-algorand";
import { getFullnodeUrl, SuiClient } from "@mysten/sui.js/client";
import { getForeignAssetSui } from "./sui.js";
import fs from "fs";
import { LRUCache } from "lru-cache";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tokenList: any = fs.readFileSync(join(__dirname, "./tokenList.json"));
const parsedTokens = JSON.parse(tokenList);

export class ApiController {
  protected wrappedAssetCache: LRUCache<string, any> = new LRUCache({
    max: 10000,
    allowStale: true,
  });

  getWrappedAsset = async (ctx, next) => {
    const request = { ...ctx.query } as unknown as WrappedAssetRequest;
    console.log("Request getWrappedAsset with parameters:", JSON.stringify(request));

    if (!request.tokenChain || !request.tokenAddress || !request.network || !request.targetChain) {
      ctx.body = "Missing parameters, we need to have: tokenChain, tokenAddress, network, targetChain";
      return;
    }

    try {
      const { tokenChain, tokenAddress, targetChain } = request;
      const gatewayChain = !!request.gatewayChain ? request.gatewayChain : "";
      const network = (request.network.toLowerCase() === "mainnet" ? "Mainnet" : "Testnet") as Network;

      const key = `${network}-${tokenChain}-${tokenAddress}-${targetChain}`;

      if (this.wrappedAssetCache.has(key)) {
        const savedAsset = this.wrappedAssetCache.get(key);
        console.log(
          `FOUND EXISTING IN LOCAL CACHE: address ${savedAsset.data.wrappedToken}${
            savedAsset.data.tokenSymbol ? ` with symbol ${savedAsset.data.tokenSymbol}` : ""
          }`,
        );

        ctx.set("Cache-Control", "public, max-age=31557600, s-maxage=31557600"); // 1 year cache
        ctx.body = savedAsset.data;
        return;
      }

      const savedAsset = await Asset.findOne({
        network,
        tokenChain,
        tokenAddress,
        targetChain,
        gatewayChain,
      }).lean();

      if (savedAsset) {
        this.wrappedAssetCache.set(key, savedAsset);

        console.log(
          `FOUND EXISTING IN DB: address ${savedAsset.data.wrappedToken}${
            savedAsset.data.tokenSymbol ? ` with symbol ${savedAsset.data.tokenSymbol}` : ""
          }`,
        );

        ctx.set("Cache-Control", "public, max-age=31557600, s-maxage=31557600"); // 1 year cache
        ctx.body = savedAsset.data;
        return;
      }

      const wh = new Wormhole(network, [EvmPlatform, SolanaPlatform, CosmwasmPlatform, AlgorandPlatform]);

      const returnAsset = async (wrappedToken: string) => {
        let tokenSymbol = parsedTokens?.[targetChain]?.[wrappedToken.toLowerCase()]?.symbol || "";

        const newAsset = new Asset({
          network,
          tokenChain,
          tokenAddress,
          targetChain,
          gatewayChain,
          data: {
            wrappedToken,
            tokenSymbol,
          },
        });
        await newAsset.save();

        this.wrappedAssetCache.set(key, newAsset);
        console.log(`FOUND NEW: address ${wrappedToken}${tokenSymbol ? ` with symbol ${tokenSymbol}` : ""}`);

        ctx.set("Cache-Control", "public, max-age=31557600, s-maxage=31557600"); // 1 year cache
        ctx.body = {
          wrappedToken,
          tokenSymbol,
        };
      };

      // SUI target
      if (targetChain === "21") {
        const which = network === "Mainnet" ? "mainnet" : "testnet";
        const suiClient = new SuiClient({ url: getFullnodeUrl(which) });
        const tokenBridgeContract = wh.getContracts("Sui")?.tokenBridge;

        const nativeTokenAddress = toNative(chainIdToChain(+tokenChain as ChainId), tokenAddress);

        const foreignAsset = await getForeignAssetSui(
          suiClient,
          tokenBridgeContract!,
          +tokenChain,
          hexToUint8Array(nativeTokenAddress.toUniversalAddress().toString()),
        );

        if (foreignAsset) {
          await returnAsset(foreignAsset);
          return;
        }
      }

      // EVM, SOLANA, COSMWASM, ALGORAND target
      const tokenID = Wormhole.chainAddress(chainIdToChain(+tokenChain as ChainId), tokenAddress);
      const tokenInfo = await wh.getWrappedAsset(chainIdToChain(+targetChain as ChainId), tokenID);
      const foreignAsset = tokenInfo.address.toString();

      // COSMWASM: Wormhole Gateway process
      if (tokenInfo.chain === "Wormchain") {
        console.log("Gateway asset!");
        if (!gatewayChain) throw new Error("gatewayChain parameter should be there for Wormhole Gateway");

        const cosmWasmPlatform = wh.getPlatform("Cosmwasm");
        const gateway = new Gateway("Wormchain", cosmWasmPlatform);

        const factoryToken = (await gateway.getWrappedAsset(tokenID)).unwrap();

        if (factoryToken) {
          const ibcDenom = Gateway.deriveIbcDenom(
            network,
            chainIdToChain(+gatewayChain as ChainId) as CosmwasmChains,
            new CosmwasmAddress(factoryToken).toString(),
          )?.toString();

          if (ibcDenom) {
            await returnAsset(ibcDenom);
            return;
          }
        }
      }

      if (foreignAsset) {
        await returnAsset(foreignAsset);
        return;
      }

      ctx.status = 404;
      ctx.body = "unable to get wrappedAsset";
    } catch (e) {
      console.error("error on getWrappedAsset", e);
      ctx.status = 404;
      ctx.body = `error getWrappedAsset: ${e}`;
    }
  };

  protected algoAssetInfoCache: LRUCache<string, any> = new LRUCache({
    max: 2500,
    allowStale: true,
  });

  getAlgoAssetInfo = async (ctx, next) => {
    const request = { ...ctx.query } as unknown as AlgoAssetRequest;
    console.log("Request getAlgoAssetInfo with parameters:", JSON.stringify(request));

    if (!request.tokenAddress || !request.network) {
      ctx.body = "Missing parameters, we need to have: tokenAddress, network";
      return;
    }

    try {
      const { network, tokenAddress } = request;
      const key = `${network}-${tokenAddress}`;

      if (this.algoAssetInfoCache.has(key)) {
        const savedAlgoInfo = this.algoAssetInfoCache.get(key);
        console.log(
          `FOUND EXISTING IN LOCAL CACHE: asset ${savedAlgoInfo.data.assetId}${
            savedAlgoInfo.data.symbol ? ` with symbol ${savedAlgoInfo.data.symbol}` : ""
          }${savedAlgoInfo.data.decimals ? ` with decimals ${savedAlgoInfo.data.decimals}` : ""}`,
        );

        ctx.set("Cache-Control", "public, max-age=31557600, s-maxage=31557600"); // 1 year cache
        ctx.body = savedAlgoInfo.data;
        return;
      }

      const savedAlgoInfo = await AlgoInfo.findOne({
        network,
        tokenAddress,
      }).lean();

      if (savedAlgoInfo) {
        this.algoAssetInfoCache.set(key, savedAlgoInfo);

        console.log(
          `FOUND EXISTING IN DB: asset ${savedAlgoInfo.data.assetId}${
            savedAlgoInfo.data.symbol ? ` with symbol ${savedAlgoInfo.data.symbol}` : ""
          }${savedAlgoInfo.data.decimals ? ` with decimals ${savedAlgoInfo.data.decimals}` : ""}`,
        );

        ctx.set("Cache-Control", "public, max-age=31557600, s-maxage=31557600"); // 1 year cache
        ctx.body = savedAlgoInfo.data;
        return;
      }

      const tokenID = Wormhole.chainAddress("Algorand", tokenAddress);
      const assetId = "" + toNative("Algorand", tokenID.address.toUniversalAddress()).toInt();

      if (!assetId) {
        ctx.status = 404;
        ctx.body = "asset id not found";
        return;
      }

      const algoUrl =
        network.toLowerCase() === "mainnet"
          ? "https://mainnet-api.algonode.cloud"
          : "https://testnet-api.algonode.cloud";

      const algodClient = new algosdk.Algodv2("", algoUrl, "");
      const assetInfo = await algodClient.getAssetByID(+assetId).do();

      const decimals = assetInfo?.params?.decimals;
      const symbol = assetInfo?.params?.["unit-name"];

      const newAlgoInfo = new AlgoInfo({
        network,
        tokenAddress,
        data: {
          assetId,
          decimals,
          symbol,
        },
      });
      await newAlgoInfo.save();

      this.algoAssetInfoCache.set(key, newAlgoInfo);
      console.log(`FOUND NEW ALGOINFO: ${assetId}`);
      ctx.set("Cache-Control", "public, max-age=31557600, s-maxage=31557600"); // 1 year cache
      if (decimals && symbol) {
        ctx.body = {
          assetId,
          decimals,
          symbol,
        };
      } else {
        ctx.body = { assetId };
      }
    } catch (e) {
      console.error("error on getAlgoAssetInfo", e);
      ctx.status = 404;
      ctx.body = `error getWrappedAsset: ${e}`;
    }
  };

  protected redeemTxCache: LRUCache<string, any> = new LRUCache({
    max: 2500,
    allowStale: true,
  });

  getRedeemTx = async (ctx: Context, next: Next) => {
    const request = { ...ctx.query } as unknown as InfoRequest;
    console.log("Request getRedeemTxn with parameters:", JSON.stringify(request));

    if (
      !request.address ||
      !request.amount ||
      !request.fromChain ||
      !request.network ||
      !request.sequence ||
      !request.timestamp ||
      !request.toChain ||
      !request.tokenAddress ||
      !request.txHash
    ) {
      ctx.body =
        "Missing parameters, we need to have: address, amount, fromChain, network, sequence, timestamp, toChain, tokenAddress, txHash";
      return;
    }

    try {
      const { address, fromChain, toChain, network, tokenAddress, timestamp, amount, txHash, sequence } = request;
      const key = `${network}-${txHash}`;

      if (this.redeemTxCache.has(key)) {
        const savedRedeemInfo = this.redeemTxCache.get(key);
        console.log(`FOUND EXISTING IN LOCAL CACHE: redeem txn ${savedRedeemInfo.data.redeemTxHash}`);

        ctx.set("Cache-Control", "public, max-age=31557600, s-maxage=31557600"); // 1 year cache
        ctx.body = savedRedeemInfo.data;
        return;
      }

      const savedTransaction = await Transaction.findOne({ txHash });

      if (savedTransaction) {
        this.redeemTxCache.set(key, savedTransaction);

        console.log("FOUND EXISTING IN DB: redeem txn", savedTransaction.data?.redeemTxHash);
        ctx.set("Cache-Control", "public, max-age=31557600, s-maxage=31557600"); // 1 year cache
        ctx.body = savedTransaction.data;
        return;
      }

      const returnTransaction = async (redeemTxHash: string, timestampMs?: number) => {
        const newTransaction = new Transaction({
          txHash,
          data: {
            redeemTxHash: redeemTxHash,
            timestamp: timestampMs,
          },
        });
        await newTransaction.save();

        this.redeemTxCache.set(key, newTransaction);

        console.log(`new ${chainIdToChain(+toChain as ChainId)} redeemTxHash found! ${redeemTxHash}`);

        ctx.set("Cache-Control", "public, max-age=31557600, s-maxage=31557600"); // 1 year cache
        ctx.body = { redeemTxHash, timestamp: timestampMs };
      };

      // SUI GET REDEEM TXN HASH
      if (toChain === "21") {
        const which = network.toLowerCase() === "mainnet" ? "mainnet" : "testnet";
        const suiClient = new SuiClient({ url: getFullnodeUrl(which) });

        let cursor: string | null | undefined = null;
        let hasMore = true;
        let ii = 0;
        const limit = 4;
        let redeemTxHash = "";
        let timestampMs = 0;

        while (hasMore && ii < limit) {
          try {
            const addressTxns = await suiClient.queryTransactionBlocks({
              options: {
                showRawInput: true,
                showEvents: true,
              },
              filter: {
                ToAddress: address,
              },
              cursor,
            });

            ii = ii + 1;
            hasMore = addressTxns.hasNextPage;
            cursor = addressTxns.nextCursor;

            if (addressTxns.data) {
              for (const txnBlock of addressTxns.data) {
                if (txnBlock.events) {
                  for (const event of txnBlock.events!) {
                    const parsedJson: any = event.parsedJson;
                    if (
                      parsedJson &&
                      `${parsedJson?.emitter_chain}` === fromChain &&
                      parsedJson?.sequence === sequence
                    ) {
                      redeemTxHash = txnBlock.digest;
                      timestampMs = +txnBlock.timestampMs!;
                    }
                  }
                }
              }
            }
            if (redeemTxHash) {
              break;
            }
          } catch (e) {
            console.error("unable to get redeem txn for sui txn");
            break;
          }
        }

        if (redeemTxHash) {
          await returnTransaction(redeemTxHash, timestampMs || undefined);
          return;
        }

        ctx.status = 404;
        ctx.body = "redeem txn not found";
        return;
      }

      // SOLANA GET REDEEM TXN HASH
      if (toChain === "1") {
        // get transfers for the address
        const { result } = await makeSolanaRpcRequest(network, "getSignaturesForAddress", [address]);

        // filter the ones older than source tx timestamp
        const signaturesDetails = result?.filter(a => a.blockTime > Date.parse(timestamp) / 1000 - 1000);

        let redeemTxHash: string | null = null;
        if (signaturesDetails) {
          // list of tx hashes
          let signatures = signaturesDetails.map(tx => tx.signature);
          console.log("amount of txs on time", signatures?.length);

          // prevent more than 100 requests, last 50 txns and the 50 closer to the timestamp
          if (signatures.length > 100) {
            signatures = [
              ...signatures.slice(0, 50),
              ...signatures.slice(signatures.length - 51, signatures.length - 1),
            ];
          }

          for (const sig of signatures) {
            const { result: txInfo } = await makeSolanaRpcRequest(network, "getTransaction", [
              sig,
              { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
            ]);

            console.log(`sig: ${sig}, blockTime: ${txInfo?.blockTime}`);

            if (!!txInfo?.meta?.innerInstructions?.length) {
              for (const innerInstruction of txInfo?.meta?.innerInstructions) {
                if (!!innerInstruction?.instructions?.length) {
                  // SOL (native token) transfer
                  if (
                    innerInstruction.instructions.some(
                      instruction =>
                        compareNumbersTrailingZeros(+instruction.parsed?.info?.amount, +amount) &&
                        instruction.parsed?.type === "transfer",
                    ) &&
                    innerInstruction.instructions.some(
                      instruction =>
                        instruction.parsed?.info?.destination?.toLowerCase() === address.toLowerCase() &&
                        instruction.parsed?.type === "transfer",
                    )
                  ) {
                    if (txInfo.transaction?.signatures && txInfo.transaction?.signatures.length === 1) {
                      redeemTxHash = txInfo.transaction.signatures[0];
                      console.log("Native SOL transfer redeem detected");

                      await returnTransaction(redeemTxHash!, +txInfo?.blockTime * 1000 || undefined);
                      return;
                    }
                  }
                  // NTT transfers
                  else if (
                    innerInstruction.instructions.some(
                      instruction =>
                        instruction?.parsed?.info?.mint?.toLowerCase() === tokenAddress.toLowerCase() &&
                        instruction?.parsed?.info?.tokenAmount?.uiAmount === +amount / 10 ** 8,
                    )
                  ) {
                    if (txInfo.transaction?.signatures && txInfo.transaction?.signatures.length === 1) {
                      redeemTxHash = txInfo.transaction.signatures[0];
                      console.log("NTT transfer redeem detected");

                      await returnTransaction(redeemTxHash!, +txInfo?.blockTime * 1000 || undefined);
                      return;
                    }
                  }
                  // SPL token transfer
                  else {
                    for (const instruction of innerInstruction.instructions) {
                      if (
                        instruction.parsed?.type === "mintTo" &&
                        instruction.parsed?.info?.mint?.toLowerCase() === tokenAddress.toLowerCase() &&
                        Math.abs(+instruction.parsed?.info?.amount - +amount) < 10000 &&
                        instruction.program === "spl-token"
                      ) {
                        if (txInfo.transaction?.signatures && txInfo.transaction?.signatures.length === 1) {
                          redeemTxHash = txInfo.transaction.signatures[0];
                          console.log("SPL token transfer redeem detected");

                          await returnTransaction(redeemTxHash!, +txInfo?.blockTime * 1000 || undefined);
                          return;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        ctx.status = 404;
        ctx.body = "redeem txn not found";
        return;
      }

      // EVM GET REDEEM TXN HASH
      const evmChainInfo = getChainInfo(network, +toChain as ChainId);
      if (!!evmChainInfo) {
        // const ethersProvider = getEthersProvider(evmChainInfo);
        const ethersProvider = getEthersProvider(network, +toChain as ChainId);
        const blockRanges = await findBlockRangeByTimestamp(ethersProvider!, timestamp);

        if (!blockRanges) {
          ctx.body = "unable to find block range for timestamp";
          return null;
        }

        const sequenceToFilter = ethers.zeroPadValue("0x" + BigInt(+sequence).toString(16).padStart(64, "0"), 32);
        const chainToFilter = ethers.zeroPadValue("0x" + BigInt(+fromChain).toString(16).padStart(64, "0"), 32);
        const addressToFilter = ethers.zeroPadValue(ethers.getAddress(address), 32);

        let redeemTxHash: string | null = null;
        let logs: Array<ethers.Log> = [];

        for (const blockRange of blockRanges) {
          if (blockRange[0] > blockRange[1]) {
            blockRange[0] = blockRange[1] - MAX_BLOCK_DIFFERENCE;
          }

          const redeemedEventSignature = "Redeemed(uint16,bytes32,uint64)";
          const filterRedeemed = {
            fromBlock: blockRange[0],
            toBlock: blockRange[1],
            address: address,
            topics: [ethers.id(redeemedEventSignature), null, null, sequenceToFilter],
          };

          const foundRedeem = await ethersProvider!.getLogs(filterRedeemed);
          if (foundRedeem.length) {
            console.log("redeemed event found");

            redeemTxHash = foundRedeem[0].transactionHash;
            const logBlock = await ethersProvider!.getBlock(foundRedeem[0].blockNumber);
            const timestampMs = logBlock?.timestamp ? logBlock.timestamp * 1000 : undefined;

            await returnTransaction(redeemTxHash, timestampMs);
            return;
          }

          const transferRedeemedEventSignature = "TransferRedeemed(uint16,bytes32,uint64)";
          const filterTransferRedeem = {
            fromBlock: blockRange[0],
            toBlock: blockRange[1],
            topics: [ethers.id(transferRedeemedEventSignature), chainToFilter, null, sequenceToFilter],
          };

          const foundTransferRedeem = await ethersProvider!.getLogs(filterTransferRedeem);
          if (foundTransferRedeem.length) {
            console.log("transferRedeemed event found");

            redeemTxHash = foundTransferRedeem[0].transactionHash;
            const logBlock = await ethersProvider!.getBlock(foundTransferRedeem[0].blockNumber);
            const timestampMs = logBlock?.timestamp ? logBlock.timestamp * 1000 : undefined;

            await returnTransaction(redeemTxHash, timestampMs);
            return;
          }

          // NTT
          const receivedMessageSignature = "ReceivedMessage(bytes32,uint16,bytes32,uint64)";
          const filterReceivedMessage = {
            fromBlock: blockRange[0],
            toBlock: blockRange[1],
            topics: [ethers.id(receivedMessageSignature)],
          };

          const foundReceivedMessage = await ethersProvider!.getLogs(filterReceivedMessage);
          if (foundReceivedMessage.length) {
            console.log("received message event found");

            const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
              ["bytes32", "uint16", "bytes32", "uint64"],
              foundReceivedMessage[0].data,
            );

            if (
              decodedData?.length === 4 &&
              decodedData[1]?.toString() === `${fromChain}` &&
              decodedData[3]?.toString() === `${sequence}`
            ) {
              redeemTxHash = foundReceivedMessage[0].transactionHash;

              const logBlock = await ethersProvider!.getBlock(foundReceivedMessage[0].blockNumber);
              const timestampMs = logBlock?.timestamp ? logBlock.timestamp * 1000 : undefined;

              await returnTransaction(redeemTxHash, timestampMs);
              return;
            }
          }

          const transferEventSignature = "Transfer(address,address,uint256)";
          const filterTransfer = {
            fromBlock: blockRange[0],
            toBlock: blockRange[1],
            address: tokenAddress,
            topics: [ethers.id(transferEventSignature), null, addressToFilter],
          };

          logs = [...logs, ...(await ethersProvider!.getLogs(filterTransfer))];
        }

        for (const log of logs) {
          const parsedLog = ethers.AbiCoder.defaultAbiCoder().decode(
            ["uint256"],
            ethers.zeroPadValue(log.data, 32),
          );

          const tokenAmount = BigInt(parsedLog?.[0])?.toString();

          const tokenDecimalsAbi = ["function decimals() view returns (uint8)"];
          const contract = new ethers.Contract(tokenAddress, tokenDecimalsAbi, ethersProvider);
          const [tokenDecimals] = await Promise.all([contract.decimals()]);

          if (
            Math.abs(+tokenAmount - +amount) < 200000 ||
            Math.abs(+ethers.formatUnits(tokenAmount, tokenDecimals || 8) - +ethers.formatUnits(amount, 8)) < 0.5
          ) {
            console.log("Transfer event found");

            redeemTxHash = log.transactionHash;
            const logBlock = await ethersProvider!.getBlock(log.blockNumber);
            const timestampMs = logBlock?.timestamp ? logBlock.timestamp * 1000 : undefined;
            if (new Date(timestamp) < new Date(timestampMs)) {
              await returnTransaction(redeemTxHash, timestampMs);
              return;
            }
          }
        }
      }

      ctx.status = 404;
      ctx.body = "redeem txn not found";
    } catch (err) {
      console.error("catch!!", err);
      ctx.status = 404;
      ctx.body = `error getting info: ${err}`;
    }
  };
}
