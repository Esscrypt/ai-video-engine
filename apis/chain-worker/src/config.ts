import { getAddress } from "viem";

const readRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const readOptionalEnv = (key: string, fallback: string): string => {
  return process.env[key] ?? fallback;
};

const readOptionalNumberEnv = (key: string, fallback: number): number => {
  const value = process.env[key];
  if (!value) {
    return fallback;
  }
  const parsedNumber = Number(value);
  if (!Number.isFinite(parsedNumber)) {
    return fallback;
  }
  return parsedNumber;
};

const readOptionalBlockEnv = (key: string): bigint | null => {
  const value = process.env[key];
  if (!value) {
    return null;
  }
  const parsedBlock = BigInt(value);
  if (parsedBlock < 0n) {
    return null;
  }
  return parsedBlock;
};

const parseOptionalAddress = (value: string): `0x${string}` | null => {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }
  return getAddress(normalizedValue);
};

export const config = {
  databaseUrl: readRequiredEnv("DATABASE_URL"),
  chainRpcUrl: readRequiredEnv("CHAIN_RPC_URL"),
  chainId: readOptionalNumberEnv("CHAIN_ID", 137),
  receiverAddress: getAddress(readRequiredEnv("DEPOSIT_RECEIVER_ADDRESS")),
  polygonUsdtAddress: parseOptionalAddress(readOptionalEnv("POLYGON_USDT_ADDRESS", "")),
  polygonUsdcAddress: parseOptionalAddress(readOptionalEnv("POLYGON_USDC_ADDRESS", "")),
  minConfirmations: readOptionalNumberEnv("MIN_CONFIRMATIONS", 50),
  pollIntervalMs: readOptionalNumberEnv("POLL_INTERVAL_MS", 15000),
  startBlock: readOptionalBlockEnv("START_BLOCK"),
};
