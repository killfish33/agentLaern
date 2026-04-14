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
  sessionId: string;
  seq: number;
  type: "token" | "done";
  token?: string;
};

type SessionSummary = {
  id: string;
  title: string | null;
  createdAt: string;
  lastMessage: {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    status: MessageStatus;
    createdAt: string;
  } | null;
};

const MAX_RETRIES = 2;
const RETRY_DELAYS = [600, 1200];
// 会话切换时保留最短 loading 时间，避免内容瞬切导致视觉生硬。
const MIN_SESSION_SWITCH_LOADING_MS = 260;

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionMessagesLoading, setSessionMessagesLoading] = useState(false);

  // EventSource 与重连控制参数都用 ref，避免渲染周期内状态丢失。
  // 这些值会在 onmessage/onerror 回调中被频繁读写，不适合放在 state。
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const seenSeqRef = useRef<Set<number>>(new Set());
  const lastSeqRef = useRef(0);
  const activeRequestRef = useRef<{
    question: string;
    requestId: string;
    assistantId: string;
    sessionId: string | null;
  } | null>(null);

  useEffect(() => {
    // 首屏拉取历史会话列表，供左侧会话导航使用。
    void loadSessions();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  const updateAssistantMessage = (
    assistantId: string,
    updater: (msg: ChatMessage) => ChatMessage,
  ) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === assistantId ? updater(msg) : msg)),
    );
  };

  const closeStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  const getSessionDisplayTitle = (session: SessionSummary) => {
    // 标题优先级：显式标题 > 最近一条消息摘要 > 会话 ID 尾号。
    const safeTitle = session.title?.trim();
    if (safeTitle) return safeTitle;
    const lastContent = session.lastMessage?.content?.trim();
    if (lastContent) return lastContent.slice(0, 20);
    return `会话 ${session.id.slice(-6)}`;
  };

  const loadSessions = async () => {
    // 仅负责左侧会话摘要，不加载具体消息内容。
    setSessionsLoading(true);
    try {
      const response = await fetch("/api/sessions?limit=30", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        setSessions([]);
        return;
      }
      const payload = (await response.json()) as {
        ok: boolean;
        data?: SessionSummary[];
      };
      setSessions(Array.isArray(payload.data) ? payload.data : []);
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  };

  const mapHistoryMessages = (rawList: unknown): ChatMessage[] => {
    // 对历史消息做一次“窄化 + 容错”，确保 UI 层拿到稳定结构。
    if (!Array.isArray(rawList)) {
      return [];
    }

    return rawList
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const rawItem = item as Record<string, unknown>;
        const role = rawItem.role;
        if (role !== "user" && role !== "assistant") {
          return null;
        }
        const status = rawItem.status;
        return {
          id:
            typeof rawItem.id === "string"
              ? rawItem.id
              : `msg_${Math.random().toString(36).slice(2, 8)}`,
          role,
          content: typeof rawItem.content === "string" ? rawItem.content : "",
          status:
            status === "pending" ||
            status === "streaming" ||
            status === "done" ||
            status === "error"
              ? status
              : "done",
        } satisfies ChatMessage;
      })
      .filter((item): item is ChatMessage => Boolean(item));
  };

  const loadSessionMessages = async (targetSessionId: string) => {
    // 记录切换起点，用于计算最短过渡时长。
    const switchStartAt = Date.now();

    // 切换会话前先把流式链路清空，避免旧会话 token 串到新会话。
    closeStream();
    setIsStreaming(false);
    setConnectionStatus("idle");
    retryCountRef.current = 0;
    seenSeqRef.current = new Set();
    lastSeqRef.current = 0;
    activeRequestRef.current = null;
    setSessionId(targetSessionId);
    setSessionMessagesLoading(true);

    try {
      const response = await fetch(
        `/api/sessions/${encodeURIComponent(targetSessionId)}/messages`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        setMessages([]);
        return;
      }

      const payload = (await response.json()) as {
        ok: boolean;
        data?: unknown;
      };
      const nextMessages = mapHistoryMessages(payload.data);
      // 即使接口很快，也至少等待 MIN_SESSION_SWITCH_LOADING_MS，避免闪烁。
      const elapsed = Date.now() - switchStartAt;
      const waitTime = Math.max(0, MIN_SESSION_SWITCH_LOADING_MS - elapsed);
      if (waitTime > 0) {
        await new Promise((resolve) => {
          setTimeout(resolve, waitTime);
        });
      }
      setMessages(nextMessages);
    } catch {
      // 错误场景保持同样的最短过渡时间，保证切换体验一致。
      const elapsed = Date.now() - switchStartAt;
      const waitTime = Math.max(0, MIN_SESSION_SWITCH_LOADING_MS - elapsed);
      if (waitTime > 0) {
        await new Promise((resolve) => {
          setTimeout(resolve, waitTime);
        });
      }
      setMessages([]);
    } finally {
      setSessionMessagesLoading(false);
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
    // 流式结束后刷新左侧会话列表，让最新消息摘要及时可见。
    void loadSessions();
  };

  // 断流后按退避时间重连，并复用同一请求参数（含 sessionId/cursor）。
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
      connectStream(
        active.question,
        active.requestId,
        active.assistantId,
        active.sessionId,
      );
    }, delay);
  };

  const handleChunk = (data: StreamChunk, assistantId: string) => {
    // 首个 chunk 可能返回新建 sessionId，需要同步到当前请求上下文，
    // 确保后续断线重连仍然绑定同一会话。
    if (!sessionId && data.sessionId) {
      setSessionId(data.sessionId);
      if (activeRequestRef.current) {
        activeRequestRef.current = {
          ...activeRequestRef.current,
          sessionId: data.sessionId,
        };
      }
    }

    // 以 seq 做幂等去重，避免重连后重复渲染 token。
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

  const connectStream = (
    question: string,
    requestId: string,
    assistantId: string,
    sessionIdValue: string | null,
  ) => {
    closeStream();

    // cursor 用于断线重连续传；服务端应返回 seq > cursor 的增量数据。
    const url = new URL("/api/chat/stream", window.location.origin);
    url.searchParams.set("q", question);
    url.searchParams.set("requestId", requestId);
    url.searchParams.set("cursor", String(lastSeqRef.current));

    if (sessionIdValue) {
      url.searchParams.set("sessionId", sessionIdValue);
    }

    const es = new EventSource(url.toString());

    eventSourceRef.current = es;

    es.onopen = () => {
      setConnectionStatus("streaming");
      updateAssistantMessage(assistantId, (msg) => ({
        ...msg,
        status: "streaming",
      }));
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
    // 流式进行中禁止并发发送，避免请求与状态机互相覆盖。
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
    activeRequestRef.current = { question, requestId, assistantId, sessionId };

    connectStream(question, requestId, assistantId, sessionId);
  };

  const selectSession = (targetSessionId: string) => {
    // 切换保护：流式中或正在切换时不接受新切换，避免状态竞争。
    if (!targetSessionId || isStreaming || sessionMessagesLoading) return;
    if (targetSessionId === sessionId) return;
    void loadSessionMessages(targetSessionId);
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
            {sessionsLoading && (
              <div className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-zinc-500">
                会话加载中...
              </div>
            )}

            {!sessionsLoading && sessions.length === 0 && (
              <div className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-zinc-500">
                暂无历史会话
              </div>
            )}

            {sessions.map((item) => {
              const isActive = sessionId === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    selectSession(item.id);
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left ${
                    isActive
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-500 hover:bg-zinc-50"
                  }`}
                >
                  <p className="truncate">{getSessionDisplayTitle(item)}</p>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col rounded-xl border border-zinc-200 bg-white">
          <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <div>
              <h1 className="text-base font-semibold">Agent 对话工作台</h1>
              <p className="text-xs text-zinc-500">
                W1：流式渲染 + 重连 + 去重
              </p>
            </div>
            <div
              className={`rounded-full px-3 py-1 text-xs font-medium ${connectionClass[connectionStatus]}`}
            >
              {connectionText[connectionStatus]}
            </div>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {sessionMessagesLoading && (
              <div className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
                正在加载历史消息...
              </div>
            )}

            {messages.length === 0 && (
              <div className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
                还没有消息，输入问题后点击发送。
              </div>
            )}

            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                      isUser
                        ? "bg-zinc-900 text-white"
                        : "border border-zinc-200 bg-zinc-50 text-zinc-800"
                    }`}
                  >
                    <p>{msg.content || "..."}</p>
                    <p className="mt-2 text-[11px] opacity-70">
                      状态：{msg.status}
                    </p>
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
