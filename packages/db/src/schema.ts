import { index, integer, pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

export const apiKeyStatusEnum = pgEnum("api_key_status", ["active", "revoked"]);
export const videoTaskStatusEnum = pgEnum("video_task_status", ["queued", "processing", "succeeded", "failed"]);
export const paymentProviderEnum = pgEnum("payment_provider", ["stripe", "usdt"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "succeeded", "failed"]);
export const chainDepositStatusEnum = pgEnum("chain_deposit_status", ["pending", "confirmed"]);

export const usersTable = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    apiCredits: integer("api_credits").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  table => {
    return {
      emailUniqueIndex: uniqueIndex("users_email_unique").on(table.email),
    };
  },
);

export const passwordResetTokensTable = pgTable(
  "password_reset_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    usedAt: text("used_at"),
    createdAt: text("created_at").notNull(),
  },
  table => {
    return {
      userIdIndex: index("password_reset_tokens_user_id_idx").on(table.userId),
      tokenHashUniqueIndex: uniqueIndex("password_reset_tokens_token_hash_unique").on(table.tokenHash),
    };
  },
);

export const passkeysTable = pgTable(
  "passkeys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    credentialId: text("credential_id").notNull(),
    credentialPublicKey: text("credential_public_key").notNull(),
    counter: integer("counter").notNull().default(0),
    deviceType: text("device_type").notNull(),
    backedUp: integer("backed_up").notNull().default(0),
    transportsJson: text("transports_json"),
    createdAt: text("created_at").notNull(),
    lastUsedAt: text("last_used_at"),
  },
  table => {
    return {
      userIdIndex: index("passkeys_user_id_idx").on(table.userId),
      credentialIdUniqueIndex: uniqueIndex("passkeys_credential_id_unique").on(table.credentialId),
    };
  },
);

export const apiKeysTable = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(),
    prefix: text("prefix").notNull(),
    maskedKey: text("masked_key").notNull(),
    status: apiKeyStatusEnum("status").notNull().default("active"),
    lastUsedAt: text("last_used_at"),
    createdAt: text("created_at").notNull(),
  },
  table => {
    return {
      userIdIndex: index("api_keys_user_id_idx").on(table.userId),
      keyHashUniqueIndex: uniqueIndex("api_keys_key_hash_unique").on(table.keyHash),
    };
  },
);

export const videoTasksTable = pgTable(
  "video_tasks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    model: text("model").notNull(),
    prompt: text("prompt").notNull(),
    imageUrl: text("image_url"),
    aspectRatio: text("aspect_ratio").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    creditsCost: integer("credits_cost").notNull(),
    status: videoTaskStatusEnum("status").notNull(),
    providerTaskId: text("provider_task_id"),
    outputVideoUrl: text("output_video_url"),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    completedAt: text("completed_at"),
  },
  table => {
    return {
      userIdIndex: index("video_tasks_user_id_idx").on(table.userId),
      createdAtIndex: index("video_tasks_created_at_idx").on(table.createdAt),
    };
  },
);

export const creditLedgerTable = pgTable(
  "credit_ledger",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    deltaCredits: integer("delta_credits").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: text("reason").notNull(),
    referenceId: text("reference_id"),
    metadataJson: text("metadata_json"),
    createdAt: text("created_at").notNull(),
  },
  table => {
    return {
      userIdIndex: index("credit_ledger_user_id_idx").on(table.userId),
    };
  },
);

export const paymentsTable = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    provider: paymentProviderEnum("provider").notNull(),
    providerPaymentId: text("provider_payment_id").notNull(),
    status: paymentStatusEnum("status").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    creditsPurchased: integer("credits_purchased").notNull(),
    rawPayloadJson: text("raw_payload_json").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  table => {
    return {
      userIdIndex: index("payments_user_id_idx").on(table.userId),
      providerPaymentUniqueIndex: uniqueIndex("payments_provider_payment_unique").on(table.providerPaymentId),
    };
  },
);

export const chainDepositsTable = pgTable(
  "chain_deposits",
  {
    id: text("id").primaryKey(),
    chainId: integer("chain_id").notNull(),
    network: text("network").notNull(),
    tokenSymbol: text("token_symbol").notNull(),
    tokenAddress: text("token_address").notNull(),
    fromAddress: text("from_address").notNull(),
    toAddress: text("to_address").notNull(),
    txHash: text("tx_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    blockNumber: integer("block_number").notNull(),
    amountRaw: text("amount_raw").notNull(),
    amountDecimal: text("amount_decimal").notNull(),
    confirmations: integer("confirmations").notNull().default(0),
    status: chainDepositStatusEnum("status").notNull().default("pending"),
    observedAt: text("observed_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  table => {
    return {
      txHashLogIndexUnique: uniqueIndex("chain_deposits_tx_hash_log_index_unique").on(table.txHash, table.logIndex),
      statusIndex: index("chain_deposits_status_idx").on(table.status),
      blockNumberIndex: index("chain_deposits_block_number_idx").on(table.blockNumber),
    };
  },
);

export const workerStateTable = pgTable(
  "worker_state",
  {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
);
