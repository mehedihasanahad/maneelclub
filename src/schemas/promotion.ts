import { z } from "zod";

const optionalDate = z
  .string()
  .optional()
  .nullable()
  .transform((s) => (s && s.trim() ? new Date(s) : null))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), { message: "Invalid date" });

export const promotionSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(60, "Name is too long"),
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.coerce.number().min(0, "Value cannot be negative"),
    minOrderAmount: z.coerce.number().min(0, "Minimum order cannot be negative"),
    maxDiscount: z.coerce.number().positive("Maximum discount must be positive").optional().nullable(),
    freeShipping: z.boolean().default(false),
    isActive: z.boolean().default(true),
    startsAt: optionalDate,
    endsAt: optionalDate,
    // Empty = every payment method. e.g. ["BKASH","NAGAD","ROCKET"] = not Cash on Delivery.
    allowedPaymentMethods: z
      .array(z.enum(["COD", "BKASH", "NAGAD", "ROCKET"]))
      .default([])
      .transform((methods) => [...new Set(methods)]),
  })
  .refine((d) => d.type !== "PERCENT" || d.value <= 100, {
    message: "Percentage must be between 0 and 100",
    path: ["value"],
  })
  .refine((d) => d.value > 0 || d.freeShipping, {
    message: "Give some money off, free delivery, or both",
    path: ["value"],
  })
  .refine((d) => !d.startsAt || !d.endsAt || d.startsAt < d.endsAt, {
    message: "The end must be after the start",
    path: ["endsAt"],
  });

export type PromotionInput = z.input<typeof promotionSchema>;
