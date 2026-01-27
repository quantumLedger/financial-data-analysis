import { chatAPI, ChatMessage, ChatType } from '../api/chat';

interface LoadedChunk {
  chunkIndex: number;
  messages: ChatMessage[];
  loadedAt: number;
}

export class ChatStore {
  private mappingId: number | null = null;
  private firmName: string | null = null;
  private firmAccountName: string | null = null;
  private chatType: ChatType;
  private loadedChunks: Map<number, LoadedChunk> = new Map();
  private metadata: { totalMessages: number; totalChunks: number } | null = null;
  private loadingChunks: Set<number> = new Set();
  private allMessages: ChatMessage[] = [];
  private listeners: Set<() => void> = new Set();
  private isInitializing: boolean = false;

  constructor(
    chatType: ChatType,
    mappingId?: number | null,
    firmName?: string | null,
    firmAccountName?: string | null
  ) {
    this.chatType = chatType;
    this.mappingId = mappingId || null;
    this.firmName = firmName || null;
    this.firmAccountName = firmAccountName || null;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(listener => listener());
  }

  async initialize() {
    if (this.isInitializing) {
      return;
    }
    this.isInitializing = true;

    try {
      const metadataParams = {
        mappingId: this.mappingId || undefined,
        firmName: this.firmName || undefined,
        firmAccountName: this.firmAccountName || undefined,
        chatType: this.chatType,
      };
      
      const metadata = await chatAPI.getMetadata(metadataParams);
      
      this.metadata = metadata;
      
      // Only update mappingId if we don't have one set
      if (this.mappingId === null && metadata.mappingId) {
        this.mappingId = metadata.mappingId;
      } else if (this.mappingId !== null && metadata.mappingId && this.mappingId !== metadata.mappingId) {
        console.warn('[WARNING] Store mappingId differs from metadata.mappingId. Keeping store value.');
      }
      
      await this.loadChunk(0);
    } catch (error) {
      console.error('[ERROR] Failed to initialize chat:', error);
      // If metadata fails, still try to load chunk 0 directly
      try {
        await this.loadChunk(0);
      } catch (chunkError) {
        console.error('[ERROR] Failed to load initial chunk:', chunkError);
        this.metadata = { totalMessages: 0, totalChunks: 0 };
        this.allMessages = [];
        this.notify();
      }
    } finally {
      this.isInitializing = false;
    }
  }

  async loadChunk(chunkIndex: number): Promise<void> {
    if (this.loadedChunks.has(chunkIndex) || this.loadingChunks.has(chunkIndex)) {
      return;
    }

    if (this.metadata && this.metadata.totalChunks > 0 && chunkIndex >= this.metadata.totalChunks) {
      return;
    }

    this.loadingChunks.add(chunkIndex);

    try {
      const requestParams = {
        mappingId: this.mappingId || undefined,
        firmName: this.firmName || undefined,
        firmAccountName: this.firmAccountName || undefined,
        chatType: this.chatType,
        chunkIndex,
        limit: 100,
      };
      
      const response = await chatAPI.getHistory(requestParams);

      // Only update mappingId if we don't have one set
      if (this.mappingId === null && response.mappingId) {
        this.mappingId = response.mappingId;
      } else if (this.mappingId !== null && response.mappingId && this.mappingId !== response.mappingId) {
        console.warn('[WARNING] Store mappingId differs from response.mappingId. Keeping store value.');
      }

      // Update metadata if we got it from the response
      if (response.totalMessages !== undefined && response.totalChunks !== undefined) {
        this.metadata = {
          totalMessages: response.totalMessages,
          totalChunks: response.totalChunks,
        };
      }

      this.loadedChunks.set(chunkIndex, {
        chunkIndex,
        messages: response.messages,
        loadedAt: Date.now(),
      });

      this.rebuildMessagesArray();
      this.notify();
    } catch (error) {
      console.error(`[ERROR] Failed to load chunk ${chunkIndex}:`, error);
      throw error;
    } finally {
      this.loadingChunks.delete(chunkIndex);
    }
  }

  private rebuildMessagesArray() {
    const chunks = Array.from(this.loadedChunks.values())
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
    
    // Reverse messages within each chunk since chunk 0 is newest
    // Then combine all chunks
    this.allMessages = chunks.flatMap(chunk => {
      // Messages in chunk are already in reverse chronological order (newest first)
      // But we want chronological order for display (oldest first)
      return [...chunk.messages].reverse();
    });
  }

  async saveMessage(message: Omit<ChatMessage, 'timestamp'>, fileData?: any): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      
      await chatAPI.saveMessage({
        mappingId: this.mappingId || undefined,
        firmName: this.firmName || undefined,
        firmAccountName: this.firmAccountName || undefined,
        chatType: this.chatType,
        message: {
          id: message.id,
          role: message.role,
          content: message.content,
          hasFile: message.hasFile,
          fileData: fileData || (message.hasFile ? message.file : undefined),
          hasToolUse: message.hasToolUse,
          chartData: message.chartData,
          toolUse: message.toolUse,
          timestamp,
        },
      });

      const newMessage: ChatMessage = {
        ...message,
        timestamp,
      };

      // Add to chunk 0 (newest messages)
      // Chunk 0 stores messages in reverse chronological order (newest first)
      // So we prepend to maintain that order
      if (this.loadedChunks.has(0)) {
        const chunk0 = this.loadedChunks.get(0)!;
        chunk0.messages.unshift(newMessage); // Prepend (newest first)
        if (chunk0.messages.length > 100) {
          chunk0.messages.pop(); // Remove oldest if over limit
        }
      } else {
        this.loadedChunks.set(0, {
          chunkIndex: 0,
          messages: [newMessage],
          loadedAt: Date.now(),
        });
      }

      if (this.metadata) {
        this.metadata.totalMessages += 1;
        // Recalculate total chunks if needed
        this.metadata.totalChunks = Math.ceil(this.metadata.totalMessages / 100);
      }

      this.rebuildMessagesArray();
      this.notify();
    } catch (error) {
      console.error('Failed to save message:', error);
      throw error;
    }
  }

  getMessages(): ChatMessage[] {
    return this.allMessages;
  }

  hasMoreChunks(): boolean {
    if (!this.metadata) return false;
    const maxLoadedChunk = Math.max(...Array.from(this.loadedChunks.keys()), -1);
    return maxLoadedChunk + 1 < this.metadata.totalChunks;
  }

  getNextChunkIndex(): number | null {
    if (!this.metadata) return null;
    const maxLoadedChunk = Math.max(...Array.from(this.loadedChunks.keys()), -1);
    const nextIndex = maxLoadedChunk + 1;
    return nextIndex < this.metadata.totalChunks ? nextIndex : null;
  }

  isLoading(): boolean {
    return this.loadingChunks.size > 0 || this.isInitializing;
  }

  getMappingId(): number | null {
    return this.mappingId;
  }
}
