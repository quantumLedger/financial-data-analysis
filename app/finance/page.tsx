"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo, memo, useImperativeHandle, forwardRef, startTransition } from "react";
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
  FileText,
  FileDown,
  Maximize2,
  BarChart3,
  LineChart,
  PieChart,
  Table2,
  ScrollText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ContentModal } from "@/components/ContentModal";
import { PanelResizer } from "@/components/PanelResizer";
import { FullPageLoader } from "@/components/FullPageLoader";
import { MessageDetailContent } from "@/components/MessageDetailContent";
import {
  sanitizeMessageForDisplay,
  messageHasExpandableDetail,
  getReadMoreLabel,
  isTrivialGreetingMessage,
} from "@/lib/messageDisplay";
import FilePreview from "@/components/FilePreview";
import { ChartRenderer } from "@/components/ChartRenderer";
import { DataTableRenderer } from "@/components/DataTableRenderer";
import { MemoRenderer } from "@/components/MemoRenderer";
import { NarrativeCard } from "@/components/NarrativeCard";
import { toast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import type { ChartData, TableData, MemoData, NarrativeData } from "@/types/chart";
import TopNavBar from "@/components/TopNavBar";
import {
  readFileAsText,
  readFileAsBase64,
  readFileAsPDFText,
} from "@/utils/fileHandling";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const mdComponents: Components = {
  // Headings: 16px
  h1: ({ node, ...props }) => <h1 className="text-[16px] font-semibold mt-3 mb-2" {...props} />,
  h2: ({ node, ...props }) => <h2 className="text-[16px] font-semibold mt-3 mb-2" {...props} />,
  // Subheadings: 14px
  h3: ({ node, ...props }) => <h3 className="text-[14px] font-medium mt-2 mb-1" {...props} />,
  h4: ({ node, ...props }) => <h4 className="text-[14px] font-medium mt-2 mb-1" {...props} />,
  h5: ({ node, ...props }) => <h5 className="text-[14px] font-medium mt-2 mb-1" {...props} />,
  h6: ({ node, ...props }) => <h6 className="text-[14px] font-medium mt-2 mb-1" {...props} />,
  // Content: 13.5px (matches fin-sight-front chat bot body)
  p: ({ node, ...props }) => <p className="text-[13.5px] my-1" {...props} />,
  ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-2 text-[13.5px]" {...props} />,
  ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-2 text-[13.5px]" {...props} />,
  li: ({ node, ...props }) => <li className="text-[13.5px]" {...props} />,
  table: ({ node, ...props }) => (
    <div className="overflow-x-auto my-3">
      <table className="w-full border-collapse text-[13.5px]" {...props} />
    </div>
  ),
  th: ({ node, ...props }) => (
    <th className="border px-2 py-1 text-left bg-background/50 text-[13.5px] font-medium" {...props} />
  ),
  td: ({ node, ...props }) => (
    <td className="border px-2 py-1 align-top text-[13.5px]" {...props} />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote className="border-l-4 pl-3 italic text-[13.5px] opacity-90 my-2" {...props} />
  ),
  // @ts-ignore — react-markdown passes `inline`; TS inference complains
  code({ node, inline, className, children, ...props }) {
    if (inline) {
      return (
        <code className="bg-background/50 px-1 py-0.5 rounded text-[11px]" {...props}>
          {children}
        </code>
      );
    }
    return (
  <pre {...(props as React.HTMLAttributes<HTMLPreElement>)} className="bg-background/50 p-3 rounded overflow-x-auto overflow-y-hidden max-w-full my-2 text-[11px] whitespace-pre-wrap break-words">
        <code className={className}>{children}</code>
      </pre>
    );
  },
};

interface Message {
  id: string;
  role: string;
  content: string;
  timestamp?: string; // ISO string set at creation time
  status?: string; // pre-stream status shown with spinner before first token
  hasToolUse?: boolean;
  file?: {
    base64: string;
    fileName: string;
    mediaType: string;
    isText?: boolean;
  };
  charts?: ChartData[];
  tables?: TableData[];
  memos?: MemoData[];
  narratives?: NarrativeData[];
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
  /** One-line hint for when to use this model */
  description: string;
};

interface FileUpload {
  base64: string;
  fileName: string;
  mediaType: string;
  isText?: boolean;
  fileSize?: number;
}

const models: Model[] = [
  {
    id: "claude-opus-4-7",
    name: "Inspolio's Opus 4.7",
    description: "Highest capability for the hardest analysis; slower and higher cost.",
  },
  {
    id: "claude-sonnet-4-6",
    name: "Inspolio's Sonnet 4.6",
    description: "Best default. Strong quality with fast responses for most finance work.",
  },
  {
    id: "claude-haiku-4-5-20251001",
    name: "Inspolio's Haiku 4.5",
    description: "Fastest answers for quick questions, edits, and lighter tasks.",
  },
];

enum PORTFOLIO_TYPE {
  MASTER_ORIGINAL = "MASTER_ORIGINAL",
  MASTER_PROPOSED = "MASTER_PROPOSED",
}

import { WEIDENTIFY_API_URL } from '@/lib/config';
import {
  ASSISTANT_NAME,
  ASSISTANT_ERROR_MESSAGE,
  finalizeAssistantMessage,
  resolveAssistantDisplayContent,
} from '@/lib/assistantMessage';

const API_URL = WEIDENTIFY_API_URL;

// Goes through our own /api/portfolio/combined-csvs BFF so the X-Internal-Key
// shared secret stays server-side. The browser must never touch
// apis.weidentify.ai directly \u2014 it has neither the secret nor a Cognito token.
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
    `/api/portfolio/combined-csvs`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return response.data;
}

interface MessageComponentProps {
  message: Message;
}

const SafeChartRenderer = memo(function SafeChartRenderer({ data }: { data: ChartData }) {
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
});

const MAX_MSG_HEIGHT = 400;
const QUERY_TRUNCATE_LEN = 140;

const VISUALIZATION_FEATURES: {
  icon: LucideIcon;
  title: string;
  description: string;
}[] = [
  {
    icon: BarChart3,
    title: "Bar Charts",
    description:
      "AI ranks your largest stock positions and sector weights in a clear side-by-side view.",
  },
  {
    icon: ChartArea,
    title: "Area Charts",
    description:
      "See how your equity portfolio value and allocation evolve over time, built from your holdings data.",
  },
  {
    icon: LineChart,
    title: "Linear Charts",
    description:
      "AI traces performance trends across your stocks to highlight momentum, dips, and turning points.",
  },
  {
    icon: PieChart,
    title: "Pie Charts",
    description:
      "Get an instant AI snapshot of how your portfolio is distributed across sectors and asset classes.",
  },
  {
    icon: Table2,
    title: "Data Tables",
    description:
      "AI structures your holdings, weights, and key metrics into exportable tables from portfolio files.",
  },
  {
    icon: ScrollText,
    title: "Memos and Narratives",
    description:
      "Receive AI-drafted investment memos and narrative summaries written around your stock portfolio.",
  },
];

function RectLoader({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass =
    size === "sm" ? "h-3 w-3" : size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <span
      className={`inline-block shrink-0 rounded-[2px] border-2 border-muted-foreground/20 border-t-muted-foreground animate-spin ${sizeClass} ${className}`}
      aria-hidden
    />
  );
}

function truncateQuery(text: string, max = QUERY_TRUNCATE_LEN): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Portfolio analysis";
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max);
}

function getQueryForMessageIndex(messages: Message[], msgIdx: number): string {
  for (let i = msgIdx; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role === "user" && msg.content && msg.content !== "thinking") {
      return msg.content;
    }
  }
  return "Portfolio analysis";
}

const MessageComponent = memo(function MessageComponent({
  message,
  isCollapsed = false,
  isOldMessage = false,
  messageIndex = 0,
  totalMessages = 0,
}: MessageComponentProps & {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isOldMessage?: boolean;
  messageIndex?: number;
  totalMessages?: number;
}) {
  const isUser = message.role === "user";
  const isThinking = message.content === "thinking";
  const [readMoreOpen, setReadMoreOpen] = useState(false);
  const [readMoreLoading, setReadMoreLoading] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const bubbleInnerRef = useRef<HTMLDivElement>(null);
  const speakerLabel = isUser ? "You" : ASSISTANT_NAME;

  const displayContent = useMemo(
    () => (isThinking ? message.content : sanitizeMessageForDisplay(message.content)),
    [message.content, isThinking]
  );
  const expandable = useMemo(
    () => !isThinking && messageHasExpandableDetail(message.content),
    [message.content, isThinking]
  );
  const readMoreLabel = useMemo(
    () => getReadMoreLabel(message.content),
    [message.content]
  );

  const openReadMore = useCallback(() => {
    setReadMoreLoading(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        startTransition(() => {
          setReadMoreOpen(true);
          setReadMoreLoading(false);
        });
      });
    });
  }, []);

  const timeStr = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  // Detect if bubble content overflows the cap
  useEffect(() => {
    const el = bubbleInnerRef.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollHeight > MAX_MSG_HEIGHT + 8);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [displayContent]);

  /* ── shared bubble + expand/collapse ── */
  const bubble = (
    <div className="relative w-full">
      <div
        ref={bubbleInnerRef}
        style={{ maxHeight: MAX_MSG_HEIGHT }}
        className={`overflow-hidden px-3 py-2.5 rounded-lg leading-relaxed break-words ${
          isUser
            ? "bg-primary text-primary-foreground text-[11px]"
            : "bg-muted/60 border backdrop-blur-sm text-[13.5px]"
        }`}
      >
        {isThinking ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <RectLoader />
            <span className="text-[11px]">{message.status ?? "Thinking"}</span>
          </div>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {displayContent}
          </ReactMarkdown>
        )}
      </div>

      {(overflows || expandable) && !readMoreOpen && (
        <div
          className={`absolute bottom-0 left-0 right-0 h-14 flex items-end justify-center pb-2 rounded-b-lg bg-gradient-to-t to-transparent ${
            isUser ? "from-primary/90" : "from-muted/95"
          }`}
        >
          <button
            type="button"
            onClick={openReadMore}
            className="text-[10px] font-semibold px-3 py-1 rounded-full border border-black bg-black text-white hover:bg-neutral-800 shadow-sm transition-colors"
          >
            {readMoreLabel}
          </button>
        </div>
      )}
    </div>
  );

  const bubbleBlock = (
    <>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold text-foreground">{speakerLabel}</span>
        {!isThinking && (
          <span className="text-[9px] text-muted-foreground/55">{timeStr}</span>
        )}
      </div>
      {bubble}
      {expandable && !overflows && !readMoreOpen && (
        <button
          type="button"
          onClick={openReadMore}
          className="mt-1.5 self-center text-[10px] font-semibold px-3 py-1 rounded-full border border-black bg-black text-white hover:bg-neutral-800 shadow-sm transition-colors"
        >
          {readMoreLabel}
        </button>
      )}
      <FullPageLoader open={readMoreLoading} message="Loading your message" />
      <ContentModal
        open={readMoreOpen}
        onClose={() => setReadMoreOpen(false)}
        title={speakerLabel}
        subtitle={timeStr}
      >
        {readMoreOpen ? (
          <MessageDetailContent
            content={message.content}
            isThinking={isThinking}
            status={message.status}
          />
        ) : null}
      </ContentModal>
    </>
  );

  if (isUser) {
    return (
      <div className={`flex justify-end ${isCollapsed && isOldMessage && messageIndex < totalMessages - 5 ? "opacity-60" : ""}`}>
        <div className="flex flex-col min-w-0 w-[70%] min-w-[70%] max-w-[70%]">
          {bubbleBlock}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex justify-start w-full ${isCollapsed && isOldMessage && messageIndex < totalMessages - 5 ? "opacity-60" : ""}`}>
      <div className="flex flex-col min-w-0 w-full max-w-full">
        {bubbleBlock}
      </div>
    </div>
  );
});

type PanelItem =
  | { type: "chart"; data: ChartData; key: string; title: string; query: string }
  | { type: "table"; data: TableData; key: string; title: string; query: string }
  | { type: "memo"; data: MemoData; key: string; title: string; query: string }
  | { type: "narrative"; data: NarrativeData; key: string; title: string; query: string };

function renderVisualizationContent(item: PanelItem, expanded = false) {
  const pad = expanded ? "p-2" : "p-6";
  const width = expanded ? "w-full" : "w-[90%]";
  switch (item.type) {
    case "chart":
      return (
        <div className={`w-full h-full ${pad} flex flex-col`}>
          <div className={`${width} flex-1 mx-auto`}>
            <SafeChartRenderer data={item.data} />
          </div>
        </div>
      );
    case "table":
      return (
        <div className={`w-full h-full ${pad} flex flex-col`}>
          <div className={`${width} mx-auto`}>
            <DataTableRenderer data={item.data} />
          </div>
        </div>
      );
    case "memo":
      return (
        <div className={`w-full h-full ${pad} flex flex-col`}>
          <div className={`${width} flex-1 mx-auto`}>
            <MemoRenderer data={item.data} />
          </div>
        </div>
      );
    case "narrative":
      return (
        <div className={`w-full h-full ${pad} flex flex-col`}>
          <div className={`${width} mx-auto`}>
            <NarrativeCard data={item.data} />
          </div>
        </div>
      );
  }
}

const VisualizationPanel = memo(function VisualizationPanel({
  items,
  onScroll,
  contentRef,
  chartEndRef,
}: {
  items: PanelItem[];
  onScroll: () => void;
  contentRef: React.RefObject<HTMLDivElement>;
  chartEndRef: React.RefObject<HTMLDivElement>;
}) {
  const [expandedItem, setExpandedItem] = useState<PanelItem | null>(null);

  return (
    <>
      <CardContent
        ref={contentRef}
        className="flex-1 overflow-y-auto min-h-0 snap-y snap-mandatory pb-20 relative z-[6]"
        onScroll={onScroll}
      >
        <div className="min-h-full flex flex-col">
          {items.map((item, idx) => (
            <div
              key={item.key}
              className="relative w-full min-h-full flex-shrink-0 snap-start snap-always flex flex-col"
              ref={idx === items.length - 1 ? chartEndRef : null}
            >
              <div className="flex shrink-0 items-center gap-2 border-b border-border/70 bg-background px-3 py-1.5 z-10">
                <p
                  className="min-w-0 flex-1 truncate text-[9px] text-muted-foreground"
                  title={item.query}
                >
                  {truncateQuery(item.query, 120)}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 shrink-0 bg-background shadow-sm"
                  title="Expand view"
                  onClick={() => setExpandedItem(item)}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                {renderVisualizationContent(item)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <ContentModal
        open={expandedItem != null}
        onClose={() => setExpandedItem(null)}
        title={expandedItem?.title ?? "Visualization"}
        subtitle={
          expandedItem
            ? `Query: ${truncateQuery(expandedItem.query)}`
            : undefined
        }
        className="max-w-5xl"
      >
        {expandedItem ? renderVisualizationContent(expandedItem, true) : null}
      </ContentModal>
    </>
  );
});

export type ChatInputHandle = {
  setText: (text: string) => void;
  focus: () => void;
};

const ChatInputBar = memo(
  forwardRef<
    ChatInputHandle,
    {
      isLoading: boolean;
      isUploading: boolean;
      includeLiveData: boolean;
      onIncludeLiveDataChange: (value: boolean) => void;
      currentUpload: FileUpload | null;
      onRemoveUpload: () => void;
      onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
      onSubmit: (text: string) => void;
      onAbort: () => void;
    }
  >(function ChatInputBar(
    {
      isLoading,
      isUploading,
      includeLiveData,
      onIncludeLiveDataChange,
      currentUpload,
      onRemoveUpload,
      onFileSelect,
      onSubmit,
      onAbort,
    },
    ref
  ) {
    const [input, setInput] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      setText: (text: string) => {
        setInput(text);
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.style.height = "auto";
          textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
        }
      },
      focus: () => textareaRef.current?.focus(),
    }));

    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const textarea = event.target;
      setInput(textarea.value);
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (isLoading || isUploading) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (input.trim() || currentUpload) {
          onSubmit(input);
          setInput("");
          if (textareaRef.current) {
            textareaRef.current.style.height = "36px";
          }
        }
      }
    };

    const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!input.trim() && !currentUpload) return;
      if (isLoading || isUploading) return;
      onSubmit(input);
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "36px";
      }
    };

    return (
      <form
        onSubmit={handleFormSubmit}
        className="absolute bottom-5 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl z-50"
      >
        {currentUpload && (
          <div className="mb-2 px-1">
            <FilePreview file={currentUpload} onRemove={onRemoveUpload} />
          </div>
        )}

        <div className="rounded-lg relative">
          {(isLoading || isUploading) && (
            <div className="absolute inset-0 z-10 rounded-lg bg-white/80 backdrop-blur-[2px] flex items-center justify-center">
              <Button
                type="button"
                onClick={onAbort}
                size="sm"
                className="h-8 px-4 rounded-full bg-black hover:bg-neutral-800 text-white text-[11px] font-semibold flex items-center gap-1.5 shadow-md"
                title="Stop generating"
              >
                <Square className="h-3 w-3 fill-current" />
                Stop
              </Button>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white rounded-lg shadow-sm border border-neutral-800">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isUploading}
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              title="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                isLoading
                  ? "Generating analysis"
                  : isUploading
                    ? "Processing file"
                    : "Ask a question about your portfolio"
              }
              readOnly={isLoading || isUploading}
              className="flex-1 min-h-[36px] max-h-[160px] resize-none border-0 bg-transparent shadow-none py-2 px-1 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              rows={1}
            />

            {(isLoading || isUploading) && (
              <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">
                <RectLoader size="sm" />
                {isUploading ? "Uploading file" : "Analyzing request"}
              </div>
            )}

            <div className="h-5 w-px bg-border shrink-0" />

            <div className="flex items-center gap-1 shrink-0">
              <label
                htmlFor="live-data-toggle"
                className="text-[10px] text-muted-foreground cursor-pointer whitespace-nowrap"
              >
                Live data
              </label>
              <Switch
                id="live-data-toggle"
                checked={includeLiveData}
                onCheckedChange={onIncludeLiveDataChange}
                className="scale-75 origin-right"
              />
            </div>

            <Button
              type="submit"
              size="icon"
              disabled={isLoading || isUploading || (!input.trim() && !currentUpload)}
              className="h-8 w-8 rounded-full shrink-0"
              title="Send"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={onFileSelect}
        />
      </form>
    );
  })
);

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

// Default ICF mapping to use when no params are provided
const DEFAULT_ICF_MAPPING = {
  csv_url_master: "identify-ai/ROTHSCHILD/investment-banker-id-11/client-id-35/icf_mapping_id_74_PortfolioTypeEnum.MASTER_ORIGINAL.csv",
  report_s3_key: null,
  csv_url_proposed: "identify-ai/ROTHSCHILD/investment-banker-id-11/client-id-35/icf_mapping_id_74_PortfolioTypeEnum.MASTER_ORIGINAL.csv",
  excel_ai_history_proposed: "",
  version_id: "NA",
  excel_ai_history_master: "",
  firm_name: "ROTHSCHILD",
  created_at: "2026-01-15T16:29:38",
  investment_banker_id: 11,
  status: "completed",
  updated_at: "2026-01-24T03:44:15",
  id: 74,
  available_liquid_cash: 0.0,
  portfolio_s3_key: null,
  client_id: 35,
  firm_account_name: "00099",
  portfolio_status: "NOT_STARTED",
  pdf_url: "identify.ai/investment_banker_11/client_id_35/firm_ROTHSCHILD/00099-pages-4-5-2026-01-15-16-29.pdf",
  report_id: "d9cebd7f-ed25-4fd6-b4d4-ce83b1850192"
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AIChat() {
  const [icfObj, setIcfObj] = useState<any | null>(null);

  useEffect(() => {
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
        if (!enc) {
          return null;
        }
        const json = decodeURIComponent(enc);
        const parsed = JSON.parse(json);
        const normalized = normalizeIcf(parsed);
        return normalized;
      } catch (error) {
        console.error('[ERROR] Failed to parse ICF from URL:', error);
        return null;
      }
    };

    const updateIcfFromURL = () => {
      const urlVal = fromURL();
      if (urlVal) {
        setIcfObj(urlVal);
      } else {
        setIcfObj(DEFAULT_ICF_MAPPING);
      }
    };

    // Initial load
    updateIcfFromURL();

    // Listen for hash changes to update ICF when URL changes
    const onHashChange = () => {
      updateIcfFromURL();
    };
    
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Use icfObj or default mapping
  const effectiveIcfObj = icfObj || DEFAULT_ICF_MAPPING;
  
  const firmName = effectiveIcfObj?.firm_name || "NA";
  const accountName = effectiveIcfObj?.firm_account_name || "NA";
  const proposedCsv = effectiveIcfObj?.csv_url_proposed || "";
  const pdfUrl = effectiveIcfObj?.pdf_url || "";
  const clientId = String(effectiveIcfObj?.client_id || "");
  const bankerId = String(effectiveIcfObj?.investment_banker_id || "");

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-6");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chartEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputHandle>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [currentUpload, setCurrentUpload] = useState<FileUpload | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [currentChartIndex, setCurrentChartIndex] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const resizableContainerRef = useRef<HTMLDivElement>(null);
  const [includeLiveData, setIncludeLiveData] = useState(true);

  const [portfolioJson, setPortfolioJson] = useState<any | null>(null);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const hasAutoInitialized = useRef(false);
  /** Synchronous guard that prevents a second request starting while one is in flight,
   *  even if React hasn't flushed the isLoading state update yet. */
  const isInFlightRef = useRef(false);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [showConversationList, setShowConversationList] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const hasLoadedConversations = useRef(false);
  // Resizable panel state
  // Always start with the SSR default so server and client HTML match.
  // The saved preference is applied after mount to avoid hydration mismatch.
  const [leftPanelWidth, setLeftPanelWidth] = useState(33.33);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRafRef = useRef<number | null>(null);
  const pendingPanelWidthRef = useRef(33.33);

  const loadConversation = useCallback(async (convId: string) => {
    setLoadingConversation(true);
    try {
      const res = await fetch(`/api/conversations/${convId}`);
      if (!res.ok) return;
      const data = await res.json();
      const loaded: Message[] = data.messages.map((m: any) => {
        const charts = Array.isArray(m.chartData) ? m.chartData : m.chartData ? [m.chartData] : undefined;
        const tables = Array.isArray(m.tableData) ? m.tableData : undefined;
        const memos = Array.isArray(m.memoData) ? m.memoData : undefined;
        const narratives = Array.isArray(m.narrativeData) ? m.narrativeData : undefined;
        const visualPayload = { charts, tables, memos, narratives };
        const content =
          m.role === "assistant"
            ? resolveAssistantDisplayContent(m.content, visualPayload) || m.content
            : m.content;
        return {
          id: m.id,
          role: m.role,
          content,
          charts,
          tables,
          memos,
          narratives,
          hasToolUse: m.hasToolUse ?? false,
        };
      });
      setMessages(
        loaded.filter(
          (m) => m.content === "thinking" || !(m.role === "user" && isTrivialGreetingMessage(m.content))
        )
      );
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
            ? `Portfolio Analysis for ${new Date().toLocaleDateString()}`
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

  const initializePromptDisplay = `Initialize portfolio data for the selected client and firm. Client: ${accountName}. Firm name: ${firmName}.`;

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
      if (!clientId || !bankerId || !firmName || firmName === "NA") return;
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
        setPortfolioError("Portfolio data could not be loaded. Please try again.");
      } finally {
        setLoadingPortfolio(false);
      }
    }
    loadOnce();
  }, [clientId, bankerId, firmName, portfolioJson]);


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
    if (isInFlightRef.current) return;

    // Trigger initialization automatically
    const autoInit = async () => {
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: initializePromptDisplay,
        timestamp: new Date().toISOString(),
      };
      const thinkingMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "thinking",
        timestamp: new Date().toISOString(),
      };
      setMessages([userMsg, thinkingMsg]);
      isInFlightRef.current = true;
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
            ...out[out.length - 1],
            role: "assistant",
            status: undefined,
            content: ASSISTANT_ERROR_MESSAGE,
          };
          return out;
        });
        hasAutoInitialized.current = false;
      } finally {
        isInFlightRef.current = false;
        setIsLoading(false);
        setMessages((prev) => {
          const out = [...prev];
          const finalized = finalizeAssistantMessage(out[out.length - 1]);
          if (finalized) out[out.length - 1] = finalized as Message;
          return out;
        });
      }
    };

    // Small delay to ensure UI is ready
    const timer = setTimeout(() => {
      autoInit();
    }, 500);

    return () => clearTimeout(timer);
  }, [icfObj, proposedCsv, portfolioJson, loadingPortfolio, isLoading, messages.length, selectedModel, firmName, accountName, pdfUrl, includeLiveData, initializePromptHidden, initializePromptDisplay, ensureConversation]);

  const scrollChatToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = chatScrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior });
    });
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => scrollChatToBottom("smooth"), 50);
    return () => clearTimeout(timeoutId);
  }, [messages, isLoading, scrollChatToBottom]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const inner = el.querySelector("[data-chat-messages]");
    if (!inner) return;
    const observer = new ResizeObserver(() => {
      scrollChatToBottom("smooth");
    });
    observer.observe(inner);
    return () => observer.disconnect();
  }, [scrollChatToBottom, messages.length]);

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
      const totalItems = messages.reduce(
        (acc, m) =>
          acc + (m.charts?.length ?? 0) + (m.tables?.length ?? 0) +
          (m.memos?.length ?? 0) + (m.narratives?.length ?? 0),
        0
      );
      if (totalItems > 0) {
        setCurrentChartIndex(totalItems - 1);
        scrollToChart(totalItems - 1);
      }
    };
    const hasAnyChart = messages.some(
        (m) => m.charts?.length || m.tables?.length || m.memos?.length || m.narratives?.length
      );
    if (hasAnyChart) {
      setTimeout(scrollToNewestChart, 100);
    }
  }, [messages]);

  // Restore saved panel width after mount (client only — avoids SSR hydration mismatch)
  useEffect(() => {
    const saved = localStorage.getItem("leftPanelWidth");
    if (saved) {
      const width = parseFloat(saved);
      pendingPanelWidthRef.current = width;
      setLeftPanelWidth(width);
    }
  }, []);

  // Handle resizing — rAF-throttled updates; localStorage only on mouseup
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      if (!resizableContainerRef.current) return;

      const containerRect = resizableContainerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      const constrainedWidth = Math.max(20, Math.min(70, newWidth));
      pendingPanelWidthRef.current = constrainedWidth;

      if (resizeRafRef.current == null) {
        resizeRafRef.current = requestAnimationFrame(() => {
          setLeftPanelWidth(pendingPanelWidthRef.current);
          resizeRafRef.current = null;
        });
      }
    };

    const handleMouseUp = () => {
      if (resizeRafRef.current != null) {
        cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
      setLeftPanelWidth(pendingPanelWidthRef.current);
      localStorage.setItem("leftPanelWidth", pendingPanelWidthRef.current.toString());
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
        description: "Extracting text content from the file",
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
        let pendingStream: {
          charts: ChartData[]; tables: TableData[]; memos: MemoData[];
          narratives: NarrativeData[]; followUps: string[]; hasToolUse: boolean;
        } | null = null;

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
                tables: event.tables ?? [],
                memos: event.memos ?? [],
                narratives: event.narratives ?? [],
                followUps: event.followUps ?? [],
                hasToolUse: !!event.hasToolUse,
              };
            } else if (event.type === "error") {
              throw new Error(event.error || "Streaming error");
            }
          }
        }

        // Apply visual artifacts and resolve display text after stream ends
        setMessages((prev) => {
          const out = [...prev];
          const last = out[out.length - 1];
          if (!last || last.role !== "assistant") return out;

          let updated: Message = { ...last };
          if (pendingStream) {
            updated = {
              ...updated,
              hasToolUse: pendingStream.hasToolUse,
              charts: pendingStream.charts.length > 0 ? pendingStream.charts : undefined,
              tables: pendingStream.tables.length > 0 ? pendingStream.tables : undefined,
              memos: pendingStream.memos.length > 0 ? pendingStream.memos : undefined,
              narratives: pendingStream.narratives.length > 0 ? pendingStream.narratives : undefined,
              followUps: pendingStream.followUps.length > 0 ? pendingStream.followUps : undefined,
            };
          }

          const finalized = finalizeAssistantMessage(updated);
          out[out.length - 1] = (finalized ?? updated) as Message;
          return out;
        });
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
    chatInputRef.current?.setText(question);
    chatInputRef.current?.focus();
  }, []);

  // ── Export popup ──────────────────────────────────────────────────────────
  const [showExportPopup, setShowExportPopup] = useState(false);
  const [exportTitle, setExportTitle] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const exportPopupRef = useRef<HTMLDivElement>(null);
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const exportTitleRef = useRef<HTMLInputElement>(null);
  const [exportPopupPos, setExportPopupPos] = useState<{ top: number; right: number } | null>(null);

  const allMemos = messages.flatMap((m) => m.memos ?? []);
  const allNarratives = messages.flatMap((m) => m.narratives ?? []);
  const allTables = messages.flatMap((m) => m.tables ?? []);
  const allCharts = messages.flatMap((m) => m.charts ?? []);

  // Default title when conversation is available
  useEffect(() => {
    const convTitle = conversations.find((c) => c.id === conversationId)?.title;
    setExportTitle(convTitle ?? (accountName ? `${accountName} Analysis` : "Conversation"));
  }, [conversationId, conversations, accountName]);

  // Close on outside click
  useEffect(() => {
    if (!showExportPopup) return;
    const handler = (e: MouseEvent) => {
      if (exportPopupRef.current && !exportPopupRef.current.contains(e.target as Node))
        setShowExportPopup(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showExportPopup]);

  useEffect(() => {
    if (showExportPopup) setTimeout(() => exportTitleRef.current?.focus(), 50);
  }, [showExportPopup]);

  const exportMarkdown = useCallback(() => {
    if (messages.length === 0) return;
    const title = exportTitle.trim() || "Conversation";
    const lines: string[] = [
      `# ${title}`,
      `_Exported ${new Date().toLocaleString()}_`,
      "",
    ];
    for (const msg of messages) {
      if (msg.content === "thinking") continue;
      lines.push(`### ${msg.role === "user" ? "You" : ASSISTANT_NAME}`);
      lines.push(msg.content);
      for (const chart of msg.charts ?? []) {
        if (chart.config?.title) { lines.push(""); lines.push(`_[Chart: ${chart.config.title}]_`); }
      }
      for (const table of msg.tables ?? []) {
        if (table.title) { lines.push(""); lines.push(`_[Table: ${table.title}]_`); }
      }
      for (const memo of msg.memos ?? []) {
        if (memo.title) {
          lines.push(""); lines.push(`### ${memo.title}`);
          lines.push(`**Executive Summary:** ${memo.executive_summary}`);
          if (memo.recommendation) lines.push(`**Recommendation:** ${memo.recommendation}`);
        }
      }
      for (const n of msg.narratives ?? []) {
        lines.push(""); lines.push(`> ${n.narrative}`);
      }
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportPopup(false);
  }, [messages, exportTitle]);

  const exportPdf = useCallback(async () => {
    if (!exportTitle.trim()) return;
    setGeneratingPdf(true);
    try {
      const [{ pdf }, { ReportDocument }] = await Promise.all([
        import("@react-pdf/renderer") as any,
        import("@/components/ReportDocument"),
      ]);
      const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const doc = React.createElement(ReportDocument, {
        reportTitle: exportTitle.trim(),
        clientName: accountName,
        firmName,
        date,
        memos: allMemos,
        narratives: allNarratives,
        tables: allTables,
        charts: allCharts,
      });
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportTitle.trim().replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowExportPopup(false);
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast({ title: "PDF failed", description: "Could not generate PDF. Try Markdown instead.", variant: "destructive" });
    } finally {
      setGeneratingPdf(false);
    }
  }, [exportTitle, accountName, firmName, allMemos, allNarratives, allTables, allCharts]);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim() && !currentUpload) return;
    if (isLoading || isUploading || isInFlightRef.current) return;
    isInFlightRef.current = true;
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      file: currentUpload || undefined,
      timestamp: new Date().toISOString(),
    };
    // Clear the current upload from the input UI as soon as the message is sent
    // so the file preview/logo above the chat doesn't persist after sending.
    setCurrentUpload(null);
    const thinkingMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "thinking",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage, thinkingMessage]);
    setIsLoading(true);
    requestAnimationFrame(() => {
      scrollChatToBottom("auto");
      requestAnimationFrame(() => scrollChatToBottom("smooth"));
    });
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
    const convId = await ensureConversation(text);
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
        const out = [...prev];
        out[out.length - 1] = {
          ...out[out.length - 1],
          role: "assistant",
          status: undefined,
          content: ASSISTANT_ERROR_MESSAGE,
        };
        return out;
      });
    } finally {
      isInFlightRef.current = false;
      setIsLoading(false);
      setMessages((prev) => {
        const out = [...prev];
        const finalized = finalizeAssistantMessage(out[out.length - 1]);
        if (finalized) out[out.length - 1] = finalized as Message;
        return out;
      });
      scrollChatToBottom("smooth");
    }
  }, [
    currentUpload,
    isLoading,
    isUploading,
    messages,
    selectedModel,
    icfObj,
    includeLiveData,
    portfolioJson,
    ensureConversation,
    scrollChatToBottom,
    callFinanceStream,
  ]);

  const hasCharts = useMemo(
    () =>
      messages.some(
        (m) =>
          (m.charts?.length ?? 0) > 0 ||
          (m.tables?.length ?? 0) > 0 ||
          (m.memos?.length ?? 0) > 0 ||
          (m.narratives?.length ?? 0) > 0
      ),
    [messages]
  );

  const visualizationItems = useMemo(() => {
    const items: PanelItem[] = [];
    messages.forEach((message, msgIdx) => {
      if (message.role !== "assistant") return;
      const query = getQueryForMessageIndex(messages, msgIdx);
      (message.charts ?? []).forEach((d, i) =>
        items.push({
          type: "chart",
          data: d,
          key: `chart-${msgIdx}-${i}`,
          title: d.config?.title || "Chart",
          query,
        })
      );
      (message.tables ?? []).forEach((d, i) =>
        items.push({
          type: "table",
          data: d,
          key: `table-${msgIdx}-${i}`,
          title: d.title || "Data Table",
          query,
        })
      );
      (message.memos ?? []).forEach((d, i) =>
        items.push({
          type: "memo",
          data: d,
          key: `memo-${msgIdx}-${i}`,
          title: d.title || "Memo",
          query,
        })
      );
      (message.narratives ?? []).forEach((d, i) =>
        items.push({
          type: "narrative",
          data: d,
          key: `narrative-${msgIdx}-${i}`,
          title: truncateQuery(d.narrative || "Narrative", 60),
          query,
        })
      );
    });
    return items;
  }, [messages]);

  const chartPanelCount = visualizationItems.length;

  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (m) =>
          m.content === "thinking" ||
          !(m.role === "user" && isTrivialGreetingMessage(m.content))
      ),
    [messages]
  );

  const handleInitialize = async () => {
    if (!proposedCsv || !portfolioJson) {
      toast({
        title: "Missing data",
        description: "Required mapping or portfolio data not available",
        variant: "destructive",
      });
      return;
    }
    if (isLoading || isInFlightRef.current) return;
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: initializePromptDisplay,
      timestamp: new Date().toISOString(),
    };
    const thinkingMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "thinking",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    isInFlightRef.current = true;
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
          ...out[out.length - 1],
          role: "assistant",
          status: undefined,
          content: ASSISTANT_ERROR_MESSAGE,
        };
        return out;
      });
    } finally {
      isInFlightRef.current = false;
      setIsLoading(false);
      setMessages((prev) => {
        const out = [...prev];
        const finalized = finalizeAssistantMessage(out[out.length - 1]);
        if (finalized) out[out.length - 1] = finalized as Message;
        return out;
      });
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ position: 'relative' }}>
      <TopNavBar
        features={{
          showDomainSelector: false,
          showViewModeSelector: false,
          showPromptCaching: false,
        }}
      />

      <div 
        ref={resizableContainerRef}
        className="flex-1 flex bg-background mt-0 pt-2 min-h-0 resizable-container relative px-3 pb-2"
      >
        <div className="flex flex-1 min-h-0 overflow-hidden rounded-xl border bg-card shadow-sm">
        <Card 
          className={`flex flex-col h-full shrink-0 border-0 shadow-none rounded-none relative overflow-hidden ${isResizing ? "" : "transition-[width] duration-150"}`}
          style={{ width: `${leftPanelWidth}%` }}
        >
          {/* Always-on ambient bubble — pink/blue AI-flow during API calls */}
          <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-hidden>
            {/* idle: soft indigo   |  loading: vivid pink */}
            <div className="absolute -inset-[30%] animate-fda-bubble-1 transition-all duration-700"
              style={{ backgroundImage: isLoading || isUploading
                ? "radial-gradient(ellipse 60% 50% at 35% 45%, hsl(330 90% 65% / 0.45), transparent 68%)"
                : "radial-gradient(ellipse 55% 45% at 35% 45%, hsl(var(--primary) / 0.14), transparent 70%)" }} />
            {/* idle: soft purple   |  loading: vivid blue */}
            <div className="absolute -inset-[25%] animate-fda-bubble-2 transition-all duration-700"
              style={{ backgroundImage: isLoading || isUploading
                ? "radial-gradient(ellipse 55% 45% at 72% 55%, hsl(220 90% 62% / 0.40), transparent 66%)"
                : "radial-gradient(ellipse 50% 42% at 70% 55%, hsl(280 70% 55% / 0.11), transparent 68%)" }} />
            {/* idle: soft cyan     |  loading: hot pink / magenta */}
            <div className="absolute -inset-[20%] animate-fda-bubble-3 transition-all duration-700"
              style={{ backgroundImage: isLoading || isUploading
                ? "radial-gradient(ellipse 50% 42% at 18% 68%, hsl(310 85% 62% / 0.38), transparent 63%)"
                : "radial-gradient(ellipse 48% 40% at 20% 70%, hsl(200 80% 55% / 0.09), transparent 65%)" }} />
            {/* idle: soft amber    |  loading: electric blue */}
            <div className="absolute -inset-[22%] animate-fda-bubble-4 transition-all duration-700"
              style={{ backgroundImage: isLoading || isUploading
                ? "radial-gradient(circle at 67% 24%, hsl(200 95% 58% / 0.42), transparent 58%)"
                : "radial-gradient(circle at 65% 25%, hsl(var(--chart-4) / 0.11), transparent 60%)" }} />
            {/* extra bloom — only during loading */}
            <div className="absolute -inset-[18%] animate-fda-bubble-1 transition-opacity duration-700"
              style={{
                backgroundImage: "radial-gradient(ellipse 45% 38% at 50% 50%, hsl(270 85% 65% / 0.30), transparent 62%)",
                opacity: isLoading || isUploading ? 1 : 0,
                animationDelay: "2s",
              }} />
          </div>
          <CardHeader className="py-3 px-4 relative z-[6]">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 shrink">
                <CardTitle className="text-[16px] leading-tight">Financial AI Assistant</CardTitle>
                <CardDescription className="text-[9px] text-muted-foreground/75 mt-0.5 leading-none">
                  Powered by weidentify.ai
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {conversations.length > 0 && (
                  <>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="h-8 text-[11px] px-3 max-w-[200px]"
                          disabled={loadingConversation}
                        >
                          {loadingConversation ? (
                            <span className="flex items-center gap-1.5 truncate">
                              <RectLoader size="sm" />
                              <span className="truncate">Loading conversation</span>
                            </span>
                          ) : (
                            <>
                              <span className="truncate">
                                {conversations.find((c) => c.id === conversationId)?.title ?? "History"}
                              </span>
                              <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                            </>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[min(280px,calc(100vw-2rem))] z-[200]">
                        {conversations.map((c) => (
                          <DropdownMenuItem
                            key={c.id}
                            onSelect={() => loadConversation(c.id)}
                            className={`flex flex-col items-start gap-0.5 py-2 cursor-pointer ${
                              c.id === conversationId ? "bg-muted" : ""
                            }`}
                          >
                            <span
                              className={`text-[11px] truncate w-full ${
                                c.id === conversationId ? "font-semibold" : "font-medium"
                              }`}
                            >
                              {c.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground leading-snug">
                              {relativeTime(c.updatedAt)}, {c._count.messages} messages
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      variant="outline"
                      className="h-8 text-[11px] px-3 shrink-0"
                      disabled={loadingConversation}
                      onClick={() => {
                        setMessages([]);
                        setConversationId(null);
                        hasAutoInitialized.current = true;
                      }}
                    >
                      + New
                    </Button>
                  </>
                )}

                <div className="relative group" ref={exportPopupRef}>
                  <Button
                    ref={exportBtnRef}
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => {
                      if (exportBtnRef.current) {
                        const r = exportBtnRef.current.getBoundingClientRect();
                        setExportPopupPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
                      }
                      setShowExportPopup((v) => !v);
                    }}
                    disabled={messages.length === 0 || isLoading}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <div className="pointer-events-none absolute top-full right-0 mt-1.5 z-[300] opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <div className="bg-popover border rounded-lg shadow-md px-2.5 py-1.5 text-[10px] whitespace-nowrap text-popover-foreground">
                      Export as Markdown or PDF
                    </div>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-8 text-[11px] px-3 max-w-[200px]"
                      title={models.find((m) => m.id === selectedModel)?.description}
                    >
                      <span className="truncate">
                        {models.find((m) => m.id === selectedModel)?.name}
                      </span>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="z-[200] w-[min(320px,calc(100vw-2rem))]">
                    {models.map((model) => (
                      <DropdownMenuItem
                        key={model.id}
                        onSelect={() => setSelectedModel(model.id)}
                        className={`flex flex-col items-start gap-0.5 py-2 cursor-pointer ${
                          model.id === selectedModel ? "bg-muted" : ""
                        }`}
                      >
                        <span
                          className={`text-[11px] leading-tight ${
                            model.id === selectedModel ? "font-semibold" : "font-medium"
                          }`}
                        >
                          {model.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-snug">
                          {model.description}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>

          <CardContent
            ref={chatScrollRef}
            className="flex flex-1 flex-col overflow-y-auto p-4 scroll-smooth relative z-[6] pb-36 min-h-0 scroll-pb-36"
          >
            <div className="relative flex flex-1 flex-col min-h-0">
            {visibleMessages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center animate-fade-in-up w-full max-w-sm mx-auto px-2">
                <h2 className="text-[19px] font-medium text-center mb-6 w-full">
                  Getting Started with Inspolio Copilot
                </h2>
                <div className="w-full border rounded-lg p-4">
                  <div className="text-[12px] mb-3 text-center space-y-1.5">
                    <p>Initialize portfolio data for the selected client and firm.</p>
                    <p>
                      <span className="text-muted-foreground">Client: </span>
                      <span className="font-medium">{accountName}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Firm name: </span>
                      <span className="font-medium">{firmName}</span>
                    </p>
                  </div>
                  <Button
                    className="w-full text-[11px]"
                    onClick={handleInitialize}
                    disabled={
                      !proposedCsv ||
                      !portfolioJson ||
                      loadingPortfolio ||
                      isLoading
                    }
                  >
                    {loadingPortfolio ? (
                      <span className="flex items-center justify-center gap-2">
                        <RectLoader size="sm" />
                        Loading portfolio data
                      </span>
                    ) : (
                      "Initialize and analyze proposed portfolio"
                    )}
                  </Button>
                  {portfolioError ? (
                    <div className="text-[11px] text-red-500 mt-2 text-center">
                      {portfolioError}
                    </div>
                  ) : null}
                </div>
                <div className="mt-8 w-full space-y-6 text-[12px]">
                  <div className="flex items-center gap-3">
                    <ChartArea className="text-muted-foreground w-6 h-6 shrink-0" />
                    <p className="text-muted-foreground">
                      I can analyze financial data and create visualizations
                      from your files.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <FileInput className="text-muted-foreground w-6 h-6 shrink-0" />
                    <p className="text-muted-foreground">
                      Upload CSV, PDF, or image files and I will help you
                      understand the data.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <MessageCircleQuestion className="text-muted-foreground w-6 h-6 shrink-0" />
                    <p className="text-muted-foreground">
                      Ask questions about your financial data and I will
                      create insightful charts.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 min-h-full" data-chat-messages>
                {visibleMessages.map((message, index) => (
                  <div
                    key={message.id}
                    className={`animate-fade-in-up ${
                      message.content === "thinking" ? "animate-pulse" : ""
                    }`}
                  >
                    <MessageComponent message={message} />
                    {message.role === "assistant" &&
                      message.followUps &&
                      message.followUps.filter((q) => !isTrivialGreetingMessage(q)).length > 0 &&
                      index === visibleMessages.length - 1 &&
                      !isLoading && (
                        <div className="flex flex-wrap gap-1.5 mt-2 ml-10">
                          {message.followUps
                            .filter((q) => !isTrivialGreetingMessage(q))
                            .map((q, i) => (
                            <button
                              key={i}
                              onClick={() => !isLoading && handleFollowUp(q)}
                              disabled={isLoading}
                              className="text-[11px] border rounded-lg px-3 py-1 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted"
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
            </div>
          </CardContent>
        </Card>

        <PanelResizer
          isResizing={isResizing}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsResizing(true);
          }}
        />

        <Card 
          className={`flex flex-1 min-w-0 flex-col h-full overflow-hidden border-0 shadow-none rounded-none relative ${isResizing ? "" : "transition-[width] duration-150"}`}
        >
          {/* Always-on ambient bubble — pink/blue AI-flow during API calls */}
          <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-hidden>
            {/* idle: soft primary  |  loading: vivid blue */}
            <div className="absolute -inset-[30%] animate-fda-bubble-2 transition-all duration-700"
              style={{ backgroundImage: isLoading || isUploading
                ? "radial-gradient(ellipse 58% 48% at 62% 40%, hsl(220 90% 62% / 0.44), transparent 66%)"
                : "radial-gradient(ellipse 52% 44% at 60% 40%, hsl(var(--primary) / 0.13), transparent 70%)" }} />
            {/* idle: soft purple   |  loading: hot pink */}
            <div className="absolute -inset-[25%] animate-fda-bubble-4 transition-all duration-700"
              style={{ backgroundImage: isLoading || isUploading
                ? "radial-gradient(ellipse 52% 43% at 28% 65%, hsl(330 88% 64% / 0.40), transparent 64%)"
                : "radial-gradient(ellipse 48% 40% at 30% 65%, hsl(280 70% 55% / 0.10), transparent 68%)" }} />
            {/* idle: soft cyan     |  loading: magenta */}
            <div className="absolute -inset-[20%] animate-fda-bubble-1 transition-all duration-700"
              style={{ backgroundImage: isLoading || isUploading
                ? "radial-gradient(ellipse 48% 40% at 77% 70%, hsl(310 85% 62% / 0.37), transparent 62%)"
                : "radial-gradient(ellipse 45% 38% at 75% 70%, hsl(200 80% 55% / 0.09), transparent 65%)" }} />
            {/* idle: soft amber    |  loading: electric cyan */}
            <div className="absolute -inset-[22%] animate-fda-bubble-3 transition-all duration-700"
              style={{ backgroundImage: isLoading || isUploading
                ? "radial-gradient(circle at 33% 30%, hsl(195 95% 56% / 0.38), transparent 56%)"
                : "radial-gradient(circle at 35% 30%, hsl(var(--chart-4) / 0.11), transparent 58%)" }} />
            {/* extra bloom — only during loading */}
            <div className="absolute -inset-[18%] animate-fda-bubble-2 transition-opacity duration-700"
              style={{
                backgroundImage: "radial-gradient(ellipse 42% 36% at 50% 50%, hsl(270 85% 65% / 0.28), transparent 60%)",
                opacity: isLoading || isUploading ? 1 : 0,
                animationDelay: "1.5s",
              }} />
          </div>

          {hasCharts && (
            <CardHeader className="py-3 px-4 shrink-0 relative z-[6]">
              <CardTitle className="text-[14px]">Inspolio&apos;s AI Visualizer</CardTitle>
            </CardHeader>
          )}

          {hasCharts ? (
            <VisualizationPanel
              items={visualizationItems}
              onScroll={handleChartScroll}
              contentRef={contentRef}
              chartEndRef={chartEndRef}
            />
          ) : (
            <CardContent
              ref={contentRef}
              className="flex flex-1 flex-col overflow-y-auto min-h-0 snap-y snap-mandatory pb-20 relative z-[6]"
              onScroll={handleChartScroll}
            >
              <div className="flex flex-1 flex-col items-center justify-center w-full max-w-2xl mx-auto px-4 py-6">
                <div className="flex flex-col items-center text-center w-full max-w-md">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[2px] border bg-muted/40 mb-3">
                    <ChartColumnBig className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-[14px] font-semibold">Inspolio&apos;s AI Visualizer</CardTitle>
                  <CardDescription className="text-[11px] mt-2 leading-relaxed text-muted-foreground">
                    Charts and detailed analysis will appear here as you chat with
                    Financial AI Assistant. Ask a question or initialize your portfolio to get started.
                  </CardDescription>
                </div>
                <div className="mt-7 w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:gap-3">
                  {VISUALIZATION_FEATURES.map(({ icon: Icon, title, description }) => (
                    <div
                      key={title}
                      className="flex flex-col items-center text-center gap-2 rounded-[2px] border bg-muted/15 px-3 py-3"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-[2px] border bg-background/90 shadow-sm">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="space-y-1.5 max-w-[220px]">
                        <p className="text-[12px] font-medium leading-tight">{title}</p>
                        <p className="text-[12px] text-muted-foreground leading-snug">
                          {description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
        </div>

        <ChatInputBar
          ref={chatInputRef}
          isLoading={isLoading}
          isUploading={isUploading}
          includeLiveData={includeLiveData}
          onIncludeLiveDataChange={setIncludeLiveData}
          currentUpload={currentUpload}
          onRemoveUpload={() => setCurrentUpload(null)}
          onFileSelect={handleFileSelect}
          onSubmit={handleSendMessage}
          onAbort={handleAbort}
        />
      </div>

      {hasCharts && (
        <ChartPagination
          total={chartPanelCount}
          current={currentChartIndex}
          onDotClick={scrollToChart}
        />
      )}

      {/* Export popup — fixed to viewport, unaffected by overflow-hidden on Card */}
      {showExportPopup && exportPopupPos && (
        <div
          ref={exportPopupRef}
          style={{ position: "fixed", top: exportPopupPos.top, right: exportPopupPos.right }}
          className="w-72 bg-background border rounded-lg shadow-2xl p-3 z-[9999]"
        >
          <div className="text-[11px] font-semibold mb-0.5">Export Conversation</div>
          <div className="text-[10px] text-muted-foreground mb-2.5">
            {[
              allMemos.length > 0 && `${allMemos.length} memo${allMemos.length > 1 ? "s" : ""}`,
              allNarratives.length > 0 && `${allNarratives.length} narrative${allNarratives.length > 1 ? "s" : ""}`,
              allTables.length > 0 && `${allTables.length} table${allTables.length > 1 ? "s" : ""}`,
              allCharts.length > 0 && `${allCharts.length} chart${allCharts.length > 1 ? "s" : ""}`,
              `${messages.filter((m) => m.content !== "thinking").length} messages`,
            ]
              .filter(Boolean)
              .join(", ")}
          </div>
          <input
            ref={exportTitleRef}
            type="text"
            value={exportTitle}
            onChange={(e) => setExportTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowExportPopup(false);
              if (e.key === "Enter" && !generatingPdf) exportMarkdown();
            }}
            className="w-full text-[11px] border rounded px-2 py-1.5 mb-2.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Report title"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-[11px] h-7 gap-1.5"
              onClick={exportMarkdown}
              disabled={generatingPdf || messages.length === 0}
            >
              <FileDown className="h-3 w-3" />
              Markdown
            </Button>
            <Button
              size="sm"
              className="flex-1 text-[11px] h-7 gap-1.5 text-white"
              onClick={exportPdf}
              disabled={generatingPdf || !exportTitle.trim()}
            >
              {generatingPdf ? (
                <>
                  <RectLoader size="sm" />
                  Generating report
                </>
              ) : (
                <>
                  <FileText className="h-3 w-3" />
                  PDF Report
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
