import { z } from "zod";

// Database status values
export const PresenceStatus = z.enum([
  "IN_OFFICE",
  "REMOTE",
  "AVAILABLE",
  "VACATION",
  "SICK",
  "AFTER_HOURS"
]);

export const UpdatePresenceSchema = z.object({
  status: PresenceStatus,
  officeLocation: z.string().min(1, "Office location is required").optional().nullable(),
  notes: z.string().max(500).optional().nullable().default(""),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional().nullable()
}).refine(
  (data) => !data.endDate || new Date(data.endDate) > new Date(data.startDate),
  { path: ["endDate"], message: "End date must be after start date" }
).refine(
  (data) => {
    if (data.status === "IN_OFFICE" || data.status === "AVAILABLE") {
      return !!data.officeLocation;
    }
    return true;
  },
  { path: ["officeLocation"], message: "Office location is required for IN_OFFICE or AVAILABLE status" }
);
