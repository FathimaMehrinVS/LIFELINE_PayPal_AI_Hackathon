import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signInWithPassword, signOutLocally, signUpWithPassword } from "../../apps/web/lib/auth-actions";

function clientWith(auth: Record<string, ReturnType<typeof vi.fn>>) {
  return { auth } as unknown as Pick<SupabaseClient, "auth">;
}

describe("Supabase email/password UI actions", () => {
  it("signs up and requires Supabase to return an immediate session", async () => {
    const session = { access_token: "test-session" };
    const signUp = vi.fn().mockResolvedValue({ data: { session }, error: null });
    const client = clientWith({ signUp });

    await expect(signUpWithPassword(client, "person@example.test", "password-123")).resolves.toBe(session);
    expect(signUp).toHaveBeenCalledWith({ email: "person@example.test", password: "password-123" });
  });

  it("explains that email confirmation must be disabled when signup returns no session", async () => {
    const signUp = vi.fn().mockResolvedValue({ data: { session: null }, error: null });

    await expect(signUpWithPassword(clientWith({ signUp }), "person@example.test", "password-123"))
      .rejects.toThrow("Disable email confirmation");
  });

  it("signs in an existing email/password user", async () => {
    const session = { access_token: "test-session" };
    const signInWithPasswordMock = vi.fn().mockResolvedValue({ data: { session }, error: null });
    const client = clientWith({ signInWithPassword: signInWithPasswordMock });

    await expect(signInWithPassword(client, "person@example.test", "password-123")).resolves.toBe(session);
    expect(signInWithPasswordMock).toHaveBeenCalledWith({ email: "person@example.test", password: "password-123" });
  });

  it("clears only the current local session on sign-out", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });

    await expect(signOutLocally(clientWith({ signOut }))).resolves.toBeUndefined();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
