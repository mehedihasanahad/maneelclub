import type { Metadata } from "next";
import { siteConfig } from "@/lib/constants";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "About Us",
  description: "About Maneel Club – our story, values, and commitment to quality fashion in Bangladesh.",
  alternates: canonical("/about"),
};

export default function AboutPage() {
  return (
    <div className="container max-w-3xl py-12 md:py-16">
      <h1 className="text-3xl font-bold mb-2">About {siteConfig.name}</h1>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm mt-6">
        <p className="text-lg">
          Welcome to {siteConfig.name}, where every thread tells a story.
        </p>
        <p>
          Our journey began in December 2024 with a simple idea: to create a clothing brand that blends timeless style with personal expression. We were tired of fast fashion that felt generic and lacked soul. We wanted to build a brand that wasn&apos;t just about what you wear, but about how you feel when you wear it—confident, comfortable, and effortlessly bold.
        </p>
        <p>
          We started small, renting an office in Dhaka. Late nights were spent analyzing designs, hand-selecting fabrics, making samples &amp; trying to think from a customer point of view. The name &quot;Maneel&quot; itself comes from our shared passion for bringing our unique ideas to life, piece by piece.
        </p>
        <p>
          From the beginning, our focus has been on quality over quantity. We believe in creating garments that last, both in style and durability. We source premium materials, prioritize ethical manufacturing, and pay attention to the smallest details, ensuring that every T-shirt, Polo, Hoodie, and accessory we offer meets our high standards.
        </p>
        <p>
          {siteConfig.name} is more than just a clothing brand; it&apos;s a community. It&apos;s for the dreamers, the doers, and those who aren&apos;t afraid to stand out. It&apos;s for people who appreciate a middle class journey to try big &amp; keep hard working even after failure and believe that fashion is timeless—your wardrobe should reflect your unique journey.
        </p>
        <p>
          Thank you for being a part of ours. We&apos;re excited to see where we go from here, and we hope our clothes inspire you to chase your own adventures.
        </p>
      </div>
    </div>
  );
}
