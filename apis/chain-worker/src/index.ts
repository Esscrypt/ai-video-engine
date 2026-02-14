import { and, eq, lte } from "drizzle-orm";
import { database } from "@viralvector/db/client";
import { chainDepositsTable, workerStateTable } from "@viralvector/db/schema";
import { createPublicClient, formatUnits, http, parseAbiItem } from "viem";
import { polygon } from "viem/chains";
import { config } from "./config";

const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const WORKER_CURSOR_KEY = `chain-worker:last-scanned-block:${config.chainId}:${config.receiverAddress.toLowerCase()}`;

interface TrackedToken {
  symbol: "USDT" | "USDC";
  address: `0x${string}`;
  decimals: number;
}

const trackedTokens: TrackedToken[] = [
  ...(config.polygonUsdtAddress ? [{ symbol: "USDT" as const, address: config.polygonUsdtAddress, decimals: 6 }] : []),
  ...(config.polygonUsdcAddress ? [{ symbol: "USDC" as const, address: config.polygonUsdcAddress, decimals: 6 }] : []),
];

if (trackedTokens.length === 0) {
  throw new Error("No tracked token addresses configured. Set POLYGON_USDT_ADDRESS and/or POLYGON_USDC_ADDRESS.");
}

const client = createPublicClient({
  chain: polygon,
  transport: http(config.chainRpcUrl),
});

const getCursorBlock = async (): Promise<bigint | null> => {
  const [state] = await database.select().from(workerStateTable).where(eq(workerStateTable.key, WORKER_CURSOR_KEY)).limit(1);
  if (!state) {
    return null;
  }
  return BigInt(state.value);
};

const setCursorBlock = async (blockNumber: bigint): Promise<void> => {
  const now = new Date().toISOString();
  await database
    .insert(workerStateTable)
    .values({
      key: WORKER_CURSOR_KEY,
      value: blockNumber.toString(),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: workerStateTable.key,
      set: {
        value: blockNumber.toString(),
        updatedAt: now,
      },
    });
};

const upsertDeposit = async (input: {
  token: TrackedToken;
  txHash: `0x${string}`;
  logIndex: number;
  blockNumber: bigint;
  fromAddress: `0x${string}`;
  toAddress: `0x${string}`;
  amountRaw: bigint;
  latestBlock: bigint;
}): Promise<void> => {
  const now = new Date().toISOString();
  const confirmationsBigInt = input.latestBlock >= input.blockNumber ? input.latestBlock - input.blockNumber + 1n : 0n;
  const confirmations = Number(confirmationsBigInt > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : confirmationsBigInt);
  const status = confirmations >= config.minConfirmations ? "confirmed" : "pending";
  const uniqueEventId = `${input.txHash}:${input.logIndex}`;

  await database
    .insert(chainDepositsTable)
    .values({
      id: uniqueEventId,
      chainId: config.chainId,
      network: "POLYGON",
      tokenSymbol: input.token.symbol,
      tokenAddress: input.token.address,
      fromAddress: input.fromAddress,
      toAddress: input.toAddress,
      txHash: input.txHash,
      logIndex: input.logIndex,
      blockNumber: Number(input.blockNumber),
      amountRaw: input.amountRaw.toString(),
      amountDecimal: formatUnits(input.amountRaw, input.token.decimals),
      confirmations,
      status,
      observedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [chainDepositsTable.txHash, chainDepositsTable.logIndex],
      set: {
        confirmations,
        status,
        updatedAt: now,
      },
    });
};

const refreshPendingConfirmations = async (latestBlock: bigint): Promise<void> => {
  const pendingDeposits = await database
    .select()
    .from(chainDepositsTable)
    .where(and(eq(chainDepositsTable.status, "pending"), lte(chainDepositsTable.blockNumber, Number(latestBlock))));

  const now = new Date().toISOString();
  for (const pendingDeposit of pendingDeposits) {
    const blockNumber = BigInt(pendingDeposit.blockNumber);
    const confirmations = Number(latestBlock - blockNumber + 1n);
    const nextStatus = confirmations >= config.minConfirmations ? "confirmed" : "pending";
    if (confirmations === pendingDeposit.confirmations && nextStatus === pendingDeposit.status) {
      continue;
    }

    await database
      .update(chainDepositsTable)
      .set({
        confirmations,
        status: nextStatus,
        updatedAt: now,
      })
      .where(eq(chainDepositsTable.id, pendingDeposit.id));
  }
};

const pollOnce = async (): Promise<void> => {
  const latestBlock = await client.getBlockNumber();
  const currentCursor = await getCursorBlock();
  const fromBlock = currentCursor !== null ? currentCursor + 1n : (config.startBlock ?? latestBlock);

  if (fromBlock > latestBlock) {
    await refreshPendingConfirmations(latestBlock);
    return;
  }

  for (const token of trackedTokens) {
    const logs = await client.getLogs({
      address: token.address,
      event: TRANSFER_EVENT,
      fromBlock,
      toBlock: latestBlock,
      args: {
        to: config.receiverAddress,
      },
    });

    for (const log of logs) {
      const decodedLog = log as unknown as {
        transactionHash: `0x${string}`;
        logIndex: number;
        blockNumber: bigint;
        args: { from: `0x${string}`; to: `0x${string}`; value: bigint };
      };

      await upsertDeposit({
        token,
        txHash: decodedLog.transactionHash,
        logIndex: decodedLog.logIndex,
        blockNumber: decodedLog.blockNumber,
        fromAddress: decodedLog.args.from,
        toAddress: decodedLog.args.to,
        amountRaw: decodedLog.args.value,
        latestBlock,
      });
    }
  }

  await setCursorBlock(latestBlock);
  await refreshPendingConfirmations(latestBlock);
};

let isPolling = false;
const runPollCycle = async (): Promise<void> => {
  if (isPolling) {
    return;
  }
  isPolling = true;
  try {
    await pollOnce();
  } catch (error) {
    console.error("[chain-worker] poll error", error);
  } finally {
    isPolling = false;
  }
};

console.log("[chain-worker] started", {
  chainId: config.chainId,
  receiverAddress: config.receiverAddress,
  minConfirmations: config.minConfirmations,
  pollIntervalMs: config.pollIntervalMs,
  trackedTokens: trackedTokens.map(token => `${token.symbol}:${token.address}`),
});

await runPollCycle();
setInterval(() => {
  void runPollCycle();
}, config.pollIntervalMs);
