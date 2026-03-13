export interface FileverseDocument {
  ddocId: string;
  title: string;
  content: string;
  syncStatus: "pending" | "synced" | "failed" | string;
  link?: string;
  localVersion?: number;
  onchainVersion?: number;
  createdAt?: string;
  updatedAt?: string;
  isDeleted?: number;
}

interface FileverseListResponse {
  ddocs: FileverseDocument[];
  total: number;
  hasNext: boolean;
}

interface FileverseMutationResponse {
  message: string;
  data: FileverseDocument;
}

function getBaseUrl() {
  const baseUrl = process.env.EXPO_PUBLIC_FILEVERSE_API_URL?.trim();

  if (!baseUrl) {
    throw new Error("Missing EXPO_PUBLIC_FILEVERSE_API_URL");
  }

  return baseUrl.replace(/\/+$/, "");
}

function getApiKey() {
  const apiKey = process.env.EXPO_PUBLIC_FILEVERSE_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing EXPO_PUBLIC_FILEVERSE_API_KEY");
  }

  return apiKey;
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  searchParams.set("apiKey", getApiKey());

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  });

  return `${getBaseUrl()}${path}?${searchParams.toString()}`;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T) : ({} as T);

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof (payload as { message?: unknown }).message === "string"
        ? ((payload as { message: string }).message)
        : `Fileverse request failed with status ${response.status}`;

    throw new Error(message);
  }

  return payload;
}

export async function listDocuments({
  limit = 100,
  skip = 0,
}: {
  limit?: number;
  skip?: number;
} = {}): Promise<FileverseListResponse> {
  const response = await fetch(buildUrl("/api/ddocs", { limit, skip }));
  return parseJsonResponse<FileverseListResponse>(response);
}

export async function getDocument(ddocId: string): Promise<FileverseDocument> {
  const response = await fetch(buildUrl(`/api/ddocs/${ddocId}`));
  return parseJsonResponse<FileverseDocument>(response);
}

export async function createDocument({
  title,
  content,
}: {
  title: string;
  content: string;
}): Promise<FileverseDocument> {
  const response = await fetch(buildUrl("/api/ddocs"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, content }),
  });

  const payload = await parseJsonResponse<FileverseMutationResponse>(response);
  return payload.data;
}

export async function updateDocument(
  ddocId: string,
  {
    title,
    content,
  }: {
    title?: string;
    content?: string;
  },
): Promise<FileverseDocument> {
  const response = await fetch(buildUrl(`/api/ddocs/${ddocId}`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, content }),
  });

  const payload = await parseJsonResponse<FileverseMutationResponse>(response);
  return payload.data;
}
