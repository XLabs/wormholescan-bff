import { writeFile } from "fs/promises";

const updateTokenList = async () => {
  const resp = await fetch(
    "https://raw.githubusercontent.com/certusone/wormhole-token-list/main/src/markets.json",
  );
  const response = await resp.json();

  const tokenEntries: [string, { logo: string; symbol: string }][] = Object.entries(response.tokens);

  const transformKeysToLowerCase = obj => {
    const transformedObj = {};
    for (const key in obj) {
      transformedObj[key.toLowerCase()] = obj[key];
    }
    return transformedObj as any;
  };

  const transformedData = tokenEntries.map(([key, value]) => [key, transformKeysToLowerCase(value)]);

  const result: any = {};
  transformedData.forEach(data => {
    result[data[0]] = data[1];
  });

  await writeFile("tokenList.json", JSON.stringify(result));
  console.log("DONE!");
};

updateTokenList();
