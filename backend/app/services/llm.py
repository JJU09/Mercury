import os
import re
import asyncio
from typing import Optional, Type, AsyncGenerator, List
from fastapi import HTTPException
from litellm import acompletion
from litellm.exceptions import AuthenticationError
from pydantic import BaseModel, Field
from app.models import SearchQueriesResponse
from app.config import get_logger

logger = get_logger(__name__)

async def call_gemini_with_retry(prompt: str, max_retries: int = 3, initial_delay: int = 2, is_json: bool = False, response_schema: Optional[Type[BaseModel]] = None) -> str:
    
    base_url = os.getenv("LITELLM_BASE_URL", "https://litellm.must.codes")
    model_name = "gemini/gemini-3-flash-preview"
    
    kwargs = {
        "model": model_name, 
        "messages": [{"role": "user", "content": prompt}],
    }
    
    if base_url:
        kwargs["api_base"] = base_url
        kwargs["api_key"] = os.getenv("LITELLM_API_KEY", "")
        kwargs["custom_llm_provider"] = "openai"
        
    safe_kwargs = kwargs.copy()
    if "api_key" in safe_kwargs and safe_kwargs["api_key"]:
        safe_kwargs["api_key"] = "***"
        
    for attempt in range(max_retries):
        try:
            logger.info(f"LLM API 호출 시도 {attempt + 1}/{max_retries} (model={model_name})")
            response = await acompletion(**kwargs)
            result_text = response.choices[0].message.content
            
            if is_json and result_text:
                result_text = result_text.strip()
                result_text = re.sub(r'^```json\s*', '', result_text, flags=re.IGNORECASE)
                result_text = re.sub(r'^```\s*', '', result_text)
                result_text = re.sub(r'\s*```$', '', result_text)
                result_text = result_text.strip()
                
            return result_text
            
        except AuthenticationError as e:
             logger.error("AuthenticationError: API 키가 유효하지 않거나 만료되었습니다.")
             raise HTTPException(status_code=401, detail="API 키가 유효하지 않거나 만료되었습니다.")
        except Exception as e:
            logger.warning(f"LLM API 호출 실패 (시도 {attempt + 1}/{max_retries}): {e}")
            if attempt == max_retries - 1:
                logger.error(f"LLM API 호출에 실패했습니다 (최대 재시도 초과): {e}")
                raise HTTPException(status_code=500, detail=f"LLM API 호출에 실패했습니다 (최대 재시도 초과): {e}")
            
            await asyncio.sleep(initial_delay * (2 ** attempt))
            
    raise HTTPException(status_code=500, detail="LLM API 호출에 실패했습니다.")

async def stream_gemini_response(prompt: str) -> AsyncGenerator[str, None]:
    base_url = os.getenv("LITELLM_BASE_URL", "https://litellm.must.codes")
    model_name = "gemini/gemini-2.5-pro"
    
    kwargs = {
        "model": model_name,
        "messages": [{"role": "user", "content": prompt}],
        "stream": True
    }
    
    if base_url:
        kwargs["api_base"] = base_url
        kwargs["api_key"] = os.getenv("LITELLM_API_KEY", "")
        kwargs["custom_llm_provider"] = "openai"
        
    try:
        response_stream = await acompletion(**kwargs)
        async for chunk in response_stream:
            content = chunk.choices[0].delta.content
            if content:
                yield content
    except Exception as e:
        logger.error(f"LLM streaming error: {e}")
        yield f"<chat>처리 중 오류가 발생했습니다: {str(e)}</chat>"

class ArticleSelectionResponse(BaseModel):
    selected_indices: List[int] = Field(description="선택된 기사의 인덱스 리스트")

async def filter_interesting_articles(topic: str, articles_titles: List[str], count: int) -> List[int]:
    logger.info(f"[{topic}] 주제에 대해 흥미로운 기사 선별 중 (후보: {len(articles_titles)}개, 목표: {count}개)")
    
    titles_with_index = "\n".join([f"{i}. {title}" for i, title in enumerate(articles_titles)])
    
    prompt = f"""당신은 테크 뉴스레터 전문 편집자입니다. 
사용자의 관심 주제('{topic}')와 관련된 기사 제목 리스트를 보고, 테크/IT 종사자들이 읽었을 때 가장 흥미롭고 기술적 통찰력을 얻을 수 있는 기사를 {count}개만 선택해 주세요.

[선택 기준]
1. 단순히 기업의 실적, 사업 확장, 단순 제휴 기사는 제외하세요.
2. 새로운 기술의 출시, 오픈소스 공개, 논문 요약, 심도 있는 튜토리얼, 아키텍처 관련 기사를 우선시하세요.
3. '{topic}' 주제와 가장 밀접하고 참신한 기사를 선택하세요.

[기사 제목 리스트]
{titles_with_index}

반드시 아래 JSON 형식으로만 반환하고, 선택한 기사의 인덱스 번호만 배열에 담아주세요:
{{
  "selected_indices": [인덱스번호1, 인덱스번호2, ...]
}}
"""
    try:
        result_text = await call_gemini_with_retry(
            prompt, 
            max_retries=2, 
            initial_delay=1, 
            is_json=True, 
            response_schema=ArticleSelectionResponse
        )
        data = ArticleSelectionResponse.model_validate_json(result_text)
        return data.selected_indices
    except Exception as e:
        logger.warning(f"기사 선별 중 오류 발생: {e}, 상위 기사 기본 선택")
        return list(range(min(len(articles_titles), count + 2)))

async def generate_search_queries(topic: str) -> dict:
    logger.info(f"[{topic}] 맞춤형 검색어 생성 중...")
    prompt = f"""사용자가 입력한 주제('{topic}')를 바탕으로 뉴스 및 아티클 크롤링을 위한 영문 검색어 3개를 생성해 줘.
각 검색어는 빙(Bing) 뉴스 검색에 사용될 예정이므로, 연관성 높고 구체적인 키워드 조합이어야 해.

1. ai_tools_query: '{topic}'와 관련된 최신 AI 소프트웨어, 스타트업 툴, Product Hunt 런칭 등에 최적화된 영문 검색어
2. deep_finds_query: '{topic}'와 관련된 arXiv 논문, 심층 연구 리포트, 오픈소스 프로젝트에 최적화된 영문 검색어
3. interesting_ai_query: '{topic}'와 관련된 AI 하드웨어, 로봇, 웨어러블, 스마트 가젯에 최적화된 영문 검색어

반드시 아래 JSON 형식으로만 반환해:
{{
  "ai_tools_query": "...",
  "deep_finds_query": "...",
  "interesting_ai_query": "..."
}}
"""
    try:
        result_text = await call_gemini_with_retry(prompt, max_retries=2, initial_delay=1, is_json=True, response_schema=SearchQueriesResponse)
        data = SearchQueriesResponse.model_validate_json(result_text)
        return data.model_dump()
    except Exception as e:
        logger.warning(f"검색어 생성 중 오류 발생: {e}, 기본 검색어 사용")
        return {
            "ai_tools_query": f"new AI startup tools launch producthunt {topic}",
            "deep_finds_query": f"arXiv research paper {topic} AI",
            "interesting_ai_query": f"new AI hardware gadget wearable robot release {topic}"
        }