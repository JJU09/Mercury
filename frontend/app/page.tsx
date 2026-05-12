"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useRef, useEffect } from "react";
import { NewsletterEditor, NewsletterEditorRef } from "@/components/editor/NewsletterEditor";
import { ExternalLink, Loader2, RefreshCw, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { toast } from "sonner";
import { useSearchArticles, useGenerateNewsletter } from "@/hooks/useNewsletter";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  type?: "text" | "suggestion" | "full_draft";
  suggestion?: {
    text: string;
    range: { from: number; to: number };
    status: "pending" | "accepted" | "rejected";
  };
  draft_content?: string;
  draft_status?: "pending" | "accepted" | "rejected";
}

interface Article {
  title: string;
  url: string;
  content: string;
}

export default function Home() {
  const [topic, setTopic] = useState("");
  const [articleCount, setArticleCount] = useState(5);
  const [searchResults, setSearchResults] = useState<Article[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<Article[]>([]);
  const [generationStatus, setGenerationStatus] = useState<string>("");
  const [editorContent, setEditorContent] = useState("<p>이곳에 AI가 작성한 뉴스레터 초안이 표시됩니다.</p>");
  
  const searchMutation = useSearchArticles();
  const generateMutation = useGenerateNewsletter();
  
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { id: "init-msg", role: "assistant", content: "안녕하세요! 뉴스레터 생성을 도와드릴 AI 어시스턴트입니다. 어떤 주제로 뉴스레터를 작성해 드릴까요?" }
  ]);
  const [editInstruction, setEditInstruction] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTextContext, setSelectedTextContext] = useState("");
  const editorRef = useRef<NewsletterEditorRef>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    const savedData = localStorage.getItem('newsletter-current-work');
    if (savedData) {
      if (window.confirm("이전에 작업하던 내용이 있습니다. 복구하시겠습니까?")) {
        try {
          const parsed = JSON.parse(savedData);
          if (parsed.topic !== undefined) setTopic(parsed.topic);
          if (parsed.articleCount !== undefined) setArticleCount(parsed.articleCount);
          if (parsed.searchResults !== undefined) setSearchResults(parsed.searchResults);
          if (parsed.selectedArticles !== undefined) setSelectedArticles(parsed.selectedArticles);
          if (parsed.editorContent !== undefined) setEditorContent(parsed.editorContent);
          if (parsed.chatHistory !== undefined) setChatHistory(parsed.chatHistory);
        } catch (e) {
          console.error("Failed to parse saved data", e);
        }
      } else {
        localStorage.removeItem('newsletter-current-work');
      }
    }
    setIsInitialLoad(false);
  }, []);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory]);

  useEffect(() => {
    if (isInitialLoad) return;

    const timer = setTimeout(() => {
      const saveData = {
        topic,
        articleCount,
        searchResults,
        selectedArticles,
        editorContent,
        chatHistory
      };
      localStorage.setItem('newsletter-current-work', JSON.stringify(saveData));
      
      const now = new Date();
      setLastSavedTime(now.toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);

    return () => clearTimeout(timer);
  }, [topic, articleCount, editorContent, chatHistory, isInitialLoad]);

  const handleReset = () => {
    if (window.confirm("모든 작업 내용이 삭제됩니다. 새 작업을 시작하시겠습니까?")) {
      setTopic("");
      setArticleCount(5);
      setSearchResults([]);
      setSelectedArticles([]);
      setEditorContent("<p>이곳에 AI가 작성한 뉴스레터 초안이 표시됩니다.</p>");
      setChatHistory([{ id: "init-msg", role: "assistant", content: "안녕하세요! 뉴스레터 생성을 도와드릴 AI 어시스턴트입니다. 어떤 주제로 뉴스레터를 작성해 드릴까요?" }]);
      setLastSavedTime(null);
      localStorage.removeItem('newsletter-current-work');
    }
  };

  const handleSearch = () => {
    if (!topic.trim()) {
      toast.error("검색할 주제를 입력해주세요.");
      return;
    }

    setSearchResults([]);
    searchMutation.mutate(
      { topic, articleCount },
      {
        onSuccess: (data) => {
          setSearchResults(data.articles || []);
          setSelectedArticles([]);
        },
      }
    );
  };

  const toggleArticleSelection = (article: Article) => {
    setSelectedArticles(prev => {
      const isSelected = prev.some(a => a.url === article.url);
      if (isSelected) {
        return prev.filter(a => a.url !== article.url);
      } else {
        return [...prev, article];
      }
    });
  };

  const handleGenerate = () => {
    if (!topic.trim()) {
      toast.error("뉴스레터 주제를 입력해주세요.");
      return;
    }

    if (selectedArticles.length === 0) {
      toast.error("뉴스레터에 포함할 기사를 선택해주세요.");
      return;
    }

    setGenerationStatus("기사 읽는 중...");
    
    // Simulate status updates
    const statusInterval = setInterval(() => {
      setGenerationStatus(prev => {
        if (prev === "기사 읽는 중...") return "초안 작성 중...";
        if (prev === "초안 작성 중...") return "스타일 입히는 중...";
        return prev;
      });
    }, 3000);

    generateMutation.mutate(
      { 
        topic, 
        main_news: selectedArticles, 
        sponsor_text: null,
        prompt_of_the_day: null,
        onStatusChange: setGenerationStatus 
      },
      {
        onSuccess: (data) => {
          setEditorContent(data.html);
        },
        onSettled: () => {
          clearInterval(statusInterval);
          setGenerationStatus("");
        }
      }
    );
  };

  const handleChatRequest = async () => {
    if (!editInstruction.trim()) return;

    const currentInstruction = editInstruction;
    setEditInstruction("");
    
    // 사용자 메시지 추가
    setChatHistory(prev => [...prev, { id: generateId(), role: "user", content: currentInstruction }]);
    setIsEditing(true);

    const range = editorRef.current?.getSelectionRange();
    const hasSelection = !!selectedTextContext && !!range;

    if (hasSelection && range) {
      // 수정 중인 영역 하이라이트 표시
      editorRef.current?.setHighlightAtRange(range.from, range.to);
    }

    try {
      // 1. 임시 응답 메시지 생성 (스트리밍으로 업데이트할 대상)
      const tempId = generateId();
      setChatHistory(prev => [...prev, {
        id: tempId,
        role: "assistant",
        content: "", // 스트리밍으로 채워질 내용
        type: "text"
      }]);

      const mappedHistory = chatHistory.map(msg => {
        let mappedContent = msg.content;
        if (msg.type === "full_draft" && msg.draft_content) {
          mappedContent = `${msg.content}\n\n[생성했던 HTML 초안]\n${msg.draft_content}`;
        } else if (msg.type === "suggestion" && msg.suggestion?.text) {
          mappedContent = `${msg.content}\n\n[제안했던 텍스트]\n${msg.suggestion.text}`;
        }
        return {
          role: msg.role,
          content: mappedContent
        };
      });

      const response = await fetch("http://localhost:8000/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selected_text: hasSelection ? selectedTextContext : null,
          instruction: currentInstruction,
          chat_history: mappedHistory,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to process chat request");
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let accumulatedText = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value, { stream: true });
        accumulatedText += chunkValue;

        // XML 태그 추출을 시도하며 렌더링
        let displayChat = accumulatedText;
        let displayHtml = "";

        const chatMatch = accumulatedText.match(/<chat>([\s\S]*?)<\/chat>/);
        const htmlMatch = accumulatedText.match(/<html_draft>([\s\S]*?)<\/html_draft>/);
        const partialChatMatch = accumulatedText.match(/<chat>([\s\S]*?)$/); // 닫히지 않은 태그

        if (chatMatch) {
            displayChat = chatMatch[1].trim();
        } else if (partialChatMatch) {
            displayChat = partialChatMatch[1];
        } else {
            // 태그가 없으면 전체를 채팅으로 간주
            displayChat = accumulatedText.replace(/<[^>]*>?/gm, ''); // 태그 조각 제거
        }
        
        if (htmlMatch) {
            displayHtml = htmlMatch[1].trim();
        }

        setChatHistory(prev => prev.map(msg => {
          if (msg.id === tempId) {
            // 아직 스트리밍 중이거나 완료되었고, HTML이 발견되었다면 상태 업데이트
            if (htmlMatch) {
              if (hasSelection && range) {
                  return {
                      ...msg,
                      content: displayChat || "다음과 같이 수정해 보았습니다.",
                      type: "suggestion",
                      suggestion: {
                          text: displayHtml || displayChat,
                          range: range,
                          status: "pending"
                      }
                  };
              } else {
                  return {
                      ...msg,
                      content: displayChat || "요청하신 내용으로 초안을 작성했습니다.",
                      type: "full_draft",
                      draft_content: displayHtml,
                      draft_status: "pending"
                  };
              }
            }
            // 아직 HTML이 없으면 채팅 내용만 업데이트
            return { ...msg, content: displayChat };
          }
          return msg;
        }));
      }

    } catch (error: any) {
      console.error("Error processing chat request:", error);
      toast.error(`요청 처리 중 오류가 발생했습니다: ${error.message}`);
      // 에러 발생 시 하이라이트 제거
      if (hasSelection && range) {
        editorRef.current?.removeHighlightAtRange(range.from, range.to);
      }
    } finally {
      setIsEditing(false);
    }
  };

  const handleAccept = (msgId: string) => {
    setChatHistory(prev => prev.map(msg => {
      if (msg.id === msgId && msg.suggestion) {
        const { range, text } = msg.suggestion;
        editorRef.current?.replaceTextAtRange(range.from, range.to, text);
        return { ...msg, suggestion: { ...msg.suggestion, status: "accepted" } };
      }
      return msg;
    }));
    setChatHistory(prev => [...prev, { id: generateId(), role: "assistant", content: "✅ 에디터에 적용되었습니다." }]);
  };

  const handleReject = (msgId: string) => {
    setChatHistory(prev => prev.map(msg => {
      if (msg.id === msgId && msg.suggestion) {
        const { range } = msg.suggestion;
        editorRef.current?.removeHighlightAtRange(range.from, range.to);
        return { ...msg, suggestion: { ...msg.suggestion, status: "rejected" } };
      }
      if (msg.id === msgId && msg.type === "full_draft") {
        return { ...msg, draft_status: "rejected" };
      }
      return msg;
    }));
    setChatHistory(prev => [...prev, { id: generateId(), role: "assistant", content: "❌ 수정 제안을 거절했습니다." }]);
  };

  const handleApplyFullDraft = (msgId: string) => {
    setChatHistory(prev => {
      const msg = prev.find(m => m.id === msgId);
      if (msg && msg.type === "full_draft" && msg.draft_content) {
        setEditorContent(msg.draft_content);
        toast.success("초안이 에디터에 적용되었습니다.");
        return prev.map(m => m.id === msgId ? { ...m, draft_status: "accepted" as const } : m).concat({
          id: generateId(), role: "assistant", content: "✅ 에디터 전체 내용이 교체되었습니다."
        });
      }
      return prev;
    });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-sm">
      {/* 1. 좌측 패널: 크롤링 및 검색 설정 */}
      <aside className="h-screen flex flex-col w-[400px] flex-shrink-0 border-r border-slate-200 bg-slate-50 relative z-10">
        {/* 고정 상단 영역 */}
        <div className="flex-none p-5 border-b border-slate-200 space-y-5 bg-slate-50 z-20">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold tracking-tight">기사 검색 및 선택</h2>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleReset} title="새 작업 시작">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">뉴스레터 주제</label>
              <Input 
                placeholder="예: 인공지능 최신 동향" 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="h-10 rounded-lg transition-all focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-slate-700">최신 뉴스 검색 개수 (최근 1주)</label>
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-md">{articleCount}개</span>
              </div>
              <Slider 
                defaultValue={[5]} 
                max={10} 
                min={1} 
                step={1} 
                value={[articleCount]}
                onValueChange={(vals) => setArticleCount(vals[0])}
                className="py-2 cursor-pointer"
              />
            </div>

            <Button 
              className="w-full h-10 rounded-lg font-medium transition-all hover:shadow-md active:scale-[0.98]" 
              onClick={handleSearch}
              disabled={searchMutation.isPending}
            >
              {searchMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  검색 중...
                </>
              ) : (
                "기사 검색하기"
              )}
            </Button>
          </div>
        </div>

        {/* 검색 결과 영역 헤더 */}
        <div className="flex-none px-5 py-3 flex justify-between items-center bg-slate-50/95 backdrop-blur supports-[backdrop-filter]:bg-slate-50/60 border-b border-slate-200 z-10 shadow-sm">
          <h3 className="font-semibold text-sm">검색 결과</h3>
          {selectedArticles.length > 0 && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {selectedArticles.length}개 선택됨
            </span>
          )}
        </div>

        {/* 스크롤 가능한 검색 결과 영역 */}
        <div className="flex-1 min-h-0 bg-transparent w-full overflow-hidden">
          <ScrollArea className="h-full w-full">
            <div className="p-4 pr-6 space-y-3">
              {searchMutation.isPending ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Card key={`skel-${i}`} className="overflow-hidden border-slate-200 rounded-lg">
                    <CardContent className="py-1.5 px-3">
                      <div className="flex items-center gap-2 w-full">
                        <Skeleton className="h-4 w-4 rounded" />
                        <div className="space-y-1.5 flex-1">
                          <Skeleton className="h-4 w-[90%]" />
                          <Skeleton className="h-4 w-[70%]" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    주제를 입력하고 검색해 주세요.
                  </p>
                </div>
              ) : (
                searchResults.map((article, index) => {
                  const isSelected = selectedArticles.some(a => a.url === article.url);
                  return (
                    <Card 
                      key={index} 
                      className={`overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md rounded-lg border-slate-200 ${isSelected ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-sm' : 'hover:border-slate-300 bg-white'}`}
                      onClick={() => toggleArticleSelection(article)}
                    >
                      <CardContent className="py-1.5 px-3">
                        <div className="flex items-center gap-2 w-full">
                          <Checkbox 
                            checked={isSelected}
                            className="pointer-events-none flex-shrink-0"
                          />
                          <div className="space-y-0.5 flex-1 min-w-0 overflow-hidden">
                            <p className="text-sm font-medium leading-tight text-foreground break-words whitespace-normal">
                              {article.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate max-w-full">
                              {article.url}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0 hover:bg-slate-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(article.url, "_blank", "noopener,noreferrer");
                            }}
                            title="기사 원문 보기"
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* 하단 고정 뉴스레터 생성 버튼 (조건부 노출) */}
        {selectedArticles.length > 0 && (
          <div className="flex-none p-4 border-t border-slate-200 bg-white shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.05)] z-20">
            <Button 
              className="w-full font-semibold shadow-md rounded-xl h-12 transition-all hover:shadow-lg active:scale-[0.98]" 
              size="lg" 
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {generationStatus || "생성 중..."}
                </>
              ) : (
                `선택한 ${selectedArticles.length}개의 기사로 생성하기`
              )}
            </Button>
          </div>
        )}
      </aside>

      {/* 2 & 3. Resizable 중앙 패널 (메인 에디터) 및 우측 패널 (AI 챗 어시스턴트) */}
      <ResizablePanelGroup direction="horizontal" autoSaveId="newsletter-layout" className="flex-1 w-full h-full overflow-hidden">
        <ResizablePanel defaultSize={75} className="flex flex-col">
          <main className="flex-1 overflow-hidden flex flex-col items-center py-6 px-8 lg:px-12 relative">
            <Card className="w-full max-w-[850px] h-full min-h-0 flex flex-col shadow-xl rounded-2xl bg-white border border-slate-200/60 overflow-hidden ring-1 ring-black/5 relative pt-0">
              {generateMutation.isPending ? (
                <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
                  <div className="w-full max-w-2xl px-12 space-y-6">
                    <div className="flex items-center gap-3 justify-center mb-8 text-primary">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <h3 className="text-xl font-bold">{generationStatus}</h3>
                    </div>
                    <div className="space-y-4">
                      <Skeleton className="h-10 w-3/4 mx-auto" />
                      <div className="pt-6 space-y-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-[95%]" />
                        <Skeleton className="h-4 w-[90%]" />
                        <Skeleton className="h-4 w-[85%]" />
                      </div>
                      <div className="pt-6 space-y-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-[92%]" />
                        <Skeleton className="h-4 w-[98%]" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
              <NewsletterEditor 
                ref={editorRef} 
                content={editorContent} 
                onSelectionChange={setSelectedTextContext}
              />
            </Card>
          </main>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={25} minSize={20} maxSize={40} className="flex flex-col bg-slate-50 relative z-10 border-l border-slate-200">
          <aside className="flex flex-col h-full">
            <div className="flex-shrink-0 p-5 space-y-3 bg-white border-b border-slate-100 shadow-sm z-10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <h2 className="text-lg font-bold tracking-tight">AI 어시스턴트</h2>
          </div>
        </div>
        <Separator />
        
        <ScrollArea className="flex-1 min-h-0 px-4 py-6 bg-slate-50/50">
          <div className="space-y-6">
            {chatHistory.map((msg) => (
              msg.role === "assistant" ? (
                <div key={msg.id} className="flex flex-col gap-2 max-w-[88%] text-sm">
                  <div className="bg-white p-3.5 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 text-slate-800">
                    <div className="prose prose-sm prose-slate max-w-none [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
                      {msg.content ? (
                        <ReactMarkdown>
                          {msg.content}
                        </ReactMarkdown>
                      ) : (
                        <div className="flex items-center gap-1.5 h-[20px] px-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      )}
                    </div>
                  </div>
                  {msg.type === "suggestion" && msg.suggestion && (
                    <div className="mt-1 space-y-3 bg-primary/5 p-3 rounded-xl border border-primary/20 border-dashed">
                      <div 
                        className="bg-white/80 p-3 rounded-lg border border-primary/10 text-slate-700 shadow-sm prose prose-sm prose-slate max-w-none"
                        dangerouslySetInnerHTML={{ __html: msg.suggestion.text }}
                      />
                      <div className="flex gap-2 w-full">
                        <Button 
                          size="sm" 
                          className="flex-1 rounded-lg shadow-sm transition-all hover:shadow-md"
                          onClick={() => handleAccept(msg.id)}
                          disabled={msg.suggestion.status !== "pending"}
                        >
                          적용하기
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1 rounded-lg hover:bg-slate-100"
                          onClick={() => handleReject(msg.id)}
                          disabled={msg.suggestion.status !== "pending"}
                        >
                          거절
                        </Button>
                      </div>
                    </div>
                  )}
                  {msg.type === "full_draft" && msg.draft_content && (
                    <div className="mt-1 space-y-3 bg-primary/5 p-3 rounded-xl border border-primary/20 border-dashed">
                      <div className="bg-white/80 p-3 rounded-lg border border-primary/10 text-slate-700 whitespace-pre-wrap shadow-sm max-h-[200px] overflow-y-auto prose prose-sm prose-slate max-w-none">
                        <div dangerouslySetInnerHTML={{ __html: msg.draft_content }} />
                      </div>
                      <div className="flex gap-2 w-full">
                        <Button 
                          size="sm" 
                          className="flex-1 rounded-lg shadow-sm transition-all hover:shadow-md"
                          onClick={() => handleApplyFullDraft(msg.id)}
                          disabled={msg.draft_status !== "pending"}
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          에디터 전체에 적용하기
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1 rounded-lg hover:bg-slate-100"
                          onClick={() => handleReject(msg.id)}
                          disabled={msg.draft_status !== "pending"}
                        >
                          거절
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div key={msg.id} className="flex flex-col gap-2 max-w-[88%] self-end ml-auto text-sm">
                  <div className="bg-primary text-primary-foreground p-3.5 rounded-2xl rounded-tr-sm shadow-sm">
                    <div className="prose prose-sm prose-invert max-w-none [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
                      <ReactMarkdown>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )
            ))}
            <div ref={chatScrollRef} />
          </div>
        </ScrollArea>

        <div className="flex-shrink-0 p-4 border-t border-slate-200 bg-white shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.02)] space-y-3 z-10">
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all flex flex-col gap-1.5">
            <div className="flex items-center gap-2 px-1 pt-1 overflow-hidden">
              {selectedTextContext ? (
                <>
                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-600 ring-1 ring-inset ring-blue-500/20 whitespace-nowrap">
                    ✏️ 선택 부분 수정 모드
                  </span>
                  <span className="text-[11px] text-slate-500 truncate italic">
                    "{selectedTextContext}"
                  </span>
                </>
              ) : (
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 whitespace-nowrap">
                  💡 아이디에이션 모드
                </span>
              )}
            </div>
            <Textarea 
              placeholder={selectedTextContext ? "수정 사항을 프롬프트로 입력하세요..." : "질문이나 아이디어를 입력하세요..."}
              className="min-h-[80px] resize-none border-0 bg-transparent focus-visible:ring-0 shadow-none pt-0"
              value={editInstruction}
              onChange={(e) => setEditInstruction(e.target.value)}
            />
          </div>
          <Button 
            className="w-full rounded-xl h-10 font-medium transition-all active:scale-[0.98]" 
            variant="default"
            onClick={handleChatRequest}
            disabled={isEditing || !editInstruction.trim()}
          >
            {isEditing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                처리 중...
              </>
            ) : (
              "보내기"
            )}
          </Button>
        </div>
          </aside>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
