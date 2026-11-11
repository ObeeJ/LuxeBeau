import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

/* ── Schemas ─────────────────────────────────────────────────── */

export const profileStatsSchema = z.object({
  reviews: z.number().nullish().transform(v => v ?? 0),
});

export const publicProfileSchema = z.object({
  user_id: z.string(),
  name: z.string(),
  role: z.string(),
  verified: z.boolean().nullish().transform(v => v ?? false),
  avatar_url: z.string().nullish().transform(v => v ?? ""),
  bio: z.string().nullish().transform(v => v ?? ""),
  social_handle: z.string().nullish().transform(v => v ?? ""),
  website: z.string().nullish().transform(v => v ?? ""),
  stats: profileStatsSchema.nullish().transform(v => v ?? { reviews: 0 }),
});
export type PublicProfile = z.infer<typeof publicProfileSchema>;

export const myProfileSchema = z.object({
  user_id: z.string().nullish(),
  avatar_url: z.string().nullish().transform(v => v ?? ""),
  bio: z.string().nullish().transform(v => v ?? ""),
  social_handle: z.string().nullish().transform(v => v ?? ""),
  website: z.string().nullish().transform(v => v ?? ""),
}).nullable();
export type MyProfile = z.infer<typeof myProfileSchema>;

export const conversationSchema = z.object({
  id: z.string(),
  user_a: z.string(),
  user_b: z.string(),
  last_at: z.string().nullish(),
});
export type Conversation = z.infer<typeof conversationSchema>;

export const messageSchema = z.object({
  id: z.number(),
  conversation_id: z.string(),
  sender_id: z.string(),
  body: z.string(),
  read_at: z.string().nullish(),
  created_at: z.string().nullish(),
});
export type Message = z.infer<typeof messageSchema>;

/* ── API functions ──────────────────────────────────────────── */

export function fetchPublicProfile(handle: string) {
  return apiFetch(`/profiles/${encodeURIComponent(handle)}`,
    z.object({ profile: publicProfileSchema })).then(r => r.profile);
}

export function fetchMyProfile() {
  return apiFetch("/me/profile/social",
    z.object({ profile: myProfileSchema })).then(r => r.profile);
}

export interface ProfileInput {
  avatar_url?: string;
  bio?: string;
  social_handle?: string;
  website?: string;
}

export function updateMyProfile(input: ProfileInput) {
  return apiFetch("/me/profile/social", z.object({ profile: myProfileSchema }), {
    method: "PATCH", body: input,
  }).then(r => r.profile);
}

export function fetchConversations() {
  return apiFetch("/me/conversations",
    z.object({ conversations: z.array(conversationSchema).nullish().transform(v => v ?? []) }))
    .then(r => r.conversations);
}

export function fetchMessages(convId: string, before?: number) {
  const q = before ? `?before=${before}` : "";
  return apiFetch(`/me/conversations/${encodeURIComponent(convId)}/messages${q}`,
    z.object({ messages: z.array(messageSchema).nullish().transform(v => v ?? []) }))
    .then(r => r.messages);
}

export function sendMessage(recipientId: string, body: string) {
  return apiFetch("/me/messages", z.object({ message: messageSchema }), {
    method: "POST", body: { recipient_id: recipientId, body },
  }).then(r => r.message);
}

export function markRead(convId: string) {
  return apiFetch(`/me/conversations/${encodeURIComponent(convId)}/read`,
    z.unknown(), { method: "POST" });
}

/* ── Hooks ──────────────────────────────────────────────────── */

export function usePublicProfile(handle: string) {
  return useQuery({
    queryKey: ["profile", handle],
    queryFn: () => fetchPublicProfile(handle),
    enabled: Boolean(handle),
  });
}

export function useMyProfile(enabled: boolean) {
  return useQuery({
    queryKey: ["me", "profile", "social"],
    enabled,
    queryFn: fetchMyProfile,
  });
}

export function useUpdateMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateMyProfile,
    onSettled: () => qc.invalidateQueries({ queryKey: ["me", "profile", "social"] }),
  });
}

export function useConversations(enabled: boolean) {
  return useQuery({
    queryKey: ["me", "conversations"],
    enabled,
    queryFn: fetchConversations,
    refetchInterval: 30_000,
  });
}

export function useMessages(convId: string | null) {
  return useQuery({
    queryKey: ["messages", convId],
    enabled: Boolean(convId),
    queryFn: () => fetchMessages(convId!),
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ recipientId, body }: { recipientId: string; body: string }) =>
      sendMessage(recipientId, body),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["me", "conversations"] });
      qc.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}
