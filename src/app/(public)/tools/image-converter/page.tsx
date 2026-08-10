"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileArchive, Loader2, ShieldCheck, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { PublicHero } from "@/shared/components/common/public-hero";
import { JoinCommunitySection } from "@/shared/components/common/join-community-section";
import { toast } from "@/shared/utils/ui/toast";
import { log } from "@/shared/utils/logging";
import { ConverterDropzone } from "./converter-dropzone";
import { ConverterFileList } from "./converter-file-list";
import { ConverterSettings } from "./converter-settings";
import { detectEncodableFormats } from "./converter-canvas";
import { saveBlob, zipPages } from "./converter-download";
import { OUTPUT_FORMATS, formatBytes } from "./converter-types";
import { useImageConverter } from "./use-image-converter";

const CANVAS_FORMATS = OUTPUT_FORMATS.filter((format) => format.value !== "image/tiff").map(
  (format) => format.value
);

export default function ImageConverterPage() {
  const {
    items,
    options,
    counts,
    isConverting,
    addFiles,
    removeItem,
    clearAll,
    updateOptions,
    runQueue,
  } = useImageConverter();

  const [supportedFormats, setSupportedFormats] = useState<Set<string>>(new Set(["image/png"]));
  const [isZipping, setIsZipping] = useState(false);

  useEffect(() => {
    let cancelled = false;
    detectEncodableFormats(CANVAS_FORMATS)
      .then((formats) => {
        if (!cancelled) setSupportedFormats(formats);
      })
      .catch((err) => log.error("Image converter: format detection failed", err));
    return () => {
      cancelled = true;
    };
  }, []);

  const hasTiffInput = useMemo(
    () => items.some((item) => /\.tiff?$/i.test(item.file.name) || item.file.type === "image/tiff"),
    [items]
  );
  const pendingCount = counts.pending;
  const allOutputs = useMemo(() => items.flatMap((item) => item.outputs), [items]);

  const handleDownloadAll = async () => {
    if (allOutputs.length === 0) return;
    if (allOutputs.length === 1) {
      saveBlob(allOutputs[0].blob, allOutputs[0].name);
      return;
    }
    setIsZipping(true);
    try {
      const archive = await zipPages(allOutputs);
      saveBlob(archive, "converted-images.zip");
    } catch (err) {
      log.error("Image converter: zip failed", err);
      toast.error("Could not build the ZIP. Try saving the images individually.");
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHero
        title="Image Converter"
        description="Turn TIFF scans into PNG, JPEG, WebP or AVIF — a whole folder at a time. Everything is decoded and re-encoded inside your browser, so no image ever leaves your computer."
      />

      <section className="flex-1 py-8">
        <div className="container mx-auto max-w-4xl space-y-6 px-4">
          <ConverterDropzone
            onFiles={addFiles}
            onRejected={(count) =>
              toast.error(
                `Skipped ${count} file${count === 1 ? "" : "s"} that ${count === 1 ? "isn't" : "aren't"} an image.`
              )
            }
          />

          <Card>
            <CardContent className="pt-6">
              <ConverterSettings
                options={options}
                supportedFormats={supportedFormats}
                onChange={updateOptions}
                hasTiffInput={hasTiffInput}
              />
            </CardContent>
          </Card>

          {items.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => void runQueue()}
                  disabled={isConverting || pendingCount === 0}
                >
                  {isConverting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="mr-2 h-4 w-4" />
                  )}
                  {isConverting
                    ? "Converting…"
                    : pendingCount > 0
                      ? `Convert ${pendingCount} file${pendingCount === 1 ? "" : "s"}`
                      : "Nothing to convert"}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => void handleDownloadAll()}
                  disabled={allOutputs.length === 0 || isZipping}
                >
                  {isZipping ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : allOutputs.length > 1 ? (
                    <FileArchive className="mr-2 h-4 w-4" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {allOutputs.length > 1 ? `Save all (${allOutputs.length}) as ZIP` : "Save result"}
                </Button>

                <Button variant="ghost" onClick={clearAll} disabled={isConverting}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear
                </Button>

                {counts.done > 0 && (
                  <span className="ml-auto text-sm text-muted-foreground">
                    {counts.done} converted · {formatBytes(counts.bytes)}
                    {counts.error > 0 ? ` · ${counts.error} failed` : ""}
                  </span>
                )}
              </div>

              <ConverterFileList items={items} options={options} onRemove={removeItem} />
            </>
          )}

          <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              Conversion runs entirely on this page — there is no upload step and no server
              involved. Your files are read straight from disk into the browser&apos;s own image
              decoders, so patient material never travels over the network. Very large scans (over
              80 megapixels) are declined rather than crashing the tab; for whole-slide images use
              the{" "}
              <a className="text-primary underline" href="/tools/virtual-slides">
                virtual slide viewer
              </a>{" "}
              instead.
            </p>
          </div>
        </div>
      </section>

      <JoinCommunitySection description="Free pathology tools and questions, built by pathologists. No fees, no subscriptions." />
    </div>
  );
}
