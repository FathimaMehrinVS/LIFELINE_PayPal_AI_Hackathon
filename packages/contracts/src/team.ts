import { z } from "zod";

/** /api/team — owner: Member 1. NGO staff manage who can use LIFELINE and with which role. */
export const TeamRoleSchema = z.enum(["NGO", "DONOR", "PARTNER"]);
export type TeamRole = z.infer<typeof TeamRoleSchema>;

export const TeamMemberSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  /** Null for older accounts created before new accounts became donors. */
  role: TeamRoleSchema.nullable(),
  created_at: z.string(),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

export const UpdateTeamRoleRequestSchema = z.object({ role: TeamRoleSchema });
export type UpdateTeamRoleRequest = z.infer<typeof UpdateTeamRoleRequestSchema>;
