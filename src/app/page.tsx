"use client";

import { useEffect, useRef, useState } from "react";

type MessageStatus = "pending" | "streaming" | "done" | "error";
type MessageRole = "user" | "assistant";
type ConnectionStatus =
  | "idle"
  | "connecting"
  | "reconnecting"
  | "streaming"
  | "closed"
  | "error";

type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
};

type StreamChunk = {
  messageId: string;
  seq: number;
  type: "token" | "done";
  token?: string;
};

const MAX_RETRIES = 2;
const RETRY_DELAYS = [600, 1200];

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [isStreaming, setIsStreaming] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const seenSeqRef = useRef<Set<number>>(new Set());
  const lastSeqRef = useRef(0);
  const activeRequestRef = useRef<{ question: string; requestId: string; assistantId: string } | null>(null);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  const updateAssistantMessage = (assistantId: string, updater: (msg: ChatMessage) => ChatMessage) => {
    setMessages((prev) => prev.map((msg) => (msg.id === assistantId ? updater(msg) : msg)));
  };

  const closeStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  const finalizeAsError = (assistantId: string) => {
    updateAssistantMessage(assistantId, (msg) => ({
      ...msg,
      status: "error",
      content: msg.content || "请求失败，请重试。",
    }));
    setConnectionStatus("error");
    setIsStreaming(false);
    closeStream();
  };

  const finishStream = (assistantId: string) => {
    updateAssistantMessage(assistantId, (msg) => ({
      ...msg,
      status: "done",
      content: msg.content || "（空响应）",
    }));
    setConnectionStatus("closed");
    setIsStreaming(false);
    retryCountRef.current = 0;
    closeStream();
  };

  const scheduleReconnect = () => {
    const active = activeRequestRef.current;
    if (!active) return;

    if (retryCountRef.current >= MAX_RETRIES) {
      finalizeAsError(active.assistantId);
      return;
    }

    const delay = RETRY_DELAYS[retryCountRef.current] ?? 1500;
    retryCountRef.current += 1;
    setConnectionStatus("reconnecting");

    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
    }

    retryTimerRef.current = setTimeout(() => {
      connectStream(active.question, active.requestId, active.assistantId);
    }, delay);
  };

  const handleChunk = (data: StreamChunk, assistantId: string) => {
    if (data.seq <= 0) return;
    if (seenSeqRef.current.has(data.seq)) return;

    seenSeqRef.current.add(data.seq);
    lastSeqRef.current = Math.max(lastSeqRef.current, data.seq);

    if (data.type === "token" && data.token) {
      updateAssistantMessage(assistantId, (msg) => ({
        ...msg,
        content: `${msg.content}${data.token}`,
        status: "streaming",
      }));
      return;
    }

    if (data.type === "done") {
      finishStream(assistantId);
    }
  };

  const connectStream = (question: string, requestId: string, assistantId: string) => {
    closeStream();

    const es = new EventSource(
      `/api/chat/stream?q=${encodeURIComponent(question)}&requestId=${encodeURIComponent(requestId)}&cursor=${lastSeqRef.current}`,
    );

    eventSourceRef.current = es;

    es.onopen = () => {
      setConnectionStatus("streaming");
      updateAssistantMessage(assistantId, (msg) => ({ ...msg, status: "streaming" }));
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as StreamChunk;
        handleChunk(data, assistantId);
      } catch {
        scheduleReconnect();
      }
    };

    es.onerror = () => {
      closeStream();
      scheduleReconnect();
    };
  };

  const sendMessage = () => {
    const question = input.trim();
    if (!question || isStreaming) return;

    const now = Date.now();
    const userId = `user_${now}`;
    const assistantId = `assistant_${now}`;
    const requestId = `request_${now}`;

    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: question, status: "done" },
      { id: assistantId, role: "assistant", content: "", status: "pending" },
    ]);

    setInput("");
    setIsStreaming(true);
    setConnectionStatus("connecting");

    retryCountRef.current = 0;
    seenSeqRef.current = new Set();
    lastSeqRef.current = 0;
    activeRequestRef.current = { question, requestId, assistantId };

    connectStream(question, requestId, assistantId);
  };

  const connectionText: Record<ConnectionStatus, string> = {
    idle: "未连接",
    connecting: "连接中",
    reconnecting: "重连中",
    streaming: "流式输出中",
    closed: "已完成",
    error: "连接异常",
  };

  const connectionClass: Record<ConnectionStatus, string> = {
    idle: "bg-zinc-100 text-zinc-700",
    connecting: "bg-amber-50 text-amber-700",
    reconnecting: "bg-orange-50 text-orange-700",
    streaming: "bg-emerald-50 text-emerald-700",
    closed: "bg-zinc-100 text-zinc-700",
    error: "bg-rose-50 text-rose-700",
  };

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <main className="mx-auto flex h-screen w-full max-w-6xl gap-4 p-4">
        <aside className="hidden w-72 rounded-xl border border-zinc-200 bg-white p-4 lg:block">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700">会话列表</h2>
          <div className="space-y-2 text-sm">
            <div className="rounded-lg bg-zinc-100 px-3 py-2">广告投放优化（当前）</div>
            <div className="rounded-lg px-3 py-2 text-zinc-500">素材审核自动化</div>
            <div className="rounded-lg px-3 py-2 text-zinc-500">归因链路分析</div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col rounded-xl border border-zinc-200 bg-white">
          <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <div>
              <h1 className="text-base font-semibold">Agent 对话工作台</h1>
              <p className="text-xs text-zinc-500">W1：流式渲染 + 重连 + 去重</p>
            </div>
            <div className={`rounded-full px-3 py-1 text-xs font-medium ${connectionClass[connectionStatus]}`}>
              {connectionText[connectionStatus]}
            </div>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
                还没有消息，输入问题后点击发送。
              </div>
            )}

            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                      isUser
                        ? "bg-zinc-900 text-white"
                        : "border border-zinc-200 bg-zinc-50 text-zinc-800"
                    }`}
                  >
                    <p>{msg.content || "..."}</p>
                    <p className="mt-2 text-[11px] opacity-70">状态：{msg.status}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <footer className="border-t border-zinc-200 p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="min-h-[44px] flex-1 resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                placeholder="输入你的问题，点击发送开始流式输出"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={isStreaming}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
              >
                {isStreaming ? "生成中..." : "发送"}
              </button>
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}
