import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NavLink } from "@/components/nav-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import type { FeatureHighlight } from "@viralvector/common/contracts";
import viralVectorLogo from "@/assets/viral-vector-logo.svg";

interface FeatureResponse {
  items: FeatureHighlight[];
}

export default function HomePage() {
  const [features, setFeatures] = useState<FeatureHighlight[]>([]);
  const [hoveredFeatureId, setHoveredFeatureId] = useState<string | null>(null);
  const [promptText, setPromptText] = useState(
    "Cinematic drone shot over a glowing cyberpunk city at blue hour, volumetric fog, dynamic light streaks, ultra-detailed.",
  );
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [durationSeconds, setDurationSeconds] = useState(8);
  const [stylePreset, setStylePreset] = useState("cinematic");

  useEffect(() => {
    const loadFeatures = async () => {
      const response = await apiRequest<FeatureResponse>("/api/site/features", { method: "GET" });
      setFeatures(response.items);
    };
    void loadFeatures();
  }, []);

  const estimatedCredits = useMemo(() => {
    return 10 + Math.round(durationSeconds);
  }, [durationSeconds]);

  const interactiveFeatureText = useMemo(() => {
    const activeFeature = features.find(feature => feature.id === hoveredFeatureId);
    if (!activeFeature) {
      return "Hover feature cards to preview why teams pick ViralVector for production workflows.";
    }
    return activeFeature.description;
  }, [features, hoveredFeatureId]);

  const estimatedRenderTimeLabel = useMemo(() => {
    const estimatedSeconds = durationSeconds * 2 + 6;
    return `~${estimatedSeconds}s estimated render`;
  }, [durationSeconds]);

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-b from-primary/10 via-background to-background p-8 sm:p-12">
        <div className="absolute -top-24 -right-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative">
          <img src={viralVectorLogo} alt="ViralVector logo" className="mb-6 w-full max-w-md" loading="eager" />
          <p className="mb-3 text-sm uppercase tracking-[0.18em] text-muted-foreground">Seedance-style AI video platform</p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            ViralVector AI Video Engine for cinematic generation, automation, and monetization.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Create and manage AI video workflows with user accounts, passkey-secured authentication, API keys, reference
            outputs, and payment-ready credit purchases.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <NavLink href="/register">Start free</NavLink>
            </Button>
            <Button variant="secondary" asChild>
              <NavLink href="/pricing">Buy credits with Apple Pay</NavLink>
            </Button>
            <Button variant="outline" asChild>
              <NavLink href="/docs">Read API Docs</NavLink>
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {[
              { label: "API latency p95", value: "< 350ms" },
              { label: "Task completion", value: "~20s avg" },
              { label: "Passkey + OAuth", value: "Enabled" },
            ].map(metric => (
              <div key={metric.label} className="rounded-full border border-border/60 bg-background/70 px-4 py-2 text-xs">
                <span className="text-muted-foreground">{metric.label}</span>
                <span className="ml-2 font-medium">{metric.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {features.map(feature => (
          <Card
            key={feature.id}
            className="group border-border/60 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
            onMouseEnter={() => setHoveredFeatureId(feature.id)}
            onMouseLeave={() => setHoveredFeatureId(null)}
          >
            <CardHeader>
              <CardTitle className="text-xl">{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <Card className="border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle>Live Prompt Studio</CardTitle>
          <CardDescription>
            Tune a generation request in real time. This preview is interactive and updates estimated cost instantly.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt-input">Prompt</Label>
              <Textarea
                id="prompt-input"
                value={promptText}
                onChange={event => setPromptText(event.target.value)}
                className="min-h-28"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Style preset</Label>
                <Select value={stylePreset} onValueChange={nextValue => setStylePreset(nextValue)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose style preset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cinematic">Cinematic</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="ugc">UGC Social</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Aspect ratio</Label>
                <Select value={aspectRatio} onValueChange={nextValue => setAspectRatio(nextValue as "16:9" | "9:16" | "1:1")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose aspect ratio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                    <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
                    <SelectItem value="1:1">1:1 (Square)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration-range">Duration: {durationSeconds}s</Label>
              <Input
                id="duration-range"
                type="range"
                min={4}
                max={12}
                step={1}
                value={durationSeconds}
                onChange={event => setDurationSeconds(Number(event.target.value))}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-border/60 bg-background/70 p-4">
            <p className="text-sm text-muted-foreground">{interactiveFeatureText}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">Estimated credits</p>
                <p className="text-2xl font-semibold">{estimatedCredits}</p>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">Estimated runtime</p>
                <p className="text-2xl font-semibold">{estimatedRenderTimeLabel}</p>
              </div>
            </div>
            <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground">Request preview</p>
              <pre className="mt-2 overflow-x-auto text-xs leading-relaxed">
{`{
  "prompt": ${JSON.stringify(promptText.slice(0, 140))},
  "stylePreset": "${stylePreset}",
  "aspectRatio": "${aspectRatio}",
  "durationSeconds": ${durationSeconds}
}`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { title: "1. Register", description: "Create your account and optionally enable passkey 2FA." },
          { title: "2. Fund credits", description: "Use Stripe checkout or Apple Pay-compatible payment intent flow." },
          { title: "3. Generate", description: "Create tasks, track status, and iterate prompts with reference videos." },
        ].map(step => (
          <Card key={step.title} className="border-border/60 transition-colors hover:border-primary/40">
            <CardHeader>
              <CardTitle>{step.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
