import type { Metadata } from "next";
import Image from "next/image";
import { connection } from "next/server";
import { Suspense } from "react";
import { BuyUnitsButton, OpenBuyUnitsOnMount } from "@/components/billing/buy-units";
import { ExternalLinkIcon, LockIcon, PlayIcon, SearchIcon } from "@/components/icons";
import { getAccountSummary } from "@/lib/account";
import { canAccessLearn, formatNaira, UNIT_PACK } from "@/lib/billing";
import { LEARNING_TOPICS } from "@/lib/learning-videos";
import { getLearningCards, type LearningCard } from "@/lib/youtube";

export const metadata: Metadata = {
  title: "Learn essay writing",
  description:
    "Video lessons on WAEC and NECO essay writing: letters, argumentative essays, speeches, grammar and more.",
};

function VideoCard({ card, topicLabel }: { card: LearningCard; topicLabel: string }) {
  const isVideo = card.kind === "video";
  const action = isVideo ? "Watch on YouTube" : "Search on YouTube";

  return (
    <li>
      <a
        className="video-card"
        href={card.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${card.title}. ${action} (opens in a new tab)`}
      >
        <div className={`video-thumb${isVideo ? "" : ` placeholder topic-${card.topic}`}`}>
          {card.thumbnailUrl ? (
            <Image
              src={card.thumbnailUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
            />
          ) : (
            <span className="video-thumb-title" aria-hidden="true">
              <small>Lesson</small>
              {topicLabel}
            </span>
          )}
          <span className="video-thumb-badge" aria-hidden="true">
            {isVideo ? <PlayIcon size={22} /> : <SearchIcon size={20} />}
          </span>
        </div>
        <div className="video-body">
          <h3 className="video-title">{card.title}</h3>
          {card.description && <p className="video-description">{card.description}</p>}
          <p className="video-meta">
            <span>{card.channel ?? (isVideo ? "YouTube" : "YouTube search")}</span>
            <span className="video-action">
              {action}
              <ExternalLinkIcon size={13} />
            </span>
          </p>
        </div>
      </a>
    </li>
  );
}

/** The lessons themselves; only rendered for students who have access. */
async function LearnLessons() {
  const cards = await getLearningCards();
  const topics = LEARNING_TOPICS.map((topic) => ({
    ...topic,
    cards: cards.filter((card) => card.topic === topic.id),
  })).filter((topic) => topic.cards.length > 0);

  return (
    <>
      <nav className="topic-nav" aria-label="Lesson topics">
        {topics.map((topic) => (
          <a key={topic.id} className="topic-chip" href={`#${topic.id}`}>
            {topic.label}
            <span className="topic-chip-count">{topic.cards.length}</span>
          </a>
        ))}
      </nav>

      <div className="topic-sections">
        {topics.map((topic) => (
          <section
            key={topic.id}
            id={topic.id}
            className="topic-section"
            aria-labelledby={`${topic.id}-title`}
          >
            <div className="topic-heading">
              <h2 id={`${topic.id}-title`}>{topic.label}</h2>
              <p>{topic.description}</p>
            </div>
            <ul className="video-grid">
              {topic.cards.map((card) => (
                <VideoCard key={card.key} card={card} topicLabel={topic.label} />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="learn-disclaimer">
        Videos are made by independent creators on YouTube. EssayMarker is not
        affiliated with them, WAEC or NECO.
      </p>
    </>
  );
}

const LOCKED_REASON =
  "Learn is available while you have units or a paid account. Buy units to unlock the video lessons.";

/** Checks access at request time; the lessons are never sent to locked accounts. */
async function GatedLearn() {
  await connection();
  const account = await getAccountSummary();

  if (!account || !canAccessLearn(account)) {
    return (
      <div className="card locked-card">
        <OpenBuyUnitsOnMount reason={LOCKED_REASON} />
        <span className="locked-icon" aria-hidden="true">
          <LockIcon size={22} />
        </span>
        <h2>Learn is locked</h2>
        <p>
          You’ve used your free units. Buy {UNIT_PACK.units} units for{" "}
          {formatNaira(UNIT_PACK.priceNaira)} to unlock the lessons and keep
          getting your essays marked.
        </p>
        <BuyUnitsButton className="button button-primary" reason={LOCKED_REASON}>
          Buy units to unlock
        </BuyUnitsButton>
      </div>
    );
  }

  return <LearnLessons />;
}

function LearnSkeleton() {
  return (
    <div className="video-grid" aria-hidden="true" style={{ marginTop: 16 }}>
      {[0, 1, 2].map((key) => (
        <div className="card skeleton" key={key} style={{ height: 260 }} />
      ))}
    </div>
  );
}

export default function LearnPage() {
  return (
    <main className="container">
      <div className="page-heading">
        <h1>Learn essay writing</h1>
        <p>
          Short video lessons for every part of the WAEC and NECO essay paper.
          Pick a topic, then watch on YouTube.
        </p>
      </div>

      <Suspense fallback={<LearnSkeleton />}>
        <GatedLearn />
      </Suspense>
    </main>
  );
}
