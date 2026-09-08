// Target Blaster — six rounds of tap-the-right-target.
//
// Built from questions the child has ALREADY answered, so it is a reward for
// finishing homework rather than a preview of it. Each play costs one play from
// the shared ledger, earned by handing work in (see shared/game-plays.ts).
//
// Stages 3-6 only: every endpoint behind this page goes through
// requirePrimaryStudent, and the page sends Forms back to their dashboard.
//
// The answers never arrive in the browser. The server marks each round and
// replies "hit" or "missed", exactly as Penalty Shootout does.

import { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";
import { isPrimaryForm } from "@shared/schema";
import { subjectLabel } from "@shared/weekly-report";
import { BLASTER_TEXT, ROUNDS_PER_GAME, type BlastRound } from "@shared/blaster";
import { PLAYS_TEXT, playsMessage, type PlayState } from "@shared/game-plays";
import { ArrowLeft, Loader2, Target, Trophy, Zap } from "lucide-react";
import logoPath from "@assets/logo.webp";

/** Where each target sits and how it drifts. Fixed spots so it stays readable. */
const TARGET_SPOTS = [
  { top: "8%", left: "6%", drift: "blaster-drift-a" },
  { top: "34%", left: "52%", drift: "blaster-drift-b" },
  { top: "58%", left: "12%", drift: "blaster-drift-c" },
  { top: "76%", left: "56%", drift: "blaster-drift-d" },
];

type Phase = "loading" | "ready" | "round" | "feedback" | "over";

export default function TargetBlaster() {
  const [, setLocation] = useLocation();
  const { student } = useAuth();

  const [phase, setPhase] = useState<Phase>("loading");
  const [plays, setPlays] = useState<PlayState | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [best, setBest] = useState<{ score: number; outOf: number; games: number }>({ score: 0, outOf: 0, games: 0 });

  const [rounds, setRounds] = useState<BlastRound[]>([]);
  const [roundNo, setRoundNo] = useState(0);
  const [score, setScore] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [lastHit, setLastHit] = useState<boolean | null>(null);
  const [lastAnswer, setLastAnswer] = useState("");
  const [result, setResult] = useState<any>(null);
  const [errorText, setErrorText] = useState("");
  const [starting, setStarting] = useState(false);

  // Answers in ROUND ORDER, one per round. The server marks the Nth answer
  // against the Nth question it issued, so this array must never have a gap —
  // a round that times out still records an answer.
  const answersRef = useRef<{ ref: string; answerText: string; timedOut?: boolean }[]>([]);

  // Forms never see this game. The server refuses them anyway; this just saves
  // them a pointless round trip.
  useEffect(() => {
    if (!student) { setLocation("/student/login"); return; }
    if (!isPrimaryForm(student.form)) setLocation("/student/dashboard");
  }, [student, setLocation]);

  const loadStatus = async () => {
    try {
      const res = await apiRequest("GET", `/api/students/${student!.id}/blaster`);
      const body = await res.json();
      if (body.success) {
        setPlays(body.plays);
        setQuestionCount(body.questionCount);
        setBest({ score: body.bestScore, outOf: body.bestOutOf, games: body.gamesPlayed });
      }
      setPhase("ready");
    } catch {
      setErrorText("Couldn't load the game. Check your connection and try again.");
      setPhase("ready");
    }
  };

  useEffect(() => {
    if (student && isPrimaryForm(student.form)) loadStatus();
    // Runs once when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The round timer. Runs down while a question is on screen; hitting zero
  // counts as a miss and moves on, so the game never stalls.
  useEffect(() => {
    if (phase !== "round") return;
    if (secondsLeft <= 0) { recordAnswer("", true); return; }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, secondsLeft]);

  const startGame = async () => {
    setStarting(true);
    setErrorText("");
    try {
      const res = await apiRequest("POST", `/api/students/${student!.id}/blaster/start`);
      const body = await res.json();

      if (!body.success) {
        // Out of plays is not an error — it is the game telling them how to
        // earn more.
        if (body.plays) setPlays(body.plays);
        setErrorText(body.message || "Couldn't start the game.");
        return;
      }

      setRounds(body.rounds);
      setPlays(body.plays);
      setRoundNo(0);
      setScore(0);
      answersRef.current = [];
      setResult(null);
      setSecondsLeft(body.secondsPerRound ?? 12);
      setPhase("round");
    } catch {
      setErrorText("Couldn't start the game. Check your connection and try again.");
    } finally {
      setStarting(false);
    }
  };

  /** Record one round's answer, show hit or miss, then move on. */
  const recordAnswer = async (answerText: string, timedOut = false) => {
    const round = rounds[roundNo];
    if (!round || phase !== "round") return;

    // Written down before anything can go wrong, so the array always has one
    // entry per round in order.
    answersRef.current = [...answersRef.current, { ref: round.ref, answerText, timedOut }];

    let hit = false;
    let correctText = "";
    if (!timedOut) {
      try {
        const res = await apiRequest("POST", `/api/students/${student!.id}/blaster/answer`, {
          ref: round.ref, answerText,
        });
        const body = await res.json();
        hit = !!body.correct;
        correctText = body.correctAnswerDisplay || "";
      } catch {
        // A dropped connection counts as a miss rather than freezing the game.
        hit = false;
      }
    }

    if (hit) setScore((s) => s + 1);
    setLastHit(hit);
    setLastAnswer(correctText);
    setPhase("feedback");

    setTimeout(() => {
      const next = roundNo + 1;
      if (next < rounds.length) {
        setRoundNo(next);
        setSecondsLeft(round.seconds);
        setPhase("round");
      } else {
        finishGame();
      }
    }, hit ? 900 : 2000);
  };

  const finishGame = async () => {
    try {
      const res = await apiRequest("POST", `/api/students/${student!.id}/blaster/finish`, {
        answers: answersRef.current,
      });
      const body = await res.json();
      if (body.success) {
        setResult(body);
        if (body.plays) setPlays(body.plays);
        setBest({ score: body.bestScore, outOf: body.bestOutOf, games: body.gamesPlayed });
        // The dashboard shows XP and streaks, so refresh them.
        queryClient.invalidateQueries({ queryKey: ["/api/students", student!.id, "stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/students", student!.id, "streak"] });
      }
      setPhase("over");
    } catch {
      setErrorText("Couldn't save your game. Check your connection.");
      setPhase("over");
    }
  };

  if (!student) return null;

  const round = rounds[roundNo];
  const playsLine = plays ? playsMessage(plays) : "";

  return (
    <div className="min-h-screen bg-background">
      {/* The drift animations live with the page that uses them. */}
      <style>{`
        @keyframes blasterDriftA { 0%,100% { transform: translate(0,0); } 50% { transform: translate(14px,10px); } }
        @keyframes blasterDriftB { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-16px,12px); } }
        @keyframes blasterDriftC { 0%,100% { transform: translate(0,0); } 50% { transform: translate(12px,-14px); } }
        @keyframes blasterDriftD { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-10px,-12px); } }
        .blaster-drift-a { animation: blasterDriftA 3.1s ease-in-out infinite; }
        .blaster-drift-b { animation: blasterDriftB 3.7s ease-in-out infinite; }
        .blaster-drift-c { animation: blasterDriftC 3.4s ease-in-out infinite; }
        .blaster-drift-d { animation: blasterDriftD 4.1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .blaster-drift-a, .blaster-drift-b, .blaster-drift-c, .blaster-drift-d { animation: none; }
        }
      `}</style>

      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/student/dashboard" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Dashboard</span>
          </Link>
          <div className="flex items-center gap-2">
            <img src={logoPath} alt="On Point" className="h-8 w-auto" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-center gap-2 mb-1">
          <Target className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{BLASTER_TEXT.title}</h1>
        </div>
        <p className="text-muted-foreground text-sm mb-6">{BLASTER_TEXT.tagline}</p>

        {phase === "loading" && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}

        {/* ---- Before a game: plays, record, and the start button ---- */}
        {phase === "ready" && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-xs text-muted-foreground">{PLAYS_TEXT.title}</p>
                    <p className="text-3xl font-bold" data-testid="text-plays-left">{plays?.left ?? 0}</p>
                  </div>
                  {best.outOf > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                        <Trophy className="h-3 w-3" /> {BLASTER_TEXT.bestSoFar}
                      </p>
                      <p className="text-xl font-semibold" data-testid="text-best">{best.score}/{best.outOf}</p>
                    </div>
                  )}
                </div>
                <p className="text-sm mt-3" data-testid="text-plays-message">{playsLine}</p>
                <p className="text-xs text-muted-foreground mt-2">{PLAYS_TEXT.resetNote}</p>
              </CardContent>
            </Card>

            {errorText && (
              <p className="text-sm text-destructive" data-testid="text-blaster-error">{errorText}</p>
            )}

            {/* Nothing handed in yet: say what to do, rather than a dead button. */}
            {questionCount === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground" data-testid="text-nothing-yet">
                  {BLASTER_TEXT.nothingYet}
                </CardContent>
              </Card>
            ) : (
              <Button
                size="lg"
                className="w-full h-14 text-lg"
                disabled={starting || (plays?.left ?? 0) <= 0}
                onClick={startGame}
                data-testid="button-start-blast"
              >
                {starting ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Zap className="h-5 w-5 mr-2" />}
                {BLASTER_TEXT.start}
              </Button>
            )}
          </div>
        )}

        {/* ---- A round in play ---- */}
        {(phase === "round" || phase === "feedback") && round && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Badge variant="outline">{BLASTER_TEXT.round(roundNo + 1, ROUNDS_PER_GAME)}</Badge>
              <Badge variant="secondary">{subjectLabel(round.subject)}</Badge>
              <span className="text-sm font-semibold" data-testid="text-score">Hit {score}/{ROUNDS_PER_GAME}</span>
              {phase === "round" && (
                <span
                  className={`text-sm font-bold tabular-nums ${secondsLeft <= 3 ? "text-destructive" : ""}`}
                  data-testid="text-timer"
                >
                  {secondsLeft}s
                </span>
              )}
            </div>

            <Card>
              <CardContent className="p-4">
                <p className="text-lg font-medium" data-testid="text-question">{round.questionText}</p>
              </CardContent>
            </Card>

            {/* The targets. Big tap areas — this is played on a phone. */}
            <div className="relative h-72 rounded-lg border bg-muted/30 overflow-hidden">
              {round.targets.map((t, i) => {
                const spot = TARGET_SPOTS[i % TARGET_SPOTS.length];
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={phase !== "round"}
                    onClick={() => recordAnswer(t.value)}
                    className={`absolute ${spot.drift} rounded-full border-4 border-primary bg-background px-5 py-4 text-base font-semibold shadow-md
                                hover-elevate active-elevate-2 disabled:opacity-60 max-w-[42%] break-words`}
                    style={{ top: spot.top, left: spot.left }}
                    data-testid={`target-${i}`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {phase === "feedback" && (
              <Card className={lastHit ? "border-green-500" : "border-destructive"}>
                <CardContent className="p-4 text-center">
                  <p className="text-lg font-bold" data-testid="text-feedback">
                    {lastHit
                      ? BLASTER_TEXT.hit
                      : answersRef.current[answersRef.current.length - 1]?.timedOut
                        ? BLASTER_TEXT.timedOut
                        : BLASTER_TEXT.missed}
                  </p>
                  {!lastHit && lastAnswer && (
                    <p className="text-sm text-muted-foreground mt-1">The right answer was {lastAnswer}.</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ---- After the game ---- */}
        {phase === "over" && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6 text-center space-y-2">
                <p className="text-3xl font-bold" data-testid="text-final-score">
                  {BLASTER_TEXT.scoreLine(result?.score ?? score, result?.outOf ?? ROUNDS_PER_GAME)}
                </p>
                {result?.newRecord && (
                  <p className="text-lg font-semibold text-primary" data-testid="text-new-record">
                    {BLASTER_TEXT.newRecord}
                  </p>
                )}
                {result?.xp?.awarded > 0 && (
                  <p className="text-sm text-muted-foreground" data-testid="text-xp">
                    +{result.xp.awarded} XP
                  </p>
                )}
                <p className="text-sm" data-testid="text-plays-after">
                  {PLAYS_TEXT.spent(plays?.left ?? 0)}
                </p>
              </CardContent>
            </Card>

            {errorText && <p className="text-sm text-destructive">{errorText}</p>}

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                disabled={(plays?.left ?? 0) <= 0}
                onClick={() => { setPhase("ready"); loadStatus(); }}
                data-testid="button-play-again"
              >
                {BLASTER_TEXT.playAgain}
              </Button>
              <Link href="/student/dashboard">
                <Button variant="secondary" className="w-full" data-testid="button-back-dashboard">
                  {BLASTER_TEXT.backToDashboard}
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
