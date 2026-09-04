// Penalty Shootout — a football quiz for primary classes (Stages 3-6).
//
// How a game goes:
//   * The child picks a subject they are enrolled in.
//   * Striker round — 5 shots. Answer the question, and if you're right you
//     choose a corner and the ball flies into the net. Get it wrong and the
//     keeper saves it, and the right answer is shown for a few seconds.
//   * Keeper round — 5 saves. Same again, the other way round: a right answer
//     makes YOUR keeper dive and save; a wrong one concedes a goal.
//   * Results — score out of 10, your personal best for that subject, and a
//     celebration if you beat it.
//
// Everything is drawn with plain SVG and moved with CSS transforms, so it stays
// smooth on cheap Android phones: no images to download, no animation library,
// and only transform/opacity are animated (those are the two things phones can
// do on the GPU). It also respects "reduce motion" in the phone's settings.
//
// The browser is never told the answers — every shot is marked by the server.

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageErrorBoundary } from "@/components/ErrorBoundary";
import { ArrowLeft, Loader2, Trophy } from "lucide-react";
import { isPrimaryForm } from "@shared/schema";
import {
  ANSWER_REVEAL_MS, CORNERS, MIN_QUESTIONS, SHOTS_PER_ROUND, TOTAL_SHOTS,
  scoreLine, type Corner, type Shot,
} from "@shared/penalty";
import { QueryError } from "@/components/QueryError";
import logoPath from "@assets/logo.webp";

interface SubjectChoice {
  subject: string;
  questionCount: number;
  bestScore: number;
  bestOutOf: number;
  gamesPlayed: number;
}

interface GameResult {
  score: number;
  outOf: number;
  perRound: number;
  strikerScore: number;
  keeperScore: number;
  bestScore: number;
  bestOutOf: number;
  previousBest: number;
  previousOutOf: number;
  newRecord: boolean;
  xp?: { awarded: number; dailyCapped: boolean };
}

// What the pitch is doing right now.
type Phase =
  | "subject"    // choosing a subject
  | "question"   // reading the question, tapping an answer
  | "marking"    // waiting for the server to say if it was right
  | "aiming"     // answered correctly, choosing which corner
  | "shooting"   // the ball (or the keeper) is moving
  | "reveal"     // got it wrong, showing the right answer
  | "results";

const CORNER_LABEL: Record<Corner, string> = {
  left: "◀ Left",
  middle: "▲ Middle",
  right: "Right ▶",
};

// Where the ball ends up for each corner, as a nudge from the penalty spot.
const CORNER_SHIFT: Record<Corner, { x: number; y: number }> = {
  left: { x: -78, y: -96 },
  middle: { x: 0, y: -104 },
  right: { x: 78, y: -96 },
};

function PenaltyShootoutContent() {
  const [, setLocation] = useLocation();
  const { student } = useAuth();

  const [subject, setSubject] = useState<string>("");
  const [shots, setShots] = useState<Shot[]>([]);
  const [shotNo, setShotNo] = useState(0);
  const [phase, setPhase] = useState<Phase>("subject");
  const [starting, setStarting] = useState(false);

  // The answers so far. Kept in a ref, not state: the last shot finishes the
  // game from inside the same function that records it, and a state value read
  // there would still be the one from before that answer — so the final shot
  // never reached the server and every game lost its last mark.
  const answersRef = useRef<{ ref: string; answerText: string; round: string }[]>([]);
  const [lastCorrect, setLastCorrect] = useState(false);
  const [correctAnswerText, setCorrectAnswerText] = useState("");
  const [corner, setCorner] = useState<Corner>("middle");
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
  const [errorText, setErrorText] = useState("");

  // Only primary children can play. Anyone else is sent back to their dashboard.
  useEffect(() => {
    if (!student) { setLocation("/student/login"); return; }
    if (!isPrimaryForm(student.form)) setLocation("/student/dashboard");
  }, [student, setLocation]);

  const { data: subjectData, isLoading: subjectsLoading, isError: subjectsIsError, error: subjectsError, refetch: refetchSubjects } = useQuery<{ success: boolean; subjects: SubjectChoice[] }>({
    queryKey: ["/api/students", student?.id, "penalty", "subjects"],
    enabled: !!student && isPrimaryForm(student?.form ?? ""),
  });

  const subjects = subjectData?.subjects ?? [];
  const shot = shots[shotNo];
  const round = shot?.round ?? "striker";
  const isKeeperRound = round === "keeper";

  // Phones set "reduce motion" for children who find movement uncomfortable.
  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const pause = (ms: number) => new Promise((r) => setTimeout(r, reduceMotion ? Math.min(ms, 400) : ms));

  const startGame = async (chosen: string) => {
    setStarting(true);
    setErrorText("");
    try {
      const res = await apiRequest("POST", `/api/students/${student!.id}/penalty/start`, { subject: chosen });
      const body = await res.json();
      if (!body.success) { setErrorText(body.message || "Couldn't start the game."); return; }
      setSubject(chosen);
      setShots(body.shots);
      setShotNo(0);
      setScore(0);
      answersRef.current = [];
      setResult(null);
      setPhase("question");
    } catch {
      setErrorText("Couldn't start the game. Please check your connection and try again.");
    } finally {
      setStarting(false);
    }
  };

  // The child tapped an answer. The server marks it, then the pitch reacts.
  const answerShot = async (value: string) => {
    if (!shot || phase !== "question") return;
    // "marking", not "shooting": until the server answers we don't know what
    // happened, and the pitch still holds the LAST shot's result. Going
    // straight to "shooting" made the ball leap towards the previous corner
    // (or the keeper dive) the instant a button was tapped — invisible on a
    // fast connection, very visible on a slow phone.
    setPhase("marking");
    let correct = false;
    let correctText = "";
    try {
      const res = await apiRequest("POST", `/api/students/${student!.id}/penalty/answer`, {
        subject, ref: shot.ref, answerText: value,
      });
      const body = await res.json();
      correct = !!body.correct;
      correctText = body.correctAnswerDisplay || "";
    } catch {
      // If the network drops mid-game, treat the shot as missed rather than
      // stalling the child on a frozen pitch.
      correct = false;
    }

    answersRef.current = [...answersRef.current, { ref: shot.ref, answerText: value, round: shot.round }];
    setLastCorrect(correct);
    setCorrectAnswerText(correctText);

    if (correct) {
      setScore((s) => s + 1);
      if (isKeeperRound) {
        // Keeper round: a right answer means your keeper dives and saves.
        setPhase("shooting");
        await pause(1500);
        await nextShot();
      } else {
        // Striker round: you earned the shot — now pick your corner.
        setPhase("aiming");
      }
    } else {
      // Wrong: the keeper saves (striker round) or a goal is conceded
      // (keeper round). Either way, show the right answer for a few seconds.
      setPhase("reveal");
      await pause(ANSWER_REVEAL_MS);
      await nextShot();
    }
  };

  // Striker round only: the corner the child picked, then the ball flies.
  const shoot = async (chosen: Corner) => {
    setCorner(chosen);
    setPhase("shooting");
    await pause(1500);
    await nextShot();
  };

  const nextShot = async () => {
    const next = shotNo + 1;
    if (next < shots.length) {
      setShotNo(next);
      setPhase("question");
      return;
    }
    await finishGame();
  };

  const finishGame = async () => {
    try {
      const res = await apiRequest("POST", `/api/students/${student!.id}/penalty/finish`, {
        subject, answers: answersRef.current,
      });
      const body = await res.json();
      if (body.success) {
        setResult(body);
        // The dashboard shows XP and streaks, so refresh them.
        queryClient.invalidateQueries({ queryKey: ["/api/students", student!.id, "stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/students", student!.id, "penalty", "subjects"] });
      } else {
        setErrorText(body.message || "Couldn't save your game.");
      }
    } catch {
      setErrorText("Couldn't save your game. Please check your connection.");
    }
    setPhase("results");
  };

  const playAgain = () => {
    setPhase("subject");
    setShots([]);
    setShotNo(0);
    setResult(null);
    setSubject("");
  };

  if (!student || !isPrimaryForm(student.form)) return null;

  return (
    <>
      <style>{`
        /* Only transform and opacity are animated — the two things cheap
           phones can move on the GPU without dropping frames. */
        .pk-ball { transition: transform 700ms cubic-bezier(.22,.61,.36,1); will-change: transform; }
        .pk-shadow { transition: opacity 700ms ease-out; }
        /* Putting the ball back on the spot for the next shot must not animate,
           or it slides back out of the net like a kick in reverse. */
        .pk-instant { transition: none; }
        .pk-keeper { transition: transform 500ms cubic-bezier(.22,.61,.36,1); will-change: transform; }
        .pk-net { transform-origin: center; }
        .pk-net-ripple { animation: pk-ripple 700ms ease-out; }
        @keyframes pk-ripple {
          0%   { transform: scale(1, 1); }
          35%  { transform: scale(1.05, 0.9); }
          70%  { transform: scale(0.98, 1.04); }
          100% { transform: scale(1, 1); }
        }
        .pk-cheer { animation: pk-cheer 1200ms ease-out forwards; }
        @keyframes pk-cheer {
          0%   { opacity: 0; transform: translateY(6px) scale(.85); }
          25%  { opacity: 1; transform: translateY(-4px) scale(1.05); }
          100% { opacity: 0; transform: translateY(-26px) scale(1); }
        }
        .pk-crowd span { display: inline-block; animation: pk-bob 900ms ease-in-out infinite; }
        .pk-crowd span:nth-child(2n) { animation-delay: 150ms; }
        .pk-crowd span:nth-child(3n) { animation-delay: 300ms; }
        @keyframes pk-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        .pk-pop { animation: pk-pop 500ms ease-out; }
        @keyframes pk-pop { 0% { transform: scale(.7); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }

        @media (prefers-reduced-motion: reduce) {
          .pk-ball, .pk-keeper, .pk-shadow { transition-duration: 200ms; }
          .pk-net-ripple, .pk-cheer, .pk-crowd span, .pk-pop { animation: none; }
        }
      `}</style>

      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/student/dashboard" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="On Point" className="h-8 w-auto" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {errorText && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm" data-testid="penalty-error">
            {errorText}
          </div>
        )}

        {/* ---------- Choose a subject ---------- */}
        {phase === "subject" && (
          <>
            <div className="text-center mb-6">
              <div className="text-5xl mb-2">⚽</div>
              <h1 className="text-2xl font-bold">Penalty Shootout</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Take {SHOTS_PER_ROUND} penalties, then save {SHOTS_PER_ROUND}. Answer correctly to score!
              </p>
            </div>

            {subjectsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : subjectsIsError ? (
              /* Without this a failed request read as "No games ready yet",
                 which tells the child their teacher has not set enough
                 questions - when really we just could not ask. */
              <QueryError error={subjectsError} what="your games" role="student" onRetry={() => refetchSubjects()} data-testid="penalty-subjects-error" />
            ) : subjects.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">No games ready yet</p>
                  <p>
                    A shootout needs {MIN_QUESTIONS} quiz questions in a subject — that's a different
                    question for each of your {SHOTS_PER_ROUND} penalties and {SHOTS_PER_ROUND} saves.
                  </p>
                  <p className="mt-2">Ask your teacher to set a few more, then come back!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3" data-testid="subject-list">
                <p className="text-sm font-medium">Pick a subject:</p>
                {subjects.map((s) => (
                  <button
                    key={s.subject}
                    onClick={() => startGame(s.subject)}
                    disabled={starting}
                    className="w-full text-left rounded-xl border-2 border-primary/25 bg-primary/5 px-4 py-4 hover:bg-primary/10 active:scale-[0.99] transition-transform disabled:opacity-60"
                    data-testid={`subject-${s.subject}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-lg">{s.subject}</div>
                        <div className="text-xs text-muted-foreground">
                          {SHOTS_PER_ROUND} penalties + {SHOTS_PER_ROUND} saves
                          {s.questionCount > 0 && ` · ${s.questionCount} question${s.questionCount === 1 ? "" : "s"}`}
                          {s.gamesPlayed > 0 && ` · played ${s.gamesPlayed} time${s.gamesPlayed === 1 ? "" : "s"}`}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {s.bestOutOf > 0 ? (
                          <>
                            <div className="text-xl font-bold tabular-nums">{s.bestScore}/{s.bestOutOf}</div>
                            <div className="text-[10px] text-muted-foreground">your best</div>
                          </>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">New!</Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ---------- Playing ---------- */}
        {(phase === "question" || phase === "marking" || phase === "aiming" || phase === "shooting" || phase === "reveal") && shot && (
          <>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-semibold">
                  {isKeeperRound ? "🧤 Keeper Round" : "⚽ Striker Round"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {isKeeperRound ? "Save" : "Shot"} {shot.index + 1} of {SHOTS_PER_ROUND} · {subject}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums" data-testid="live-score">{score}</div>
                <div className="text-[10px] text-muted-foreground">scored</div>
              </div>
            </div>

            <Pitch
              phase={phase}
              round={round}
              corner={corner}
              correct={lastCorrect}
              reduceMotion={reduceMotion}
            />

            {/* Question + answer buttons */}
            {phase === "question" && (
              <Card className="mt-4">
                <CardContent className="pt-5">
                  <p className="text-base font-medium mb-4" data-testid="question-text">{shot.questionText}</p>
                  <div className="grid gap-2.5">
                    {shot.options.map((opt, i) => (
                      <button
                        key={`${opt.value}-${i}`}
                        onClick={() => answerShot(opt.value)}
                        className="w-full rounded-xl border-2 px-4 py-4 text-base font-medium hover:bg-primary/10 hover:border-primary/50 active:scale-[0.98] transition-transform"
                        data-testid={`answer-${i}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Correct — now choose a corner (striker round only) */}
            {phase === "aiming" && (
              <Card className="mt-4 border-green-500/40">
                <CardContent className="pt-5">
                  <p className="text-base font-semibold text-green-700 dark:text-green-400 mb-1">Correct! ⚽</p>
                  <p className="text-sm text-muted-foreground mb-4">Now pick your corner:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {CORNERS.map((c) => (
                      <button
                        key={c}
                        onClick={() => shoot(c)}
                        className="rounded-xl border-2 border-primary/40 bg-primary/5 px-2 py-5 text-sm font-semibold hover:bg-primary/15 active:scale-[0.97] transition-transform"
                        data-testid={`corner-${c}`}
                      >
                        {CORNER_LABEL[c]}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Wrong — show the right answer for a few seconds */}
            {phase === "reveal" && (
              <Card className="mt-4 border-amber-500/50" data-testid="answer-reveal">
                <CardContent className="pt-5 text-center">
                  <p className="text-base font-semibold text-amber-700 dark:text-amber-400">
                    {isKeeperRound ? "Goal conceded!" : "Saved!"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">The correct answer was</p>
                  <p className="text-xl font-bold mt-1">{correctAnswerText || "—"}</p>
                </CardContent>
              </Card>
            )}

            {phase === "marking" && (
              <p className="mt-4 text-center text-sm text-muted-foreground" data-testid="marking">…</p>
            )}

            {phase === "shooting" && (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                {lastCorrect
                  ? (isKeeperRound ? "Great save! 🧤" : "What a strike! ⚽")
                  : "…"}
              </p>
            )}
          </>
        )}

        {/* ---------- Results ---------- */}
        {phase === "results" && (
          <div className="text-center py-4" data-testid="results">
            {result?.newRecord && (
              <div className="pk-pop mb-4 rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/40 px-4 py-3" data-testid="new-record">
                <div className="text-3xl mb-1">🏆</div>
                <p className="font-bold text-amber-800 dark:text-amber-200">New personal best!</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {result.previousOutOf > 0
                    ? `You beat your old record of ${result.previousBest}/${result.previousOutOf} in ${subject}.`
                    : `Your first record in ${subject} — now try to beat it!`}
                </p>
              </div>
            )}

            <div className="text-6xl font-bold tabular-nums" data-testid="final-score">
              {result?.score ?? score}<span className="text-2xl text-muted-foreground">/{result?.outOf ?? TOTAL_SHOTS}</span>
            </div>
            <p className="text-lg font-medium mt-2">
              {scoreLine(result?.score ?? score, result?.outOf ?? TOTAL_SHOTS)}
            </p>

            <div className="pk-crowd text-2xl mt-3" aria-hidden="true">
              <span>🎉</span><span>👏</span><span>🎊</span><span>👏</span><span>🎉</span>
            </div>

            <Card className="mt-5 text-left">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">How you did</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="⚽ Penalties scored" value={`${result?.strikerScore ?? 0} / ${SHOTS_PER_ROUND}`} />
                <Row label="🧤 Saves made" value={`${result?.keeperScore ?? 0} / ${SHOTS_PER_ROUND}`} />
                <Row
                  label={<span className="flex items-center gap-1"><Trophy className="h-3.5 w-3.5" /> Your best in {subject}</span>}
                  value={`${result?.bestScore ?? 0} / ${result?.bestOutOf || TOTAL_SHOTS}`}
                />
                {result?.xp && result.xp.awarded > 0 && (
                  <Row label="⭐ XP earned" value={`+${result.xp.awarded}${result.xp.dailyCapped ? " (daily cap reached)" : ""}`} />
                )}
              </CardContent>
            </Card>

            <div className="flex gap-2 mt-5">
              <Button className="flex-1" onClick={playAgain} data-testid="button-play-again">Play again</Button>
              <Button variant="outline" className="flex-1" onClick={() => setLocation("/student/dashboard")} data-testid="button-done">
                Done
              </Button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

// The pitch, goal, keeper and ball — all flat SVG shapes, no images.
function Pitch({
  phase, round, corner, correct, reduceMotion,
}: {
  phase: Phase; round: string; corner: Corner; correct: boolean; reduceMotion: boolean;
}) {
  const isKeeperRound = round === "keeper";
  const moving = phase === "shooting";
  const scored = moving && correct && !isKeeperRound;
  const saved = (phase === "reveal" || phase === "shooting") && !correct && !isKeeperRound;
  const keeperSaved = moving && correct && isKeeperRound;
  const conceded = phase === "reveal" && !correct && isKeeperRound;

  // Where the ball sits. In the keeper round the striker shoots at YOU, so the
  // ball always travels; whether it gets past depends on the answer.
  const ballShift =
    scored ? CORNER_SHIFT[corner]
    : saved ? { x: -30, y: -70 }
    : keeperSaved ? { x: -60, y: -74 }
    : conceded ? { x: 74, y: -96 }
    : { x: 0, y: 0 };

  // True while the ball is back on the penalty spot. Between shots we put it
  // back WITHOUT animating: sliding it back out of the net while the child is
  // reading the next question looked like a second, backwards kick.
  const atRest = ballShift.x === 0 && ballShift.y === 0;

  // The keeper dives towards the ball when saving, and the wrong way when beaten.
  const keeperShift =
    scored ? (corner === "left" ? 42 : corner === "right" ? -42 : 34)
    : saved ? -26
    : keeperSaved ? -52
    : conceded ? 46
    : 0;

  const netRipples = scored || conceded;

  return (
    <div className="relative rounded-xl overflow-hidden border bg-[#2e7d32]">
      <svg viewBox="0 0 320 200" className="w-full block" role="img" aria-label="Football pitch with a goal">
        {/* Grass, with simple mown stripes. */}
        <rect x="0" y="0" width="320" height="200" fill="#2e7d32" />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={i * 64} y="0" width="32" height="200" fill="#317a35" opacity="0.5" />
        ))}

        {/* Crowd behind the goal — a flat band of dots. */}
        <rect x="0" y="0" width="320" height="26" fill="#1b3b1d" />
        {Array.from({ length: 40 }).map((_, i) => (
          <circle key={i} cx={4 + i * 8} cy={i % 2 ? 10 : 16} r="3.2" fill={["#f4c542", "#e0e0e0", "#4a90d9", "#e07a5f"][i % 4]} opacity="0.85" />
        ))}

        {/* Goal: posts, crossbar and net. */}
        <g className={netRipples && !reduceMotion ? "pk-net pk-net-ripple" : "pk-net"}>
          <rect x="76" y="34" width="168" height="70" fill="#ffffff" opacity="0.10" />
          {Array.from({ length: 11 }).map((_, i) => (
            <line key={`v${i}`} x1={78 + i * 16.8} y1="34" x2={78 + i * 16.8} y2="104" stroke="#ffffff" strokeWidth="1" opacity="0.45" />
          ))}
          {Array.from({ length: 5 }).map((_, i) => (
            <line key={`h${i}`} x1="76" y1={38 + i * 16} x2="244" y2={38 + i * 16} stroke="#ffffff" strokeWidth="1" opacity="0.45" />
          ))}
          <rect x="72" y="30" width="6" height="78" rx="2" fill="#ffffff" />
          <rect x="242" y="30" width="6" height="78" rx="2" fill="#ffffff" />
          <rect x="72" y="30" width="176" height="6" rx="2" fill="#ffffff" />
        </g>

        {/* Penalty box and spot. */}
        <rect x="52" y="30" width="216" height="110" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.65" />
        <circle cx="160" cy="150" r="3" fill="#ffffff" opacity="0.9" />

        {/* Goalkeeper — flat shapes, slides sideways when diving. */}
        <g
          className="pk-keeper"
          style={{ transform: `translateX(${reduceMotion ? keeperShift * 0.4 : keeperShift}px)` }}
        >
          <circle cx="160" cy="58" r="9" fill="#ffd7a8" />
          <rect x="150" y="68" width="20" height="26" rx="5" fill="#f4c542" />
          {/* Arms go up when diving. */}
          <rect x="132" y="66" width="18" height="6" rx="3" fill="#f4c542" transform={keeperShift !== 0 ? "rotate(-28 141 69)" : undefined} />
          <rect x="170" y="66" width="18" height="6" rx="3" fill="#f4c542" transform={keeperShift !== 0 ? "rotate(28 179 69)" : undefined} />
          <rect x="152" y="94" width="6" height="16" rx="3" fill="#2f3640" />
          <rect x="162" y="94" width="6" height="16" rx="3" fill="#2f3640" />
        </g>

        {/* The ball's shadow stays on the grass. It used to sit inside the ball
            group, so it flew up into the net along with the ball — which is why
            the kick looked wrong. Now it just fades as the ball leaves. */}
        <ellipse
          className={`pk-shadow${atRest ? " pk-instant" : ""}`}
          cx="160" cy="156" rx="7" ry="2.5" fill="#000000"
          style={{ opacity: atRest ? 0.25 : 0 }}
        />

        {/* The ball. It shrinks a little as it travels, which is what makes it
            read as flying towards the goal rather than sliding along the grass. */}
        <g
          className={`pk-ball${atRest ? " pk-instant" : ""}`}
          style={{
            transform:
              `translate(${reduceMotion ? ballShift.x * 0.5 : ballShift.x}px, ${reduceMotion ? ballShift.y * 0.5 : ballShift.y}px)` +
              ` scale(${atRest ? 1 : 0.72})`,
            transformOrigin: "160px 150px",
          }}
        >
          <circle cx="160" cy="150" r="7" fill="#ffffff" stroke="#2f3640" strokeWidth="1" />
          <circle cx="160" cy="150" r="2.4" fill="#2f3640" />
        </g>

        {/* The striker, only in the round where the child is shooting. */}
        {!isKeeperRound && (
          <g>
            <circle cx="160" cy="176" r="8" fill="#ffd7a8" />
            <rect x="151" y="185" width="18" height="14" rx="4" fill="#1F3864" />
          </g>
        )}
      </svg>

      {/* A quick shout over the pitch when something happens. */}
      {(scored || keeperSaved) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="pk-cheer text-3xl font-extrabold text-white drop-shadow-lg" data-testid="cheer">
            {scored ? "GOAL! 🎉" : "SAVED! 🧤"}
          </span>
        </div>
      )}
      {(saved || conceded) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-extrabold text-white/90 drop-shadow-lg" data-testid="miss">
            {saved ? "SAVED!" : "GOAL AGAINST"}
          </span>
        </div>
      )}
    </div>
  );
}

export default function PenaltyShootout() {
  return (
    <div className="min-h-screen bg-background">
      <PageErrorBoundary backHref="/student/dashboard" backLabel="Back to Dashboard" label="penalty-shootout">
        <PenaltyShootoutContent />
      </PageErrorBoundary>
    </div>
  );
}
