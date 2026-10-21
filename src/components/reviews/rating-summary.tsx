import { Star } from "lucide-react";

/**
 * Visible star average for a product.
 *
 * Google requires that any AggregateRating in structured data corresponds to a
 * rating shown on the page, so this component and the product's JSON-LD are
 * driven by the same `aggregateRating()` result and must stay in step.
 */
export function RatingSummary({
  ratingValue,
  reviewCount,
}: {
  ratingValue: number;
  reviewCount: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            // Floor, never round up: 4.5 shows four filled stars, so the icons
            // can never overstate the score. The exact value is in the text.
            className={
              n <= Math.floor(ratingValue)
                ? "h-4 w-4 fill-yellow-400 text-yellow-400"
                : "h-4 w-4 text-muted-foreground/40"
            }
          />
        ))}
      </div>
      <span className="text-sm text-muted-foreground">
        {ratingValue.toFixed(1)} out of 5 from {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
      </span>
    </div>
  );
}
