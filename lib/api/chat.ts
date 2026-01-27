import { CHAT_API_BASE_URL } from '@/lib/config';

const API_BASE = CHAT_API_BASE_URL;

export type ChatType = 'FINANCE' | 'PORTFOLIO_COPILOT' | 'MULTI_PORTFOLIO_ANALYST';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  hasFile: boolean;
  file: any | null;
  hasToolUse: boolean;
  chartData: any | null;
  toolUse: any | null;
  timestamp: string;
}

export interface SaveMessageRequest {
  mappingId?: number;
  firmName?: string;
  firmAccountName?: string;
  chatType: ChatType;
  message: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    hasFile?: boolean;
    fileData?: any;
    hasToolUse?: boolean;
    chartData?: any;
    toolUse?: any;
    timestamp?: string;
  };
}

export interface ChatHistoryResponse {
  mappingId: number;
  chatType: string;
  totalMessages: number;
  totalChunks: number;
  chunkIndex: number;
  hasMore: boolean;
  nextChunkIndex: number | null;
  messages: ChatMessage[];
}

export interface ChatMetadata {
  mappingId: number;
  chatType: string;
  totalMessages: number;
  totalChunks: number;
  lastMessageAt: string | null;
}

export const chatAPI = {
  saveMessage: async (request: SaveMessageRequest) => {
    try {
      const response = await fetch(`${API_BASE}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ERROR] Chat API error:', response.status, errorText);
        throw new Error(`Failed to save message: ${response.status} ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('[ERROR] Chat API fetch error:', error);
      throw error;
    }
  },

  getHistory: async (
    params: {
      mappingId?: number;
      firmName?: string;
      firmAccountName?: string;
      chatType: ChatType;
      chunkIndex?: number;
      limit?: number;
    }
  ): Promise<ChatHistoryResponse> => {
    const queryParams = new URLSearchParams();
    if (params.mappingId) queryParams.set('mappingId', params.mappingId.toString());
    if (params.firmName) queryParams.set('firmName', params.firmName);
    if (params.firmAccountName) queryParams.set('firmAccountName', params.firmAccountName);
    queryParams.set('chatType', params.chatType);
    if (params.chunkIndex !== undefined) queryParams.set('chunkIndex', params.chunkIndex.toString());
    if (params.limit) queryParams.set('limit', params.limit.toString());

    const url = `${API_BASE}/history?${queryParams}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ERROR] Chat history API error:', response.status, errorText);
        throw new Error(`Failed to load chat history: ${response.status} ${errorText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('[ERROR] Chat history fetch error:', error);
      throw error;
    }
  },

  getMetadata: async (
    params: {
      mappingId?: number;
      firmName?: string;
      firmAccountName?: string;
      chatType: ChatType;
    }
  ): Promise<ChatMetadata> => {
    const queryParams = new URLSearchParams();
    if (params.mappingId) queryParams.set('mappingId', params.mappingId.toString());
    if (params.firmName) queryParams.set('firmName', params.firmName);
    if (params.firmAccountName) queryParams.set('firmAccountName', params.firmAccountName);
    queryParams.set('chatType', params.chatType);

    const url = `${API_BASE}/metadata?${queryParams}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ERROR] Chat metadata API error:', response.status, errorText);
        throw new Error(`Failed to get chat metadata: ${response.status} ${errorText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('[ERROR] Chat metadata fetch error:', error);
      throw error;
    }
  },
};
