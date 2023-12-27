import { SuiClient, SuiObjectResponse } from "@mysten/sui.js/client";
import { isValidSuiAddress as isValidFullSuiAddress, normalizeSuiAddress } from "@mysten/sui.js/utils";

const isValidSuiType = (type: string): boolean => {
  const tokens = type.split("::");
  if (tokens.length !== 3) {
    return false;
  }

  return isValidSuiAddress(tokens[0]) && !!tokens[1] && !!tokens[2];
};

export const uint8ArrayToHex = (a: Uint8Array): string => Buffer.from(a).toString("hex");

export const hexToUint8Array = (h: string): Uint8Array => {
  if (h.startsWith("0x")) h = h.slice(2);
  return new Uint8Array(Buffer.from(h, "hex"));
};

const ensureHexPrefix = (x: string): string => {
  return x.substring(0, 2) !== "0x" ? `0x${x}` : x;
};

const trimSuiType = (type: string): string => type.replace(/(0x)(0*)/g, "0x");

const getTableKeyType = (tableType: string): string | null => {
  if (!tableType) return null;
  const match = trimSuiType(tableType).match(/0x2::table::Table<(.*)>/);
  if (!match) return null;
  const [keyType] = match[1].split(",");
  if (!isValidSuiType(keyType)) return null;
  return keyType;
};

const getFieldsFromObjectResponse = (object: SuiObjectResponse) => {
  const content = object.data?.content;
  return content && content.dataType === "moveObject" ? content.fields : null;
};

export const isValidSuiAddress = (address: string): boolean => isValidFullSuiAddress(normalizeSuiAddress(address));

const getObjectFields = async (client: SuiClient, objectId: string): Promise<Record<string, any> | null> => {
  if (!isValidSuiAddress(objectId)) {
    throw new Error(`Invalid object ID: ${objectId}`);
  }

  const res = await client.getObject({
    id: objectId,
    options: {
      showContent: true,
    },
  });
  return getFieldsFromObjectResponse(res);
};

export const getTokenCoinType = async (
  client: SuiClient,
  tokenBridgeStateObjectId: string,
  tokenAddress: Uint8Array,
  tokenChain: number,
): Promise<string | null> => {
  const tokenBridgeStateFields = await getObjectFields(client, tokenBridgeStateObjectId);

  if (!tokenBridgeStateFields) {
    throw new Error("Unable to fetch object fields from token bridge state");
  }

  const coinTypes = tokenBridgeStateFields?.token_registry?.fields?.coin_types;
  const coinTypesObjectId = coinTypes?.fields?.id?.id;

  if (!coinTypesObjectId) {
    throw new Error("Unable to fetch coin types");
  }

  const keyType = getTableKeyType(coinTypes?.type);
  if (!keyType) {
    throw new Error("Unable to get key type");
  }

  const response = await client.getDynamicFieldObject({
    parentId: coinTypesObjectId,
    name: {
      type: keyType,
      value: {
        addr: [...tokenAddress],
        chain: tokenChain,
      },
    },
  });

  if (response.error) {
    if (response.error.code === "dynamicFieldNotFound") {
      return null;
    }
    throw new Error(`Unexpected getDynamicFieldObject response ${response.error}`);
  }
  const fields: any = getFieldsFromObjectResponse(response);
  return fields?.value ? trimSuiType(ensureHexPrefix(fields.value)) : null;
};

export async function getForeignAssetSui(
  client: SuiClient,
  tokenBridgeStateObjectId: string,
  originChain: number,
  originAddress: Uint8Array,
): Promise<string | null> {
  return getTokenCoinType(client, tokenBridgeStateObjectId, originAddress, originChain);
}
