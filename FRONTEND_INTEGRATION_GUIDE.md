# Chat History API - Frontend Integration Guide

## Overview

This guide provides complete frontend integration examples for the Chat History Storage API. The API uses a hybrid approach:
- **Metadata** stored in MySQL (RDS)
- **Full message content** stored in S3

---

## API Endpoints

### Base URL
```
https://apis.weidentify.ai/api/chat
```

### Endpoints
1. `POST /api/chat/save` - Save a chat message
2. `GET /api/chat/history` - Load chat history
3. `GET /api/chat/sessions` - List all sessions

---

## 1. Save Chat Message

### Endpoint
```
POST /api/chat/save
```

### Request Headers
```javascript
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <access_token>"  // Required if auth is enabled
}
```

### Request Body
```typescript
interface SaveMessageRequest {
  mappingId: number;
  firmName: string;
  accountName: string;
  message: {
    id: string;                    // UUID from frontend
    role: "user" | "assistant";
    content: string;                // Full message text
    hasFile: boolean;
    fileData: object | null;        // File data if hasFile is true
    hasToolUse: boolean;
    chartData: object | null;       // Chart data if present
    toolUse: object | null;         // Tool usage data if present
    timestamp?: string;              // ISO format (optional, defaults to now)
  };
}
```

### Response (200 OK)
```typescript
interface SaveMessageResponse {
  success: boolean;
  sessionId: number;
  messageId: number;
  timestamp: string;  // ISO format
}
```

### Error Responses
- `400 Bad Request` - Invalid request data
- `404 Not Found` - Mapping ID not found
- `500 Internal Server Error` - Server error

---

## 2. Load Chat History

### Endpoint
```
GET /api/chat/history
```

### Query Parameters
- `mappingId` (required): ICF mapping ID
- `sessionId` (optional): Specific session ID to load
- `limit` (optional, default: 100): Max messages to return

### Request Headers
```javascript
{
  "Authorization": "Bearer <access_token>"  // Required if auth is enabled
}
```

### Response (200 OK)
```typescript
interface ChatHistoryResponse {
  session: {
    id: number;
    mappingId: number;
    firmName: string;
    accountName: string;
    sessionDate: string;        // ISO date format "YYYY-MM-DD"
    sessionNumber: number;
    startedAt: string;          // ISO datetime with Z
    lastUpdatedAt: string;      // ISO datetime with Z
    messageCount: number;
    isActive: boolean;
  } | null;  // null if no session exists
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    hasFile: boolean;
    file: object | null;
    hasToolUse: boolean;
    chartData: object | null;
    toolUse: object | null;
    timestamp: string;          // ISO datetime with Z
  }>;
}
```

### Empty Response (No Session)
```json
{
  "session": null,
  "messages": []
}
```

---

## 3. List Sessions

### Endpoint
```
GET /api/chat/sessions
```

### Query Parameters
- `mappingId` (required): ICF mapping ID
- `limit` (optional, default: 50): Max sessions to return

### Request Headers
```javascript
{
  "Authorization": "Bearer <access_token>"  // Required if auth is enabled
}
```

### Response (200 OK)
```typescript
interface SessionsListResponse {
  sessions: Array<{
    id: number;
    mappingId: number;
    firmName: string;
    accountName: string;
    sessionDate: string;
    sessionNumber: number;
    startedAt: string;
    lastUpdatedAt: string;
    messageCount: number;
    isActive: boolean;
  }>;
}
```

---

## Frontend Integration Examples

### JavaScript/TypeScript with Fetch API

```typescript
// Configuration
const API_BASE_URL = 'https://apis.weidentify.ai/api/chat';
const getAuthToken = () => localStorage.getItem('access_token'); // Your auth token getter

// Types
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  hasFile: boolean;
  fileData: any | null;
  hasToolUse: boolean;
  chartData: any | null;
  toolUse: any | null;
  timestamp?: string;
}

interface SaveMessagePayload {
  mappingId: number;
  firmName: string;
  accountName: string;
  message: ChatMessage;
}

// 1. Save Chat Message
async function saveChatMessage(
  mappingId: number,
  firmName: string,
  accountName: string,
  message: ChatMessage
): Promise<{ success: boolean; sessionId: number; messageId: number; timestamp: string }> {
  try {
    const payload: SaveMessagePayload = {
      mappingId,
      firmName,
      accountName,
      message: {
        ...message,
        timestamp: message.timestamp || new Date().toISOString()
      }
    };

    const response = await fetch(`${API_BASE_URL}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error saving chat message:', error);
    throw error;
  }
}

// 2. Load Chat History
async function loadChatHistory(
  mappingId: number,
  sessionId?: number,
  limit: number = 100
): Promise<{ session: any | null; messages: ChatMessage[] }> {
  try {
    const params = new URLSearchParams({
      mappingId: mappingId.toString(),
      limit: limit.toString()
    });
    
    if (sessionId) {
      params.append('sessionId', sessionId.toString());
    }

    const response = await fetch(`${API_BASE_URL}/history?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error loading chat history:', error);
    throw error;
  }
}

// 3. List All Sessions
async function listChatSessions(
  mappingId: number,
  limit: number = 50
): Promise<{ sessions: any[] }> {
  try {
    const params = new URLSearchParams({
      mappingId: mappingId.toString(),
      limit: limit.toString()
    });

    const response = await fetch(`${API_BASE_URL}/sessions?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing sessions:', error);
    throw error;
  }
}
```

---

## React Hook Example

```typescript
import { useState, useEffect, useCallback } from 'react';

interface UseChatHistoryProps {
  mappingId: number;
  firmName: string;
  accountName: string;
}

export function useChatHistory({ mappingId, firmName, accountName }: UseChatHistoryProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load chat history
  const loadHistory = useCallback(async (sessionId?: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadChatHistory(mappingId, sessionId);
      setMessages(data.messages || []);
      setSession(data.session);
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to load chat history:', err);
    } finally {
      setLoading(false);
    }
  }, [mappingId]);

  // Save a message
  const saveMessage = useCallback(async (message: ChatMessage) => {
    try {
      const result = await saveChatMessage(mappingId, firmName, accountName, message);
      
      // Reload history to get updated messages
      await loadHistory(result.sessionId);
      
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [mappingId, firmName, accountName, loadHistory]);

  // Load history on mount
  useEffect(() => {
    if (mappingId) {
      loadHistory();
    }
  }, [mappingId, loadHistory]);

  return {
    messages,
    session,
    loading,
    error,
    loadHistory,
    saveMessage,
    refresh: () => loadHistory(session?.id)
  };
}
```

---

## React Component Example

```tsx
import React, { useState } from 'react';
import { useChatHistory } from './useChatHistory';

interface ChatComponentProps {
  mappingId: number;
  firmName: string;
  accountName: string;
}

export const ChatComponent: React.FC<ChatComponentProps> = ({
  mappingId,
  firmName,
  accountName
}) => {
  const { messages, session, loading, error, saveMessage } = useChatHistory({
    mappingId,
    firmName,
    accountName
  });
  
  const [input, setInput] = useState('');

  const handleSend = async () => {
    if (!input.trim()) return;

    const message: ChatMessage = {
      id: crypto.randomUUID(), // or use uuid library
      role: 'user',
      content: input,
      hasFile: false,
      fileData: null,
      hasToolUse: false,
      chartData: null,
      toolUse: null
    };

    try {
      await saveMessage(message);
      setInput('');
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  return (
    <div className="chat-container">
      {error && <div className="error">{error}</div>}
      
      <div className="messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="role">{msg.role}</div>
            <div className="content">{msg.content}</div>
            {msg.hasFile && msg.file && (
              <div className="file">File attached</div>
            )}
            {msg.chartData && (
              <div className="chart">Chart data available</div>
            )}
          </div>
        ))}
      </div>

      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type your message..."
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>

      {session && (
        <div className="session-info">
          Session #{session.sessionNumber} - {session.messageCount} messages
        </div>
      )}
    </div>
  );
};
```

---

## Axios Example

```typescript
import axios from 'axios';

const chatAPI = axios.create({
  baseURL: 'https://apis.weidentify.ai/api/chat',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token interceptor
chatAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Save message
export const saveMessage = async (payload: SaveMessagePayload) => {
  const response = await chatAPI.post('/save', payload);
  return response.data;
};

// Load history
export const loadHistory = async (mappingId: number, sessionId?: number, limit = 100) => {
  const params: any = { mappingId, limit };
  if (sessionId) params.sessionId = sessionId;
  
  const response = await chatAPI.get('/history', { params });
  return response.data;
};

// List sessions
export const listSessions = async (mappingId: number, limit = 50) => {
  const response = await chatAPI.get('/sessions', {
    params: { mappingId, limit }
  });
  return response.data;
};
```

---

## Usage Examples

### Example 1: Save a User Message

```typescript
const message: ChatMessage = {
  id: crypto.randomUUID(),
  role: 'user',
  content: 'What is the portfolio performance?',
  hasFile: false,
  fileData: null,
  hasToolUse: false,
  chartData: null,
  toolUse: null
};

const result = await saveChatMessage(123, 'ROTHSCHILD', '99829910', message);
console.log('Message saved:', result);
// Output: { success: true, sessionId: 456, messageId: 789, timestamp: "2026-01-21T10:30:00Z" }
```

### Example 2: Save an Assistant Message with Chart

```typescript
const assistantMessage: ChatMessage = {
  id: crypto.randomUUID(),
  role: 'assistant',
  content: 'Here is the portfolio performance analysis.',
  hasFile: false,
  fileData: null,
  hasToolUse: false,
  chartData: {
    type: 'line',
    data: { /* chart data */ }
  },
  toolUse: null
};

await saveChatMessage(123, 'ROTHSCHILD', '99829910', assistantMessage);
```

### Example 3: Load Latest Chat History

```typescript
const history = await loadChatHistory(123);
console.log('Session:', history.session);
console.log('Messages:', history.messages);
```

### Example 4: Load Specific Session

```typescript
const history = await loadChatHistory(123, sessionId: 456);
```

### Example 5: List All Sessions

```typescript
const { sessions } = await listChatSessions(123);
sessions.forEach(session => {
  console.log(`Session ${session.sessionNumber}: ${session.messageCount} messages`);
});
```

---

## Error Handling

```typescript
async function saveMessageWithErrorHandling(message: ChatMessage) {
  try {
    const result = await saveChatMessage(123, 'ROTHSCHILD', '99829910', message);
    return result;
  } catch (error: any) {
    if (error.message.includes('404')) {
      console.error('Mapping ID not found');
      // Handle: Show error to user, maybe redirect
    } else if (error.message.includes('400')) {
      console.error('Invalid request data');
      // Handle: Validate input and retry
    } else if (error.message.includes('500')) {
      console.error('Server error');
      // Handle: Retry with exponential backoff
    } else {
      console.error('Network error:', error);
      // Handle: Check connection, show offline message
    }
    throw error;
  }
}
```

---

## Session Management Notes

1. **Automatic Session Creation**: A new session is created if:
   - No active session exists, OR
   - Last message was > 30 minutes ago

2. **Session Numbering**: Sessions are numbered sequentially per day per mapping (1, 2, 3...)

3. **Active Session**: The API automatically finds/creates the active session when saving messages

4. **Loading History**: 
   - Without `sessionId`: Loads latest session
   - With `sessionId`: Loads that specific session

---

## Best Practices

1. **Message IDs**: Always generate UUIDs on the frontend for message IDs
2. **Error Handling**: Always wrap API calls in try-catch blocks
3. **Loading States**: Show loading indicators during API calls
4. **Optimistic Updates**: Update UI immediately, then sync with server
5. **Retry Logic**: Implement retry for failed requests (especially for save operations)
6. **Caching**: Cache loaded history to reduce API calls
7. **Pagination**: Use `limit` parameter for large message lists

---

## Testing with cURL

```bash
# Save message
curl -X POST https://apis.weidentify.ai/api/chat/save \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "mappingId": 123,
    "firmName": "ROTHSCHILD",
    "accountName": "99829910",
    "message": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "role": "user",
      "content": "What is the portfolio performance?",
      "hasFile": false,
      "fileData": null,
      "hasToolUse": false,
      "chartData": null,
      "toolUse": null
    }
  }'

# Load history
curl "https://apis.weidentify.ai/api/chat/history?mappingId=123&limit=100" \
  -H "Authorization: Bearer YOUR_TOKEN"

# List sessions
curl "https://apis.weidentify.ai/api/chat/sessions?mappingId=123&limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## TypeScript Type Definitions

For full type safety, you can create a `types/chat.ts` file:

```typescript
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  hasFile: boolean;
  fileData: any | null;
  hasToolUse: boolean;
  chartData: any | null;
  toolUse: any | null;
  timestamp?: string;
}

export interface SaveMessageRequest {
  mappingId: number;
  firmName: string;
  accountName: string;
  message: ChatMessage;
}

export interface SaveMessageResponse {
  success: boolean;
  sessionId: number;
  messageId: number;
  timestamp: string;
}

export interface ChatSession {
  id: number;
  mappingId: number;
  firmName: string;
  accountName: string;
  sessionDate: string;
  sessionNumber: number;
  startedAt: string;
  lastUpdatedAt: string;
  messageCount: number;
  isActive: boolean;
}

export interface ChatHistoryResponse {
  session: ChatSession | null;
  messages: ChatMessage[];
}

export interface SessionsListResponse {
  sessions: ChatSession[];
}
```

---

## Quick Reference

| Action | Method | Endpoint | Required Params |
|--------|--------|----------|----------------|
| Save Message | POST | `/api/chat/save` | `mappingId`, `firmName`, `accountName`, `message` |
| Load History | GET | `/api/chat/history` | `mappingId` |
| Load Specific Session | GET | `/api/chat/history` | `mappingId`, `sessionId` |
| List Sessions | GET | `/api/chat/sessions` | `mappingId` |

---

## Support

For issues or questions:
- Check API response error messages
- Verify `mappingId` exists in your system
- Ensure authentication token is valid
- Check network connectivity

