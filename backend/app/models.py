from pydantic import BaseModel
from typing import Optional, List

class SearchRequest(BaseModel):
    topic: str
    article_count: int

class Article(BaseModel):
    title: str
    url: str
    content: str

class GenerateRequest(BaseModel):
    topic: str
    main_news: List[Article]
    sponsor_text: Optional[str] = None
    prompt_of_the_day: Optional[str] = None

class NewsletterResponse(BaseModel):
    intro_html: str
    main_news_html: str
    ai_tools_html: str
    deep_finds_html: str
    interesting_ai_html: str
    sources_html: str

class SearchQueriesResponse(BaseModel):
    ai_tools_query: str
    deep_finds_query: str
    interesting_ai_query: str

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    selected_text: Optional[str] = None
    instruction: str
    chat_history: Optional[List[ChatMessage]] = []