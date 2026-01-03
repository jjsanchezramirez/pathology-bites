"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { toast } from "@/shared/utils/toast";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, Loader2, Zap, Copy } from "lucide-react";

export default function ToastDemoPage() {
  const [customMessage, setCustomMessage] = useState("Custom toast message");
  const [customDuration, setCustomDuration] = useState("8000");
  const [loadingToastId, setLoadingToastId] = useState<string | number | undefined>();

  // Simulate async operation
  const simulateAsyncOperation = () => {
    return new Promise((resolve) => {
      setTimeout(() => resolve({ count: 42 }), 2000);
    });
  };

  // Simulate async operation with error
  const simulateAsyncError = () => {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Something went wrong")), 2000);
    });
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Toast Notification Demo</h1>
        <p className="text-muted-foreground">Test and explore all toast notification features</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Toasts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Basic Toast Types
            </CardTitle>
            <CardDescription>Standard toast notifications for different scenarios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => toast.success("Operation completed successfully!")}
              className="w-full"
              variant="default"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Success Toast
            </Button>

            <Button
              onClick={() => toast.error("Failed to complete operation")}
              className="w-full"
              variant="destructive"
            >
              <AlertCircle className="mr-2 h-4 w-4" />
              Error Toast
            </Button>

            <Button
              onClick={() => toast.warning("Please review your changes carefully")}
              className="w-full"
              variant="outline"
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Warning Toast
            </Button>

            <Button
              onClick={() => toast.info("New features are now available")}
              className="w-full"
              variant="secondary"
            >
              <Info className="mr-2 h-4 w-4" />
              Info Toast
            </Button>

            <Button
              onClick={() => toast.message("Welcome back to Pathology Bites!")}
              className="w-full"
              variant="outline"
            >
              Message Toast
            </Button>
          </CardContent>
        </Card>

        {/* Categorized Toasts */}
        <Card>
          <CardHeader>
            <CardTitle>Categorized Toasts</CardTitle>
            <CardDescription>
              Toasts organized by feature category with automatic deduplication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold mb-2">Authentication</h4>
              <div className="space-y-2">
                <Button
                  onClick={() => toast.auth.success("Login successful")}
                  className="w-full"
                  size="sm"
                  variant="outline"
                >
                  Auth Success
                </Button>
                <Button
                  onClick={() => toast.auth.error("Invalid credentials")}
                  className="w-full"
                  size="sm"
                  variant="outline"
                >
                  Auth Error
                </Button>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Questions</h4>
              <div className="space-y-2">
                <Button
                  onClick={() => toast.question.success("Question created successfully")}
                  className="w-full"
                  size="sm"
                  variant="outline"
                >
                  Question Success
                </Button>
                <Button
                  onClick={() => toast.question.info("Question submitted for review")}
                  className="w-full"
                  size="sm"
                  variant="outline"
                >
                  Question Info
                </Button>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Quiz & Upload</h4>
              <div className="space-y-2">
                <Button
                  onClick={() => toast.quiz.success("Quiz completed!")}
                  className="w-full"
                  size="sm"
                  variant="outline"
                >
                  Quiz Success
                </Button>
                <Button
                  onClick={() => toast.upload.success("Image uploaded successfully")}
                  className="w-full"
                  size="sm"
                  variant="outline"
                >
                  Upload Success
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Promise-Based Toasts */}
        <Card>
          <CardHeader>
            <CardTitle>Promise-Based Toasts</CardTitle>
            <CardDescription>Automatic loading, success, and error states</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => {
                toast.promise(simulateAsyncOperation(), {
                  loading: "Processing data...",
                  success: "Data processed successfully!",
                  error: "Failed to process data",
                });
              }}
              className="w-full"
              variant="default"
            >
              <Loader2 className="mr-2 h-4 w-4" />
              Promise Success
            </Button>

            <Button
              onClick={() => {
                toast.promise(simulateAsyncError(), {
                  loading: "Attempting operation...",
                  success: "Operation succeeded!",
                  error: "Operation failed",
                });
              }}
              className="w-full"
              variant="destructive"
            >
              Promise Error
            </Button>

            <Button
              onClick={() => {
                toast.promise(simulateAsyncOperation(), {
                  loading: "Loading questions...",
                  success: (data: unknown) => `Loaded ${data.count} questions successfully`,
                  error: (err: Error) => `Error: ${err.message}`,
                });
              }}
              className="w-full"
              variant="outline"
            >
              Promise with Dynamic Message
            </Button>
          </CardContent>
        </Card>

        {/* Manual Loading States */}
        <Card>
          <CardHeader>
            <CardTitle>Manual Loading States</CardTitle>
            <CardDescription>
              Control loading toasts manually for complex operations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => {
                const id = toast.loading("Processing your request...");
                setLoadingToastId(id);

                setTimeout(() => {
                  toast.success("Request completed!", { id });
                  setLoadingToastId(undefined);
                }, 3000);
              }}
              className="w-full"
              variant="default"
              disabled={!!loadingToastId}
            >
              <Loader2 className="mr-2 h-4 w-4" />
              Manual Loading → Success
            </Button>

            <Button
              onClick={() => {
                const id = toast.loading("Uploading file...");
                setLoadingToastId(id);

                setTimeout(() => {
                  toast.error("Upload failed - file too large", { id });
                  setLoadingToastId(undefined);
                }, 3000);
              }}
              className="w-full"
              variant="destructive"
              disabled={!!loadingToastId}
            >
              Manual Loading → Error
            </Button>

            <Button
              onClick={() => {
                toast.dismiss();
              }}
              className="w-full"
              variant="outline"
            >
              Dismiss All Toasts
            </Button>
          </CardContent>
        </Card>

        {/* Custom Duration Toasts */}
        <Card>
          <CardHeader>
            <CardTitle>Custom Durations</CardTitle>
            <CardDescription>Control how long toasts stay visible</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => toast.info("Quick message (3 seconds)", { duration: 3000 })}
              className="w-full"
              variant="outline"
            >
              Short Duration (3s)
            </Button>

            <Button
              onClick={() => toast.success("Default duration (8 seconds)")}
              className="w-full"
              variant="outline"
            >
              Default Duration (8s)
            </Button>

            <Button
              onClick={() => toast.warning("Important message (15 seconds)", { duration: 15000 })}
              className="w-full"
              variant="outline"
            >
              Long Duration (15s)
            </Button>

            <Button
              onClick={() =>
                toast.error("Critical error - requires manual dismissal", { duration: Infinity })
              }
              className="w-full"
              variant="destructive"
            >
              Persistent Toast (∞)
            </Button>
          </CardContent>
        </Card>

        {/* Duplicate Prevention Demo */}
        <Card>
          <CardHeader>
            <CardTitle>Duplicate Prevention</CardTitle>
            <CardDescription>
              Automatic deduplication prevents spam (1 second window)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => {
                // Trigger multiple identical toasts - only one will show
                toast.error("Network error occurred");
                toast.error("Network error occurred");
                toast.error("Network error occurred");
              }}
              className="w-full"
              variant="destructive"
            >
              Spam Same Error (Only 1 Shows)
            </Button>

            <Button
              onClick={() => {
                // Different messages will all show
                toast.success("Action 1 completed");
                toast.success("Action 2 completed");
                toast.success("Action 3 completed");
              }}
              className="w-full"
              variant="default"
            >
              Different Messages (All Show)
            </Button>

            <Button
              onClick={() => {
                // Categories have separate deduplication
                toast.auth.error("Login failed");
                toast.question.error("Login failed");
                toast.quiz.error("Login failed");
              }}
              className="w-full"
              variant="outline"
            >
              Same Message, Different Categories
            </Button>
          </CardContent>
        </Card>

        {/* Custom Toast Playground */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Custom Toast Playground</CardTitle>
            <CardDescription>Create your own custom toast with custom settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <Label htmlFor="custom-message">Message</Label>
                <Input
                  id="custom-message"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Enter toast message"
                />
              </div>

              <div>
                <Label htmlFor="custom-duration">Duration (ms)</Label>
                <Input
                  id="custom-duration"
                  type="number"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  placeholder="8000"
                />
              </div>

              <div>
                <Label htmlFor="toast-type">Type</Label>
                <Select defaultValue="success">
                  <SelectTrigger id="toast-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="message">Message</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  const type =
                    (document.getElementById("toast-type") as HTMLSelectElement)?.value ||
                    "success";
                  const duration = parseInt(customDuration) || 8000;

                  switch (type) {
                    case "success":
                      toast.success(customMessage, { duration });
                      break;
                    case "error":
                      toast.error(customMessage, { duration });
                      break;
                    case "warning":
                      toast.warning(customMessage, { duration });
                      break;
                    case "info":
                      toast.info(customMessage, { duration });
                      break;
                    case "message":
                      toast.message(customMessage, { duration });
                      break;
                  }
                }}
                className="flex-1"
              >
                Show Custom Toast
              </Button>

              <Button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `toast.success('${customMessage}', { duration: ${customDuration} })`
                  );
                  toast.info("Code copied to clipboard!", { duration: 2000 });
                }}
                variant="outline"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Documentation Link */}
        <Card className="lg:col-span-2 bg-muted">
          <CardHeader>
            <CardTitle>Documentation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              For complete documentation on using toast notifications, including best practices, API
              reference, and advanced examples, see:
            </p>
            <code className="block bg-background p-3 rounded-md text-sm">
              docs/toast-usage-guide.md
            </code>
            <div className="mt-4 p-4 bg-background rounded-md">
              <p className="text-sm font-semibold mb-2">Quick Import:</p>
              <code className="text-sm">
                import &#123; toast &#125; from '@/shared/utils/toast'
              </code>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
