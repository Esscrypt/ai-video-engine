import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import type { ApiKeySummary, CreateApiKeyResponse } from "@viralvector/common/contracts";
import { useEffect, useState, type FormEvent } from "react";

interface ApiKeysResponse {
  items: ApiKeySummary[];
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeySummary[]>([]);
  const [newKeyName, setNewKeyName] = useState("Production key");
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRawKeyVisible, setIsRawKeyVisible] = useState(false);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  const loadApiKeys = async () => {
    const response = await apiRequest<ApiKeysResponse>("/api/keys", { method: "GET" });
    setApiKeys(response.items);
  };

  useEffect(() => {
    const load = async () => {
      try {
        await loadApiKeys();
      } catch (error) {
        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Could not load API keys.");
        }
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const onCreateApiKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await apiRequest<CreateApiKeyResponse>("/api/keys", {
        method: "POST",
        body: JSON.stringify({ name: newKeyName }),
      });
      setNewRawKey(response.rawKey);
      setIsRawKeyVisible(false);
      setCopyNotice(null);
      await loadApiKeys();
      setNewKeyName("New key");
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Could not create API key.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onRotateApiKey = async (apiKeyId: string, keyName: string) => {
    try {
      const response = await apiRequest<CreateApiKeyResponse>(`/api/keys/${apiKeyId}/rotate`, {
        method: "POST",
        body: JSON.stringify({
          name: `${keyName} (rotated)`,
        }),
      });
      setNewRawKey(response.rawKey);
      setIsRawKeyVisible(false);
      setCopyNotice(null);
      await loadApiKeys();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Could not rotate API key.");
      }
    }
  };

  const onCopyRawKey = async () => {
    if (!newRawKey) {
      return;
    }
    await navigator.clipboard.writeText(newRawKey);
    setCopyNotice("Copied. Store this key securely now.");
  };

  const getHiddenRawKey = (rawKey: string): string => {
    const prefix = rawKey.slice(0, 10);
    return `${prefix}••••••••••••••••`;
  };

  const onRevokeApiKey = async (apiKeyId: string) => {
    try {
      await apiRequest<void>(`/api/keys/${apiKeyId}`, { method: "DELETE" });
      await loadApiKeys();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Could not revoke API key.");
      }
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">API Keys</h1>
        <p className="mt-2 text-muted-foreground">Create and rotate credentials with safe masking and revocation support.</p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Create API key</CardTitle>
          <CardDescription>New keys are only shown once. Save them securely in your secrets manager.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreateApiKey} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full space-y-2">
              <Label htmlFor="api-key-name">Name</Label>
              <Input
                id="api-key-name"
                value={newKeyName}
                onChange={event => setNewKeyName(event.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create key"}
            </Button>
          </form>
          {newRawKey ? (
            <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
              <p className="font-medium">Store this key securely. It is only shown once.</p>
              <code className="mt-2 block break-all rounded bg-background px-2 py-2">
                {isRawKeyVisible ? newRawKey : getHiddenRawKey(newRawKey)}
              </code>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsRawKeyVisible(!isRawKeyVisible)}>
                  {isRawKeyVisible ? "Hide key" : "Show key"}
                </Button>
                <Button type="button" size="sm" onClick={onCopyRawKey}>
                  Copy key
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setNewRawKey(null)}>
                  I stored it
                </Button>
              </div>
              {copyNotice ? <p className="mt-2 text-xs text-primary">{copyNotice}</p> : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing keys</CardTitle>
        </CardHeader>
        <CardContent>
          {errorMessage ? <p className="mb-4 text-sm text-destructive">{errorMessage}</p> : null}
          {isLoading ? <p className="text-sm text-muted-foreground">Loading keys...</p> : null}
          {!isLoading && apiKeys.length === 0 ? <p className="text-sm text-muted-foreground">No keys yet.</p> : null}
          {!isLoading && apiKeys.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Key</th>
                    <th className="px-3 py-2 text-left font-medium">Created</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map(apiKey => (
                    <tr key={apiKey.id} className="border-b border-border/50">
                      <td className="px-3 py-2">{apiKey.name}</td>
                      <td className="px-3 py-2 font-mono">{apiKey.maskedKey}</td>
                      <td className="px-3 py-2">{new Date(apiKey.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2 capitalize">{apiKey.status}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={apiKey.status !== "active"}
                            onClick={() => onRotateApiKey(apiKey.id, apiKey.name)}
                          >
                            Rotate
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={apiKey.status !== "active"}
                            onClick={() => onRevokeApiKey(apiKey.id)}
                          >
                            Revoke
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
