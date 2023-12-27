import { Algodv2, LogicSigAccount, decodeAddress, getApplicationAddress } from "algosdk";
import { hexToUint8Array, uint8ArrayToHex } from "./utils";
import { id } from "ethers";

interface IPopulateData {
  appId: bigint;
  appAddress: string;
  addrIdx: bigint;
  emitterId: string;
}
type PopulateData = Required<IPopulateData>;

const LIMIT = BigInt(0x7f);
function encodingLength(value: bigint): number {
  let i = 0;

  for (; value >= BigInt(0x80); i++) {
    value >>= BigInt(7);
  }

  return i + 1;
}

function encode(i: bigint, buffer?: ArrayBuffer, byteOffset?: number): Uint8Array {
  if (i < BigInt(0)) {
    throw new RangeError("value must be unsigned");
  }

  const byteLength = encodingLength(i);
  buffer = buffer || new ArrayBuffer(byteLength);
  byteOffset = byteOffset || 0;
  if (buffer.byteLength < byteOffset + byteLength) {
    throw new RangeError("the buffer is too small to encode the number at the offset");
  }

  const array = new Uint8Array(buffer, byteOffset);

  let offset = 0;
  while (LIMIT < i) {
    array[offset++] = Number(i & LIMIT) | 0x80;
    i >>= BigInt(7);
  }

  array[offset] = Number(i);

  return array;
}

function encodeHex(i: bigint, buffer?: ArrayBuffer, byteOffset?: number): string {
  return Buffer.from(encode(i, buffer, byteOffset)).toString("hex");
}

class TmplSig {
  algoClient: Algodv2;
  sourceHash: string;
  bytecode: Uint8Array;

  constructor(algoClient: Algodv2) {
    this.algoClient = algoClient;
    this.sourceHash = "";
    this.bytecode = new Uint8Array();
  }

  async compile(source: string) {
    const hash = id(source);
    if (hash !== this.sourceHash) {
      const response = await this.algoClient.compile(source).do();
      this.bytecode = new Uint8Array(Buffer.from(response.result, "base64"));
      this.sourceHash = hash;
    }
  }

  /**
   * Populate data in the TEAL source and return the LogicSig object based on the resulting compiled bytecode.
   * @param data The data to populate fields with.
   * @notes emitterId must be prefixed with '0x'. appAddress must be decoded with algoSDK and prefixed with '0x'.
   * @returns A LogicSig object.
   */

  async populate(data: PopulateData): Promise<LogicSigAccount> {
    const byteString: string = [
      "0620010181",
      encodeHex(data.addrIdx),
      "4880",
      encodeHex(BigInt(data.emitterId.length / 2)),
      data.emitterId,
      "483110810612443119221244311881",
      encodeHex(data.appId),
      "1244312080",
      encodeHex(BigInt(data.appAddress.length / 2)),
      data.appAddress,
      "124431018100124431093203124431153203124422",
    ].join("");
    this.bytecode = hexToUint8Array(byteString);
    return new LogicSigAccount(this.bytecode);
  }
}

const accountExistsCache = new Set<[bigint, string]>();
/**
 * Checks to see it the account exists for the application
 * @param client An Algodv2 client
 * @param appId Application ID
 * @param acctAddr Account address to check
 * @returns true, if account exists for application.  Otherwise, returns false
 */
async function accountExists(client: Algodv2, appId: bigint, acctAddr: string): Promise<boolean> {
  if (accountExistsCache.has([appId, acctAddr])) return true;

  let ret = false;
  try {
    const acctInfo = await client.accountInformation(acctAddr).do();
    const als: Record<string, any>[] = acctInfo["apps-local-state"];

    if (!als) {
      return ret;
    }
    als.forEach(app => {
      if (BigInt(app["id"]) === appId) {
        accountExistsCache.add([appId, acctAddr]);
        ret = true;
        return;
      }
    });
  } catch (e) {}
  return ret;
}

/**
 * Returns the local data for an application ID
 * @param client Algodv2 client
 * @param appId Application ID of interest
 * @param address Address of the account
 * @returns Uint8Array of data squirreled away
 */
export async function decodeLocalState(client: Algodv2, appId: bigint, address: string): Promise<Uint8Array> {
  let app_state: any = null;
  const ai = await client.accountInformation(address).do();

  for (const app of ai["apps-local-state"]) {
    if (BigInt(app["id"]) === appId) {
      app_state = app["key-value"];
      break;
    }
  }

  let ret = Buffer.alloc(0);
  let empty = Buffer.alloc(0);
  if (app_state) {
    const e = Buffer.alloc(127);
    const m = Buffer.from("meta");

    let sk: string[] = [];
    let vals: Map<string, Buffer> = new Map<string, Buffer>();
    for (const kv of app_state) {
      const k = Buffer.from(kv["key"], "base64");
      const key: number = k.readInt8();
      if (!Buffer.compare(k, m)) {
        continue;
      }
      const v: Buffer = Buffer.from(kv["value"]["bytes"], "base64");
      if (Buffer.compare(v, e)) {
        vals.set(key.toString(), v);
        sk.push(key.toString());
      }
    }

    sk.sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

    sk.forEach(v => {
      ret = Buffer.concat([ret, vals.get(v) || empty]);
    });
  }
  return new Uint8Array(ret);
}

/**
 * Calculates the logic sig account for the application
 * @param client An Algodv2 client
 * @param appId Application ID
 * @param appIndex Application index
 * @param emitterId Emitter address
 * @returns LogicSigAccountInfo
 */
async function calcLogicSigAccount(
  client: Algodv2,
  appId: bigint,
  appIndex: bigint,
  emitterId: string,
): Promise<any> {
  const appAddress = getApplicationAddress(appId);
  const decAppAddress = decodeAddress(appAddress).publicKey;
  const aa = uint8ArrayToHex(decAppAddress);

  let data: any = {
    addrIdx: appIndex,
    appAddress: aa,
    appId: appId,
    emitterId: emitterId,
  };

  const ts: TmplSig = new TmplSig(client);
  const lsa: LogicSigAccount = await ts.populate(data);
  const sigAddr: string = lsa.address();

  const doesExist: boolean = await accountExists(client, appId, sigAddr);
  return {
    lsa,
    doesExist,
  };
}

export const getForeignAssetAlgorand = async (
  client: Algodv2,
  tokenBridgeId: bigint,
  chainId: number,
  contract: string,
): Promise<bigint | null> => {
  if (chainId === 8) {
    return BigInt("0x" + Buffer.from(hexToUint8Array(contract)).toString("hex"));
  } else {
    let { lsa, doesExist } = await calcLogicSigAccount(client, tokenBridgeId, BigInt(chainId), contract);

    if (!doesExist) {
      return null;
    }

    let asset: Uint8Array = await decodeLocalState(client, tokenBridgeId, lsa.address());
    if (asset.length > 8) {
      const tmp = Buffer.from(asset.slice(0, 8));
      return tmp.readBigUInt64BE(0);
    }

    return null;
  }
};
