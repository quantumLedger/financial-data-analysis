# Backend Implementation Guide: Chat History API

## Overview

This guide provides complete implementation details for adding chat history storage to your existing backend API. The implementation follows your existing SQLAlchemy pattern and integrates with your `icfMapping` table.

---

## Database Models

### 1. ChatSession Model

```python
from sqlalchemy import Column, Integer, String, Date, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.sql import func
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime
import uuid

Base = declarative_base()

class ChatSession(Base):
    __tablename__ = 'chat_sessions'

    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Foreign key to icfMapping table (assuming it has an id column)
    mapping_id = Column(Integer, ForeignKey('icf_mapping.id'), nullable=False, index=True)
    
    firm_name = Column(String(255), nullable=True)
    account_name = Column(String(255), nullable=True)
    
    session_date = Column(Date, nullable=False, index=True)
    session_number = Column(Integer, nullable=False)
    
    started_at = Column(DateTime, default=func.now(), nullable=False)
    last_updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    
    message_count = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationship to messages
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")
    
    # Unique constraint: one session per mapping per date per session number
    __table_args__ = (
        {'mysql_engine': 'InnoDB'},
    )
```

### 2. ChatMessage Model

```python
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime

class ChatMessage(Base):
    __tablename__ = 'chat_messages'

    id = Column(Integer, primary_key=True, autoincrement=True)
    
    session_id = Column(Integer, ForeignKey('chat_sessions.id', ondelete='CASCADE'), nullable=False, index=True)
    
    # Unique message ID (UUID from frontend)
    message_id = Column(String(255), nullable=False)
    
    role = Column(String(20), nullable=False)  # 'user' or 'assistant'
    
    # S3 key where full message content is stored
    s3_key = Column(String(1024), nullable=False)
    
    # Preview of content (first 500 chars) for quick display/search
    content_preview = Column(Text, nullable=True)
    
    # Flags for quick filtering
    has_file = Column(Boolean, default=False, nullable=False)
    has_tool_use = Column(Boolean, default=False, nullable=False)
    has_chart = Column(Boolean, default=False, nullable=False)
    
    timestamp = Column(DateTime, default=func.now(), nullable=False)
    message_order = Column(Integer, nullable=False)
    
    # Relationship to session
    session = relationship("ChatSession", back_populates="messages")
    
    # Unique constraint: one message_id per session
    __table_args__ = (
        {'mysql_engine': 'InnoDB'},
    )
```

---

## Pydantic Schemas

### Request/Response Models

```python
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date

# ============ Save Message ============

class ChatMessageContent(BaseModel):
    id: str = Field(..., description="Unique message ID (UUID)")
    role: str = Field(..., description="Message role: 'user' or 'assistant'")
    content: str = Field(..., description="Message content text")
    hasFile: Optional[bool] = Field(False, description="Whether message contains file")
    fileData: Optional[Dict[str, Any]] = Field(None, description="File data if hasFile is true")
    hasToolUse: Optional[bool] = Field(False, description="Whether message contains tool use")
    chartData: Optional[Dict[str, Any]] = Field(None, description="Chart data if present")
    toolUse: Optional[Dict[str, Any]] = Field(None, description="Tool use data if present")

class SaveMessageRequest(BaseModel):
    mappingId: int = Field(..., description="ICF mapping ID from icfMapping table")
    firmName: str = Field(..., max_length=255, description="Firm name")
    accountName: str = Field(..., max_length=255, description="Account name")
    message: ChatMessageContent = Field(..., description="Message to save")

class SaveMessageResponse(BaseModel):
    success: bool
    sessionId: int
    messageId: int
    timestamp: datetime

# ============ Load History ============

class ChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    hasFile: bool
    file: Optional[Dict[str, Any]]
    hasToolUse: bool
    chartData: Optional[Dict[str, Any]]
    toolUse: Optional[Dict[str, Any]]
    timestamp: datetime

class ChatSessionResponse(BaseModel):
    id: int
    mappingId: int
    firmName: Optional[str]
    accountName: Optional[str]
    sessionDate: date
    sessionNumber: int
    startedAt: datetime
    lastUpdatedAt: datetime
    messageCount: int
    isActive: bool

class LoadHistoryResponse(BaseModel):
    session: Optional[ChatSessionResponse]
    messages: List[ChatMessageResponse]

# ============ List Sessions ============

class ListSessionsResponse(BaseModel):
    sessions: List[ChatSessionResponse]
```

---

## AWS S3 Integration

### S3 Key Generation

```python
from datetime import date
from typing import Optional

def generate_s3_key(mapping_id: int, session_date: date, session_number: int, message_order: int) -> str:
    """
    Generate S3 key for message storage.
    Format: financial_ai_analyst_chats/chat_history_{mappingId}/chat_messages_{date}_{sessionNumber}/chat_message_{order}.json
    """
    date_str = session_date.strftime("%Y-%m-%d")
    return f"financial_ai_analyst_chats/chat_history_{mapping_id}/chat_messages_{date_str}_{session_number}/chat_message_{message_order}.json"
```

### S3 Upload/Download Functions

```python
import boto3
import json
from botocore.exceptions import ClientError
from typing import Dict, Any, List

# Initialize S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_REGION', 'us-east-1')
)

S3_BUCKET_NAME = os.getenv('AWS_S3_BUCKET_NAME')

def upload_message_to_s3(s3_key: str, message_data: Dict[str, Any]) -> None:
    """Upload message content to S3"""
    try:
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=s3_key,
            Body=json.dumps(message_data, ensure_ascii=False),
            ContentType='application/json'
        )
    except ClientError as e:
        raise Exception(f"Failed to upload to S3: {str(e)}")

def download_message_from_s3(s3_key: str) -> Dict[str, Any]:
    """Download message content from S3"""
    try:
        response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key=s3_key)
        content = response['Body'].read().decode('utf-8')
        return json.loads(content)
    except ClientError as e:
        raise Exception(f"Failed to download from S3: {str(e)}")

def download_messages_from_s3(s3_keys: List[str]) -> List[Dict[str, Any]]:
    """Download multiple messages from S3 in parallel"""
    import concurrent.futures
    
    def download_one(key: str) -> Dict[str, Any]:
        try:
            return download_message_from_s3(key)
        except Exception as e:
            print(f"Error downloading {key}: {e}")
            return None
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(download_one, s3_keys))
    
    # Filter out None results
    return [msg for msg in results if msg is not None]
```

---

## Business Logic Functions

### Session Management

```python
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
from typing import Optional

def get_or_create_session(
    db: Session,
    mapping_id: int,
    firm_name: str,
    account_name: str
) -> ChatSession:
    """
    Get active session (within last 30 minutes) or create new one.
    Returns session ID.
    """
    today = date.today()
    thirty_minutes_ago = datetime.utcnow() - timedelta(minutes=30)
    
    # Check for active session today (within last 30 minutes)
    recent_session = db.query(ChatSession).filter(
        ChatSession.mapping_id == mapping_id,
        ChatSession.session_date == today,
        ChatSession.is_active == True,
        ChatSession.last_updated_at > thirty_minutes_ago
    ).order_by(ChatSession.session_number.desc()).first()
    
    if recent_session:
        return recent_session
    
    # Get next session number for today
    max_session = db.query(
        func.coalesce(func.max(ChatSession.session_number), 0)
    ).filter(
        ChatSession.mapping_id == mapping_id,
        ChatSession.session_date == today
    ).scalar()
    
    next_session_number = (max_session or 0) + 1
    
    # Create new session
    new_session = ChatSession(
        mapping_id=mapping_id,
        firm_name=firm_name,
        account_name=account_name,
        session_date=today,
        session_number=next_session_number,
        started_at=datetime.utcnow(),
        last_updated_at=datetime.utcnow(),
        message_count=0,
        is_active=True
    )
    
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    
    return new_session

def get_next_message_order(db: Session, session_id: int) -> int:
    """Get next message order number for a session"""
    max_order = db.query(
        func.coalesce(func.max(ChatMessage.message_order), -1)
    ).filter(
        ChatMessage.session_id == session_id
    ).scalar()
    
    return (max_order or -1) + 1
```

---

## API Endpoints

### 1. POST `/api/chat/save`

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime

router = APIRouter(prefix="/api/chat", tags=["chat"])

@router.post("/save", response_model=SaveMessageResponse)
async def save_chat_message(
    request: SaveMessageRequest,
    db: Session = Depends(get_db)  # Your existing DB dependency
):
    """
    Save a chat message to RDS (metadata) and S3 (content).
    """
    try:
        # Validate mapping_id exists in icfMapping table (if needed)
        # You can add this check if you want to validate the mapping exists
        # icf_mapping = db.query(IcfMapping).filter(IcfMapping.id == request.mappingId).first()
        # if not icf_mapping:
        #     raise HTTPException(status_code=404, detail="ICF mapping not found")
        
        # Get or create session
        session = get_or_create_session(
            db=db,
            mapping_id=request.mappingId,
            firm_name=request.firmName,
            account_name=request.accountName
        )
        
        # Get next message order
        message_order = get_next_message_order(db, session.id)
        
        # Generate S3 key
        s3_key = generate_s3_key(
            mapping_id=request.mappingId,
            session_date=session.session_date,
            session_number=session.session_number,
            message_order=message_order
        )
        
        # Prepare message data for S3
        message_data_for_s3 = {
            "id": request.message.id,
            "role": request.message.role,
            "content": request.message.content,
            "hasFile": request.message.hasFile or False,
            "fileData": request.message.fileData,
            "hasToolUse": request.message.hasToolUse or False,
            "chartData": request.message.chartData,
            "toolUse": request.message.toolUse,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Upload to S3
        try:
            upload_message_to_s3(s3_key, message_data_for_s3)
        except Exception as s3_error:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload message to S3: {str(s3_error)}"
            )
        
        # Create content preview (first 500 chars)
        content_preview = request.message.content[:500]
        if len(request.message.content) > 500:
            content_preview += "..."
        
        # Save metadata to database
        chat_message = ChatMessage(
            session_id=session.id,
            message_id=request.message.id,
            role=request.message.role,
            s3_key=s3_key,
            content_preview=content_preview,
            has_file=request.message.hasFile or False,
            has_tool_use=request.message.hasToolUse or False,
            has_chart=bool(request.message.chartData),
            message_order=message_order,
            timestamp=datetime.utcnow()
        )
        
        db.add(chat_message)
        
        # Update session message count and last_updated_at
        session.message_count += 1
        session.last_updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(chat_message)
        
        return SaveMessageResponse(
            success=True,
            sessionId=session.id,
            messageId=chat_message.id,
            timestamp=chat_message.timestamp
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save message: {str(e)}"
        )
```

### 2. GET `/api/chat/history`

```python
@router.get("/history", response_model=LoadHistoryResponse)
async def load_chat_history(
    mappingId: int,
    sessionId: Optional[int] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Load chat history for a mapping ID, optionally for a specific session.
    """
    try:
        # If sessionId provided, load specific session
        if sessionId:
            session = db.query(ChatSession).filter(
                ChatSession.id == sessionId,
                ChatSession.mapping_id == mappingId
            ).first()
            
            if not session:
                raise HTTPException(
                    status_code=404,
                    detail="Session not found"
                )
        else:
            # Load latest active session
            session = db.query(ChatSession).filter(
                ChatSession.mapping_id == mappingId,
                ChatSession.is_active == True
            ).order_by(ChatSession.last_updated_at.desc()).first()
        
        if not session:
            return LoadHistoryResponse(session=None, messages=[])
        
        # Load message metadata from database
        message_metadata = db.query(ChatMessage).filter(
            ChatMessage.session_id == session.id
        ).order_by(ChatMessage.message_order.asc()).limit(limit).all()
        
        if not message_metadata:
            return LoadHistoryResponse(
                session=ChatSessionResponse(
                    id=session.id,
                    mappingId=session.mapping_id,
                    firmName=session.firm_name,
                    accountName=session.account_name,
                    sessionDate=session.session_date,
                    sessionNumber=session.session_number,
                    startedAt=session.started_at,
                    lastUpdatedAt=session.last_updated_at,
                    messageCount=session.message_count,
                    isActive=session.is_active
                ),
                messages=[]
            )
        
        # Download message content from S3
        s3_keys = [msg.s3_key for msg in message_metadata]
        message_contents = download_messages_from_s3(s3_keys)
        
        # Create a map of s3_key to content for quick lookup
        content_map = {msg.s3_key: content for msg, content in zip(message_metadata, message_contents)}
        
        # Combine metadata with S3 content
        messages = []
        for msg_meta in message_metadata:
            content = content_map.get(msg_meta.s3_key, {})
            
            messages.append(ChatMessageResponse(
                id=msg_meta.message_id,
                role=msg_meta.role,
                content=content.get("content", ""),
                hasFile=msg_meta.has_file,
                file=content.get("fileData") if msg_meta.has_file else None,
                hasToolUse=msg_meta.has_tool_use,
                chartData=content.get("chartData") if msg_meta.has_chart else None,
                toolUse=content.get("toolUse") if msg_meta.has_tool_use else None,
                timestamp=msg_meta.timestamp
            ))
        
        return LoadHistoryResponse(
            session=ChatSessionResponse(
                id=session.id,
                mappingId=session.mapping_id,
                firmName=session.firm_name,
                accountName=session.account_name,
                sessionDate=session.session_date,
                sessionNumber=session.session_number,
                startedAt=session.started_at,
                lastUpdatedAt=session.last_updated_at,
                messageCount=session.message_count,
                isActive=session.is_active
            ),
            messages=messages
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load chat history: {str(e)}"
        )
```

### 3. GET `/api/chat/sessions`

```python
@router.get("/sessions", response_model=ListSessionsResponse)
async def list_chat_sessions(
    mappingId: int,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    List all chat sessions for a mapping ID.
    """
    try:
        sessions = db.query(ChatSession).filter(
            ChatSession.mapping_id == mappingId
        ).order_by(ChatSession.last_updated_at.desc()).limit(limit).all()
        
        session_list = [
            ChatSessionResponse(
                id=session.id,
                mappingId=session.mapping_id,
                firmName=session.firm_name,
                accountName=session.account_name,
                sessionDate=session.session_date,
                sessionNumber=session.session_number,
                startedAt=session.started_at,
                lastUpdatedAt=session.last_updated_at,
                messageCount=session.message_count,
                isActive=session.is_active
            )
            for session in sessions
        ]
        
        return ListSessionsResponse(sessions=session_list)
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load sessions: {str(e)}"
        )
```

---

## Database Migration

### Create Tables SQL (MySQL/MariaDB)

```sql
-- Chat Sessions Table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mapping_id INT NOT NULL,
    firm_name VARCHAR(255),
    account_name VARCHAR(255),
    session_date DATE NOT NULL,
    session_number INT NOT NULL,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    message_count INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    INDEX idx_mapping_id (mapping_id),
    INDEX idx_session_date (session_date),
    INDEX idx_mapping_date_active (mapping_id, session_date, is_active),
    FOREIGN KEY (mapping_id) REFERENCES icf_mapping(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    message_id VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    s3_key VARCHAR(1024) NOT NULL,
    content_preview TEXT,
    has_file BOOLEAN NOT NULL DEFAULT FALSE,
    has_tool_use BOOLEAN NOT NULL DEFAULT FALSE,
    has_chart BOOLEAN NOT NULL DEFAULT FALSE,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    message_order INT NOT NULL,
    INDEX idx_session_id (session_id),
    INDEX idx_message_id (message_id),
    UNIQUE KEY unique_session_message (session_id, message_id),
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## Environment Variables

Add these to your backend `.env`:

```env
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET_NAME=your_bucket_name
```

---

## Testing

### Test Save Message

```bash
curl -X POST https://apis.weidentify.ai/api/chat/save \
  -H "Content-Type: application/json" \
  -d '{
    "mappingId": 123,
    "firmName": "Test Firm",
    "accountName": "Test Account",
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
```

### Test Load History

```bash
curl "https://apis.weidentify.ai/api/chat/history?mappingId=123&limit=50"
```

### Test List Sessions

```bash
curl "https://apis.weidentify.ai/api/chat/sessions?mappingId=123&limit=20"
```

---

## Important Notes

1. **mapping_id**: This comes from your `icfMapping` table. The foreign key relationship ensures data integrity.

2. **Session Management**: Sessions are automatically created if no active session exists (within 30 minutes). Each day can have multiple sessions (session_number increments).

3. **S3 Storage**: Full message content is stored in S3. Database only stores metadata for fast queries.

4. **Error Handling**: All endpoints should handle:
   - Database connection failures
   - S3 upload/download failures
   - Invalid mapping_id
   - Missing sessions

5. **Performance**: S3 downloads are done in parallel for better performance when loading history.

6. **Security**: Ensure your S3 bucket has proper IAM policies and your database has proper access controls.

