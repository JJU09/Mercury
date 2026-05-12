import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import ssl
import asyncio
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
from fastapi import HTTPException
from crawl4ai import AsyncWebCrawler
from app.config import CONTENT_MAX_CHARS, get_logger
from app.services.llm import filter_interesting_articles

logger = get_logger(__name__)

async def crawl_articles(topic: str, count: int, crawler: AsyncWebCrawler) -> list:
    logger.info(f"[{topic}] 주제로 {count}개의 기사 검색 중 (후보군 Pool 확대 적용)...")
    results = []
    try:
        # 1. 후보군 확대를 위한 다중 키워드 검색
        # 단일 검색어로는 결과가 부족하므로, 연관 키워드를 조합하여 여러 번 검색
        search_variants = [
            topic,
            f"{topic} 기술",
            f"{topic} 새로운",
            f"{topic} 출시"
        ]
        
        all_items = []
        ssl_context = ssl._create_unverified_context()
        
        async def fetch_rss_items(query: str):
            try:
                encoded_query = urllib.parse.quote(query)
                rss_url = f"https://www.bing.com/news/search?q={encoded_query}&qft=sortbydate%3d%221%22&format=rss&mkt=ko-KR"
                req = urllib.request.Request(
                    rss_url, 
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'}
                )
                # urlopen은 동기 함수이므로 루프에서 실행하거나 run_in_executor 사용
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(None, lambda: urllib.request.urlopen(req, context=ssl_context).read())
                root = ET.fromstring(response)
                return root.findall('.//item')
            except Exception as e:
                logger.warning(f"RSS 검색 실패 ({query}): {e}")
                return []

        # 다중 키워드 병렬 검색
        rss_tasks = [fetch_rss_items(variant) for variant in search_variants]
        rss_results = await asyncio.gather(*rss_tasks)
        
        # 중복 제거 (URL 기준)
        seen_urls = set()
        for items in rss_results:
            for item in items:
                link = item.findtext('link')
                if link not in seen_urls:
                    all_items.append(item)
                    seen_urls.add(link)
        
        # 최신순 정렬 유지를 위해 개수 제한 (필터링 전 최대 60개)
        items = all_items[:60]
        
        if not items:
            return []
            
        logger.info(f"검색 완료. {len(items)}개의 기사 크롤링 시작...")
        
        async def fetch_article(direct_url: str, title: str):
            try:
                logger.info(f"[Crawl4AI 크롤링 시작] {direct_url}")
                # magic=True로 언론사 자체 봇 차단막만 우회
                result = await crawler.arun(url=direct_url, magic=True, timeout=15)
                
                # 1. 크롤링 성공 여부 및 결과 확인
                if not result.success:
                    logger.warning(f"실패: 크롤러가 페이지 접속에 실패함 - {direct_url}")
                    return None

                text = (result.markdown or "").strip()[:CONTENT_MAX_CHARS]
                
                # 2. 에러 페이지 키워드 검사
                error_keywords = ["404", "Page Not Found", "페이지를 찾을 수 없습니다", "존재하지 않는", "삭제된 기사"]
                if any(kw in text for kw in error_keywords) and len(text) < 500:
                    logger.warning(f"실패: 에러 페이지 탐지 - {title}")
                    return None

                # 3. 본문 길이 검사 (너무 짧으면 유효한 기사가 아닐 가능성 높음)
                min_length = 200
                if len(text) < min_length:
                    logger.warning(f"실패: 본문 내용 너무 짧음 ({len(text)}자) - {title}")
                    return None
                
                logger.info(f"성공: {len(text)}자 추출 완료 - {title}")
                return {
                    'title': title,
                    'url': direct_url,
                    'content': text
                }
            except Exception as e:
                logger.error(f"오류: Crawl4AI 크롤링 실패 ({direct_url}) - {e}")
                return None

        candidates = []
        now = datetime.now(tz=None)
        # 기본적으로 1개월(30일) 이내 기사만 수집 (필요시 조정)
        date_threshold = timedelta(days=30)
        
        # 뉴스레터에 부적합한 기사 필터링 키워드
        excluded_filter = ["사업", "계약", "실적", "주가", "MOU", "체결", "채용", "매출", "영업이익"]

        for item in items:
            title = item.findtext('title') or ""
            pub_date_str = item.findtext('pubDate')
            
            # 1. 제외 키워드 필터링 (제목 기준)
            if any(keyword in title for keyword in excluded_filter):
                logger.info(f"뉴스레터 제외 (키워드 필터링): {title}")
                continue

            # 2. 날짜 필터링 로직 추가
            if pub_date_str:
                try:
                    pub_date = parsedate_to_datetime(pub_date_str)
                    if pub_date.tzinfo:
                        pub_date = pub_date.replace(tzinfo=None)
                    
                    if now - pub_date > date_threshold:
                        logger.info(f"뉴스레터 제외 (오래된 기사): {title}")
                        continue
                except Exception:
                    pass

            direct_url = item.findtext('link')
            if not direct_url:
                continue

            try:
                parsed_url = urllib.parse.urlparse(direct_url)
                query_params = urllib.parse.parse_qs(parsed_url.query)
                if 'url' in query_params:
                    direct_url = query_params['url'][0]
                    parsed_url = urllib.parse.urlparse(direct_url) # URL이 바뀌었으므로 다시 파싱
                
                # 3. 상세 기사가 아닌 카테고리/섹션 메인 페이지 필터링
                # 보통 기사 URL은 path가 길거나 숫자/날짜가 포함됨
                path = parsed_url.path.strip('/')
                path_segments = [s for s in path.split('/') if s]
                
                # - path가 아예 없거나 너무 짧은 경우 (예: hankyung.com/tech, news.naver.com/)
                if not path or len(path_segments) < 2:
                    # 단, path가 하나라도 숫자가 포함되어 있으면 기사일 가능성이 있음 (예: /12345)
                    if not any(char.isdigit() for char in path):
                        logger.info(f"뉴스레터 제외 (카테고리/메인 페이지 의심): {direct_url}")
                        continue
                
                # - 특정 제외 키워드가 경로에 포함된 경우
                category_keywords = ['category', 'section', 'index', 'topic', 'main', 'channel', 'list']
                if any(kw in path.lower() for kw in category_keywords) and not any(char.isdigit() for char in path):
                    logger.info(f"뉴스레터 제외 (카테고리/메인 페이지 키워드 탐지): {direct_url}")
                    continue

            except Exception:
                pass
            
            candidates.append({'title': title, 'url': direct_url})

        if not candidates:
            return []

        # 3. LLM을 통한 흥미도 기반 2차 필터링 (우선순위 결정)
        candidate_titles = [c['title'] for c in candidates]
        # 충분한 후보군 확보를 위해 LLM에게 조금 더 많이(count + 5) 골라달라고 요청
        selected_indices = await filter_interesting_articles(topic, candidate_titles, count + 5)
        
        # 4. 목표 개수(count)를 채울 때까지 선별된 기사들을 순차적/병렬적으로 크롤링
        # 한 번에 너무 많은 병렬 처리는 피하되, 실패를 고려하여 count개씩 끊어서 처리
        batch_size = count
        selected_candidates = [candidates[idx] for idx in selected_indices if 0 <= idx < len(candidates)]
        
        for i in range(0, len(selected_candidates), batch_size):
            batch = selected_candidates[i:i+batch_size]
            tasks = [fetch_article(article['url'], article['title']) for article in batch]
            
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for res in batch_results:
                if isinstance(res, dict) and res.get('content'):
                    results.append(res)
                    if len(results) >= count:
                        logger.info(f"✅ 요청한 {count}개의 고품질 기사 수집을 완료했습니다.")
                        return results[:count]
            
            # 목표치를 채웠으면 종료
            if len(results) >= count:
                break
                    
    except Exception as e:
        logger.error(f"검색 과정 중 예기치 않은 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=f"기사 검색 중 오류 발생: {str(e)}")
        
    return results