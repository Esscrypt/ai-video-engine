const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};

export const SESSION_COOKIE_NAME = "ave_session";

export const jsonResponse = <T>(data: T, init?: ResponseInit): Response => {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", JSON_HEADERS["Content-Type"]);
  headers.set("Cache-Control", "no-store");

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
};

export const emptyResponse = (init?: ResponseInit): Response => {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(null, { ...init, headers });
};

export const getCookieValue = (request: Request, cookieName: string): string | null => {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").map(cookiePart => cookiePart.trim());
  for (const cookiePart of cookies) {
    if (!cookiePart.startsWith(`${cookieName}=`)) {
      continue;
    }
    const [, cookieValue = ""] = cookiePart.split("=", 2);
    return decodeURIComponent(cookieValue);
  }

  return null;
};

const buildCookieString = (name: string, value: string, maxAgeSeconds: number): string => {
  const segments = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (process.env.NODE_ENV === "production") {
    segments.push("Secure");
  }

  return segments.join("; ");
};

export const withSessionCookie = (response: Response, sessionId: string, maxAgeSeconds: number): Response => {
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", buildCookieString(SESSION_COOKIE_NAME, sessionId, maxAgeSeconds));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export const clearSessionCookie = (response: Response): Response => {
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", buildCookieString(SESSION_COOKIE_NAME, "", 0));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export const readJsonBody = async <T>(request: Request): Promise<T | null> => {
  try {
    const requestBody = await request.json();
    if (!requestBody || typeof requestBody !== "object") {
      return null;
    }
    return requestBody as T;
  } catch {
    return null;
  }
};
