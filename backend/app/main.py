from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from crawl4ai import AsyncWebCrawler

from app.routers import search, generate, chat, upload
from app.config import ALLOWED_ORIGINS, get_logger # 환경 변수 등 초기화

logger = get_logger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("크롤러 초기화 중...")
    crawler = AsyncWebCrawler()
    await crawler.start()
    app.state.crawler = crawler
    try:
        yield
    finally:
        logger.info("크롤러 종료 중...")
        import asyncio
        try:
            await crawler.close()
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.warning(f"크롤러 종료 중 예외 발생 (무시됨): {e}")

app = FastAPI(lifespan=lifespan)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # Environment-based CORS
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# 라우터 등록 (기존 api 경로 유지)
app.include_router(search.router, prefix="/api")
app.include_router(generate.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(upload.router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)