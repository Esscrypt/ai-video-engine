import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import type { ReferenceVideo } from "@viralvector/common/contracts";
import { useEffect, useState } from "react";

interface ReferenceVideosResponse {
  items: ReferenceVideo[];
}

export default function ReferenceVideosPage() {
  const [videos, setVideos] = useState<ReferenceVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadVideos = async () => {
      try {
        const response = await apiRequest<ReferenceVideosResponse>("/api/videos/reference", { method: "GET" });
        setVideos(response.items);
      } catch (error) {
        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Could not load reference videos.");
        }
      } finally {
        setIsLoading(false);
      }
    };
    void loadVideos();
  }, []);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Reference Videos</h1>
        <p className="mt-2 text-muted-foreground">Curated generated-style outputs to calibrate prompts and framing.</p>
      </section>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading gallery...</p> : null}
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        {videos.map(video => (
          <Card key={video.id}>
            <CardHeader>
              <CardTitle>{video.title}</CardTitle>
              <CardDescription>{video.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <video
                className="w-full rounded-lg border"
                controls
                preload="metadata"
                poster={video.thumbnailUrl}
                src={video.videoUrl}
              />
              <p className="text-xs text-muted-foreground">
                {video.durationSeconds}s - {video.aspectRatio}
              </p>
              <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs">{video.prompt}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
