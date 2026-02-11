"use client";

import { useState, useRef } from "react";
import { ExplainerPlayer } from "@/shared/components/explainer/explainer-player";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Upload, Play, FileAudio } from "lucide-react";
import type { ExplainerSequence } from "@/shared/types/explainer";

const R2_BASE = "https://pub-a4bec7073d99465f99043c842be6318c.r2.dev";

// Demo sequence using placeholder images from the R2 bucket.
// Replace these URLs with actual pathology images from the library.
const DEMO_SEQUENCE: ExplainerSequence = {
  version: 1,
  duration: 30,
  aspectRatio: "16:9",
  segments: [
    {
      id: "seg-1",
      imageUrl: `${R2_BASE}/static/images/og-image.png`,
      imageAlt: "Overview slide",
      startTime: 0,
      endTime: 15,
      transition: "crossfade",
      transitionDuration: 1,
      keyframes: [
        {
          time: 0,
          transform: { x: 0, y: 0, scale: 1 },
          highlights: [],
          textOverlays: [
            {
              id: "t-title",
              text: "Pathology Explanation Demo",
              position: { x: 50, y: 10 },
              fontSize: 1.25,
              fontWeight: "bold",
              color: "#ffffff",
              backgroundColor: "rgba(0,0,0,0.7)",
              textAlign: "center",
              animation: "fade",
            },
          ],
        },
        {
          time: 5,
          transform: { x: -8, y: -5, scale: 1.3 },
          highlights: [
            {
              id: "h1",
              type: "circle",
              position: { x: 45, y: 45 },
              size: { width: 20, height: 20 },
              borderColor: "#ef4444",
              borderWidth: 3,
              opacity: 0.9,
            },
          ],
          textOverlays: [
            {
              id: "t-label1",
              text: "Region of interest",
              position: { x: 58, y: 42 },
              fontSize: 0.875,
              fontWeight: "semibold",
              color: "#ffffff",
              backgroundColor: "rgba(239,68,68,0.8)",
              animation: "slide-up",
            },
          ],
        },
        {
          time: 10,
          transform: { x: -15, y: -10, scale: 1.6 },
          highlights: [
            {
              id: "h1",
              type: "circle",
              position: { x: 45, y: 45 },
              size: { width: 12, height: 12 },
              borderColor: "#ef4444",
              borderWidth: 2,
              opacity: 0.7,
            },
          ],
          textOverlays: [
            {
              id: "t-label2",
              text: "Zooming in to see cellular detail",
              position: { x: 50, y: 80 },
              fontSize: 0.875,
              fontWeight: "normal",
              color: "#ffffff",
              backgroundColor: "rgba(0,0,0,0.7)",
              textAlign: "center",
              animation: "fade",
            },
          ],
        },
        {
          time: 15,
          transform: { x: 0, y: 0, scale: 1 },
          highlights: [],
          textOverlays: [],
        },
      ],
    },
    {
      id: "seg-2",
      imageUrl: `${R2_BASE}/static/images/og-image.png`,
      imageAlt: "Second view",
      startTime: 15,
      endTime: 30,
      transition: "cut",
      transitionDuration: 0,
      keyframes: [
        {
          time: 0,
          transform: { x: 10, y: 5, scale: 1.2 },
          highlights: [],
          textOverlays: [
            {
              id: "t-seg2-title",
              text: "Summary",
              position: { x: 50, y: 10 },
              fontSize: 1.25,
              fontWeight: "bold",
              color: "#ffffff",
              backgroundColor: "rgba(0,0,0,0.7)",
              textAlign: "center",
              animation: "fade",
            },
          ],
        },
        {
          time: 5,
          transform: { x: 0, y: 0, scale: 1 },
          highlights: [
            {
              id: "h2",
              type: "rectangle",
              position: { x: 25, y: 30 },
              size: { width: 50, height: 40 },
              borderColor: "#3b82f6",
              borderWidth: 2,
              fillColor: "rgba(59,130,246,0.1)",
              opacity: 0.8,
            },
          ],
          textOverlays: [
            {
              id: "t-seg2-title",
              text: "Summary",
              position: { x: 50, y: 10 },
              fontSize: 1.25,
              fontWeight: "bold",
              color: "#ffffff",
              backgroundColor: "rgba(0,0,0,0.7)",
              textAlign: "center",
              animation: "fade",
            },
            {
              id: "t-seg2-label",
              text: "Key diagnostic feature highlighted",
              position: { x: 50, y: 75 },
              fontSize: 0.875,
              fontWeight: "normal",
              color: "#ffffff",
              backgroundColor: "rgba(59,130,246,0.8)",
              textAlign: "center",
              animation: "slide-up",
            },
          ],
        },
        {
          time: 12,
          transform: { x: -5, y: -3, scale: 1.1 },
          highlights: [],
          textOverlays: [
            {
              id: "t-seg2-end",
              text: "End of explanation",
              position: { x: 50, y: 50 },
              fontSize: 1,
              fontWeight: "bold",
              color: "#ffffff",
              backgroundColor: "rgba(0,0,0,0.7)",
              textAlign: "center",
              animation: "fade",
            },
          ],
        },
        {
          time: 15,
          transform: { x: 0, y: 0, scale: 1 },
          highlights: [],
          textOverlays: [],
        },
      ],
    },
  ],
};

export default function ExplainerEditorPage() {
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/audio/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setAudioUrl(data.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleManualUrl = () => {
    const url = prompt("Enter audio URL (MP3):");
    if (url) {
      setAudioUrl(url);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Explainer Editor</h1>
        <p className="text-muted-foreground">
          Create animated explanations for pathology questions. This is a demo of
          the ExplainerPlayer component.
        </p>
      </div>

      {/* Audio Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileAudio className="h-5 w-5" />
            Audio Setup
          </CardTitle>
          <CardDescription>
            Upload an MP3 file or enter a URL to use as the narration track.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mpeg,audio/mp4,audio/wav,audio/webm,audio/ogg"
              onChange={handleAudioUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? "Uploading..." : "Upload MP3"}
            </Button>
            <Button variant="ghost" onClick={handleManualUrl}>
              Enter URL manually
            </Button>
          </div>

          {uploadError && (
            <p className="text-sm text-destructive">{uploadError}</p>
          )}

          {audioUrl && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Audio:</span>
              <code className="text-xs bg-muted px-2 py-1 rounded max-w-md truncate">
                {audioUrl}
              </code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Demo Player */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Player Preview
          </CardTitle>
          <CardDescription>
            Preview the ExplainerPlayer with a demo animation sequence.
            {!audioUrl &&
              " Upload or enter an audio URL above to enable full playback."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showPlayer ? (
            <div className="space-y-4">
              <Button
                onClick={() => setShowPlayer(true)}
                disabled={!audioUrl}
              >
                <Play className="h-4 w-4 mr-2" />
                Load Player
              </Button>
              {!audioUrl && (
                <p className="text-sm text-muted-foreground">
                  Set up audio first to enable the player.
                </p>
              )}
            </div>
          ) : (
            <div className="max-w-3xl">
              <ExplainerPlayer
                sequence={DEMO_SEQUENCE}
                audioUrl={audioUrl}
                className="w-full rounded-lg shadow-lg"
                onEnded={() => console.log("Explainer ended")}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sequence JSON */}
      <Card>
        <CardHeader>
          <CardTitle>Sequence JSON</CardTitle>
          <CardDescription>
            The JSON data driving the demo animation above. In production, this
            will be authored via the Sequencer Editor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-96">
            {JSON.stringify(DEMO_SEQUENCE, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
