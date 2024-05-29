import { ethers } from "ethers";
import { Chain, ChainId, Network } from "@wormhole-foundation/sdk";

const MAINNET_RPCS: { [key in Chain]?: string } = {
  Acala: "https://eth-rpc-acala.aca-api.network",
  Algorand: "https://mainnet-api.algonode.cloud",
  Aptos: "https://fullnode.mainnet.aptoslabs.com",
  Arbitrum: "https://rpc.ankr.com/arbitrum",
  Avalanche: "https://rpc.ankr.com/avalanche",
  Base: "https://mainnet.base.org",
  Blast: "https://rpc.ankr.com/blast",
  Bsc: "https://1rpc.io/bnb",
  Celo: "https://forno.celo.org",
  Ethereum: "https://rpc.ankr.com/eth",
  Fantom: "https://rpc.ankr.com/fantom",
  Injective: "https://api.injective.network",
  Karura: "https://eth-rpc-karura.aca-api.network",
  Klaytn: "https://klaytn-mainnet-rpc.allthatnode.com:8551",
  Moonbeam: "https://rpc.ankr.com/moonbeam",
  Near: "https://rpc.mainnet.near.org",
  Oasis: "https://emerald.oasis.dev",
  Optimism: "https://rpc.ankr.com/optimism",
  Polygon: "https://rpc.ankr.com/polygon",
  Scroll: "https://rpc.ankr.com/scroll",
  Solana: "https://api.mainnet-beta.solana.com",
  Sui: "https://rpc.mainnet.sui.io",
  Terra: "https://terra-classic-fcd.publicnode.com",
  Terra2: "https://lcd-terra.tfl.foundation",
  Xlayer: "https://xlayerrpc.okx.com",
  Xpla: "https://dimension-lcd.xpla.dev",
};

const TESTNET_RPCS: { [key in Chain]?: string } = {
  // Arbitrum: "https://goerli-rollup.arbitrum.io/rpc",
  ArbitrumSepolia: "https://sepolia-rollup.arbitrum.io/rpc",
  Avalanche: "https://api.avax-test.network/ext/bc/C/rpc",
  // Base: "https://goerli.base.org",
  BaseSepolia: "https://sepolia.base.org",
  Blast: "https://sepolia.blast.io",
  Bsc: "https://data-seed-prebsc-2-s3.binance.org:8545",
  Celo: "https://alfajores-forno.celo-testnet.org",
  // Ethereum: "https://rpc.ankr.com/eth_goerli",
  Moonbeam: "https://rpc.api.moonbase.moonbeam.network",
  // Optimism: "https://goerli.optimism.io",
  OptimismSepolia: "https://sepolia.optimism.io",
  // Polygon: "https://rpc.ankr.com/polygon_mumbai",
  PolygonSepolia: "https://rpc.ankr.com/polygon_amoy",
  Scroll: "https://rpc.ankr.com/scroll_sepolia_testnet",
  Sepolia: "https://rpc.sepolia.org",
  Xlayer: "https://xlayertestrpc.okx.com",
};

export type Environment = {
  chainInfos: ChainInfo[];
  network: Network;
};

export type ChainInfo = {
  chainId: ChainId;
  rpcUrl: string;
};

export const testnetEnv: Environment = {
  network: "Testnet",
  chainInfos: [
    // {
    //   chainId: 2 as ChainId,
    //   rpcUrl: TESTNET_RPCS.Ethereum || "",
    // },
    {
      chainId: 4 as ChainId,
      rpcUrl: TESTNET_RPCS.Bsc || "",
    },
    // {
    //   chainId: 5 as ChainId,
    //   rpcUrl: TESTNET_RPCS.Polygon || "",
    // },
    {
      chainId: 6 as ChainId,
      rpcUrl: TESTNET_RPCS.Avalanche || "",
    },
    {
      chainId: 14 as ChainId,
      rpcUrl: TESTNET_RPCS.Celo || "",
    },
    {
      chainId: 16 as ChainId,
      rpcUrl: TESTNET_RPCS.Moonbeam || "",
    },
    // {
    //   chainId: 30 as ChainId,
    //   rpcUrl: TESTNET_RPCS.Base || "",
    // },
    // {
    //   chainId: 23 as ChainId,
    //   rpcUrl: TESTNET_RPCS.Arbitrum || "",
    // },
    // {
    //   chainId: 24 as ChainId,
    //   rpcUrl: TESTNET_RPCS.Optimism || "",
    // },
    {
      chainId: 34 as ChainId,
      rpcUrl: TESTNET_RPCS.Scroll || "",
    },
    {
      chainId: 36 as ChainId,
      rpcUrl: TESTNET_RPCS.Blast || "",
    },
    {
      chainId: 37 as ChainId,
      rpcUrl: TESTNET_RPCS.Xlayer || "",
    },
    {
      chainId: 10002 as ChainId,
      rpcUrl: TESTNET_RPCS.Sepolia || "",
    },
    {
      chainId: 10003 as ChainId,
      rpcUrl: TESTNET_RPCS.ArbitrumSepolia || "",
    },
    {
      chainId: 10004 as ChainId,
      rpcUrl: TESTNET_RPCS.BaseSepolia || "",
    },
    {
      chainId: 10005 as ChainId,
      rpcUrl: TESTNET_RPCS.OptimismSepolia || "",
    },
    {
      chainId: 10007 as ChainId,
      rpcUrl: TESTNET_RPCS.PolygonSepolia || "",
    },
  ],
};

export const mainnetEnv: Environment = {
  network: "Mainnet",
  chainInfos: [
    {
      chainId: 2 as ChainId,
      rpcUrl: MAINNET_RPCS.Ethereum || "",
    },
    {
      chainId: 4 as ChainId,
      rpcUrl: MAINNET_RPCS.Bsc || "",
    },
    {
      chainId: 5 as ChainId,
      rpcUrl: MAINNET_RPCS.Polygon || "",
    },
    {
      chainId: 6 as ChainId,
      rpcUrl: MAINNET_RPCS.Avalanche || "",
    },
    {
      chainId: 10 as ChainId,
      rpcUrl: MAINNET_RPCS.Fantom || "",
    },
    {
      chainId: 13 as ChainId,
      rpcUrl: MAINNET_RPCS.Klaytn || "",
    },
    {
      chainId: 14 as ChainId,
      rpcUrl: MAINNET_RPCS.Celo || "",
    },
    {
      chainId: 16 as ChainId,
      rpcUrl: MAINNET_RPCS.Moonbeam || "",
    },
    {
      chainId: 23 as ChainId,
      rpcUrl: MAINNET_RPCS.Arbitrum || "",
    },
    {
      chainId: 24 as ChainId,
      rpcUrl: MAINNET_RPCS.Optimism || "",
    },
    {
      chainId: 30 as ChainId,
      rpcUrl: MAINNET_RPCS.Base || "",
    },
    {
      chainId: 34 as ChainId,
      rpcUrl: MAINNET_RPCS.Scroll || "",
    },
    {
      chainId: 36 as ChainId,
      rpcUrl: MAINNET_RPCS.Blast || "",
    },
    {
      chainId: 37 as ChainId,
      rpcUrl: MAINNET_RPCS.Xlayer || "",
    },
  ],
};

const mainnetProviders = {};
for (const chain of mainnetEnv.chainInfos) {
  const provider = new ethers.JsonRpcProvider(chain.rpcUrl);

  try {
    await provider._detectNetwork();
    mainnetProviders[chain.chainId] = provider;
  } catch (err) {
    console.log("err for mainnet provider in chain", chain.chainId);
    continue;
  }
}

const testnetProviders = {};
for (const chain of testnetEnv.chainInfos) {
  const provider = new ethers.JsonRpcProvider(chain.rpcUrl);

  try {
    await provider._detectNetwork();
    testnetProviders[chain.chainId] = provider;
  } catch (err) {
    console.log("err for testnet provider in chain", chain.chainId);
    continue;
  }
}

export function getEthersProvider(network: string, chainId: ChainId) {
  // if (chainInfo?.rpcUrl) return new ethers.JsonRpcProvider(chainInfo.rpcUrl);

  if (network.toLowerCase() === "mainnet") {
    if (mainnetProviders[chainId]) return mainnetProviders[chainId];
  }

  if (network.toLowerCase() === "testnet") {
    if (testnetProviders[chainId]) return testnetProviders[chainId];
  }

  return null;
}

export function getChainInfo(network: Network, chainId: ChainId): ChainInfo {
  const env = network.toUpperCase() === "MAINNET" ? mainnetEnv : testnetEnv;
  const output = env.chainInfos.find(chainInfo => chainInfo.chainId === chainId);

  if (output === undefined) {
    console.error(`Unknown chainId ${chainId}`);
  }

  return output!;
}
