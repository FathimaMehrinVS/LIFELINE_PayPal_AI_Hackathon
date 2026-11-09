import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createSessionResolver, type SessionResolverDependencies } from "../../apps/api/src/auth/session";
import { errorHandler } from "../../apps/api/src/middleware/error-handler";
import { createAuthRouter } from "../../apps/api/src/routes/auth.routes";
import { HttpError } from "../../apps/api/src/utils/http-error";

function setup(profile: { id: string; email: string | null; role: string | null } | null = {
  id: "profile-1", email: "ngo@example.test", role: "NGO",
}) {
  const dependencies: SessionResolverDependencies = {
    getSupabaseIdentity: vi.fn().mockResolvedValue({ id: "supabase-user-1", email: "ngo@example.test", name: "NGO User" }),
    findProfile: vi.fn().mockResolvedValue(profile),
  };
  const app = express();
  app.use("/api/auth", createAuthRouter(createSessionResolver(dependencies)));
  app.use(errorHandler);
  return { app, dependencies };
}

describe("Supabase-backed auth session", () => {
  it.each(["NGO", "DONOR", "PARTNER"] as const)("resolves an authenticated user with the %s role", async (role) => {
    const { app, dependencies } = setup({ id: "profile-1", email: "user@example.test", role });
    const response = await request(app).get("/api/auth/me").set("Authorization", "Bearer test-access-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: "profile-1", email: "ngo@example.test", role });
    expect(dependencies.getSupabaseIdentity).toHaveBeenCalledWith("test-access-token");
    expect(dependencies.findProfile).toHaveBeenCalledWith("supabase-user-1");
    expect(response.text).not.toContain("test-access-token");
  });

  it("rejects missing authentication before looking up an application profile", async () => {
    const { app, dependencies } = setup();
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    expect(dependencies.getSupabaseIdentity).not.toHaveBeenCalled();
    expect(dependencies.findProfile).not.toHaveBeenCalled();
  });

  it("does not look up a profile when Supabase rejects the access token", async () => {
    const { app, dependencies } = setup();
    (dependencies.getSupabaseIdentity as ReturnType<typeof vi.fn>).mockRejectedValue(new HttpError("AUTHENTICATION_REQUIRED", "Supabase access token is invalid or expired"));
    const response = await request(app).get("/api/auth/me").set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
    expect(dependencies.findProfile).not.toHaveBeenCalled();
  });

  it.each([null, "RECIPIENT", "MERCHANT", "UNKNOWN"])("rejects a missing or unsupported application role (%s)", async (role) => {
    const { app } = setup({ id: "profile-1", email: "user@example.test", role });
    const response = await request(app).get("/api/auth/me").set("Authorization", "Bearer test-access-token");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    if (role === null) expect(response.body.error.message).toContain("pending assignment");
  });

  it("rejects an authenticated Supabase user without a linked LIFELINE profile", async () => {
    const { app } = setup(null);
    const response = await request(app).get("/api/auth/me").set("Authorization", "Bearer test-access-token");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });
});
