/** Where each role starts: the page holding the work they need to do first. */
export function homeFor(role: "ADMIN" | "NGO" | "DONOR" | "PARTNER"): string {
  if (role === "ADMIN") return "/admin/users";
  if (role === "NGO") return "/overview";
  return role === "DONOR" ? "/plans" : "/deliveries";
}
