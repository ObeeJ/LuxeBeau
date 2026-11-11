/* Admin user detail: schema, fetch hook and pure helpers.
   Moderation actions reuse the mutations in lib/queries.ts. */
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/lib/api";

const str = z.string().nullish().transform(v => v ?? "");

export const adminUserDetailSchema = z.object({
  id: z.string(),
  name: str,
  email: str,
  phone: str,
  role: str,
  status: str,
  country_code: str,
  jurisdiction: str,
  cac_number: str,
  kyc_status: str,
  email_verified: z.boolean().nullish().transform(v => v ?? false),
  verified: z.boolean().nullish().transform(v => v ?? false),
  created_at: z.string().nullish().transform(v => v ?? null),
});
export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;

export const adminUserDetailResponseSchema = z.object({ user: adminUserDetailSchema });

export function useAdminUser(id: string | null) {
  return useQuery({
    queryKey: ["admin", "user", id],
    enabled: !!id,
    queryFn: async () => (await apiFetch(`/admin/users/${encodeURIComponent(id ?? "")}`, adminUserDetailResponseSchema)).user,
    retry: (count, err) => {
      const s = (err as { status?: number })?.status;
      return s !== 403 && s !== 404 && count < 1;
    },
  });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Nov 2026" for a join date, or "Unknown" when missing or invalid. */
export function memberSince(iso: string | null | undefined): string {
  if (!iso) return "Unknown";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "Unknown" : `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function roleLabel(role: string): string {
  const r = role.toLowerCase();
  return r ? r.charAt(0).toUpperCase() + r.slice(1) : "Unknown";
}

export function kycLabel(kyc: string): string {
  switch (kyc) {
    case "verified": return "Identity verified";
    case "pending": return "Check in progress";
    case "failed": return "Check failed";
    case "unverified":
    case "": return "Not checked";
    default: return kyc;
  }
}

/** Sellers and artisans are the only roles that go through the partner check. */
export function isPartner(role: string): boolean {
  return role === "seller" || role === "artisan";
}

export interface UserActionRules {
  canChangeRole: boolean;
  canSuspend: boolean;
  canVerify: boolean;
  canDelete: boolean;
  isSuspended: boolean;
}

/** Admins cannot be demoted, suspended or removed here; the server refuses it too. */
export function userActionRules(u: Pick<AdminUserDetail, "role" | "status" | "verified">): UserActionRules {
  const admin = u.role === "admin";
  return {
    canChangeRole: !admin,
    canSuspend: !admin,
    canVerify: isPartner(u.role) && !u.verified,
    canDelete: !admin,
    isSuspended: u.status === "suspended",
  };
}

export const ROLE_CHOICES: { value: string; label: string }[] = [
  { value: "buyer", label: "Buyer" },
  { value: "seller", label: "Seller" },
  { value: "artisan", label: "Artisan" },
];

/** What happens if the admin does this: shown next to each action. */
export function consequenceText(action: "role" | "suspend" | "reactivate" | "verify" | "delete", name: string): string {
  switch (action) {
    case "role": return `Changes what ${name} can do on LuxeBeau straight away.`;
    case "suspend": return `${name} will be signed out of selling and buying until you reactivate the account.`;
    case "reactivate": return `${name} will be able to use the account again.`;
    case "verify": return `Marks ${name} as a verified partner and shows the verified badge on their shop.`;
    case "delete": return `Permanently removes ${name} and their account. This cannot be undone.`;
  }
}

/** The exact words the admin must type to confirm a delete: the user's email, or name when no email. */
export function deletePhrase(u: Pick<AdminUserDetail, "name" | "email">): string {
  return (u.email || u.name).trim();
}

export function deleteConfirmed(typed: string, u: Pick<AdminUserDetail, "name" | "email">): boolean {
  const want = deletePhrase(u).toLowerCase();
  return want !== "" && typed.trim().toLowerCase() === want;
}
