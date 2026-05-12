from fastapi import APIRouter, Request
import asyncio
from app.models import GenerateRequest
from app.services.crawler import crawl_articles
from app.services.llm import generate_search_queries
from app.services.newsletter import generate_newsletter_with_gemini
from app.config import get_logger

logger = get_logger(__name__)

router = APIRouter()

@router.post("/generate")
async def generate_newsletter(request: GenerateRequest, fastapi_req: Request):
    if not request.main_news:
        return {"html": "<p>선택된 메인 뉴스가 없어 뉴스레터를 생성할 수 없습니다.</p>"}
        
    main_news_dict = [{"title": a.title, "url": a.url, "content": a.content} for a in request.main_news]
    
    # 비동기로 맞춤형 검색어 생성
    queries = await generate_search_queries(request.topic)
    
    crawler = fastapi_req.app.state.crawler
    
    # 비동기로 자동 크롤링 병렬 실행
    ai_tools, deep_finds, interesting_ai = await asyncio.gather(
        crawl_articles(queries.get("ai_tools_query", f"new AI startup tools launch producthunt {request.topic}"), 3, crawler),
        crawl_articles(queries.get("deep_finds_query", f"arXiv research paper {request.topic} AI"), 3, crawler),
        crawl_articles(queries.get("interesting_ai_query", f"new AI hardware gadget wearable robot release {request.topic}"), 2, crawler)
    )
    
    html_content = await generate_newsletter_with_gemini(
        request.topic, 
        main_news_dict, 
        ai_tools, 
        deep_finds, 
        interesting_ai,
        request.sponsor_text,
        request.prompt_of_the_day
    )
    
    logger.info("뉴스레터 생성 완료!")
    
    return {"html": html_content}
