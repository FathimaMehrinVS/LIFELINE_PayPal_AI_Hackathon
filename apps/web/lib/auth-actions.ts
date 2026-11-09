import type { SupabaseClient } from "@supabase/supabase-js";

type BrowserClient = Pick<SupabaseClient, "auth">;

export async function signUpWithPassword(client: BrowserClient, email: string, password: string) {
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.session) {
    throw new Error("Supabase did not create a session. Disable email confirmation for the local/demo project to allow immediate sign-in.");
  }
  return data.session;
}

export async function signInWithPassword(client: BrowserClient, email: string, password: string) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error("Supabase sign-in did not return a session. Please try again.");
  return data.session;
}

export async function signOutLocally(client: BrowserClient): Promise<void> {
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw error;
}
