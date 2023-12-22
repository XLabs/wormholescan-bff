export const findBlockRangeByTimestamp = async (ethersProvider, targetTimestamp) => {
  const lastBlock = await ethersProvider.getBlockNumber();
  let startBlock = 0;
  let endBlock = lastBlock;
  const maxBlockDifference = 1000; // Max difference between blocks

  while (startBlock <= endBlock) {
    const midBlock = Math.floor((startBlock + endBlock) / 2);
    const midBlockInfo = await ethersProvider.getBlock(midBlock);

    // Check if the timestamp is within a certain threshold of the target timestamp
    const timestampDiff = Math.abs(midBlockInfo.timestamp - Date.parse(targetTimestamp) / 1000);

    console.log({ timestampDiff });

    if (timestampDiff <= 1000) {
      console.log({ midBlock });
      const blockRanges = [
        [Math.max(0, midBlock - maxBlockDifference * 9), Math.min(lastBlock, midBlock - maxBlockDifference * 7)],
        [Math.max(0, midBlock - maxBlockDifference * 7), Math.min(lastBlock, midBlock - maxBlockDifference * 5)],
        [Math.max(0, midBlock - maxBlockDifference * 5), Math.min(lastBlock, midBlock - maxBlockDifference * 3)],
        [Math.max(0, midBlock - maxBlockDifference * 3), Math.min(lastBlock, midBlock - maxBlockDifference)],
        [Math.max(0, midBlock - maxBlockDifference), Math.min(lastBlock, midBlock + maxBlockDifference)],
        [Math.max(0, midBlock + maxBlockDifference), Math.min(lastBlock, midBlock + maxBlockDifference * 3)],
        [Math.max(0, midBlock + maxBlockDifference * 3), Math.min(lastBlock, midBlock + maxBlockDifference * 5)],
        [Math.max(0, midBlock + maxBlockDifference * 5), Math.min(lastBlock, midBlock + maxBlockDifference * 7)],
      ];

      return blockRanges;
    }

    if (midBlockInfo.timestamp < Date.parse(targetTimestamp) / 1000) {
      startBlock = midBlock - 1;
    } else {
      endBlock = midBlock + 1;
    }
  }

  // If no matching block is found, return null
  return null;
};
