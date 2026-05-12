from fastapi import APIRouter, Request
from app.models import SearchRequest
from app.services.crawler import crawl_articles

router = APIRouter()

@router.post("/search")
async def search_articles(request: SearchRequest, fastapi_req: Request):
    crawler = fastapi_req.app.state.crawler
    articles = await crawl_articles(request.topic, request.article_count, crawler)
    return {"articles": articles}