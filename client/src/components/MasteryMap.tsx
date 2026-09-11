// The Learner Mastery Map, as a child sees it.
//
// Their own skills, grouped by subject, each one green (got it), amber
// (getting there) or red (keep practising).
//
// Two rules run through the whole thing:
//
//   1. NEVER say "failed". A child reading this is being shown their weakest
//      work, which is a vulnerable thing. Every band names what to do next, and
//      the weakest band is "Keep practising" with "everyone has some of these"
//      beside it — true, and the difference between a nudge and a telling-off.
//   2. Colour is never the only signal. Each band carries its own words and its
//      own icon, so a colour-blind child reads exactly the same information.
//
// Mobile first: one column on a phone, the bands as full-width rows with big
// text, nothing that needs a wide screen to make sense.

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { subjectName, useT } from "@/lib/i18n";
import {
  topicsToPractise,
  type MasteryBand, type MasteryMap as MasteryMapData, type TopicMastery,
} from "@shared/mastery";
import { CheckCircle2, CircleDot, Sparkles, Target, TrendingUp } from "lucide-react";

/**
 * How each band looks. Colour AND an icon AND words — a child who cannot tell
 * green from red still reads the same thing.
 */
const BAND_STYLE: Record<MasteryBand, { dot: string; text: string; bar: string; icon: React.ReactNode }> = {
  mastered: {
    dot: "bg-green-500",
    text: "text-green-700 dark:text-green-400",
    bar: "bg-green-500",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  developing: {
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-500",
    bar: "bg-amber-500",
    icon: <TrendingUp className="h-4 w-4" />,
  },
  practise: {
    dot: "bg-red-500",
    text: "text-red-700 dark:text-red-400",
    bar: "bg-red-500",
    icon: <Target className="h-4 w-4" />,
  },
};

/** One skill: its name, how it is going, and how much it is based on. */
function TopicRow({ topic }: { topic: TopicMastery }) {
  const text = useT();
  const style = BAND_STYLE[topic.band];
  return (
    <div className="py-2" data-testid={`row-topic-${topic.subject}-${topic.topic}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${style.dot}`} aria-hidden />
          <span className="font-medium truncate">{topic.topic}</span>
        </div>
        <div className={`flex items-center gap-1.5 shrink-0 ${style.text}`}>
          {style.icon}
          <span className="text-sm font-semibold tabular-nums">{topic.percent}%</span>
        </div>
      </div>

      {/* The bar repeats the number rather than replacing it — a bar alone is
          hard to read exactly, and the number alone is hard to scan. */}
      <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${style.bar}`}
          style={{ width: `${Math.max(topic.percent, 2)}%` }}
          aria-hidden
        />
      </div>

      <p className="text-xs text-muted-foreground mt-1">
        {text.mastery.bands[topic.band]} · {text.mastery.detail(topic.scored, topic.available, topic.questions)}
      </p>
    </div>
  );
}

export function MasteryMap({ map }: { map: MasteryMapData }) {
  const text = useT();
  // Nothing to show yet. An invitation, never a blank screen and never a zero:
  // a child who has done no homework has not failed anything.
  if (!map.hasEnough) {
    return (
      <Card data-testid="card-mastery-empty">
        <CardContent className="py-8 text-center space-y-2">
          <Sparkles className="h-8 w-8 mx-auto text-primary" />
          <p className="font-medium" data-testid="text-mastery-empty">{text.mastery.empty}</p>
          <p className="text-sm text-muted-foreground">
            {map.untagged > 0 || map.subjects.length > 0
              ? text.mastery.notEnoughYet
              : text.mastery.emptyNote}
          </p>
        </CardContent>
      </Card>
    );
  }

  const practise = topicsToPractise(map);

  return (
    <div className="space-y-4">
      {/* Where they stand, in one line. */}
      <Card>
        <CardContent className="py-4">
          <p className="font-medium" data-testid="text-mastery-summary">
            {text.mastery.summary(map.totals.mastered, map.totals.topics)}
          </p>
          <div className="flex items-center gap-3 flex-wrap mt-2 text-xs">
            {(["mastered", "developing", "practise"] as MasteryBand[]).map((band) => (
              <span key={band} className="flex items-center gap-1.5" data-testid={`legend-${band}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${BAND_STYLE[band].dot}`} aria-hidden />
                <span className="text-muted-foreground">
                  {text.mastery.bands[band]} ({map.totals[band]})
                </span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* What to work on, pulled to the top so it is not buried. Only shown
          when there IS something — an empty "areas to practise" heading reads
          like a missing list rather than good news. */}
      {practise.length > 0 && (
        <Card className="border-primary/40" data-testid="card-practise">
          <CardContent className="py-4">
            <p className="font-semibold flex items-center gap-2 mb-1">
              <Target className="h-4 w-4" />
              {text.mastery.practiseHeading}
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              {text.mastery.bandNotes.practise}
            </p>
            <div className="flex flex-wrap gap-2">
              {practise.map((t) => (
                <Badge
                  key={`${t.subject}-${t.topic}`}
                  variant="outline"
                  data-testid={`badge-practise-${t.topic}`}
                >
                  {t.topic} · {subjectName(text, t.subject)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* The map itself, a subject at a time, strongest first. */}
      {map.subjects.map((s) => (
        <Card key={s.subject} data-testid={`card-subject-${s.subject}`}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="font-semibold">{subjectName(text, s.subject)}</p>
              <div className={`flex items-center gap-1.5 ${BAND_STYLE[s.band].text}`}>
                <CircleDot className="h-4 w-4" />
                <span className="text-sm font-semibold tabular-nums" data-testid={`text-subject-percent-${s.subject}`}>
                  {s.percent}%
                </span>
              </div>
            </div>
            <div className="divide-y">
              {s.topics.map((t) => (
                <TopicRow key={`${t.subject}-${t.topic}`} topic={t} />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
