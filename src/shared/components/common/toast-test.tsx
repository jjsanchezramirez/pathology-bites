"use client"

import { toast } from "sonner"
import { Button } from "@/shared/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"

export function ToastTest() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Toast Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          variant="default"
          onClick={() =>
            toast("Default Toast", {
              description: "This is a default toast message",
            })
          }
          className="w-full"
        >
          Default Toast
        </Button>

        <Button
          variant="default"
          onClick={() =>
            toast.success("Success Toast", {
              description: "This is a success toast message",
            })
          }
          className="w-full"
        >
          Success Toast
        </Button>

        <Button
          variant="destructive"
          onClick={() =>
            toast.error("Error Toast", {
              description: "This is an error toast message",
            })
          }
          className="w-full"
        >
          Error Toast
        </Button>

        <Button
          variant="secondary"
          onClick={() =>
            toast.warning("Warning Toast", {
              description: "This is a warning toast message",
            })
          }
          className="w-full"
        >
          Warning Toast
        </Button>

        <Button
          variant="outline"
          onClick={() =>
            toast.info("Info Toast", {
              description: "This is an info toast message",
            })
          }
          className="w-full"
        >
          Info Toast
        </Button>

        <Button
          variant="outline"
          onClick={() =>
            toast("Toast with Action", {
              description: "This toast has an action button",
              action: {
                label: "Undo",
                onClick: () => toast("Undo clicked!"),
              },
            })
          }
          className="w-full"
        >
          Toast with Action
        </Button>

        <Button
          variant="outline"
          onClick={() => {
            // Test for duplicate prevention
            toast("Duplicate Test", {
              description: "This should only appear once",
              id: "duplicate-test", // Using ID to prevent duplicates
            })
          }}
          className="w-full"
        >
          Duplicate Prevention Test
        </Button>
      </CardContent>
    </Card>
  )
}
