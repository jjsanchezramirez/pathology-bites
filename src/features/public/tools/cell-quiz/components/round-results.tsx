"use client";

import { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { createClient } from "@/shared/services/client";
import { toast } from "@/shared/utils/ui/toast";
import { MAX_ROUND_SCORE, QUESTIONS_PER_ROUND, scoreRound, type RoundAnswer } from "../scoring";
import { getGuestId, getSavedNickname, saveNickname } from "@/shared/leaderboard/guest";

function verdict(correct: number) {
  if (correct >= 9) return "Outstanding";
  if (correct >= 7) return "Strong round";
  if (correct >= 5) return "Solid effort";
  return "Keep practicing";
}

export function RoundResults({
  answers,
  onPlayAgain,
  onMenu,
  onSubmitted,
}: {
  answers: RoundAnswer[];
  onPlayAgain: () => void;
  onMenu: () => void;
  onSubmitted: () => void;
}) {
  const { score, correct, durationMs } = scoreRound(answers);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [nickname, setNickname] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [honeypot, setHoneypot] = useState("");

  useEffect(() => {
    setNickname(getSavedNickname());
    createClient()
      .auth.getUser()
      .then(({ data }) => setSignedIn(!!data.user))
      .catch(() => setSignedIn(false));
  }, []);

  async function submit() {
    setState("saving");
    try {
      const res = await fetch("/api/public/leaderboard/cell-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: { answers },
          nickname,
          guestId: getGuestId(),
          referral_source: honeypot,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save score");
      if (!signedIn) saveNickname(nickname.trim());
      setState("saved");
      onSubmitted();
    } catch (e) {
      setState("idle");
      toast.error(e instanceof Error ? e.message : "Could not save score");
    }
  }

  return (
    <div className="space-y-6 text-center">
      <div>
        <p className="text-sm text-muted-foreground">{verdict(correct)}</p>
        <p className="mt-1 text-6xl font-bold tabular-nums text-primary">{score}</p>
        <p className="text-xs text-muted-foreground">of {MAX_ROUND_SCORE} points</p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-xl font-semibold tabular-nums">
            {correct}/{QUESTIONS_PER_ROUND}
          </p>
          <p className="text-xs text-muted-foreground">correct</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-xl font-semibold tabular-nums">
            {(durationMs / QUESTIONS_PER_ROUND / 1000).toFixed(1)}s
          </p>
          <p className="text-xs text-muted-foreground">avg per cell</p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5" aria-label="Answer history">
        {answers.map((a, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full ${a.correct ? "bg-emerald-500" : "bg-red-400"}`}
          />
        ))}
      </div>

      {state === "saved" ? (
        <p className="flex items-center justify-center gap-1.5 text-sm text-emerald-600">
          <Check className="h-4 w-4" /> Score added to the leaderboard
        </p>
      ) : (
        <div className="space-y-2 rounded-xl border p-3 text-left">
          <p className="text-sm font-medium">Add this round to the leaderboard</p>
          {signedIn === false && (
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Nickname (2–24 characters)"
              maxLength={24}
              aria-label="Nickname"
            />
          )}
          {/* honeypot: hidden from people, filled by naive bots */}
          <input
            type="text"
            name="referral_source"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            className="absolute left-[-9999px] h-0 w-0 opacity-0"
            aria-hidden="true"
          />
          <Button
            onClick={submit}
            disabled={
              state === "saving" || signedIn === null || (!signedIn && nickname.trim().length < 2)
            }
            className="w-full"
          >
            {state === "saving" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {signedIn ? "Submit score" : "Submit as guest"}
          </Button>
          {signedIn === false && (
            <p className="text-xs text-muted-foreground">
              Have an account? Sign in first to rank under your profile name.
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Button onClick={onPlayAgain} size="lg" className="w-full">
          Play another round
        </Button>
        <Button onClick={onMenu} variant="ghost" className="w-full">
          Back to menu
        </Button>
      </div>
    </div>
  );
}
