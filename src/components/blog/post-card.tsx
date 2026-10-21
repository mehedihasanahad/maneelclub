import Link from "next/link";
import Image from "next/image";
import { CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { BlogPost } from "@/lib/blog";
import { markdownToPlainText } from "@/lib/markdown";

/** Long date in en-GB so it reads the same on the server and the client. */
export function formatPostDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function PostCard({ post }: { post: BlogPost }) {
  const summary = post.excerpt || markdownToPlainText(post.content, 140);

  return (
    <Card className="overflow-hidden pt-0 transition-shadow hover:shadow-md">
      <Link href={`/blog/${post.slug}`} className="block">
        <div className="relative aspect-[16/9] bg-muted">
          {post.coverImage ? (
            <Image
              src={post.coverImage}
              alt=""
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {post.title}
            </div>
          )}
        </div>
      </Link>
      <CardContent className="space-y-2">
        {post.publishedAt && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            <time dateTime={post.publishedAt.toISOString()}>
              {formatPostDate(post.publishedAt)}
            </time>
          </p>
        )}
        <h2 className="font-semibold leading-snug">
          <Link href={`/blog/${post.slug}`} className="hover:text-primary">
            {post.title}
          </Link>
        </h2>
        {summary && (
          <p className="line-clamp-3 text-sm text-muted-foreground">{summary}</p>
        )}
      </CardContent>
    </Card>
  );
}
