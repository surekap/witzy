import Link from "next/link";

import { Surface, primaryButtonClass, secondaryButtonClass } from "@/components/ui";

const pathways = [
  {
    title: "Host a game",
    description: "Spin up a room, pick the round settings, and control the live reveal.",
    href: "/host",
  },
  {
    title: "Join a game",
    description: "Enter a room code, choose an age band, and get your personalized challenge.",
    href: "/join",
  },
  {
    title: "Solo practice",
    description: "Test the question engine with a 10-question practice run.",
    href: "/solo",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-6">
      <Surface className="overflow-hidden p-0">
        <div className="grid gap-8 p-6 md:grid-cols-[1.3fr_0.8fr] md:p-10">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.32em] text-cyan-200/80">Kids Quiz Live</p>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-5xl font-black tracking-tight text-white sm:text-6xl">
                Shared categories, private difficulty, big family energy.
              </h1>
              <p className="max-w-2xl text-lg text-slate-300">
                Kids answer simultaneously on their own devices while the host runs a lively, synchronized quiz room.
                Everyone gets the same category, but the challenge is tuned to their level.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className={primaryButtonClass} href="/host">
                Host a game
              </Link>
              <Link className={secondaryButtonClass} href="/join">
                Join a room
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            {[
              ["Live rooms", "Hosts control pacing with lobby sync, countdowns, reveals, and rematches."],
              ["Equal challenge", "Age bands and adaptive difficulty keep every round fair without using the same question for everyone."],
              ["Media ready", "Text, image, and audio questions all work inside the same round loop."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-cyan-200/80">{title}</p>
                <p className="mt-2 text-sm text-slate-300">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </Surface>

      <div className="grid gap-6 md:grid-cols-3">
        {pathways.map((pathway) => (
          <Surface key={pathway.title} className="flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.2em] text-cyan-200/80">{pathway.title}</p>
              <h2 className="text-2xl font-black text-white">{pathway.title}</h2>
              <p className="text-sm text-slate-300">{pathway.description}</p>
            </div>
            <Link className={secondaryButtonClass} href={pathway.href}>
              Open
            </Link>
          </Surface>
        ))}
      </div>
    </div>
  );
}
