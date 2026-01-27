"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
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
  ChevronDown,
  ChevronUp,
  Paperclip,
  ChartArea,
  FileInput,
  MessageCircleQuestion,
  ChartColumnBig,
  ArrowUp,
  ArrowDown,
  ChevronRight,
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
import type { ChartData } from "@/types/chart";
import TopNavBar from "@/components/TopNavBar";
import {
  readFileAsText,
  readFileAsBase64,
  readFileAsPDFText,
} from "@/utils/fileHandling";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatStore } from "@/lib/stores/chatStore";
import type { ChatMessage } from "@/lib/api/chat";

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
  hasToolUse?: boolean;
  file?: {
    base64: string;
    fileName: string;
    mediaType: string;
    isText?: boolean;
  };
  chartData?: ChartMsg | null;
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
  { id: "claude-sonnet-4-5-20250929", name: "IdentifyAI's SH" },
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

import { WEIDENTIFY_API_URL } from '@/lib/config';

const API_URL = WEIDENTIFY_API_URL;

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

const MessageComponent: React.FC<MessageComponentProps & { 
  isCollapsed?: boolean; 
  onToggleCollapse?: () => void;
  isOldMessage?: boolean;
  messageIndex?: number;
  totalMessages?: number;
}> = ({ message, isCollapsed = false, onToggleCollapse, isOldMessage = false, messageIndex = 0, totalMessages = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isLongContent, setIsLongContent] = useState(false);
  const MAX_PREVIEW_LENGTH = 500; // Characters to show before "Show more"

  useEffect(() => {
    if (contentRef.current) {
      const textLength = message.content.length;
      setIsLongContent(textLength > MAX_PREVIEW_LENGTH);
    }
  }, [message.content]);

  // Only collapse assistant messages, not user messages
  const shouldShowCollapse = message.role === "assistant" && isOldMessage && messageIndex < totalMessages - 5;
  const displayContent = isLongContent && !isExpanded 
    ? message.content.substring(0, MAX_PREVIEW_LENGTH) + '...'
    : message.content;

  return (
    <div className={`flex items-start gap-2 ${shouldShowCollapse && isCollapsed ? 'opacity-60' : ''}`}>
      {message.role === "assistant" && (
        <Avatar className="w-8 h-8 border flex-shrink-0">
          <AvatarImage src="/ant-logo.svg" alt="AI Assistant Avatar" />
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
      )}
      <div
        className={`flex flex-col ${
          message.role === "user" ? "max-w-[75%] ml-auto" : "w-full"
        }`}
      >
        {shouldShowCollapse && (
          <button
            onClick={onToggleCollapse}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground mb-1 transition-colors"
          >
            {isCollapsed ? (
              <>
                <ChevronRight className="w-3 h-3" />
                <span>Show message</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                <span>Hide message</span>
              </>
            )}
          </button>
        )}
        {(!shouldShowCollapse || !isCollapsed) && (
          <div
            className={`p-3 rounded-md text-[12px] ${
              message.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted border"
            }`}
            ref={contentRef}
          >
            {message.content === "thinking" ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2" />
                <span>Thinking...</span>
              </div>
            ) : (
              <>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {displayContent}
                </ReactMarkdown>
                {isLongContent && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="mt-2 text-[10px] text-muted-foreground hover:text-foreground underline"
                  >
                    {isExpanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </>
            )}
          </div>
        )}
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
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(
    "claude-sonnet-4-5-20250929"
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chartEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [currentUpload, setCurrentUpload] = useState<FileUpload | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [currentChartIndex, setCurrentChartIndex] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isScrollLocked, setIsScrollLocked] = useState(false);
  const resizableContainerRef = useRef<HTMLDivElement>(null);
  const [includeLiveData, setIncludeLiveData] = useState(true);

  const [portfolioJson, setPortfolioJson] = useState<any | null>(null);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  
  // Chat store for persistence
  const [chatStore, setChatStore] = useState<ChatStore | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fabRef = useRef<HTMLDivElement>(null);
  
  // Expanded messages state (messages that are explicitly expanded, old messages are collapsed by default)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [showJumpButtons, setShowJumpButtons] = useState(false);

  // Ensure FAB stays fixed even when scrolling or in iframe
  useEffect(() => {
    const fabElement = fabRef.current;
    if (!fabElement) return;

    // Force fixed positioning
    const ensureFixed = () => {
      fabElement.style.position = 'fixed';
      fabElement.style.bottom = '100px';
      fabElement.style.left = '50%';
      fabElement.style.transform = 'translateX(-50%)';
      fabElement.style.zIndex = '99999';
    };

    ensureFixed();
    
    // Re-apply on scroll to ensure it stays fixed
    const handleScroll = () => {
      ensureFixed();
    };

    window.addEventListener('scroll', handleScroll, true);
    document.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, []);
  
  // Resizable panel state
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('leftPanelWidth');
      return saved ? parseFloat(saved) : 33.33; // Default to 33.33% (1/3)
    }
    return 33.33;
  });
  const [isResizing, setIsResizing] = useState(false);

  // Initialize chat store when ICF mapping is available
  useEffect(() => {
    // Normalize ICF object first (extract icfMapping if it exists, otherwise use as-is)
    const rawIcfObj = icfObj || DEFAULT_ICF_MAPPING;
    const normalizedIcfObj = normalizeIcf(rawIcfObj) || rawIcfObj;
    const currentIcfObj = normalizedIcfObj;
    
    // After normalization, the id should be directly on the object
    const mappingId = currentIcfObj?.id || null;
    const firmNameForChat = currentIcfObj?.firm_name || null;
    const firmAccountNameForChat = currentIcfObj?.firm_account_name || null;
    
    // Clear messages immediately when switching ICF to prevent showing old data
    setMessages([]);
    setLoadingHistory(true);
    
    // Create a flag to track if this effect is still active
    let isActive = true;
    
    const store = new ChatStore(
      'FINANCE',
      mappingId,
      firmNameForChat,
      firmAccountNameForChat
    );
    setChatStore(store);
    
    // Load historical messages
    store.initialize().then(() => {
      if (!isActive) return;
      
      const chatMessages = store.getMessages();
      const convertedMessages: Message[] = chatMessages.map((msg: ChatMessage) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        hasToolUse: msg.hasToolUse,
        file: msg.file && msg.hasFile ? msg.file : undefined,
        chartData: msg.chartData || null,
      }));
      
      setMessages(convertedMessages);
      setLoadingHistory(false);
    }).catch((error) => {
      if (!isActive) return;
      console.error('[ERROR] Failed to load chat history:', error);
      setLoadingHistory(false);
      setMessages([]);
    });
    
    // Subscribe to store updates
    const unsubscribe = store.subscribe(() => {
      if (!isActive) return;
      
      const chatMessages = store.getMessages();
      const convertedMessages: Message[] = chatMessages.map((msg: ChatMessage) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        hasToolUse: msg.hasToolUse,
        file: msg.file && msg.hasFile ? msg.file : undefined,
        chartData: msg.chartData || null,
      }));
      
      setMessages(convertedMessages);
    });
    
    return () => {
      isActive = false;
      unsubscribe();
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [icfObj]);

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
        setPortfolioError("Failed loading portfolio data");
      } finally {
        setLoadingPortfolio(false);
      }
    }
    loadOnce();
  }, [clientId, bankerId, firmName, portfolioJson]);


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
      const chartsCount = messages.filter((m) => m.chartData).length;
      if (chartsCount > 0) {
        setCurrentChartIndex(chartsCount - 1);
        scrollToChart(chartsCount - 1);
      }
    };
    const lastChartIndex = messages.findLastIndex((m) => m.chartData);
    if (lastChartIndex !== -1) {
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
      chartData: null,
    };
    // Clear the current upload from the input UI as soon as the message is sent
    // so the file preview/logo above the chat doesn't persist after sending.
    setCurrentUpload(null);
    const thinkingMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "thinking",
      chartData: null,
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
    const requestBody = {
      messages: apiMessages,
      model: selectedModel,
      icfMapping: effectiveIcfObj,
      includeLiveData: includeLiveData,
    };
    try {
      const response = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) throw new Error(String(response.status));
      const data: APIResponse = await response.json();
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.content,
        hasToolUse: data.hasToolUse || !!data.toolUse,
        chartData:
          data.chartData || (data.toolUse?.input as ChartData) || null,
      };
      
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = assistantMessage;
        return newMessages;
      });
      
      // Save both user and assistant messages to chat store
      if (chatStore) {
        try {
          // Save user message
          await chatStore.saveMessage({
            id: userMessage.id,
            role: 'user',
            content: userMessage.content,
            hasFile: !!userMessage.file,
            file: userMessage.file || null,
            hasToolUse: false,
            chartData: null,
            toolUse: null,
          }, userMessage.file ? {
            base64: userMessage.file.base64,
            fileName: userMessage.file.fileName,
            mediaType: userMessage.file.mediaType,
            isText: userMessage.file.isText,
          } : undefined);
          
          // Save assistant message
          await chatStore.saveMessage({
            id: assistantMessage.id,
            role: 'assistant',
            content: assistantMessage.content,
            hasFile: false,
            file: null,
            hasToolUse: assistantMessage.hasToolUse || false,
            chartData: assistantMessage.chartData,
            toolUse: data.toolUse || null,
          });
        } catch (error) {
          console.error('[ERROR] Failed to save messages to chat store:', error);
          toast({
            title: "Warning",
            description: "Message saved locally but failed to sync to server",
            variant: "destructive",
          });
        }
      }
      
      setCurrentUpload(null);
    } catch {
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "I encountered an error. Please try again.",
          chartData: null,
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
    
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto";
    
    // Calculate new height (limit max height to 200px)
    const newHeight = Math.min(textarea.scrollHeight, 200);
    
    // Set new height - it will grow upward naturally with items-end alignment
    textarea.style.height = `${newHeight}px`;
  };

  const hasCharts = messages.some((m) => m.chartData);

    const initializePromptHidden = (() => {
    const payload = {
      firmName,
      accountName,
      proposedCsv,
      pdfUrl,
      icfMapping: effectiveIcfObj,
      portfolioData: portfolioJson,
    };
    const lines: string[] = [];
    lines.push(
      `Initialize portfolio memory and analysis context for firm "${firmName}" and account "${accountName}".`
    );
    lines.push(`Always use the PROPOSED portfolio CSV.`);
    lines.push(
      `You are given a JSON payload containing combined portfolio data under "portfolioData". Ingest and normalize it.`
    );
    lines.push(`Tasks:`);
    lines.push(
      `1) Summarize top holdings by weight and total value, and cash percentage.`
    );
    lines.push(`2) Build sector allocation and market-cap buckets.`);
    lines.push(`3) Produce three charts:`);
    lines.push(`   - Bar: Top 10 holdings by weight`);
    lines.push(`   - Pie: Sector allocation`);
    lines.push(
      `   - Area or Line: Portfolio value over time (if series present), else bar by asset class`
    );
    lines.push(`Return a concise summary and chart configs JSON for rendering.`);
    lines.push(`DATA JSON:`);
    lines.push(JSON.stringify(payload));
    return lines.join("\n");
  })();

  const initializePromptDisplay = `Initialize memory and analyze data for ${accountName} at ${firmName}. (details hidden)`;

  const handleInitialize = async () => {
    if (!proposedCsv || !portfolioJson) {
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
      chartData: null,
    };
    const thinkingMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "thinking",
      chartData: null,
    };
    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setIsLoading(true);
    const msgs = [{ role: "user", content: initializePromptHidden }];
    const body = { messages: msgs, model: selectedModel, icfMapping: effectiveIcfObj };
    try {
      const res = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data: APIResponse = await res.json();
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.content,
        hasToolUse: data.hasToolUse || !!data.toolUse,
        chartData: data.chartData || (data.toolUse?.input as ChartData) || null,
      };
      
      setMessages((prev) => {
        const out = [...prev];
        out[out.length - 1] = assistantMessage;
        return out;
      });
      
      // Save initialization messages to chat store
      if (chatStore) {
        try {
          await chatStore.saveMessage({
            id: userMsg.id,
            role: 'user',
            content: userMsg.content,
            hasFile: false,
            file: null,
            hasToolUse: false,
            chartData: null,
            toolUse: null,
          });
          
          await chatStore.saveMessage({
            id: assistantMessage.id,
            role: 'assistant',
            content: assistantMessage.content,
            hasFile: false,
            file: null,
            hasToolUse: assistantMessage.hasToolUse || false,
            chartData: assistantMessage.chartData,
            toolUse: data.toolUse || null,
          });
        } catch (error) {
          console.error('Failed to save initialization messages:', error);
          toast({
            title: "Warning",
            description: "Initialization saved locally but failed to sync to server",
            variant: "destructive",
          });
        }
      }
    } catch {
      setMessages((prev) => {
        const out = [...prev];
        out[out.length - 1] = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Initialization failed. Please try again.",
          chartData: null,
        };
        return out;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen" style={{ position: 'relative', overflow: 'visible' }}>
      <TopNavBar
        features={{
          showDomainSelector: false,
          showViewModeSelector: false,
          showPromptCaching: false,
        }}
      />

      {/* Floating Action Button (FAB) - Fixed at bottom, stays visible even in iframe */}
      <div 
        ref={fabRef}
        id="chat-fab-input"
        style={{
          position: 'fixed',
          bottom: '100px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: '56rem',
          zIndex: 99999,
          willChange: 'transform',
          pointerEvents: 'auto',
          isolation: 'isolate',
        }}
        className="fixed bottom-[30px] left-1/2 -translate-x-1/2 w-[90%] max-w-4xl"
      >
        <form onSubmit={handleSubmit} className="flex flex-col">
          {currentUpload && (
            <div className="mb-2">
              <FilePreview
                file={currentUpload}
                onRemove={() => setCurrentUpload(null)}
              />
            </div>
          )}

          <div className="relative bg-background/95 backdrop-blur-sm border rounded-xl shadow-2xl p-2" style={{ boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>

            {/* Input field with all controls inside - grows upward */}
            <div className="relative flex items-end">
              {/* Left separator */}
              <div className="absolute left-0 top-0 bottom-0 w-px bg-border z-10" />

              {/* File attachment button - positioned at bottom left */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isUploading}
                className="absolute left-2 z-10 hover:bg-muted"
                style={{ bottom: '8px' }}
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              <Textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask questions, @ for context, / for commands"
                disabled={isLoading || isUploading}
                className="min-h-[44px] max-h-[200px] resize-none pl-12 py-3 pr-24 rounded-xl border-0 bg-transparent focus-visible:ring-0 focus-visible:border-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm overflow-y-auto"
                rows={1}
              />

              {/* Right separator */}
              <div className="absolute right-20 top-0 bottom-0 w-px bg-border z-10" />

              {/* Live Data button - positioned at bottom right */}
              <Button
                type="button"
                variant={includeLiveData ? "default" : "outline"}
                size="sm"
                onClick={() => setIncludeLiveData(!includeLiveData)}
                disabled={isLoading || isUploading}
                className={`absolute right-24 z-10 px-2 text-[10px] ${
                  includeLiveData 
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                    : 'border border-border hover:bg-muted'
                }`}
                style={{ bottom: '8px', height: '28px' }}
              >
                Live Data
              </Button>

              {/* Send button - positioned at bottom right */}
              <Button
                type="submit"
                disabled={
                  isLoading || isUploading || (!input.trim() && !currentUpload)
                }
                className="absolute right-2 z-10 rounded-full p-0 disabled:opacity-50 bg-primary hover:bg-primary/90"
                title="Send message"
                style={{ bottom: '8px', height: '32px', width: '32px' }}
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-background border-t-transparent" />
                ) : (
                  <Send className="h-3.5 w-3.5 text-primary-foreground" />
                )}
              </Button>
            </div>

            {/* Status text when loading */}
            {(isLoading || isUploading) && (
              <div className="absolute -bottom-5 left-0 text-[10px] text-muted-foreground">
                {isUploading ? "Processing your file..." : "Please wait while we are getting your query..."}
              </div>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileSelect}
          />
        </form>
      </div>

      <div 
        ref={resizableContainerRef}
        className="flex-1 flex bg-background mt-0 pt-0 h-[calc(100vh-4rem)] pb-32 resizable-container relative"
      >
        <Card 
          className="flex flex-col h-full transition-all mr-2"
          style={{ width: `calc(${leftPanelWidth}% - 0.5rem)` }}
        >
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div>
                  <CardTitle className="text-[12px]">Financial Assistant</CardTitle>
                  <CardDescription className="text-[11px]">
                    Powered by weidentify.ai
                  </CardDescription>
                </div>
              </div>

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
          </CardHeader>

          <CardContent 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 scroll-smooth snap-y snap-mandatory relative"
            onScroll={(e) => {
              // Debounce scroll handler for better performance
              if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
              }
              
              const target = e.currentTarget;
              const scrollTop = target.scrollTop;
              const scrollHeight = target.scrollHeight;
              const clientHeight = target.clientHeight;
              
              // Show jump buttons when scrolled away from top/bottom
              const isNearTop = scrollTop < 100;
              const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
              setShowJumpButtons(!isNearTop && !isNearBottom);
              
              scrollTimeoutRef.current = setTimeout(() => {
                // Lazy load older messages when scrolling near top
                if (target && scrollTop !== null && scrollTop !== undefined && scrollTop < 200 && chatStore && chatStore.hasMoreChunks()) {
                  const nextChunk = chatStore.getNextChunkIndex();
                  if (nextChunk !== null && !chatStore.isLoading()) {
                    chatStore.loadChunk(nextChunk).catch((error) => {
                      console.error('Failed to load chunk:', error);
                    });
                  }
                }
              }, 150); // 150ms debounce
            }}
          >
            {/* Jump to top/bottom buttons */}
            {showJumpButtons && (
              <div className="sticky top-4 z-10 flex justify-center gap-2 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-[10px] bg-background/95 backdrop-blur-sm shadow-lg"
                  onClick={() => {
                    messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <ArrowUp className="w-3 h-3 mr-1" />
                  Top
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-[10px] bg-background/95 backdrop-blur-sm shadow-lg"
                  onClick={() => {
                    if (messagesContainerRef.current) {
                      messagesContainerRef.current.scrollTo({ 
                        top: messagesContainerRef.current.scrollHeight, 
                        behavior: 'smooth' 
                      });
                    }
                  }}
                >
                  <ArrowDown className="w-3 h-3 mr-1" />
                  Bottom
                </Button>
              </div>
            )}
            {loadingHistory ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
                <p className="text-[12px] text-muted-foreground">Loading chat history...</p>
              </div>
            ) : messages.length === 0 ? (
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
                {chatStore && chatStore.isLoading() && chatStore.hasMoreChunks() && (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
                    <span className="text-[11px] text-muted-foreground">Loading older messages...</span>
                  </div>
                )}
                {messages.map((message, index) => {
                  const isOldMessage = index < messages.length - 5;
                  // Only collapse assistant messages, user messages are always visible
                  // Old assistant messages are collapsed by default unless explicitly expanded
                  const isCollapsed = message.role === "assistant" && isOldMessage && !expandedMessages.has(message.id);
                  return (
                    <div
                      key={message.id}
                      className={`animate-fade-in-up ${
                        message.content === "thinking" ? "animate-pulse" : ""
                      }`}
                    >
                      <MessageComponent 
                        message={message} 
                        isCollapsed={isCollapsed}
                        onToggleCollapse={() => {
                          setExpandedMessages(prev => {
                            const next = new Set(prev);
                            if (next.has(message.id)) {
                              next.delete(message.id);
                            } else {
                              next.add(message.id);
                            }
                            return next;
                          });
                        }}
                        isOldMessage={isOldMessage}
                        messageIndex={index}
                        totalMessages={messages.length}
                      />
                    </div>
                  );
                })}
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
                {messages.map(
                  (message, index) =>
                    message.chartData && (
                      <div
                        key={`chart-${index}`}
                        className="w-full min-h-full flex-shrink-0 snap-start snap-always"
                        ref={
                          index ===
                          messages.filter((m) => m.chartData).length - 1
                            ? chartEndRef
                            : null
                        }
                      >
                        <SafeChartRenderer data={message.chartData} />
                      </div>
                    )
                )}
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
          total={messages.filter((m) => m.chartData).length}
          current={currentChartIndex}
          onDotClick={scrollToChart}
        />
      )}
    </div>
  );
}
