"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Send } from "@/components/icons";
import SiteShell, { Container } from "@/components/site/shell";
import { EmptyState, LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/store";
import {
  markRead,
  useConversations,
  useMessages,
  useSendMessage,
  type Conversation,
  type Message,
} from "@/lib/social";
import { formatLagosDateTime } from "@/lib/format";
import { API_BASE } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

function ConvItem({ conv, active, myId, onClick }: { conv: Conversation; active: boolean; myId: string; onClick: () => void }) {
  const otherId = conv.user_a === myId ? conv.user_b : conv.user_a;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
        active && "bg-brand-wash",
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-wash text-[13px] font-semibold text-brand-deep">
        {otherId.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold">{otherId.slice(0, 8)}…</p>
        {conv.last_at && <p className="text-[12px] text-muted">{formatLagosDateTime(conv.last_at)}</p>}
      </div>
    </button>
  );
}

function Bubble({ msg, mine }: { msg: Message; mine: boolean }) {
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[75%] rounded-[18px] px-4 py-2.5 text-[14px] leading-relaxed",
        mine ? "rounded-br-[4px] bg-brand text-surface" : "rounded-bl-[4px] bg-canvas text-ink",
      )}>
        <p>{msg.body}</p>
        {msg.created_at && (
          <p className={cn("mt-1 text-[11px]", mine ? "text-surface/70" : "text-muted")}>
            {formatLagosDateTime(msg.created_at)}
          </p>
        )}
      </div>
    </div>
  );
}

function Thread({ convId, myId }: { convId: string; myId: string }) {
  const q = useMessages(convId);
  const send = useSendMessage();
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const msgs = [...(q.data ?? [])].reverse();
  const parts = convId.split(":");
  const recipientId = parts[0] === myId ? parts[1] : parts[0];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  useEffect(() => {
    if (convId) markRead(convId).catch(() => {});
  }, [convId]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || send.isPending) return;
    setBody("");
    send.mutate({ recipientId, body: text });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {q.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-3/4 rounded-[18px]" />)}
          </div>
        ) : q.isError ? (
          <LoadError onRetry={() => q.refetch()} message="We couldn't load messages." />
        ) : msgs.length === 0 ? (
          <EmptyState>No messages yet. Say hello.</EmptyState>
        ) : (
          msgs.map(m => <Bubble key={m.id} msg={m} mine={m.sender_id === myId} />)
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={submit} className="flex items-end gap-2 border-t border-hairline p-3">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(e as unknown as React.FormEvent);
            }
          }}
          placeholder="Message…"
          rows={1}
          maxLength={2000}
          className="lb-input flex-1 resize-none rounded-[20px] py-2.5 text-[14px]"
          aria-label="Message"
        />
        <Button type="submit" size="sm" disabled={!body.trim() || send.isPending} aria-label="Send">
          {send.isPending
            ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            : <Send className="h-4 w-4" aria-hidden />}
        </Button>
      </form>
    </div>
  );
}

export default function MessagesClient() {
  const user = useAuth(s => s.user);
  const searchParams = useSearchParams();
  const toParam = searchParams.get("to");
  const qc = useQueryClient();
  const convs = useConversations(Boolean(user));
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  useEffect(() => {
    if (toParam && user) {
      const id = [user.id, toParam].sort().join(":");
      setActiveConvId(id);
    }
  }, [toParam, user]);

  // SSE realtime
  useEffect(() => {
    if (!user) return;
    const apiRoot = API_BASE.replace(/\/api\/v1\/?$/, "");
    const es = new EventSource(`${apiRoot}/api/v1/me/messages/stream`, { withCredentials: true });
    es.onmessage = (e) => {
      if (e.data && !e.data.startsWith(":")) {
        qc.invalidateQueries({ queryKey: ["me", "conversations"] });
        qc.invalidateQueries({ queryKey: ["messages", e.data] });
      }
    };
    return () => es.close();
  }, [user, qc]);

  if (!user) {
    return (
      <SiteShell>
        <Container className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <p className="text-[16px] text-muted">Sign in to view your messages.</p>
            <Button asChild className="mt-4"><Link href="/signin">Sign in</Link></Button>
          </div>
        </Container>
      </SiteShell>
    );
  }

  return (
    <SiteShell footer={false}>
      <div className="flex h-[calc(100dvh-3.5rem)] md:h-dvh">
        <aside className={cn(
          "flex w-full flex-col border-r border-hairline bg-surface md:w-80 md:shrink-0",
          activeConvId && "hidden md:flex",
        )}>
          <div className="flex h-14 items-center border-b border-hairline px-4">
            <h1 className="text-[16px] font-semibold">Messages</h1>
          </div>
          <div className="flex-1 overflow-y-auto">
            {convs.isLoading ? (
              <div className="space-y-1 p-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-[16px]" />)}
              </div>
            ) : convs.isError ? (
              <LoadError onRetry={() => convs.refetch()} message="We couldn't load conversations." />
            ) : (convs.data ?? []).length === 0 ? (
              <div className="p-4"><EmptyState>No conversations yet.</EmptyState></div>
            ) : (
              (convs.data ?? []).map(c => (
                <ConvItem
                  key={c.id}
                  conv={c}
                  active={c.id === activeConvId}
                  myId={user.id}
                  onClick={() => setActiveConvId(c.id)}
                />
              ))
            )}
          </div>
        </aside>

        <main className={cn("flex flex-1 flex-col", !activeConvId && "hidden md:flex")}>
          {activeConvId ? (
            <>
              <div className="flex h-14 items-center gap-3 border-b border-hairline px-4 md:hidden">
                <button type="button" onClick={() => setActiveConvId(null)}
                  className="text-[14px] text-muted hover:text-ink focus-visible:outline-none">
                  ← Back
                </button>
              </div>
              <Thread convId={activeConvId} myId={user.id} />
            </>
          ) : (
            <div className="hidden flex-1 items-center justify-center md:flex">
              <p className="text-[14px] text-muted">Select a conversation to start messaging.</p>
            </div>
          )}
        </main>
      </div>
    </SiteShell>
  );
}
