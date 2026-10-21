"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Google truncates around these lengths; shown as guidance, not enforced. */
const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

/**
 * Search engine optimisation fields, shared by the product and category forms.
 *
 * Field names are passed in as typed paths so this stays type-safe against each
 * form's own schema without casting. Every field is optional - left blank, the
 * storefront falls back to the automatic value shown as the placeholder.
 */
export function SeoFields<T extends FieldValues>({
  control,
  names,
  autoTitle,
  autoDescription,
  canonicalExample,
}: {
  control: Control<T>;
  names: {
    metaTitle: FieldPath<T>;
    metaDescription: FieldPath<T>;
    canonicalUrl: FieldPath<T>;
  };
  /** What the storefront uses when Meta Title is blank. */
  autoTitle: string;
  /** What the storefront uses when Meta Description is blank. */
  autoDescription: string;
  canonicalExample: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>SEO</CardTitle>
        <CardDescription>
          Controls how this page appears on Google and in AI answers. Leave a
          field empty to use the automatic value.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={control}
          name={names.metaTitle}
          render={({ field }) => {
            const length = String(field.value ?? "").length;
            return (
              <FormItem>
                <FormLabel>Meta Title</FormLabel>
                <FormControl>
                  <Input
                    placeholder={autoTitle}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormDescription>
                  {length === 0
                    ? `Automatic: "${autoTitle}"`
                    : `${length} / ${TITLE_LIMIT} characters${
                        length > TITLE_LIMIT ? " - Google may truncate this" : ""
                      }`}
                </FormDescription>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <FormField
          control={control}
          name={names.metaDescription}
          render={({ field }) => {
            const length = String(field.value ?? "").length;
            return (
              <FormItem>
                <FormLabel>Meta Description</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder={autoDescription}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormDescription>
                  {length === 0
                    ? "Automatic: the description above."
                    : `${length} / ${DESCRIPTION_LIMIT} characters${
                        length > DESCRIPTION_LIMIT
                          ? " - Google may truncate this"
                          : ""
                      }`}
                </FormDescription>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <FormField
          control={control}
          name={names.canonicalUrl}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Canonical URL</FormLabel>
              <FormControl>
                <Input
                  placeholder={canonicalExample}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormDescription>
                Leave empty unless this page duplicates another one. A wrong
                value here can remove the page from Google.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
