"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Send,
  Square,
  Download,
  ChevronDown,
  Paperclip,
  ChartArea,
  FileInput,
  MessageCircleQuestion,
  ChartColumnBig,
} from "lucide-react";
import FilePreview from "@/components/FilePreview";
import { ChartRenderer } from "@/components/ChartRenderer";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import type { ChartData } from "@/types/chart";
import TopNavBar from "@/components/TopNavBar";
import {
  readFileAsText,
  readFileAsBase64,
  readFileAsPDFText,
} from "@/utils/fileHandling";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

type ChartMsg = ChartData;

const mdComponents: Components = {
  // Headings: 16px
  h1: ({ node, ...props }) => <h1 className="text-[16px] font-semibold mt-3 mb-2" {...props} />,
  h2: ({ node, ...props }) => <h2 className="text-[16px] font-semibold mt-3 mb-2" {...props} />,
  // Subheadings: 14px
  h3: ({ node, ...props }) => <h3 className="text-[14px] font-medium mt-2 mb-1" {...props} />,
  h4: ({ node, ...props }) => <h4 className="text-[14px] font-medium mt-2 mb-1" {...props} />,
  h5: ({ node, ...props }) => <h5 className="text-[14px] font-medium mt-2 mb-1" {...props} />,
  h6: ({ node, ...props }) => <h6 className="text-[14px] font-medium mt-2 mb-1" {...props} />,
  // Content: 12px
  p: ({ node, ...props }) => <p className="text-[12px] my-1" {...props} />,
  ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-2 text-[12px]" {...props} />,
  ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-2 text-[12px]" {...props} />,
  li: ({ node, ...props }) => <li className="text-[12px]" {...props} />,
  table: ({ node, ...props }) => (
    <div className="overflow-x-auto my-3">
      <table className="w-full border-collapse text-[12px]" {...props} />
    </div>
  ),
  th: ({ node, ...props }) => (
    <th className="border px-2 py-1 text-left bg-background/50 text-[12px] font-medium" {...props} />
  ),
  td: ({ node, ...props }) => (
    <td className="border px-2 py-1 align-top text-[12px]" {...props} />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote className="border-l-4 pl-3 italic text-[12px] opacity-90 my-2" {...props} />
  ),
  // @ts-ignore — react-markdown passes `inline`; TS inference complains
  code({ node, inline, className, children, ...props }) {
    if (inline) {
      return (
        <code className="bg-background/50 px-1 py-0.5 rounded text-[12px]" {...props}>
          {children}
        </code>
      );
    }
    return (
  <pre {...(props as React.HTMLAttributes<HTMLPreElement>)} className="bg-background/50 p-3 rounded overflow-auto my-2 text-[12px]">
        <code className={className}>{children}</code>
      </pre>
    );
  },
};

interface Message {
  id: string;
  role: string;
  content: string;
  status?: string; // pre-stream status shown with spinner before first token
  hasToolUse?: boolean;
  file?: {
    base64: string;
    fileName: string;
    mediaType: string;
    isText?: boolean;
  };
  charts?: ChartData[];
  followUps?: string[];
}

interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

type Model = {
  id: string;
  name: string;
};

interface FileUpload {
  base64: string;
  fileName: string;
  mediaType: string;
  isText?: boolean;
  fileSize?: number;
}

const models: Model[] = [
  { id: "claude-sonnet-4-5-20250929", name: "IdentifyAI's CH" },
  { id: "claude-haiku-4-5-20251001", name: "IdentifyAI's SH" },
];

interface APIResponse {
  content: string;
  hasToolUse: boolean;
  toolUse?: {
    type: "tool_use";
    id: string;
    name: string;
    input: ChartData;
  };
  chartData?: ChartData;
}

enum PORTFOLIO_TYPE {
  MASTER_ORIGINAL = "MASTER_ORIGINAL",
  MASTER_PROPOSED = "MASTER_PROPOSED",
}

const API_URL ="https://apis.weidentify.ai";

async function fetchCombinedCSVsByFirm(
  clientId: string,
  investmentBankerId: string,
  firmName: string,
  portfolioType: PORTFOLIO_TYPE
) {
  const formData = new FormData();
  formData.append("investment_banker_id", investmentBankerId);
  formData.append("portfolio_type", portfolioType);
  formData.append("firm_name", firmName);
  formData.append("client_id", clientId);
  const response = await axios.post(
    `${API_URL}/api/fetch-combined-csvs-by-firm`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return response.data;
}

interface MessageComponentProps {
  message: Message;
}

const SafeChartRenderer: React.FC<{ data: ChartData }> = ({ data }) => {
  try {
    return (
      <div className="w-full h-full p-6 flex flex-col">
        <div className="w-[90%] flex-1 mx-auto">
          <ChartRenderer data={data} />
        </div>
      </div>
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return (
      <div className="text-red-500">Error rendering chart: {errorMessage}</div>
    );
  }
};

const MessageComponent: React.FC<MessageComponentProps> = ({ message }) => {
  return (
    <div className="flex items-start gap-2">
      {message.role === "assistant" && (
        <Avatar className="w-8 h-8 border">
          <AvatarImage src="/ant-logo.svg" alt="AI Assistant Avatar" />
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
      )}
      <div
        className={`flex flex-col max-w-[75%] ${
          message.role === "user" ? "ml-auto" : ""
        }`}
      >
        <div
          className={`p-3 rounded-md text-[12px] ${
            message.role === "user"
              ? "bg-primary text-primary-foreground"
              : "bg-muted border"
          }`}
        >
          {message.content === "thinking" ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current flex-shrink-0" />
              <span className="text-[11px]">{message.status ?? "Thinking..."}</span>
            </div>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {message.content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
};

const ChartPagination = ({
  total,
  current,
  onDotClick,
}: {
  total: number;
  current: number;
  onDotClick: (index: number) => void;
}) => (
  <div className="fixed right-12 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-40">
    {Array.from({ length: total }).map((_, i) => (
      <button
        key={i}
        onClick={() => onDotClick(i)}
        className={`w-2 h-2 rounded-full transition-all ${
          i === current ? "bg-primary scale-125" : "bg-muted hover:bg-primary/50"
        }`}
      />
    ))}
  </div>
);

function normalizeIcf(v: any) {
  if (!v) return null;
  return v.icfMapping ? v.icfMapping : v;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AIChat() {
  const [icfObj, setIcfObj] = useState<any | null>(null);

  useEffect(() => {
    const fromLS = () => {
      try {
        const raw = localStorage.getItem("icfObj");
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return normalizeIcf(parsed);
      } catch {
        return null;
      }
    };

    const fromURL = () => {
      try {
        const search = window.location.search.startsWith("?")
          ? window.location.search.slice(1)
          : window.location.search;
        const params = new URLSearchParams(search);
        let enc = params.get("icf");
        if (!enc) {
          const hash = window.location.hash.startsWith("#")
            ? window.location.hash.slice(1)
            : window.location.hash;
          const qs = new URLSearchParams(hash);
          enc = qs.get("icf");
        }
        if (!enc) return null;
        const json = decodeURIComponent(enc);
        const parsed = JSON.parse(json);
        return normalizeIcf(parsed);
      } catch {
        return null;
      }
    };

    const urlVal = fromURL();
    if (urlVal) {
      localStorage.setItem("icfObj", JSON.stringify(urlVal));
      setIcfObj(urlVal);
      return;
    }

    const lsVal = fromLS();
    if (lsVal) setIcfObj(lsVal);

    const onStorage = (e: StorageEvent) => {
      if (e.key === "icfObj") {
        try {
          const next = e.newValue ? normalizeIcf(JSON.parse(e.newValue)) : null;
          setIcfObj(next);
        } catch {
          setIcfObj(null);
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const firmName = icfObj?.firm_name || "NA";
  const accountName = icfObj?.firm_account_name || "NA";
  const proposedCsv = icfObj?.csv_url_proposed || "";
  const pdfUrl = icfObj?.pdf_url || "";
  const clientId = String(icfObj?.client_id || "");
  const bankerId = String(icfObj?.investment_banker_id || "");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(
    "claude-sonnet-4-5-20250929"
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chartEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [currentUpload, setCurrentUpload] = useState<FileUpload | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [currentChartIndex, setCurrentChartIndex] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isScrollLocked, setIsScrollLocked] = useState(false);
  const resizableContainerRef = useRef<HTMLDivElement>(null);
  const [includeLiveData, setIncludeLiveData] = useState(false);

  const [portfolioJson, setPortfolioJson] = useState<any | null>(null);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const hasAutoInitialized = useRef(false);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [showConversationList, setShowConversationList] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const hasLoadedConversations = useRef(false);

  // Resizable panel state
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('leftPanelWidth');
      return saved ? parseFloat(saved) : 33.33; // Default to 33.33% (1/3)
    }
    return 33.33;
  });
  const [isResizing, setIsResizing] = useState(false);

  const loadConversation = useCallback(async (convId: string) => {
    setLoadingConversation(true);
    try {
      const res = await fetch(`/api/conversations/${convId}`);
      if (!res.ok) return;
      const data = await res.json();
      const loaded: Message[] = data.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        charts: Array.isArray(m.chartData)
          ? m.chartData
          : m.chartData
          ? [m.chartData]
          : undefined,
        hasToolUse: m.hasToolUse ?? false,
      }));
      setMessages(loaded);
      setConversationId(convId);
      hasAutoInitialized.current = true;
    } catch (err) {
      console.error("❌ loadConversation error:", err);
    } finally {
      setLoadingConversation(false);
    }
  }, []);

  const ensureConversation = useCallback(async (firstUserContent: string): Promise<string | null> => {
    if (conversationId) return conversationId;
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientId || "anonymous",
          bankerId: bankerId || "anonymous",
          firmName,
          accountName,
          title: firstUserContent.startsWith("Initialize memory")
            ? `Portfolio Analysis · ${new Date().toLocaleDateString()}`
            : firstUserContent.slice(0, 60) || "New Conversation",
        }),
      });
      if (!res.ok) return null;
      const conv = await res.json();
      setConversationId(conv.id);
      setConversations((prev) => [{ ...conv, _count: { messages: 0 } }, ...prev]);
      return conv.id;
    } catch (err) {
      console.error("❌ ensureConversation error:", err);
      return null;
    }
  }, [conversationId, clientId, bankerId, firmName, accountName]);

  const initializePromptDisplay = `Initialize memory and analyze data for ${accountName} at ${firmName}. (details hidden)`;

  const initializePromptHidden = useMemo(() => {
    const payload = {
      firmName,
      accountName,
      proposedCsv,
      pdfUrl,
      icfMapping: icfObj,
      portfolioData: portfolioJson,
      mappingDetails: {
        csv_url_master: icfObj?.csv_url_master,
        csv_url_proposed: icfObj?.csv_url_proposed,
        excel_ai_history_proposed: icfObj?.excel_ai_history_proposed,
        excel_ai_history_master: icfObj?.excel_ai_history_master,
        portfolio_s3_key: icfObj?.portfolio_s3_key,
        report_s3_key: icfObj?.report_s3_key,
        available_liquid_cash: icfObj?.available_liquid_cash,
        portfolio_status: icfObj?.portfolio_status,
        report_id: icfObj?.report_id,
        id: icfObj?.id,
        investment_banker_id: icfObj?.investment_banker_id,
        client_id: icfObj?.client_id,
      },
    };
    const lines: string[] = [];
    lines.push(`Initialize portfolio memory and analysis context for firm "${firmName}" and account "${accountName}".`);
    lines.push(`Always use the PROPOSED portfolio CSV.`);
    lines.push(`You are given a JSON payload containing combined portfolio data under "portfolioData". Ingest and normalize it.`);
    if (icfObj?.available_liquid_cash) {
      lines.push(`Available liquid cash: $${icfObj.available_liquid_cash.toLocaleString()}`);
    }
    if (icfObj?.portfolio_status) {
      lines.push(`Portfolio status: ${icfObj.portfolio_status}`);
    }
    lines.push(`Tasks:`);
    lines.push(`1) Summarize top holdings by weight and total value, and cash percentage.`);
    lines.push(`2) Build sector allocation and market-cap buckets.`);
    lines.push(`3) Produce three charts:`);
    lines.push(`   - Bar: Top 10 holdings by weight`);
    lines.push(`   - Pie: Sector allocation`);
    lines.push(`   - Area or Line: Portfolio value over time (if series present), else bar by asset class`);
    lines.push(`Return a concise summary and chart configs JSON for rendering.`);
    lines.push(`DATA JSON:`);
    lines.push(JSON.stringify(payload));
    return lines.join("\n");
  }, [firmName, accountName, proposedCsv, pdfUrl, icfObj, portfolioJson]);

  useEffect(() => {
    async function loadOnce() {
      if (!API_URL) return;
      if (!icfObj) return;
      if (!clientId || !bankerId || !firmName) return;
      if (portfolioJson) return;
      try {
        setLoadingPortfolio(true);
        setPortfolioError(null);
        const data = await fetchCombinedCSVsByFirm(
          clientId,
          bankerId,
          firmName,
          PORTFOLIO_TYPE.MASTER_PROPOSED
        );
        setPortfolioJson(data);
      } catch {
        setPortfolioError("Failed loading portfolio data");
      } finally {
        setLoadingPortfolio(false);
      }
    }
    loadOnce();
  }, [icfObj, clientId, bankerId, firmName, portfolioJson]);

  // Load prior conversations once icfObj is resolved
  useEffect(() => {
    if (!icfObj || !clientId || !bankerId) return;
    if (hasLoadedConversations.current) return;
    hasLoadedConversations.current = true;

    (async () => {
      try {
        const res = await fetch(`/api/conversations?clientId=${clientId}&bankerId=${bankerId}`);
        if (!res.ok) return;
        const convList: ConversationSummary[] = await res.json();
        setConversations(convList);
        if (convList.length > 0) {
          await loadConversation(convList[0].id);
        }
      } catch (err) {
        console.error("❌ bootstrap conversations error:", err);
      }
    })();
  }, [icfObj, clientId, bankerId, loadConversation]);

  // Auto-initialize chat when all data is ready
  useEffect(() => {
    // Only auto-initialize once per session and when all required data is available
    if (
      hasAutoInitialized.current ||
      !icfObj ||
      !proposedCsv ||
      !portfolioJson ||
      loadingPortfolio ||
      isLoading ||
      messages.length > 0 // Don't auto-initialize if there are already messages
    ) {
      return;
    }

    // Mark as initialized to prevent multiple calls
    hasAutoInitialized.current = true;
    
    // Trigger initialization automatically
    const autoInit = async () => {
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: initializePromptDisplay,
      };
      const thinkingMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "thinking",
      };
      setMessages([userMsg, thinkingMsg]);
      setIsLoading(true);
      const msgs = [{ role: "user", content: initializePromptHidden }];
      const convId = await ensureConversation(initializePromptDisplay);
      const body = {
        messages: msgs,
        model: selectedModel,
        icfMapping: icfObj,
        includeLiveData,
        portfolioData: portfolioJson ?? undefined,
        conversationId: convId,
      };
      try {
        await callFinanceStream(body);
      } catch (error) {
        console.error("Auto-initialization failed:", error);
        setMessages((prev) => {
          const out = [...prev];
          out[out.length - 1] = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "Initialization failed. Please try again.",
          };
          return out;
        });
        hasAutoInitialized.current = false;
      } finally {
        setIsLoading(false);
      }
    };

    // Small delay to ensure UI is ready
    const timer = setTimeout(() => {
      autoInit();
    }, 500);

    return () => clearTimeout(timer);
  }, [icfObj, proposedCsv, portfolioJson, loadingPortfolio, isLoading, messages.length, selectedModel, firmName, accountName, pdfUrl, includeLiveData, initializePromptHidden, initializePromptDisplay, ensureConversation]);

  useEffect(() => {
    const scrollToBottom = () => {
      if (!messagesEndRef.current) return;
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      });
    };
    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [messages, isLoading]);

  useEffect(() => {
    if (!messagesEndRef.current) return;
    const observer = new ResizeObserver(() => {
      if (!isScrollLocked) {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      }
    });
    observer.observe(messagesEndRef.current);
    return () => observer.disconnect();
  }, [isScrollLocked]);

  const handleChartScroll = useCallback(() => {
    if (!contentRef.current) return;
    const { scrollTop, clientHeight } = contentRef.current;
    const newIndex = Math.round(scrollTop / clientHeight);
    setCurrentChartIndex(newIndex);
  }, []);

  const scrollToChart = (index: number) => {
    if (!contentRef.current) return;
    const targetScroll = index * contentRef.current.clientHeight;
    contentRef.current.scrollTo({ top: targetScroll, behavior: "smooth" });
  };

  useEffect(() => {
    const scrollToNewestChart = () => {
      const totalCharts = messages.reduce((acc, m) => acc + (m.charts?.length ?? 0), 0);
      if (totalCharts > 0) {
        setCurrentChartIndex(totalCharts - 1);
        scrollToChart(totalCharts - 1);
      }
    };
    const hasAnyChart = messages.some((m) => m.charts?.length);
    if (hasAnyChart) {
      setTimeout(scrollToNewestChart, 100);
    }
  }, [messages]);

  // Save panel width to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('leftPanelWidth', leftPanelWidth.toString());
    }
  }, [leftPanelWidth]);

  // Handle resizing
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      if (!resizableContainerRef.current) return;
      
      const containerRect = resizableContainerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      
      // Constrain between 20% and 70%
      const constrainedWidth = Math.max(20, Math.min(70, newWidth));
      setLeftPanelWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    // Prevent text selection during drag
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', handleMouseMove, { passive: false });
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    let loadingToastRef: { dismiss: () => void } | undefined;
    if (file.type === "application/pdf") {
      loadingToastRef = toast({
        title: "Processing PDF",
        description: "Extracting text content...",
        duration: Infinity,
      });
    }
    try {
      const isImage = file.type.startsWith("image/");
      const isPDF = file.type === "application/pdf";
      let base64Data = "";
      let isText = false;
      if (isImage) {
        base64Data = await readFileAsBase64(file);
        isText = false;
      } else if (isPDF) {
        try {
          const pdfText = await readFileAsPDFText(file);
          base64Data = btoa(encodeURIComponent(pdfText));
          isText = true;
        } catch {
          toast({
            title: "PDF parsing failed",
            description: "Unable to extract text from the PDF",
            variant: "destructive",
          });
          return;
        }
      } else {
        try {
          const textContent = await readFileAsText(file);
          base64Data = btoa(encodeURIComponent(textContent));
          isText = true;
        } catch {
          toast({
            title: "Invalid file type",
            description: "File must be readable as text, PDF, or be an image",
            variant: "destructive",
          });
          return;
        }
      }
      setCurrentUpload({
        base64: base64Data,
        fileName: file.name,
        mediaType: isText ? "text/plain" : file.type,
        isText,
      });
      toast({
        title: "File uploaded",
        description: `${file.name} ready to analyze`,
      });
    } finally {
      setIsUploading(false);
      if (loadingToastRef) {
        loadingToastRef.dismiss();
        if (file.type === "application/pdf") {
          toast({
            title: "PDF Processed",
            description: "Text extracted successfully",
          });
        }
      }
    }
  };

  // Shared SSE stream consumer — updates the last message in real-time
  const callFinanceStream = useCallback(
    async (requestBody: object) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await fetch("/api/finance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) throw new Error(String(res.status));

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let pendingStream: { charts: ChartData[]; followUps: string[]; hasToolUse: boolean } | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            if (!part.startsWith("data: ")) continue;
            let event: any;
            try {
              event = JSON.parse(part.slice(6));
            } catch {
              continue;
            }

            if (event.type === "status") {
              setMessages((prev) => {
                const out = [...prev];
                out[out.length - 1] = { ...out[out.length - 1], status: event.message };
                return out;
              });
            } else if (event.type === "text") {
              setMessages((prev) => {
                const out = [...prev];
                const last = out[out.length - 1];
                out[out.length - 1] = {
                  ...last,
                  status: undefined,
                  content:
                    last.content === "thinking" ? event.text : last.content + event.text,
                };
                return out;
              });
            } else if (event.type === "chart") {
              pendingStream = {
                charts: event.charts ?? [],
                followUps: event.followUps ?? [],
                hasToolUse: !!event.hasToolUse,
              };
            } else if (event.type === "error") {
              throw new Error(event.error || "Streaming error");
            }
          }
        }

        // Apply charts and follow-ups after stream ends
        if (pendingStream) {
          setMessages((prev) => {
            const out = [...prev];
            out[out.length - 1] = {
              ...out[out.length - 1],
              hasToolUse: pendingStream!.hasToolUse,
              charts: pendingStream!.charts.length > 0 ? pendingStream!.charts : undefined,
              followUps: pendingStream!.followUps.length > 0 ? pendingStream!.followUps : undefined,
            };
            return out;
          });
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          // Finalize any partial/thinking message so the UI isn't stuck
          setMessages((prev) => {
            const out = [...prev];
            const last = out[out.length - 1];
            if (last?.role === "assistant") {
              out[out.length - 1] = {
                ...last,
                status: undefined,
                content: last.content === "thinking" ? "_(Stopped)_" : last.content,
              };
            }
            return out;
          });
          return;
        }
        throw err;
      } finally {
        abortControllerRef.current = null;
      }
    },
    [],
  );

  const handleAbort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleFollowUp = useCallback((question: string) => {
    setInput(question);
    textareaRef.current?.focus();
  }, []);

  const exportConversation = useCallback(() => {
    if (messages.length === 0) return;
    const title =
      conversations.find((c) => c.id === conversationId)?.title ?? "Conversation";
    const lines: string[] = [
      `# ${title}`,
      `_Exported ${new Date().toLocaleString()}_`,
      "",
    ];
    for (const msg of messages) {
      if (msg.content === "thinking") continue;
      lines.push(`### ${msg.role === "user" ? "You" : "Assistant"}`);
      lines.push(msg.content);
      for (const chart of msg.charts ?? []) {
        if (chart.config?.title) {
          lines.push("");
          lines.push(`_[Chart: ${chart.config.title}]_`);
        }
      }
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, conversations, conversationId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim() && !currentUpload) return;
    if (isLoading || isUploading) return;
    setIsScrollLocked(true);
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      file: currentUpload || undefined,
    };
    // Clear the current upload from the input UI as soon as the message is sent
    // so the file preview/logo above the chat doesn't persist after sending.
    setCurrentUpload(null);
    const thinkingMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "thinking",
    };
    setMessages((prev) => [...prev, userMessage, thinkingMessage]);
    setInput("");
    // Reset textarea height after clearing input
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = "44px"; // Reset to min height
    }
    setIsLoading(true);
    const apiMessages = [...messages, userMessage].map((msg) => {
      if (msg.file) {
        if (msg.file.isText) {
          const decodedText = decodeURIComponent(atob(msg.file.base64));
          return {
            role: msg.role,
            content: `File contents of ${msg.file.fileName}:\n\n${decodedText}\n\n${msg.content}`,
          };
        } else {
          return {
            role: msg.role,
            content: [
              {
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: msg.file.mediaType,
                  data: msg.file.base64,
                },
              },
              { type: "text" as const, text: msg.content },
            ],
          };
        }
      }
      return { role: msg.role, content: msg.content };
    });
    const convId = await ensureConversation(input);
    const requestBody = {
      messages: apiMessages,
      model: selectedModel,
      icfMapping: icfObj,
      includeLiveData,
      // Always pass portfolio data when available — the backend decides whether to use
      // it based on includeLiveData, avoiding a redundant re-fetch in either mode.
      portfolioData: portfolioJson ?? undefined,
      conversationId: convId,
    };
    try {
      await callFinanceStream(requestBody);
      setCurrentUpload(null);
    } catch {
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "I encountered an error. Please try again.",
        };
        return newMessages;
      });
    } finally {
      setIsLoading(false);
      setIsScrollLocked(false);
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isLoading || isUploading) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() || currentUpload) {
        const form = e.currentTarget.form;
        if (form) {
          const submitEvent = new Event("submit", {
            bubbles: true,
            cancelable: true,
          });
          form.dispatchEvent(submitEvent);
        }
      }
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = event.target;
    setInput(textarea.value);
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`;
  };

  const hasCharts = messages.some((m) => m.charts && m.charts.length > 0);

  const handleInitialize = async () => {
    if (!icfObj || !proposedCsv || !portfolioJson) {
      toast({
        title: "Missing data",
        description: "Required mapping or portfolio data not available",
        variant: "destructive",
      });
      return;
    }
    if (isLoading) return;
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: initializePromptDisplay,
    };
    const thinkingMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "thinking",
    };
    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setIsLoading(true);
    const msgs = [{ role: "user", content: initializePromptHidden }];
    const convId = await ensureConversation(initializePromptDisplay);
    const body = {
      messages: msgs,
      model: selectedModel,
      icfMapping: icfObj,
      includeLiveData,
      portfolioData: portfolioJson ?? undefined,
      conversationId: convId,
    };
    try {
      await callFinanceStream(body);
    } catch {
      setMessages((prev) => {
        const out = [...prev];
        out[out.length - 1] = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Initialization failed. Please try again.",
        };
        return out;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <TopNavBar
        features={{
          showDomainSelector: false,
          showViewModeSelector: false,
          showPromptCaching: false,
        }}
      />

      <div 
        ref={resizableContainerRef}
        className="flex-1 flex bg-background p-4 pt-0 h-[calc(100vh-4rem)] pb-40 resizable-container relative"
      >
        <Card 
          className="flex flex-col h-full transition-all mr-2"
          style={{ width: `calc(${leftPanelWidth}% - 0.5rem)` }}
        >
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div>
                  <CardTitle className="text-[14px]">Financial Assistant</CardTitle>
                  <CardDescription className="text-[11px]">
                    Powered by weidentify.ai
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={exportConversation}
                  disabled={messages.length === 0 || isLoading}
                  title="Export conversation as Markdown"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-8 text-[11px]">
                      {models.find((m) => m.id === selectedModel)?.name}
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {models.map((model) => (
                      <DropdownMenuItem
                        key={model.id}
                        onSelect={() => setSelectedModel(model.id)}
                      >
                        {model.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {conversations.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-7 text-[11px] px-2 max-w-[200px]"
                      disabled={loadingConversation}
                    >
                      {loadingConversation ? (
                        <div className="flex items-center gap-1.5">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current flex-shrink-0" />
                          <span>Loading...</span>
                        </div>
                      ) : (
                        <>
                          <span className="truncate">
                            {conversations.find((c) => c.id === conversationId)?.title ?? "History"}
                          </span>
                          <ChevronDown className="ml-1 h-3 w-3 flex-shrink-0" />
                        </>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[260px]">
                    {conversations.map((c) => (
                      <DropdownMenuItem
                        key={c.id}
                        onSelect={() => loadConversation(c.id)}
                        className={`flex flex-col items-start gap-0.5 py-2 ${c.id === conversationId ? "bg-muted" : ""}`}
                      >
                        <span className={`text-[11px] truncate w-full ${c.id === conversationId ? "font-semibold" : ""}`}>
                          {c.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {relativeTime(c.updatedAt)} · {c._count.messages} messages
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  className="h-7 text-[11px] px-2 flex-shrink-0"
                  disabled={loadingConversation}
                  onClick={() => {
                    setMessages([]);
                    setConversationId(null);
                    hasAutoInitialized.current = true; // keep true so auto-init doesn't fire; user starts fresh manually
                  }}
                >
                  + New
                </Button>
              </div>
            )}
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 scroll-smooth snap-y snap-mandatory">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full animate-fade-in-up max-w-[95%] mx-auto">
                <h2 className="text-[16px] mb-6">
                  Identify AI's Financial Assistant
                </h2>
                <div className="w-full max-w-sm mx-auto border rounded-lg p-4 mb-6">
                  <div className="text-[12px] mb-2">
                    Initialize data for{" "}
                    <span className="font-medium">{accountName}</span> at{" "}
                    <span className="font-medium">{firmName}</span>
                  </div>
                  <Button
                    className="w-full text-[11px]"
                    onClick={handleInitialize}
                    disabled={
                      !icfObj ||
                      !proposedCsv ||
                      !portfolioJson ||
                      loadingPortfolio ||
                      isLoading
                    }
                  >
                    {loadingPortfolio
                      ? "Loading Portfolio..."
                      : "Initialize and Analyze (Proposed)"}
                  </Button>
                  {portfolioError ? (
                    <div className="text-[11px] text-red-500 mt-2">
                      {portfolioError}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-6 text-[12px]">
                  <div className="flex items-center gap-3">
                    <ChartArea className="text-muted-foreground w-6 h-6" />
                    <p className="text-muted-foreground">
                      I can analyze financial data and create visualizations
                      from your files.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <FileInput className="text-muted-foreground w-6 h-6" />
                    <p className="text-muted-foreground">
                      Upload CSVs, PDFs, or images and I&apos;ll help you
                      understand the data.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <MessageCircleQuestion className="text-muted-foreground w-6 h-6" />
                    <p className="text-muted-foreground">
                      Ask questions about your financial data and I&apos;ll
                      create insightful charts.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 min-h-full">
                {messages.map((message, index) => (
                  <div
                    key={message.id}
                    className={`animate-fade-in-up ${
                      message.content === "thinking" ? "animate-pulse" : ""
                    }`}
                  >
                    <MessageComponent message={message} />
                    {message.role === "assistant" &&
                      message.followUps &&
                      message.followUps.length > 0 &&
                      index === messages.length - 1 &&
                      !isLoading && (
                        <div className="flex flex-wrap gap-1.5 mt-2 ml-10">
                          {message.followUps.map((q, i) => (
                            <button
                              key={i}
                              onClick={() => handleFollowUp(q)}
                              className="text-[11px] border rounded-full px-3 py-1 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                ))}
                <div ref={messagesEndRef} className="h-4" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resizable divider */}
        <div
          className={`w-1 bg-border hover:bg-primary/50 cursor-col-resize transition-colors relative group flex-shrink-0 select-none ${
            isResizing ? 'bg-primary' : ''
          }`}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsResizing(true);
          }}
          style={{ userSelect: 'none' }}
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-8 -ml-4 flex items-center justify-center pointer-events-none">
            <div className="w-1 h-12 bg-muted-foreground/30 rounded-full group-hover:bg-primary/50 transition-colors" />
          </div>
        </div>

        <Card 
          className="flex flex-col h-full overflow-hidden transition-all ml-2"
          style={{ width: `calc(${100 - leftPanelWidth}% - 0.5rem)` }}
        >
          {hasCharts && (
            <CardHeader className="py-3 px-4 shrink-0">
              <CardTitle className="text-h6">Analysis & Visualizations</CardTitle>
            </CardHeader>
          )}

          <CardContent
            ref={contentRef}
            className="flex-1 overflow-y-auto min-h-0 snap-y snap-mandatory"
            onScroll={handleChartScroll}
          >
            {hasCharts ? (
              <div className="min-h-full flex flex-col">
                {(() => {
                  const flatCharts: { chart: ChartData; key: string }[] = [];
                  messages.forEach((message, msgIdx) => {
                    (message.charts ?? []).forEach((chart, cIdx) => {
                      flatCharts.push({ chart, key: `chart-${msgIdx}-${cIdx}` });
                    });
                  });
                  return flatCharts.map(({ chart, key }, idx) => (
                    <div
                      key={key}
                      className="w-full min-h-full flex-shrink-0 snap-start snap-always"
                      ref={idx === flatCharts.length - 1 ? chartEndRef : null}
                    >
                      <SafeChartRenderer data={chart} />
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="flex flex-col items-center justify-center gap-4 -translate-y-8">
                  <ChartColumnBig className="w-8 h-8 text-muted-foreground" />
                  <div className="space-y-2">
                    <CardTitle className="text-h6">
                      Analysis & Visualizations
                    </CardTitle>
                    <CardDescription className="text-body1">
                      Charts and detailed analysis will appear here as you chat
                    </CardDescription>
                    <div className="flex flex-wrap justify-center gap-2 mt-4">
                      <Badge variant="outline">Bar Charts</Badge>
                      <Badge variant="outline">Area Charts</Badge>
                      <Badge variant="outline">Linear Charts</Badge>
                      <Badge variant="outline">Pie Charts</Badge>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {hasCharts && (
        <ChartPagination
          total={messages.reduce((acc, m) => acc + (m.charts?.length ?? 0), 0)}
          current={currentChartIndex}
          onDotClick={scrollToChart}
        />
      )}

      <form
        onSubmit={handleSubmit}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 
                   w-[90%] max-w-4xl bg-background border rounded-xl shadow-lg
                   z-50"
      >
        <div className="flex flex-col gap-2">
          {/* Live Data Toggle */}
          <div className="flex items-center justify-end gap-2 px-3 pt-3">
            <label htmlFor="live-data-toggle" className="text-[11px] text-muted-foreground cursor-pointer">
              Include Live Data
            </label>
            <Switch
              id="live-data-toggle"
              checked={includeLiveData}
              onCheckedChange={setIncludeLiveData}
              disabled={isLoading || isUploading}
            />
          </div>

          {currentUpload && (
            <div className="w-full">
              <FilePreview
                file={currentUpload}
                onRemove={() => setCurrentUpload(null)}
              />
            </div>
          )}

          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isUploading}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8"
              >
                <Paperclip className="h-5 w-5" />
              </Button>

              <Textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  isLoading || isUploading
                    ? "Please wait while your request is processing..."
                    : "Type your message..."
                }
                disabled={isLoading || isUploading}
                className="min-h-[44px] max-h-[200px] resize-none pl-12 py-3 pr-12 rounded-lg border focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition"
                rows={1}
              />

              {isLoading ? (
                <Button
                  type="button"
                  onClick={handleAbort}
                  className="absolute right-2 bottom-2 h-8 w-8 rounded-full p-0 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  title="Stop generating"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isUploading || (!input.trim() && !currentUpload)}
                  className="absolute right-2 bottom-2 h-8 w-8 rounded-full p-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {(isUploading || isLoading) && (
            <div className="flex items-center gap-2 px-3 pb-3 text-subtitle1 text-muted-foreground">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-muted-foreground" />
              <span>
                {isUploading
                  ? "Processing your file..."
                  : "Generating your financial analysis..."}
              </span>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
