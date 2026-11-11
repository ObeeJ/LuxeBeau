import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

/* ── Wire schemas (snake_case from Go) ─────────────────────────── */

export const influencerPackageSchema = z.object({
  id: z.number(),
  owner_id: z.string(),
  slug: z.string(),
  influencer_name: z.string(),
  influencer_email: z.string().nullish().transform(v => v ?? ""),
  influencer_phone: z.string().nullish().transform(v => v ?? ""),
  influencer_handle: z.string().nullish().transform(v => v ?? ""),
  scope: z.string(),
  agreement: z.string().nullish().transform(v => v ?? ""),
  commission_bps: z.number(),
  bank_code: z.string().nullish().transform(v => v ?? ""),
  account_number: z.string().nullish().transform(v => v ?? ""),
  account_name: z.string().nullish().transform(v => v ?? ""),
  starts_at: z.string().nullish(),
  ends_at: z.string().nullish(),
  state: z.string(),
  created_at: z.string().nullish(),
  total_earned_kobo: z.number().nullish().transform(v => v ?? 0),
  total_paid_kobo: z.number().nullish().transform(v => v ?? 0),
  total_pending_kobo: z.number().nullish().transform(v => v ?? 0),
  conversion_count: z.number().nullish().transform(v => v ?? 0),
});
export type InfluencerPackage = z.infer<typeof influencerPackageSchema>;

export const packagesResponseSchema = z.object({
  packages: z.array(influencerPackageSchema).nullish().transform(v => v ?? []),
});
export const packageResponseSchema = z.object({ package: influencerPackageSchema });

export const commissionSchema = z.object({
  id: z.number(),
  package_id: z.number(),
  order_id: z.string(),
  order_amount: z.number(),
  platform_fee: z.number(),
  seller_net: z.number(),
  commission_amount: z.number(),
  state: z.string(),
  created_at: z.string().nullish(),
});
export type InfluencerCommission = z.infer<typeof commissionSchema>;

export const commissionsResponseSchema = z.object({
  commissions: z.array(commissionSchema).nullish().transform(v => v ?? []),
});

/* ── Input type ─────────────────────────────────────────────────── */

export interface PackageInput {
  slug: string;
  influencer_name: string;
  influencer_email?: string;
  influencer_phone?: string;
  influencer_handle?: string;
  scope: string;
  agreement?: string;
  commission_bps: number;
  bank_code?: string;
  account_number?: string;
  account_name?: string;
  starts_at?: string;
  ends_at?: string;
}

/* ── Pure helpers ───────────────────────────────────────────────── */

export function commissionPct(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}

export function stateTone(state: string): "success" | "pending" | "failed" | "neutral" {
  switch (state) {
    case "active": return "success";
    case "paused": return "pending";
    case "cancelled": case "expired": return "failed";
    default: return "neutral";
  }
}

export function commissionTone(state: string): "success" | "pending" | "failed" {
  switch (state) {
    case "paid": return "success";
    case "earned": return "pending";
    default: return "failed";
  }
}

export function stateLabel(state: string): string {
  return state.charAt(0).toUpperCase() + state.slice(1);
}

/* ── API functions ──────────────────────────────────────────────── */

export function fetchPackages() {
  return apiFetch("/me/influencer-packages", packagesResponseSchema)
    .then(r => r.packages);
}

export function fetchPackage(id: number) {
  return apiFetch(`/me/influencer-packages/${id}`, packageResponseSchema)
    .then(r => r.package);
}

export function createPackage(input: PackageInput) {
  return apiFetch("/me/influencer-packages", packageResponseSchema, {
    method: "POST", body: input,
  }).then(r => r.package);
}

export function updatePackage(id: number, input: PackageInput) {
  return apiFetch(`/me/influencer-packages/${id}`, packageResponseSchema, {
    method: "PATCH", body: input,
  }).then(r => r.package);
}

export function setPackageState(id: number, state: string) {
  return apiFetch(`/me/influencer-packages/${id}/state`, z.unknown(), {
    method: "PATCH", body: { state },
  });
}

export function fetchCommissions(packageId: number) {
  return apiFetch(
    `/me/influencer-packages/${packageId}/commissions`,
    commissionsResponseSchema,
  ).then(r => r.commissions);
}

/* ── Hooks ──────────────────────────────────────────────────────── */

export function useInfluencerPackages(enabled: boolean) {
  return useQuery({
    queryKey: ["me", "influencer-packages"],
    enabled,
    queryFn: fetchPackages,
  });
}

export function useCreatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPackage,
    onSettled: () => qc.invalidateQueries({ queryKey: ["me", "influencer-packages"] }),
  });
}

export function useUpdatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: PackageInput }) => updatePackage(id, input),
    onSettled: () => qc.invalidateQueries({ queryKey: ["me", "influencer-packages"] }),
  });
}

export function useSetPackageState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, state }: { id: number; state: string }) => setPackageState(id, state),
    onSettled: () => qc.invalidateQueries({ queryKey: ["me", "influencer-packages"] }),
  });
}

export function useCommissions(packageId: number | null) {
  return useQuery({
    queryKey: ["influencer-commissions", packageId],
    enabled: packageId !== null,
    queryFn: () => fetchCommissions(packageId!),
  });
}
