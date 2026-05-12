"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
// 터미널에서 npm install @tiptap/extension-image 를 실행하여 패키지를 설치해주세요.
import Image from '@tiptap/extension-image';
import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Undo2, 
  Redo2, 
  Check, 
  Download, 
  Copy,
  Palette,
  Link as LinkIcon,
  Image as ImageIcon
} from 'lucide-react';
import { useEffect, forwardRef, useImperativeHandle, useState, useRef } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface NewsletterEditorProps {
  content: string;
  onSelectionChange?: (selectedText: string) => void;
}

export interface NewsletterEditorRef {
  getSelectedText: () => string;
  replaceSelectedText: (newText: string) => void;
  getSelectionRange: () => { from: number; to: number } | null;
  setHighlightAtRange: (from: number, to: number) => void;
  removeHighlightAtRange: (from: number, to: number) => void;
  replaceTextAtRange: (from: number, to: number, newText: string) => void;
}

export const NewsletterEditor = forwardRef<NewsletterEditorRef, NewsletterEditorProps>(({ content, onSelectionChange }, ref) => {
  const [selectedTheme, setSelectedTheme] = useState<string>('theme-default');
  const [textStyle, setTextStyle] = useState<string>('p');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 5MB 용량 체크
    if (file.size > 5 * 1024 * 1024) {
      alert('이미지 용량은 5MB를 초과할 수 없습니다. 브라우저 성능을 위해 작은 이미지를 사용해주세요.');
      event.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Image upload failed');
      }

      const data = await response.json();
      
      if (editor && data.url) {
        editor.chain().focus().setImage({ src: data.url }).run();
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('이미지 업로드에 실패했습니다. 나중에 다시 시도해주세요.');
    } finally {
      event.target.value = '';
    }
  };

  const themes = {
    'theme-default': {
      name: '기본 테마',
      desc: '가장 깔끔하고 모던한 기본 스타일',
      style: { backgroundColor: '#ffffff', color: '#1f2937', fontFamily: '"Pretendard", "Noto Sans KR", "Inter", sans-serif' },
    },
    'theme-soft': {
      name: '소프트 테마',
      desc: 'SaaS 블로그처럼 부드럽고 친근한 스타일',
      style: { backgroundColor: '#f8fafc', color: '#334155', fontFamily: '"Pretendard", "Noto Sans KR", "Inter", sans-serif' },
    },
    'theme-pro': {
      name: '프로페셔널 테마',
      desc: '비즈니스/VC 뉴스레터의 신뢰감 있는 스타일',
      style: { backgroundColor: '#ffffff', color: '#0f172a', fontFamily: '"Playfair Display", "Noto Serif KR", serif' },
    },
    'theme-neopop': {
      name: '네오 팝',
      desc: '발랄하고 톡톡 튀는 트렌디한 브루탈리즘',
      style: { backgroundColor: '#ffffff', color: '#000000', fontFamily: '"Space Grotesk", sans-serif' },
    },
    'theme-editorial': {
      name: '에디토리얼',
      desc: '고급스러운 잡지와 신문의 우아한 스타일',
      style: { backgroundColor: '#fdfbf7', color: '#2c2c2c', fontFamily: '"Playfair Display", "Noto Serif KR", serif' },
    },
    'theme-midnight': {
      name: '미드나잇 다크',
      desc: '눈이 편안하고 세련된 다크 모드',
      style: { backgroundColor: '#0f172a', color: '#e2e8f0', fontFamily: '"Pretendard", "Noto Sans KR", "Inter", sans-serif' },
    },
    'theme-eco': {
      name: '에코 네이처',
      desc: '따뜻하고 자연 친화적인 그리너리 스타일',
      style: { backgroundColor: '#f9f9f6', color: '#2f3e2e', fontFamily: '"Pretendard", "Noto Sans KR", "Inter", sans-serif' },
    },
    'theme-cyberpunk': {
      name: '사이버펑크',
      desc: '해커/개발자 감성의 레트로 퓨처리즘',
      style: { backgroundColor: '#0a0a0a', color: '#00ff41', fontFamily: '"JetBrains Mono", "Roboto Mono", monospace' },
    },
    'theme-mercury': {
      name: '머큐리 시그니처',
      desc: '수은처럼 매끄럽고 몽환적인 우주의 빛',
      style: { backgroundColor: '#020205', backgroundImage: 'linear-gradient(to bottom, #0b0f19, #020205)', color: '#e4e4e7', fontFamily: '"Pretendard", "Noto Sans KR", "Inter", sans-serif' },
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Image.configure({ inline: true }),
    ],
    content: content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base m-5 focus:outline-none w-full max-w-none',
      },
    },
    onTransaction: ({ editor }) => {
      if (editor.isActive('heading', { level: 1 })) setTextStyle('h1');
      else if (editor.isActive('heading', { level: 2 })) setTextStyle('h2');
      else if (editor.isActive('heading', { level: 3 })) setTextStyle('h3');
      else setTextStyle('p');
    },
    onSelectionUpdate: ({ editor }) => {
      if (editor.isActive('heading', { level: 1 })) setTextStyle('h1');
      else if (editor.isActive('heading', { level: 2 })) setTextStyle('h2');
      else if (editor.isActive('heading', { level: 3 })) setTextStyle('h3');
      else setTextStyle('p');

      if (onSelectionChange) {
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, " ");
        onSelectionChange(text.trim());
      }
    },
    onBlur: ({ editor }) => {
      // Blur 시에도 선택 영역이 풀리면 업데이트
      if (onSelectionChange) {
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, " ");
        onSelectionChange(text.trim());
      }
    }
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  useImperativeHandle(ref, () => ({
    getSelectedText: () => {
      if (!editor) return "";
      const { from, to } = editor.state.selection;
      return editor.state.doc.textBetween(from, to, " ");
    },
    replaceSelectedText: (newText: string) => {
      if (!editor) return;
      editor.commands.insertContent(newText);
    },
    getSelectionRange: () => {
      if (!editor) return null;
      const { from, to } = editor.state.selection;
      if (from === to) return null; // No selection
      return { from, to };
    },
    setHighlightAtRange: (from: number, to: number) => {
      if (!editor) return;
      editor.chain().focus().setTextSelection({ from, to }).setHighlight({ color: '#ffcc00' }).run();
    },
    removeHighlightAtRange: (from: number, to: number) => {
      if (!editor) return;
      editor.chain().focus().setTextSelection({ from, to }).unsetHighlight().run();
    },
    replaceTextAtRange: (from: number, to: number, newText: string) => {
      if (!editor) return;
      editor.chain().focus().setTextSelection({ from, to }).unsetHighlight().insertContent(newText).run();
    }
  }));

  const getFullHtml = () => {
    if (!editor) return "";
    let editorContent = editor.getHTML();
    
    const currentTheme = themes[selectedTheme as keyof typeof themes] || themes['theme-default'];

    // Convert raw HTML to inline styles using DOMParser
    if (typeof window !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(editorContent, 'text/html');
      
      const baseStyles: Record<string, string> = {
        p: `margin-top: 1.2em; margin-bottom: 1.2em; line-height: 1.75; font-size: 18px; color: ${currentTheme.style.color};`,
        h1: `margin-top: 1.5em; margin-bottom: 0.8em; line-height: 1.2; font-weight: 800; font-size: 2.25em; color: ${currentTheme.style.color};`,
        h2: `margin-top: 1.5em; margin-bottom: 0.8em; line-height: 1.3; font-weight: 700; font-size: 1.75em; color: ${currentTheme.style.color};`,
        h3: `margin-top: 1.5em; margin-bottom: 0.6em; line-height: 1.4; font-weight: 600; font-size: 1.25em; color: ${currentTheme.style.color};`,
        ul: `margin-top: 1em; margin-bottom: 1em; padding-left: 1.5em; font-size: 18px; color: ${currentTheme.style.color};`,
        ol: `margin-top: 1em; margin-bottom: 1em; padding-left: 1.5em; font-size: 18px; color: ${currentTheme.style.color};`,
        li: `margin-top: 0.5em; margin-bottom: 0.5em; line-height: 1.75; font-size: 18px; color: ${currentTheme.style.color};`,
        blockquote: 'margin-top: 1.5em; margin-bottom: 1.5em; font-size: 18px;',
        img: 'display: block; max-width: 100%; height: auto; border-radius: 8px; margin: 1.5em 0; -ms-interpolation-mode: bicubic;',
        a: `text-decoration: underline; text-underline-offset: 4px; color: ${currentTheme.style.color};`,
        hr: 'border: 0; border-top: 1px solid #e5e7eb; margin: 2em 0;'
      };

      const themeStyles: Record<string, Record<string, string>> = {
        'theme-default': {
          h1: 'color: #111827; letter-spacing: -0.02em;',
          h2: 'color: #1f2937; letter-spacing: -0.01em; border-bottom: 2px solid #f3f4f6; padding-bottom: 0.3em;',
          h3: 'color: #374151;',
          blockquote: 'border-left: 4px solid #e5e7eb; padding-left: 1em; color: #6b7280; font-style: italic;',
          a: 'color: #2563eb; text-decoration-color: #93c5fd;',
          hr: 'border-top: 1px solid #e5e7eb;'
        },
        'theme-soft': {
          h1: 'color: #1e293b; text-align: center; margin-bottom: 1.2em;',
          h2: 'background-color: #e0e7ff; color: #3730a3; padding: 0.4em 0.8em; border-radius: 12px; display: inline-block; font-size: 1.5em;',
          h3: 'color: #4338ca; font-size: 1.35em; font-weight: 700;',
          blockquote: 'background-color: #ffffff; color: #475569; padding: 1.5em; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); border: 1px solid #f1f5f9; font-style: normal;',
          a: 'color: #6366f1; text-decoration: none; border-bottom: 2px solid #c7d2fe; font-weight: 500;',
          img: 'max-width: 100%; height: auto; border-radius: 16px; margin: 1.5em 0; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);',
          hr: 'border-top: 2px dashed #cbd5e1;'
        },
        'theme-pro': {
          h1: 'color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #0f172a; padding-bottom: 0.5em; text-align: center;',
          h2: 'color: #1e293b; border-left: 3px solid #334155; padding-left: 0.8em; letter-spacing: 0.02em;',
          h3: 'color: #334155; font-weight: 600;',
          blockquote: 'border-left: 2px solid #cbd5e1; padding-left: 1.5em; color: #475569; font-size: 1.1em; font-style: italic;',
          a: 'color: #0f172a; text-decoration: underline; text-decoration-thickness: 1px;',
          hr: 'border-top: 1px solid #cbd5e1;'
        },
        'theme-neopop': {
          h1: 'border: 4px solid #000; background-color: #ff00ff; color: #fff; padding: 0.5em 0.8em; box-shadow: 6px 6px 0px #000; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em;',
          h2: 'border: 3px solid #000; background-color: #ffff00; color: #000; padding: 0.4em 0.8em; box-shadow: 4px 4px 0px #000; font-weight: 800; display: inline-block;',
          h3: 'color: #000; background-color: #00ffff; padding: 0.2em 0.4em; border: 2px solid #000; font-weight: bold;',
          blockquote: 'border: 4px solid #000; background-color: #fff; color: #000; padding: 1.5em; font-weight: bold; box-shadow: 6px 6px 0px #000; font-size: 1.1em; font-style: normal;',
          a: 'color: #ff0000; font-weight: 800; text-decoration: none; border-bottom: 4px solid #000; background-color: #ffff00; padding: 0 0.2em;',
          img: 'max-width: 100%; height: auto; border: 4px solid #000; border-radius: 0; box-shadow: 6px 6px 0px #000; margin: 1.5em 0;',
          hr: 'border-top: 4px solid #000;'
        },
        'theme-editorial': {
          h1: 'font-size: 2.8em; text-align: center; border-bottom: 1px solid #2c2c2c; padding-bottom: 0.4em; color: #1a1a1a; font-weight: 400; font-style: italic;',
          h2: 'text-align: center; border-top: 1px solid #e5e5e5; border-bottom: 1px solid #e5e5e5; padding: 0.6em 0; color: #2c2c2c; font-weight: 600; text-transform: uppercase; letter-spacing: 0.15em; font-size: 1.2em;',
          h3: 'color: #3a3a3a; font-weight: 600; letter-spacing: 0.05em;',
          blockquote: 'border: none; border-top: 1px solid #2c2c2c; border-bottom: 1px solid #2c2c2c; padding: 1.5em 0; margin: 2em 0; font-style: italic; color: #4a4a4a; font-size: 1.2em; text-align: center;',
          a: 'color: #1a1a1a; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 4px;',
          img: 'max-width: 100%; height: auto; border-radius: 0; margin: 2em 0; filter: sepia(0.1);',
          p: 'margin-top: 1.5em; margin-bottom: 1.5em; line-height: 1.8; text-align: justify;',
          hr: 'border-top: 1px solid #1a1a1a; width: 30%; margin: 3em auto;'
        },
        'theme-midnight': {
          h1: 'color: #f8fafc; font-weight: 800; letter-spacing: -0.02em; border-bottom: 1px solid #334155; padding-bottom: 0.5em;',
          h2: 'color: #38bdf8; font-weight: 700; letter-spacing: -0.01em;',
          h3: 'color: #a78bfa; font-weight: 600;',
          blockquote: 'background-color: #1e293b; border-left: 4px solid #38bdf8; padding: 1.2em 1.5em; color: #94a3b8; font-style: italic; border-radius: 0 8px 8px 0;',
          a: 'color: #38bdf8; text-decoration: none; border-bottom: 1px solid #38bdf8; transition: all 0.2s;',
          hr: 'border-top: 1px solid #334155;',
          img: 'max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #334155; opacity: 0.9;'
        },
        'theme-eco': {
          h1: 'color: #166534; font-weight: 800; text-align: center; margin-bottom: 1em;',
          h2: 'color: #15803d; border-bottom: 2px dashed #bbf7d0; padding-bottom: 0.3em;',
          h3: 'color: #166534; font-weight: 600;',
          blockquote: 'background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 1.5em; color: #166534; font-style: italic; box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.02);',
          a: 'color: #15803d; text-decoration: none; border-bottom: 2px solid #86efac; font-weight: 500;',
          hr: 'border-top: 2px dotted #86efac; width: 50%; margin: 2.5em auto;',
          img: 'max-width: 100%; height: auto; border-radius: 12px; border: 4px solid #f0fdf4;'
        },
        'theme-cyberpunk': {
          h1: 'color: #ff00ff; text-transform: uppercase; border-bottom: 2px dashed #00ff41; padding-bottom: 0.4em; font-weight: 900; text-shadow: 2px 2px 0px #000, -1px -1px 0px #000;',
          h2: 'color: #00ffff; border-left: 4px solid #ff00ff; padding-left: 0.5em; background-color: rgba(255, 0, 255, 0.1); font-weight: 800; text-transform: uppercase;',
          h3: 'color: #ffff00; font-weight: 700; letter-spacing: 0.05em;',
          blockquote: 'background-color: #0a0a0a; border: 1px solid #00ff41; color: #00ff41; padding: 1.2em 1.5em; border-left: 4px solid #ff00ff; font-style: normal; font-family: monospace;',
          a: 'color: #ffff00; text-decoration: none; border-bottom: 1px dashed #ffff00;',
          hr: 'border-top: 1px dashed #00ff41;',
          p: 'text-shadow: 0 0 1px #00ff41;',
          img: 'max-width: 100%; height: auto; border: 1px solid #00ff41; border-radius: 0; filter: contrast(1.2) saturate(1.5);'
        },
        'theme-mercury': {
          h1: 'color: #00e5ff; font-weight: 800; letter-spacing: -0.01em; border-bottom: 1px solid rgba(0, 229, 255, 0.2); padding-bottom: 0.5em; text-align: center; text-shadow: 0 0 8px rgba(0, 229, 255, 0.2);',
          h2: 'color: #e4e4e7; font-weight: 700; border-left: 4px solid #3b82f6; padding-left: 0.8em;',
          h3: 'color: #93c5fd; font-weight: 600;',
          blockquote: 'background-color: rgba(0, 229, 255, 0.05); border-left: 4px solid #00e5ff; padding: 1.5em; color: #e4e4e7; font-style: normal; border-radius: 0 12px 12px 0; line-height: 1.8;',
          a: 'color: #00e5ff; text-decoration: none; border-bottom: 1px solid rgba(0, 229, 255, 0.4); transition: border-color 0.2s;',
          hr: 'border-top: 0; height: 1px; background: linear-gradient(to right, transparent, rgba(0, 229, 255, 0.6), transparent); margin: 3em 0;',
          img: 'max-width: 100%; height: auto; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);'
        }
      };

      const currentThemeStyles = themeStyles[selectedTheme] || {};

      const applyStyles = (element: Element) => {
        const tagName = element.tagName.toLowerCase();
        
        let styleStr = element.getAttribute('style') || '';
        if (styleStr && !styleStr.endsWith(';')) styleStr += '; ';
        else if (styleStr) styleStr += ' ';

        if (baseStyles[tagName]) {
          styleStr += baseStyles[tagName] + ' ';
        }
        if (currentThemeStyles[tagName]) {
          styleStr += currentThemeStyles[tagName] + ' ';
        }

        if (styleStr.trim()) {
          element.setAttribute('style', styleStr.trim());
        }

        Array.from(element.children).forEach(applyStyles);
      };

      Array.from(doc.body.children).forEach(applyStyles);
      editorContent = doc.body.innerHTML;
    }

    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="ko">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI 뉴스레터</title>
  <style type="text/css">
    @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@400;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Space+Grotesk:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap');
    
    /* Email Client Resets */
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body, table, td, p, a, li, blockquote { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
    
    /* Responsive */
    @media only screen and (max-width: 600px) {
      .content-table {
        width: 100% !important;
      }
      .content-td {
        padding: 20px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${currentTheme.style.backgroundColor}; ${'backgroundImage' in currentTheme.style ? `background-image: ${(currentTheme.style as any).backgroundImage};` : ''} -webkit-font-smoothing: antialiased; width: 100% !important;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="${currentTheme.style.backgroundColor}" style="background-color: ${currentTheme.style.backgroundColor}; ${'backgroundImage' in currentTheme.style ? `background-image: ${(currentTheme.style as any).backgroundImage};` : ''} width: 100%;">
    <tr>
      <td align="center" valign="top" style="padding: 20px 0;">
        <!--[if mso]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="600" style="width:600px;">
        <tr>
        <td valign="top">
        <![endif]-->
        <table class="content-table" width="600" border="0" cellspacing="0" cellpadding="0" align="center" style="width: 600px; max-width: 600px; margin: 0 auto; text-align: left; background-color: transparent;">
          <tr>
            <td class="content-td" style="padding: 40px; font-size: 18px; line-height: 1.75; font-family: ${currentTheme.style.fontFamily}, sans-serif; color: ${currentTheme.style.color};">
              <div>
                ${editorContent}
              </div>
            </td>
          </tr>
        </table>
        <!--[if mso]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
  };

  const handleCopyHtml = () => {
    const html = getFullHtml();
    if (!html) return;
    navigator.clipboard.writeText(html).then(() => {
      alert("클립보드에 HTML이 복사되었습니다.");
    });
  };

  const handleDownload = () => {
    const html = getFullHtml();
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'newsletter.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const setLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL을 입력하세요', previousUrl);

    if (url === null) {
      return;
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-col w-full h-full bg-white relative">
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleImageUpload}
        className="hidden"
      />
      <div className="flex px-3 border-b border-slate-100 bg-white/90 backdrop-blur-sm sticky top-0 z-20 items-center justify-between shadow-sm h-[52px] overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-center justify-between w-full min-w-[650px] gap-2">
          {/* Left Group */}
          <div className="flex items-center gap-0.5 h-full shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center h-9 w-9 text-emerald-500/80">
                <Check className="w-[18px] h-[18px]" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              자동 저장됨
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                className="h-9 w-9 p-0 rounded-md hover:bg-slate-100 transition-colors inline-flex items-center justify-center"
              >
                <Undo2 className="w-[18px] h-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              실행 취소 (Undo)
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                className="h-9 w-9 p-0 rounded-md hover:bg-slate-100 transition-colors inline-flex items-center justify-center"
              >
                <Redo2 className="w-[18px] h-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              다시 실행 (Redo)
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="w-px h-7 bg-slate-200 mx-3 shrink-0" />

        {/* Center Group */}
        <div className="flex items-center gap-3 flex-1 min-w-max">
          <div className="flex items-center gap-2">
            <Select
              value={textStyle}
              onValueChange={(value) => {
                if (value === 'p') editor.chain().focus().setParagraph().run();
                else if (value === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
                else if (value === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
                else if (value === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
              }}
            >
              <SelectTrigger className="w-[120px] h-9 border-none bg-transparent hover:bg-slate-100 focus:ring-0 text-sm font-medium">
                <SelectValue placeholder="스타일" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="p">일반 텍스트</SelectItem>
                <SelectItem value="h1">제목 1</SelectItem>
                <SelectItem value="h2">제목 2</SelectItem>
                <SelectItem value="h3">제목 3</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={`h-9 w-9 p-0 inline-flex items-center justify-center rounded-md transition-all ${editor.isActive('bold') ? 'bg-slate-200 text-primary font-bold' : 'hover:bg-slate-100 text-slate-600'}`}
                >
                  <Bold className="w-[18px] h-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                굵게
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={`h-9 w-9 p-0 inline-flex items-center justify-center rounded-md transition-all ${editor.isActive('italic') ? 'bg-slate-200 text-primary italic' : 'hover:bg-slate-100 text-slate-600'}`}
                >
                  <Italic className="w-[18px] h-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                기울임꼴
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={setLink}
                  className={`h-9 w-9 p-0 inline-flex items-center justify-center rounded-md transition-all ${editor.isActive('link') ? 'bg-slate-200 text-primary' : 'hover:bg-slate-100 text-slate-600'}`}
                >
                  <LinkIcon className="w-[18px] h-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                링크
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-9 w-9 p-0 inline-flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-600 transition-all"
                >
                  <ImageIcon className="w-[18px] h-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                이미지 삽입
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  className={`h-9 w-9 p-0 inline-flex items-center justify-center rounded-md transition-all ${editor.isActive('bulletList') ? 'bg-slate-200 text-primary' : 'hover:bg-slate-100 text-slate-600'}`}
                >
                  <List className="w-[18px] h-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                글머리 기호 목록
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  className={`h-9 w-9 p-0 inline-flex items-center justify-center rounded-md transition-all ${editor.isActive('orderedList') ? 'bg-slate-200 text-primary' : 'hover:bg-slate-100 text-slate-600'}`}
                >
                  <ListOrdered className="w-[18px] h-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                번호 매기기 목록
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="w-px h-7 bg-slate-200 mx-3 shrink-0" />

        {/* Right Group */}
        <div className="flex items-center gap-1 shrink-0">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-9 gap-1.5 text-slate-600 font-medium">
                <Palette className="w-4 h-4" />
                내보내기
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[1400px] max-w-[90vw] w-[1400px] h-[85vh] flex flex-col gap-0 p-0 overflow-hidden" aria-describedby={undefined}>
              <DialogHeader className="px-6 py-4 border-b shrink-0">
                <DialogTitle>디자인 및 내보내기</DialogTitle>
              </DialogHeader>
              <div className="flex flex-1 overflow-hidden">
                {/* 좌측 패널: 테마 선택 */}
                <div className="w-1/3 border-r bg-slate-50/50 p-6 flex flex-col gap-4 overflow-y-auto">
                  <h3 className="font-semibold text-sm text-slate-500 mb-2">테마 선택</h3>
                  {(Object.entries(themes) as [keyof typeof themes, typeof themes['theme-default']][]).map(([key, theme]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedTheme(key)}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${selectedTheme === key ? 'border-primary bg-primary/5 ring-4 ring-primary/10' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                      <div className="font-semibold text-slate-900 mb-1">{theme.name}</div>
                      <div className="text-xs text-slate-500">{theme.desc}</div>
                    </button>
                  ))}
                </div>
                {/* 우측 패널: 미리보기 & 내보내기 */}
                <div className="w-2/3 flex flex-col bg-slate-100">
                  <div className="flex items-center justify-between px-6 py-3 border-b bg-white shrink-0">
                    <span className="text-sm font-medium text-slate-500">실시간 미리보기</span>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={handleCopyHtml} className="h-8 gap-1.5">
                        <Copy className="w-3.5 h-3.5" />
                        HTML 복사
                      </Button>
                      <Button size="sm" onClick={handleDownload} className="h-8 gap-1.5">
                        <Download className="w-3.5 h-3.5" />
                        HTML 다운로드
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto p-8">
                    <div 
                      className={`w-full max-w-[800px] mx-auto shadow-sm rounded-lg h-fit ${selectedTheme}`}
                      style={{
                        backgroundColor: themes[selectedTheme as keyof typeof themes]?.style.backgroundColor || '#ffffff',
                        backgroundImage: (themes[selectedTheme as keyof typeof themes]?.style as any)?.backgroundImage || 'none',
                        color: themes[selectedTheme as keyof typeof themes]?.style.color || '#333333',
                        fontFamily: themes[selectedTheme as keyof typeof themes]?.style.fontFamily || 'sans-serif',
                        padding: '40px',
                        minHeight: '100%',
                      }}
                      dangerouslySetInnerHTML={{ __html: `<div class="prose max-w-none ${selectedTheme}">${editor.getHTML()}</div>` }}
                    />
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0 w-full">
        <div className="min-h-full px-12 py-10 cursor-text" onClick={() => editor.chain().focus().run()}>
          <EditorContent editor={editor} className="mx-auto max-w-[700px]" />
        </div>
      </ScrollArea>
    </div>
  );
});