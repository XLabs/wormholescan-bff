## WormholeScan utils

This repository contains an ExpressJS server that provides endpoints that are useful for the Wormhole network.

---

### Endpoints

`/getWrappedAsset`

Tries to get the wrapped token address for a canonical token. Requires the following query parameters:

- **tokenChain**: original token wormhole chain id
- **tokenAddress**: original token address
- **network**: "MAINNET" or "TESTNET"
- **targetChain**: the wormhole chain id of where that original token is going

return example:

```ts
{
  wrappedToken: "c7nnpwuzcnjzbfw5p6jvgsr8pudsrpedp1zahnodwj7h",
  tokenSymbol: "MATICet"
}
```

`/getRedeemTxn`

Tries to get the redeem transaction hash for transactions that don't include it. Requires the following query parameters:

- **network**: "MAINNET" | "TESTNET"
- **fromChain**: wormhole chain id of the source chain
- **toChain**: wormhole chain id of the target chain
- **address**: target wallet address, the one that should have received the transaction
- **tokenAddress**: the token address that was sent to this wallet
- **timestamp**: the date string for this transaction that we want to get
- **amount**: the raw amount that was received
- **txHash**: txHash of the source transaction (for cache purposes)
- **sequence**: sequence of the VAA

return example:

```ts
{
  redeemTxHash: "0xd6e6b693ca820a5455afbf853f5f5ba1c73e9a6149a202a165275ce683637b1d";
}
```

`/fastTransfers/auctionStatus`

Search for the auction status and fill transaction of given a Fast Transfer VAA. Requires the following query parameters:

- **network**: "MAINNET" | "TESTNET"
- **digest**: VAA digest (double keccak256 of the encoded body)

return example:

```bash
$ curl -s localhost:9091/fastTransfers/auctionStatus\?network\=Testnet\&digest\=b81f6714970e7ea2bd09b3574b9cf3d857c5f60357afddd1f86361c2bf422927 | jq

{
  "status": {
    "completed": {
      "slot": "297124098"
    }
  },
  "targetProtocol": {
    "cctp": {
      "domain": 6
    }
  },
  "vaaHash": "b81f6714970e7ea2bd09b3574b9cf3d857c5f60357afddd1f86361c2bf422927",
  "vaaTimestamp": "1715028314",
  "info": {
    "configId": 2,
    "custodyTokenBump": 254,
    "vaaSequence": "11357",
    "sourceChain": 10005,
    "bestOfferAccount": "RoX5UsxwSMD2f3TmQA8aDsWqyYuyCGKZHwZEaDZHa6e",
    "bestOfferAccountOwner": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "initialOfferAccount": "GtDbUxUVor13vVJrshyuZvziMxoSbmg85zNmkfCGrswL",
    "initialOfferAccountOwner": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "startSlot": "297124091",
    "amountIn": "10000000",
    "securityDeposit": "2550000",
    "offerPrice": "1425000",
    "destinationAssetInfo": null
  },
  "fill": {
    "txHash": "F4owizxd2LsZJdjtsbk9ur1EwZAjRzPGRHGqB5pMt8thnp3v8wbBfobdgqDiMQVArMvBhJ2Z8xL3MdV5pUBiURh",
    "vaa": {
      "emitterChain": 1,
      "emitterAddress": "3e374fcd3aaf2ed067f3c93d21416855ec7916cfd2c2127bcbc68b3b1fb73077",
      "sequence": "4492"
    }
  }
}
```

`/fastTransfers/findOrderForFill`

Search for the original fast transfer VAA given a fill transaction. Requires the following query parameters:

- **network**: "MAINNET" | "TESTNET"
- **fillTxHash**: fill transaction hash

return example:

```bash
$ curl -s localhost:9091/fastTransfers/findOrderForFill\?network\=Testnet\&fillTxHash=F4owizxd2LsZJdjtsbk9ur1EwZAjRzPGRHGqB5pMt8thnp3v8wbBfobdgqDiMQVArMvBhJ2Z8xL3MdV5pUBiURh | jq

{
  "emitterChain": 10005,
  "emitterAddress": "000000000000000000000000c1cf3501ef0b26c8a47759f738832563c7cb014a",
  "sequence": "11357"
}
```
