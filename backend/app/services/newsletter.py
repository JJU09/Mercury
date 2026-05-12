from typing import Optional
from fastapi import HTTPException
from app.models import NewsletterResponse
from app.services.llm import call_gemini_with_retry
from app.config import get_logger

logger = get_logger(__name__)

async def generate_newsletter_with_gemini(topic: str, main_news: list, ai_tools: list, deep_finds: list, interesting_ai: list, sponsor_text: Optional[str] = None, prompt_of_the_day: Optional[str] = None) -> str:
    logger.info("Gemini API로 뉴스레터 생성 중...")
    
    def format_articles(articles, title):
        if not articles:
            return ""
        res = f"[{title}]\n"
        for i, a in enumerate(articles):
            res += f"{i+1}. 제목: {a['title']}\nURL: {a['url']}\n내용: {a['content'][:500]}...\n\n"
        return res
        
    context = f"주제: {topic}\n\n"
    context += format_articles(main_news, "메인 뉴스")
    context += format_articles(ai_tools, "오늘의 AI 툴")
    context += format_articles(deep_finds, "심층 정보 및 아티클")
    context += format_articles(interesting_ai, "흥미로운 하드웨어 & 서비스")
    
    prompt = f"""[절대 규칙 - 반드시 지킬 것]
- 정보 기반 작성 및 플랜 B: 기본적으로 전달된 JSON 데이터(`main_news`, `ai_tools`, `deep_finds`, `interesting_ai`) 안에 있는 실제 기사 내용만을 바탕으로 작성해. 하지만 만약 특정 섹션(예: interesting_ai_html, deep_finds_html)을 채울 구체적인 기사 정보가 부족하다면, 절대 빈 문자열("")을 반환하지 마. 대신 수집된 '메인 뉴스'의 맥락을 바탕으로 해당 카테고리와 관련된 '최신 트렌드 분석'이나 '에디터의 통찰(인사이트)'을 작성해서 지면을 채워줘.
- 사족 금지: '오늘의 툴을 소개합니다' 같은 뻔한 도입부 문장을 절대 쓰지 마. 곧바로 기사/툴 이름과 핵심 설명으로 넘어가.
- 카테고리 엄수: 
  1. 'ai_tools_html': 언론사나 뉴스 기사가 아닌, 실제 작동하는 '소프트웨어/앱/서비스'만 넣어.
  2. 'deep_finds_html': 뭉뚱그린 사이트 소개가 아니라, 구체적인 논문 이름, 리포트 제목, 오픈소스 프로젝트 명을 정확히 명시해 (정보가 부족하면 플랜 B 적용).
  3. 'interesting_ai_html': ChatGPT 같은 챗봇 소프트웨어가 아니라, 반드시 로봇, 웨어러블, 가젯 등 물리적인 '기기(Hardware)' 위주로만 작성해 (관련 하드웨어 기사가 없다면 플랜 B 적용).

너는 10년 차 베테랑 뉴스레터 에디터야. 제공된 기사 정보들을 바탕으로 읽기 쉽고 흥미로운 뉴스레터를 작성해 줘. 
반드시 아래 JSON 포맷으로만 응답해야 해. 마크다운(```json 등)은 절대 사용하지 마.

{{
  "intro_html": "활기찬 인사말과 오늘 다룰 핵심 주제 8~10가지를 <ul><li> 형태의 불릿 포인트로 요약",
  "main_news_html": "각 뉴스는 <h3>[이모지] 기사 제목</h3>과 <p>3~4문장 핵심 요약 (중요 부분 <strong>)</p>으로 구성",
  "ai_tools_html": "툴 소개 (<ul><li>[이모지] <strong>툴이름</strong>: 1~2문장 기능 설명</li></ul>). 단, 제공된 툴 중 하나는 네이티브 애드 형태로 깊이 있게 소개할 것",
  "deep_finds_html": "심층 정보 (다큐, 논문, 오픈소스 등)를 <ul><li> 형태로 구성. 기사 정보가 부족하면 메인 뉴스 기반의 심층 분석/인사이트 제공",
  "interesting_ai_html": "반드시 기사에 등장한 '특정 브랜드의 구체적인 제품명'을 하나 선정해서 2~3문단으로 상세히 리뷰하는 HTML (<p> 태그 사용). 만약 기사에 구체적인 제품명이 명시되어 파악할 수 없다면, '메인 뉴스'의 맥락과 연결하여 최신 AI 트렌드나 에디터 인사이트로 대체하여 작성해.",
  "sources_html": "수집된 모든 기사의 출처(제목과 URL)를 <ul><li><a href='url'>제목</a></li></ul> 형태로 구성"
}}

제약조건:
- 허용되는 HTML 태그: <h3>, <p>, <ul>, <li>, <strong>, <a>, <br>
- JSON 형식 외에 다른 텍스트는 절대 출력하지 마.
- 각 값은 문자열이어야 하고, 이스케이프 처리를 완벽하게 해줘.

[수집된 기사 정보]
{context}"""

    try:
        result_text = await call_gemini_with_retry(prompt, is_json=True, response_schema=NewsletterResponse)
        data = NewsletterResponse.model_validate_json(result_text).model_dump()
    except Exception as e:
        logger.error(f"JSON 파싱 오류: {e}, 원본 텍스트: {result_text if 'result_text' in locals() else 'None'}")
        raise HTTPException(status_code=500, detail="뉴스레터 생성 중 오류가 발생했습니다. 다시 시도해주세요.")
        
    # 방어 로직: 각 섹션이 비어있지 않을 때만 제목과 구분선을 포함
    intro_html = data.get('intro_html', '')
    
    main_news_html = data.get('main_news_html', '')
    main_news_section = f"<hr>\n<h2>🔥 메인 뉴스</h2>\n{main_news_html}\n" if main_news_html else ""
    
    ai_tools_html = data.get('ai_tools_html', '')
    ai_tools_section = f"<hr>\n<h2>🛠️ 오늘의 AI 툴</h2>\n{ai_tools_html}\n" if ai_tools_html else ""
    
    sponsor_section = f"<hr>\n<h2>💎 스폰서</h2>\n<blockquote>{sponsor_text}</blockquote>\n" if sponsor_text else ""
    
    deep_finds_html = data.get('deep_finds_html', '')
    deep_finds_section = f"<hr>\n<h2>📚 심층 정보 및 아티클</h2>\n{deep_finds_html}\n" if deep_finds_html else ""
    
    interesting_ai_html = data.get('interesting_ai_html', '')
    interesting_ai_section = f"<hr>\n<h2>🤖 흥미로운 하드웨어 & 서비스</h2>\n{interesting_ai_html}\n" if interesting_ai_html else ""
    
    prompt_section = f"<hr>\n<h2>✍️ 오늘의 프롬프트</h2>\n<blockquote>{prompt_of_the_day}</blockquote>\n" if prompt_of_the_day else ""
    
    sources_html = data.get('sources_html', '')
    sources_section = f"<hr>\n<h2>🔗 관련 자료</h2>\n{sources_html}\n" if sources_html else ""

    final_html = f"""{intro_html}
{main_news_section}{ai_tools_section}{sponsor_section}{deep_finds_section}{interesting_ai_section}{prompt_section}{sources_section}<hr>
<h2>💬 마무리 및 피드백</h2>
<p>오늘 머큐리가 전해드린 소식은 어떠셨나요? 여러분의 1분 피드백이 더 나은 뉴스레터를 만드는 데 큰 힘이 됩니다.</p>
<p><a href="https://docs.google.com/forms/d/e/1FAIpQLSf9PbZ7ggnzlsrDPhx8BBpD8P-egznXo8iZ_R_Org3BmIcvHQ/viewform?usp=dialog" target="_blank" data-button="feedback"><strong>👉 피드백 남기러 가기 (1분 소요)</strong></a></p>
<p>오늘 준비한 소식은 여기까지입니다. 눈길을 끄는 소식이 있었다면 동료와 친구들에게도 널리 공유해 주세요! 다음 주에도 가장 흥미로운 AI 소식으로 찾아오겠습니다. 🚀</p>
<br>
<p><strong>오늘도 함께해 주셔서 감사합니다. <br>— Mercury (머큐리)</strong></p>"""

    return final_html