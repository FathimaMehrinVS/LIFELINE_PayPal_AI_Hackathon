import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createPendingProfileProvisioner, type ProfileProvisionDependencies } from "../../apps/api/src/auth/profile.service";
import type { SupabaseIdentity } from "../../apps/api/src/auth/session";
import { errorHandler } from "../../apps/api/src/middleware/error-handler";
import { createAuthRouter } from "../../apps/api/src/routes/auth.routes";

const identity: SupabaseIdentity = { id: "supabase-auth-user-id", email: "new.user@example.test", name: "New User" };

function memoryProfiles(): ProfileProvisionDependencies & { create: ReturnType<typeof vi.fn>; findByAuthUserId: ReturnType<typeof vi.fn> } {
  let profile: { id: string; email: string; role: string | null } | null = null;
  return {
    findByAuthUserId: vi.fn(async (authUserId: string) => authUserId === identity.id ? profile : null),
    create: vi.fn(async (input) => {
      profile = { id: "lifeline-profile-id", email: input.email, role: input.role };
      return profile;
    }),
  };
}

describe("pending LIFELINE profile provisioning", () => {
  it("creates a donor profile from verified Supabase identity fields only", async () => {
    const profiles = memoryProfiles();
    const provision = createPendingProfileProvisioner(profiles);
    const result = await provision(identity);

    expect(result).toEqual({ id: "lifeline-profile-id", email: identity.email, role: "DONOR" });
    expect(profiles.create).toHaveBeenCalledWith({
      authUserId: identity.id,
      email: identity.email,
      name: identity.name,
      role: "DONOR",
    });
  });

  it("is idempotent for repeat provisioning of the same Supabase user", async () => {
    const profiles = memoryProfiles();
    const provision = createPendingProfileProvisioner(profiles);

    const first = await provision(identity);
    const second = await provision(identity);

    expect(second).toEqual(first);
    expect(profiles.create).toHaveBeenCalledOnce();
  });

  it("does not change an already assigned role during self-provisioning", async () => {
    const dependencies: ProfileProvisionDependencies = {
      findByAuthUserId: vi.fn().mockResolvedValue({ id: "existing", email: identity.email!, role: "DONOR" }),
      create: vi.fn(),
    };
    const result = await createPendingProfileProvisioner(dependencies)(identity);

    expect(result.role).toBe("DONOR");
    expect(dependencies.create).not.toHaveBeenCalled();
  });

  it("converges concurrent duplicate creation on the unique authUserId profile", async () => {
    let finds = 0;
    const dependencies: ProfileProvisionDependencies = {
      findByAuthUserId: vi.fn(async () => {
        finds += 1;
        return finds < 2 ? null : { id: "linked", email: identity.email!, role: null };
      }),
      create: vi.fn().mockRejectedValue({ code: "P2002" }),
    };
    const provision = createPendingProfileProvisioner(dependencies);

    await expect(provision(identity)).resolves.toEqual({ id: "linked", email: identity.email, role: null });
    expect(dependencies.create).toHaveBeenCalledOnce();
  });

  it("ignores browser role/email fields and cannot self-assign a privileged role", async () => {
    const profiles = memoryProfiles();
    const app = express();
    app.use(express.json());
    app.use("/api/auth", createAuthRouter(
      async () => ({ id: "unused", email: identity.email!, role: "NGO" }),
      async () => identity,
      createPendingProfileProvisioner(profiles),
    ));
    app.use(errorHandler);

    const response = await request(app)
      .post("/api/auth/profile")
      .set("Authorization", "Bearer verified-session-token")
      .send({ email: "attacker@example.test", role: "NGO", authUserId: "another-user" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: "lifeline-profile-id", email: identity.email, role: "DONOR" });
    expect(profiles.create).toHaveBeenCalledWith(expect.objectContaining({
      authUserId: identity.id,
      email: identity.email,
      role: "DONOR",
    }));
  });

  it("does not let a browser request change an already assigned profile role", async () => {
    const existing = { id: "existing-profile", email: identity.email!, role: "NGO" };
    const provision = createPendingProfileProvisioner({
      findByAuthUserId: vi.fn().mockResolvedValue(existing),
      create: vi.fn(),
    });
    const app = express();
    app.use(express.json());
    app.use("/api/auth", createAuthRouter(
      async () => ({ id: existing.id, email: existing.email, role: "NGO" }),
      async () => identity,
      provision,
    ));
    app.use(errorHandler);

    const response = await request(app)
      .post("/api/auth/profile")
      .set("Authorization", "Bearer verified-session-token")
      .send({ role: "DONOR" });

    expect(response.status).toBe(200);
    expect(response.body.role).toBe("NGO");
  });
});
