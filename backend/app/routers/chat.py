from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import json
from app.models import ChatRequest
from app.services.llm import call_gemini_with_retry, stream_gemini_response
from app.config import get_logger

logger = get_logger(__name__)

router = APIRouter()

@router.post("/chat/stream")
async def chat_stream_endpoint(request: ChatRequest):
    logger.info(f"채팅/수정 스트리밍 요청: {request.instruction}")
    
    html_instruction = """
중요 제약조건: 생성하는 HTML 본문/초안은 절대 마크다운(*, ** 등)을 사용하지 말고, 반드시 Tiptap 에디터(StarterKit)에서 호환되는 기본 HTML 태그만 사용해야 해. 
허용되는 태그: <h1>, <h2>, <h3>, <p>, <strong>, <em>, <ul>, <ol>, <li>, <blockquote>, <hr>, <br>, <a>. 
절대 <div>, <span>, <section>, <style> 태그나 인라인 스타일(style='...')을 사용하지 마. 전체 구조는 오직 <p>와 헤딩 태그 위주로만 작성해.
"""

    # XML 태그 기반 스트리밍용 스키마 지시어
    schema_instruction = """
반드시 아래와 같은 커스텀 XML 태그 형식으로 응답해 줘. 스트리밍 처리를 위함이므로 다른 형식은 사용하지 마:
<chat>사용자에게 할 자연스러운 대화나 안내 문구 (에디터 본문에 들어갈 내용이 아님)</chat>
<html_draft>순수 HTML 본문(없으면 태그 생략). 마크다운 틱(```html)을 쓰지 마.</html_draft>
"""

    if request.selected_text:
        prompt = f"""원본 텍스트: [{request.selected_text}], 요청사항: [{request.instruction}]. 이 요청에 맞게 원본 텍스트를 수정해 줘.
{html_instruction}
{schema_instruction}
수정된 텍스트는 <html_draft> 태그에 담고, 수정 완료 안내 메시지를 <chat> 태그에 담아 줘."""
    else:
        history_text = ""
        if request.chat_history:
            for msg in request.chat_history:
                role = "사용자" if msg.role == "user" else "AI"
                history_text += f"{role}: {msg.content}\n"
                
        prompt = f"""너는 뉴스레터 전문가야. 사용자가 기획안이나 초안 작성을 요구하면 HTML 형식으로 성실히 작성해 줘.
{html_instruction}
{schema_instruction}

[이전 대화 기록]
{history_text}
사용자: {request.instruction}"""

    return StreamingResponse(stream_gemini_response(prompt), media_type="text/event-stream")

@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    logger.info(f"채팅/수정 요청: {request.instruction}")
    
    html_instruction = """
중요 제약조건: 생성하는 HTML 본문/초안은 절대 마크다운(*, ** 등)을 사용하지 말고, 반드시 Tiptap 에디터(StarterKit)에서 호환되는 기본 HTML 태그만 사용해야 해. 
허용되는 태그: <h1>, <h2>, <h3>, <p>, <strong>, <em>, <ul>, <ol>, <li>, <blockquote>, <hr>, <br>, <a>. 
절대 <div>, <span>, <section>, <style> 태그나 인라인 스타일(style='...')을 사용하지 마. 전체 구조는 오직 <p>와 헤딩 태그 위주로만 작성해.
"""

    # JSON Mode Schema Instruction
    schema_instruction = """
반드시 아래 JSON 형식으로만 응답해 줘. 다른 말은 절대 추가하지 마:
{
  "chat_message": "사용자에게 할 자연스러운 대화나 안내 문구 (에디터 본문에 들어갈 내용이 아님)",
  "editor_html": "순수 HTML 본문(없으면 null). 여기에 마크다운 틱(```html)을 쓰지 마."
}
"""

    if request.selected_text:
        prompt = f"""원본 텍스트: [{request.selected_text}], 요청사항: [{request.instruction}]. 이 요청에 맞게 원본 텍스트를 수정해 줘.
{html_instruction}
{schema_instruction}
수정된 텍스트는 'editor_html'에 담고, 수정 완료 안내 메시지를 'chat_message'에 담아 줘."""
    else:
        history_text = ""
        if request.chat_history:
            for msg in request.chat_history:
                role = "사용자" if msg.role == "user" else "AI"
                history_text += f"{role}: {msg.content}\n"
                
        prompt = f"""너는 뉴스레터 전문가야. 사용자가 기획안이나 초안 작성을 요구하면 HTML 형식으로 성실히 작성해 줘.
{html_instruction}
{schema_instruction}

[이전 대화 기록]
{history_text}
사용자: {request.instruction}"""
    
    try:
        result = await call_gemini_with_retry(prompt, max_retries=2, initial_delay=1, is_json=True)
        result = result.strip()
        
        parsed_result = json.loads(result)
        
        return {
            "chat_message": parsed_result.get("chat_message", ""),
            "editor_html": parsed_result.get("editor_html", None)
        }
    except HTTPException as e:
        return {"error": e.detail, "chat_message": "", "editor_html": None}
    except Exception as e:
        logger.error(f"Gemini API 오류/JSON 파싱 오류: {e}")
        return {"error": "처리 중 오류가 발생했습니다.", "chat_message": "", "editor_html": None}
