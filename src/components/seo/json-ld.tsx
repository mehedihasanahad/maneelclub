/**
 * Renders a schema.org graph as an application/ld+json script tag.
 *
 * `<` is escaped so a product title or description containing "</script>" can
 * never break out of the tag.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const json = JSON.stringify(data).replace(/</g, "\u003c");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
