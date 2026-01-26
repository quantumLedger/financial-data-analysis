# Chat History Loading Flow

## Overview

This document explains how chat history is loaded in the frontend application.

---

## Request Flow

```
User Opens Page
    ↓
ICF Mapping Data Loaded (from URL/context)
    ↓
useEffect Detects mapping_id
    ↓
Frontend → Next.js API Route (/api/chat/history)
    ↓
Next.js → Backend API (https://apis.weidentify.ai/api/chat/history)
    ↓
Backend → RDS (metadata) + S3 (content)
    ↓
Backend → Next.js → Frontend
    ↓
Messages Displayed in Chat UI
```

---

## Source of Request

### 1. **Trigger: Component Mount + ICF Mapping Available**

The chat history loading is triggered automatically when:
- The `finance/page.tsx` component mounts
- AND `icfObj.mapping_id` is available

### 2. **Location: `app/finance/page.tsx`**

**Lines 350-387**: Chat history loading logic

```typescript
// Load chat history when icfObj is available
useEffect(() => {
  async function loadChatHistory() {
    if (!icfObj || !icfObj.mapping_id) return;
    
    try {
      setIsLoadingHistory(true);
      const response = await fetch(
        `/api/chat/history?mappingId=${icfObj.mapping_id}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.session && data.messages && data.messages.length > 0) {
          setCurrentSessionId(data.session.id);
          // Convert database messages to Message format
          const loadedMessages: Message[] = data.messages.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            file: msg.file,
            chartData: msg.chartData,
            hasToolUse: msg.hasToolUse,
          }));
          setMessages(loadedMessages);
        }
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
      // Silently fail - user can start a new chat
    } finally {
      setIsLoadingHistory(false);
    }
  }
  
  loadChatHistory();
}, [icfObj?.mapping_id]);
```

---

## Request Details

### Frontend Request

**Endpoint**: `/api/chat/history` (Next.js API route)

**Method**: `GET`

**Query Parameters**:
- `mappingId` (required): From `icfObj.mapping_id`
- `sessionId` (optional): Not used in auto-load, but can be passed for specific session
- `limit` (optional): Defaults to 100

**Example Request**:
```typescript
fetch(`/api/chat/history?mappingId=${icfObj.mapping_id}`)
```

### Next.js Proxy Route

**File**: `app/api/chat/history/route.ts`

**What it does**:
1. Receives request from frontend
2. Extracts `mappingId` from query params
3. Forwards request to backend: `https://apis.weidentify.ai/api/chat/history?mappingId=123`
4. Returns backend response to frontend

**Code**:
```typescript
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mappingId = searchParams.get("mappingId");
  const sessionId = searchParams.get("sessionId");
  const limit = searchParams.get("limit") || "100";

  const backendApiUrl = process.env.BACKEND_API_URL || "https://apis.weidentify.ai";
  
  const queryParams = new URLSearchParams({
    mappingId,
    limit,
  });
  if (sessionId) {
    queryParams.append("sessionId", sessionId);
  }

  const response = await fetch(`${backendApiUrl}/api/chat/history?${queryParams.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  return NextResponse.json(await response.json());
}
```

### Backend API

**Endpoint**: `GET https://apis.weidentify.ai/api/chat/history`

**What it does**:
1. Queries RDS for message metadata (session, message IDs, S3 keys)
2. Downloads full message content from S3
3. Combines metadata + content
4. Returns to Next.js

**Response Format**:
```json
{
  "session": {
    "id": 456,
    "mappingId": 123,
    "firmName": "ROTHSCHILD",
    "accountName": "99829910",
    "sessionDate": "2026-01-21",
    "sessionNumber": 1,
    "startedAt": "2026-01-21T10:00:00Z",
    "lastUpdatedAt": "2026-01-21T10:30:00Z",
    "messageCount": 10,
    "isActive": true
  },
  "messages": [
    {
      "id": "uuid-1",
      "role": "user",
      "content": "What is the portfolio performance?",
      "hasFile": false,
      "file": null,
      "hasToolUse": false,
      "chartData": null,
      "toolUse": null,
      "timestamp": "2026-01-21T10:00:00Z"
    },
    {
      "id": "uuid-2",
      "role": "assistant",
      "content": "Here is the analysis...",
      "hasFile": false,
      "file": null,
      "hasToolUse": true,
      "chartData": { /* chart data */ },
      "toolUse": null,
      "timestamp": "2026-01-21T10:00:05Z"
    }
  ]
}
```

---

## When Does It Load?

### Automatic Loading

1. **On Page Load**: When user navigates to `/finance` page
2. **When ICF Mapping Changes**: If `icfObj.mapping_id` changes (e.g., switching accounts)
3. **Dependency**: `useEffect` depends on `icfObj?.mapping_id`

### Manual Loading (Future Enhancement)

You can also manually trigger history loading:

```typescript
// Load specific session
const loadSpecificSession = async (sessionId: number) => {
  const response = await fetch(
    `/api/chat/history?mappingId=${icfObj.mapping_id}&sessionId=${sessionId}`
  );
  const data = await response.json();
  setMessages(data.messages);
};

// Refresh current session
const refreshHistory = async () => {
  const response = await fetch(
    `/api/chat/history?mappingId=${icfObj.mapping_id}`
  );
  const data = await response.json();
  setMessages(data.messages);
};
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User Opens /finance Page                  │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  IcfProvider loads icfObj from URL/context                  │
│  icfObj = { mapping_id: 123, firm_name: "...", ... }         │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  useEffect detects icfObj.mapping_id change                 │
│  Triggers loadChatHistory()                                  │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Frontend: fetch('/api/chat/history?mappingId=123')         │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Next.js: app/api/chat/history/route.ts                      │
│  - Receives request                                        │
│  - Extracts mappingId                                      │
│  - Forwards to backend                                      │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Backend: GET /api/chat/history?mappingId=123               │
│  - Queries RDS for session metadata                        │
│  - Gets S3 keys from messages                              │
│  - Downloads content from S3                                │
│  - Combines and returns                                     │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Next.js: Returns response to frontend                     │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Frontend: Processes response                               │
│  - Sets currentSessionId                                    │
│  - Converts messages to Message[] format                    │
│  - Updates state: setMessages(loadedMessages)               │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  React re-renders with chat history displayed               │
│  User sees previous conversation                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Points

1. **Automatic**: History loads automatically when page opens (if mapping_id exists)
2. **Source**: Request originates from `app/finance/page.tsx` useEffect hook
3. **Trigger**: `icfObj.mapping_id` change
4. **Route**: Frontend → Next.js proxy → Backend API → RDS/S3 → Backend → Next.js → Frontend
5. **Silent Failure**: If loading fails, user can still start a new chat (no error shown)

---

## Current Implementation Status

✅ **Already Implemented**:
- Auto-loading on page mount
- Loading state (`isLoadingHistory`)
- Error handling (silent fail)
- Message format conversion
- Session ID tracking

🔄 **Can Be Enhanced**:
- Show loading indicator while fetching
- Show error message if loading fails
- Manual refresh button
- Load specific session from session list
- Pagination for large histories

---

## Example: Complete Request Chain

### 1. User Action
User navigates to: `https://yourapp.com/finance?icf={"mapping_id":123,...}`

### 2. Frontend Request
```typescript
// In app/finance/page.tsx
fetch(`/api/chat/history?mappingId=123`)
```

### 3. Next.js Proxy
```typescript
// In app/api/chat/history/route.ts
fetch(`https://apis.weidentify.ai/api/chat/history?mappingId=123`)
```

### 4. Backend Processing
```python
# In your backend
GET /api/chat/history?mappingId=123
→ Query RDS: SELECT * FROM chat_sessions WHERE mapping_id = 123
→ Query RDS: SELECT * FROM chat_messages WHERE session_id = 456
→ Download from S3: s3_keys = [msg.s3_key for msg in messages]
→ Combine and return
```

### 5. Response Back to Frontend
```json
{
  "session": { ... },
  "messages": [ ... ]
}
```

### 6. Frontend Updates UI
```typescript
setMessages(loadedMessages); // React re-renders with history
```

---

## Testing

### Test Auto-Load
1. Open `/finance` page with `icf` parameter containing `mapping_id`
2. Check browser Network tab
3. Should see: `GET /api/chat/history?mappingId=123`
4. Should see messages appear in chat UI

### Test Manual Load
```typescript
// In browser console
fetch('/api/chat/history?mappingId=123')
  .then(r => r.json())
  .then(console.log);
```

---

## Summary

**Request Source**: `app/finance/page.tsx` - useEffect hook (line 350-387)

**Trigger**: When `icfObj.mapping_id` is available

**Flow**: Frontend → Next.js Proxy → Backend API → RDS/S3 → Backend → Next.js → Frontend

**Result**: Previous chat messages are displayed automatically when user opens the page

