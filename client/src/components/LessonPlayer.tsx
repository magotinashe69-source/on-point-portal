// The player for one lesson, shared by the teacher and student lesson lists so
// both always play a lesson the same way.
//
// Three cases: a YouTube link goes through YouTube's embedded player, an audio
// lesson gets an audio bar, and anything else gets a video player.

import { youtubeEmbedUrl } from "@/lib/lesson-media";

interface LessonPlayerProps {
  lessonId: number | string;
  title: string;
  fileUrl: string;
  type: string; // "VIDEO" | "AUDIO"
}

export function LessonPlayer({ lessonId, title, fileUrl, type }: LessonPlayerProps) {
  const embedUrl = youtubeEmbedUrl(fileUrl);

  if (embedUrl) {
    return (
      // The 16:9 box keeps the video the right shape on a phone as well as a
      // laptop, since the iframe itself has no idea how wide it should be.
      <div className="relative w-full overflow-hidden rounded-md" style={{ paddingTop: "56.25%" }}>
        <iframe
          className="absolute inset-0 h-full w-full"
          src={embedUrl}
          title={title}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          data-testid={`youtube-player-${lessonId}`}
        />
      </div>
    );
  }

  if (type === "AUDIO") {
    return (
      <audio controls className="w-full" preload="metadata" data-testid={`audio-player-${lessonId}`}>
        <source src={fileUrl} />
        Your browser does not support the audio element.
      </audio>
    );
  }

  return (
    <video controls className="w-full rounded-md" preload="metadata" data-testid={`video-player-${lessonId}`}>
      <source src={fileUrl} />
      Your browser does not support the video element.
    </video>
  );
}
