interface ApiRequestOptions extends RequestInit {
  ignoreUnauthorized?: boolean;
}

const API_BASE_URL = (process.env.BUN_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/+$/, "");

const resolveApiUrl = (url: string): string => {
  if (/^https?:\/\//.test(url)) {
    return url;
  }
  if (!API_BASE_URL) {
    return url;
  }
  return `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`;
};

export class ApiClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const parseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const data = await response.json();
    if (data && typeof data.error === "string") {
      return data.error;
    }
  } catch {
    return `Request failed with status ${response.status}.`;
  }
  return `Request failed with status ${response.status}.`;
};

export const apiRequest = async <T>(url: string, options?: ApiRequestOptions): Promise<T> => {
  const response = await fetch(resolveApiUrl(url), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (options?.ignoreUnauthorized && response.status === 401) {
    throw new ApiClientError("Unauthorized", 401);
  }

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new ApiClientError(errorMessage, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};
