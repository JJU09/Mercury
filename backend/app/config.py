import os
import logging
from dotenv import load_dotenv

# 환경 변수 로드 (.env 파일에서 GEMINI_API_KEY 등 로드)
load_dotenv()

CONTENT_MAX_CHARS = 2000

# CORS 설정
ALLOWED_ORIGINS = [
    origin.strip() 
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") 
    if origin.strip()
]

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

def get_logger(name: str):
    return logging.getLogger(name)