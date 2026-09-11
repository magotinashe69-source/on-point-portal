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
//
// Walking away does not cost the play. Every round is written down on the
// server as it is played, so closing the tab, running out of battery or tapping
// "back" leaves the game exactly where it was — coming back drops the child
// into the SAME game at the round they had reached. The rounds they already
// played keep their marks and are never asked again.

import { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";
import { isPrimaryForm } from "@shared/schema";
import { ROUNDS_PER_GAME, type BlastRound } from "@shared/blaster";
import {
  PLAYS_TEXT, RESUME_TEXT, playsMessage, readProgress, scoreProgress,
  type PlayState, type SlotProgress,
} from "@shared/game-plays";
import { ArrowLeft, Loader2, Target, Trophy, Zap } from "lucide-react";
import logoPath from "@assets/logo.webp";
import { subjectName, useT } from "@/lib/i18n";

/** Where each target sits and how it drifts. Fixed spots so it stays readable. */
const TARGET_SPOTS = [
  { top: "8%", left: "6%", drift: "blaster-drift-a" },
  { top: "34%", left: "52%", drift: "blaster-drift-b" },
  { top: "58%", left: "12%", drift: "blaster-drift-c" },
  { top: "76%", left: "56%", drift: "blaster-drift-d" },
];

type Phase = "loading" | "ready" | "round" | "feedback" | "over";

export default function TargetBlaster() {
  const text = useT();
  const [, setLocation] = useLocation();
  const { student } = useAuth();

  const [phase, setPhase] = useState<Phase>("loading");
  const [plays, setPlays] = useState<PlayState | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [best, setBest] = useState<{ score: number; outOf: number; games: number }>({ score: 0, outOf: 0, games: 0 });

  // The rounds still to play, in order. On a fresh game that is all six; on one
  // being picked up again it is only the rounds not yet played, so a round whose
  // answer has already been seen is never asked twice.
  const [rounds, setRounds] = useState<BlastRound[]>([]);
  const [roundNo, setRoundNo] = useState(0);
  const [resumed, setResumed] = useState(false);
  const [canResume, setCanResume] = useState(false);
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
        setCanResume(!!body.resumable);
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

      // A game being picked up again: keep only the rounds still to play, and
      // start from the score already earned. The server decides both — the
      // marks were written down as each round was played.
      const all: BlastRound[] = body.rounds ?? [];
      const progress: SlotProgress = readProgress(body.progress, ROUNDS_PER_GAME);
      const todo = body.resumed ? all.filter((r) => !progress[r.index]) : all;

      setPlays(body.plays);
      setResumed(!!body.resumed);
      setCanResume(false);
      setScore(body.resumed ? scoreProgress(progress) : 0);
      answersRef.current = [];
      setResult(null);

      // Every round already played: nothing left to ask, so score it and show
      // the result rather than starting a game with no rounds in it.
      if (todo.length === 0) {
        setRounds(all);
        setRoundNo(0);
        await finishGame();
        return;
      }

      setRounds(todo);
      setRoundNo(0);
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

    // Kept for the local "too slow" wording only. The score is the server's:
    // it marks and saves each round as it happens, and adds them up at the end.
    answersRef.current = [...answersRef.current, { ref: round.ref, answerText, timedOut }];

    let hit = false;
    let correctText = "";
    // Sent even when the round timed out, so the server writes it down as
    // played. Otherwise coming back to the game would ask it all over again.
    try {
      const res = await apiRequest("POST", `/api/students/${student!.id}/blaster/answer`, {
        slot: round.index, ref: round.ref, answerText, timedOut,
      });
      const body = await res.json();
      hit = !timedOut && !!body.correct;
      correctText = body.correctAnswerDisplay || "";
    } catch {
      // A dropped connection counts as a miss rather than freezing the game.
      hit = false;
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
          <h1 className="text-2xl font-bold">{text.blaster.title}</h1>
        </div>
        <p className="text-muted-foreground text-sm mb-6">{text.blaster.tagline}</p>

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
                    <p className="text-xs text-muted-foreground">{text.gamePlays.title}</p>
                    <p className="text-3xl font-bold" data-testid="text-plays-left">{plays?.left ?? 0}</p>
                  </div>
                  {best.outOf > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                        <Trophy className="h-3 w-3" /> {text.blaster.bestSoFar}
                      </p>
                      <p className="text-xl font-semibold" data-testid="text-best">{best.score}/{best.outOf}</p>
                    </div>
                  )}
                </div>
                <p className="text-sm mt-3" data-testid="text-plays-message">{playsLine}</p>
                <p className="text-xs text-muted-foreground mt-2">{text.gamePlays.resetNote}</p>
                <p className="text-xs text-muted-foreground mt-1">{text.resume.noCost}</p>
              </CardContent>
            </Card>

            {errorText && (
              <p className="text-sm text-destructive" data-testid="text-blaster-error">{errorText}</p>
            )}

            {/* Nothing handed in yet: say what to do, rather than a dead button. */}
            {questionCount === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground" data-testid="text-nothing-yet">
                  {text.blaster.nothingYet}
                </CardContent>
              </Card>
            ) : (
              <>
                {canResume && (
                  <Card className="border-primary">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium" data-testid="text-resume-banner">
                        {text.resume.banner}
                      </p>
                    </CardContent>
                  </Card>
                )}
                <Button
                  size="lg"
                  className="w-full h-14 text-lg"
                  /* A game already paid for can always be picked up, whatever
                     the balance says — charging for it twice is the bug this
                     whole path exists to avoid. */
                  disabled={starting || (!canResume && (plays?.left ?? 0) <= 0)}
                  onClick={startGame}
                  data-testid="button-start-blast"
                >
                  {starting ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Zap className="h-5 w-5 mr-2" />}
                  {canResume ? "Carry on" : text.blaster.start}
                </Button>
              </>
            )}
          </div>
        )}

        {/* ---- A round in play ---- */}
        {(phase === "round" || phase === "feedback") && round && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Badge variant="outline">{text.blaster.round(round.index + 1, ROUNDS_PER_GAME)}</Badge>
              <Badge variant="secondary">{subjectName(text, round.subject)}</Badge>
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

            {resumed && (
              <p className="text-xs text-muted-foreground" data-testid="text-resumed-note">
                {text.resume.where("round", round.index + 1, ROUNDS_PER_GAME, score)}
              </p>
            )}

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
                      ? text.blaster.hit
                      : answersRef.current[answersRef.current.length - 1]?.timedOut
                        ? text.blaster.timedOut
                        : text.blaster.missed}
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
                  {text.blaster.scoreLine(result?.score ?? score, result?.outOf ?? ROUNDS_PER_GAME)}
                </p>
                {result?.newRecord && (
                  <p className="text-lg font-semibold text-primary" data-testid="text-new-record">
                    {text.blaster.newRecord}
                  </p>
                )}
                {result?.xp?.awarded > 0 && (
                  <p className="text-sm text-muted-foreground" data-testid="text-xp">
                    +{result.xp.awarded} XP
                  </p>
                )}
                <p className="text-sm" data-testid="text-plays-after">
                  {text.gamePlays.spent(plays?.left ?? 0)}
                </p>
              </CardContent>
            </Card>

            {errorText && <p className="text-sm text-destructive">{errorText}</p>}

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                disabled={(plays?.left ?? 0) <= 0}
                onClick={() => { setResumed(false); setPhase("ready"); loadStatus(); }}
                data-testid="button-play-again"
              >
                {text.blaster.playAgain}
              </Button>
              <Link href="/student/dashboard">
                <Button variant="secondary" className="w-full" data-testid="button-back-dashboard">
                  {text.blaster.backToDashboard}
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
