import * as SecureStore from "expo-secure-store";
import type { Address, Hex } from "viem";
import { CHAIN_NAME, TOKEN_DECIMALS } from "../blockchain/contracts";
import {
  createDocument,
  getDocument,
  listDocuments,
  updateDocument,
  type FileverseDocument,
} from "./client";

const LEDGER_TITLE_PREFIX = "Bump Ledger -";
const LEDGER_SECTION_HEADER = "## Transactions";
const STORAGE_KEY_PREFIX = "fileverseLedgerDdocId";
const SEARCH_PAGE_SIZE = 100;
const MAX_SEARCH_PAGES = 5;

export interface LedgerEntryInput {
  ownerAddress: Address;
  role: "payer" | "receiver";
  amount: bigint;
  tokenSymbol: string;
  chainName: string;
  txHash: Hex;
  from: Address;
  to: Address;
  fromLabel?: string | null;
  toLabel?: string | null;
  confirmedAt?: number;
}

function getStorageKey(ownerAddress: Address) {
  return `${STORAGE_KEY_PREFIX}_${ownerAddress.toLowerCase()}`;
}

export function getLedgerTitle(ownerAddress: Address) {
  return `${LEDGER_TITLE_PREFIX} ${ownerAddress}`;
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
}

function buildInitialContent(ownerAddress: Address) {
  const nowIso = new Date().toISOString();

  return [
    "# Bump Ledger",
    "",
    `Owner: ${ownerAddress}`,
    `Chain: ${CHAIN_NAME}`,
    `Last updated: ${nowIso}`,
    "",
    LEDGER_SECTION_HEADER,
    "",
    "_No transactions recorded yet._",
  ].join("\n");
}

function buildEntry(input: LedgerEntryInput) {
  const timestamp = formatTimestamp(input.confirmedAt ?? Date.now());
  const direction = input.role === "payer" ? "Sent" : "Received";
  const counterpartyLabel =
    input.role === "payer" ? input.toLabel ?? input.to : input.fromLabel ?? input.from;
  const counterpartyAddress = input.role === "payer" ? input.to : input.from;
  const addressLabel = input.role === "payer" ? "To" : "From";
  const amount = (Number(input.amount) / 10 ** TOKEN_DECIMALS).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: TOKEN_DECIMALS,
  });

  return [
    `### ${timestamp}`,
    `- Type: ${direction}`,
    `- Amount: ${amount} ${input.tokenSymbol}`,
    `- Counterparty: ${counterpartyLabel}`,
    `- ${addressLabel}: ${counterpartyAddress}`,
    `- Tx Hash: ${input.txHash}`,
    `- Chain: ${input.chainName}`,
    "",
  ].join("\n");
}

function replaceLastUpdated(content: string) {
  return content.replace(
    /^Last updated: .*$/m,
    `Last updated: ${new Date().toISOString()}`,
  );
}

function insertEntry(content: string, entry: string, txHash: Hex) {
  const withUpdatedTimestamp = replaceLastUpdated(content);

  if (withUpdatedTimestamp.includes(`- Tx Hash: ${txHash}`)) {
    return withUpdatedTimestamp;
  }

  if (!withUpdatedTimestamp.includes(LEDGER_SECTION_HEADER)) {
    return `${withUpdatedTimestamp}\n\n${LEDGER_SECTION_HEADER}\n\n${entry}`;
  }

  const [beforeSection, afterSection] = withUpdatedTimestamp.split(LEDGER_SECTION_HEADER, 2);
  const cleanedTail = afterSection.replace(/^\s*_No transactions recorded yet\._\s*/m, "").trimStart();

  return [
    beforeSection.trimEnd(),
    "",
    LEDGER_SECTION_HEADER,
    "",
    entry.trimEnd(),
    cleanedTail ? cleanedTail : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function readStoredLedgerDdocId(ownerAddress: Address) {
  return SecureStore.getItemAsync(getStorageKey(ownerAddress));
}

async function storeLedgerDdocId(ownerAddress: Address, ddocId: string) {
  await SecureStore.setItemAsync(getStorageKey(ownerAddress), ddocId);
}

async function searchLedgerByTitle(ownerAddress: Address) {
  const expectedTitle = getLedgerTitle(ownerAddress);

  for (let page = 0; page < MAX_SEARCH_PAGES; page += 1) {
    const response = await listDocuments({
      limit: SEARCH_PAGE_SIZE,
      skip: page * SEARCH_PAGE_SIZE,
    });

    const match = response.ddocs.find(
      (document) => !document.isDeleted && document.title === expectedTitle,
    );

    if (match) {
      return getDocument(match.ddocId);
    }

    if (!response.hasNext) {
      break;
    }
  }

  return null;
}

export async function getExistingLedger(ownerAddress: Address) {
  const storedDdocId = await readStoredLedgerDdocId(ownerAddress);

  if (storedDdocId) {
    try {
      const storedDocument = await getDocument(storedDdocId);
      if (!storedDocument.isDeleted) {
        return storedDocument;
      }
    } catch (error) {
      console.warn("Failed to read stored Fileverse ledger:", error);
    }
  }

  const existingDocument = await searchLedgerByTitle(ownerAddress);
  if (existingDocument) {
    await storeLedgerDdocId(ownerAddress, existingDocument.ddocId);
  }

  return existingDocument;
}

export async function ensureLedger(ownerAddress: Address) {
  const existing = await getExistingLedger(ownerAddress);
  if (existing) {
    return existing;
  }

  const created = await createDocument({
    title: getLedgerTitle(ownerAddress),
    content: buildInitialContent(ownerAddress),
  });

  await storeLedgerDdocId(ownerAddress, created.ddocId);
  return created;
}

export async function syncLedgerEntry(input: LedgerEntryInput): Promise<FileverseDocument> {
  const ledger = await ensureLedger(input.ownerAddress);
  const nextContent = insertEntry(
    ledger.content || buildInitialContent(input.ownerAddress),
    buildEntry(input),
    input.txHash,
  );

  if (nextContent === ledger.content) {
    return ledger;
  }

  const updated = await updateDocument(ledger.ddocId, {
    content: nextContent,
  });

  await storeLedgerDdocId(input.ownerAddress, updated.ddocId);
  return updated;
}
