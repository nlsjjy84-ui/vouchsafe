'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { JangdanMark } from './JangdanMark';

/**
 * =========================================================================
 * ChatWidget — 로그인 후 화면 우하단에 떠 있는 AI 챗봇.
 * =========================================================================
 * [MOCK 고지] 이 프로젝트의 Mock-first 원칙(MockVerificationService 등)을 그대로 따라,
 * 지금은 실제 LLM API를 호출하지 않고 "우리 서비스 도메인 지식"에 대한 규칙 기반
 * 응답 엔진(answerFor())으로 동작한다. answerFor()의 입력(사용자 문장)과 출력(답변 문자열)
 * 인터페이스는 실제 LLM 호출로 그대로 교체 가능하게 설계했다 - 나중에 백엔드에
 * POST /chat 같은 엔드포인트를 추가해 실제 모델 응답을 받아오도록 바꾸면,
 * 이 컴포넌트는 answerFor() 호출 한 줄만 그 API 호출로 바꾸면 된다.
 * =========================================================================
 */

interface ChatMessage {
  id: number;
  role: 'user' | 'bot';
  text: string;
}

const RULES: Array<{ keywords: string[]; answer: string }> = [
  {
    keywords: ['에스크로', 'escrow', '안전거래', '돈', '결제'],
    answer:
      '에스크로는 의뢰인이 지불한 자금을 플랫폼이 대신 보관했다가, 결과물이 승인되거나 무이의 기간(5일)이 지나야 전문가에게 정산해주는 구조예요. 그래서 "결과물도 못 받았는데 돈만 먼저 나가는" 위험이 없어요.',
  },
  {
    keywords: ['이의제기', '분쟁', 'dispute', '환불'],
    answer:
      '제출된 결과물에 문제가 있다고 생각되면 바운티 상세 화면에서 이의제기를 접수할 수 있어요. 접수 즉시 에스크로 자금이 동결(FROZEN)되고, 관리자가 내용을 검토해 환불 또는 정산 유지로 중재해요.',
  },
  {
    keywords: ['자격', '인증', 'certification', '검증', '전문가 등록'],
    answer:
      '전문가 자격은 4개 트랙(국가 공인 자격증 / 사업자 경력 / 실무 경력·교육 / 크리에이터) 중 하나로 증빙을 제출하면, 형식 검증과 대조를 거쳐 자동으로 승인/반려돼요. 승인된 분야의 바운티에만 지원할 수 있어요.',
  },
  {
    keywords: ['인사이트', 'ai', '분석', '소비', '지출', '예산', '마이데이터'],
    answer:
      '좌측 메뉴의 "AI 인사이트"에 들어가면 내 활동 데이터(지출/수입/분야별 분포/월별 추이)를 기반으로 한 맞춤 분석과, 지출 경향에 대한 인사이트 문장을 볼 수 있어요.',
  },
  {
    keywords: ['바운티', '등록', '올리기', '의뢰'],
    answer:
      '"바운티 등록" 메뉴에서 분야(도메인)와 예산, 원하는 결과물을 적어 올리면, 해당 분야에 인증된 전문가들이 지원할 수 있어요. 지원자 중 한 명을 선택하면 에스크로에 자금이 잠기고 작업이 시작돼요.',
  },
  {
    keywords: ['정산', '수수료', 'fee', '수익'],
    answer:
      '결과물이 승인되거나 무이의 기간이 지나면 플랫폼 수수료를 제외한 금액이 전문가에게 자동 정산돼요. 마이페이지에서 정산 내역을 확인할 수 있어요.',
  },
  {
    keywords: ['안녕', 'hi', 'hello', '반가'],
    answer: '안녕하세요! CredoBounty 도우미예요. 바운티, 에스크로, 전문가 인증, AI 인사이트 등 무엇이든 물어보세요.',
  },
];

const FALLBACK =
  '아직 그 질문에는 정확히 답하기 어려워요. "에스크로", "이의제기", "전문가 인증", "AI 인사이트" 같은 키워드로 다시 물어봐 주실래요?';

function answerFor(userText: string): string {
  const lower = userText.toLowerCase();
  const matched = RULES.find((rule) => rule.keywords.some((kw) => lower.includes(kw.toLowerCase())));
  return matched?.answer ?? FALLBACK;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: 'bot',
      text: '안녕하세요! CredoBounty AI 도우미예요. 에스크로, 이의제기, 전문가 인증, AI 인사이트 등 궁금한 걸 물어보세요.',
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, typing]);

  function send() {
    const text = input.trim();
    if (!text) return;
    const userMsg: ChatMessage = { id: Date.now(), role: 'user', text };
    setInput('');
    setMessages((prev) => [...prev, userMsg]);
    setTyping(true);

    // [MOCK] 실제 응답처럼 느껴지도록 살짝의 지연 + "입력중" 표시를 흉내낸다 - 실제
    // API(예: POST /chat) 교체 지점. 지연시간과 타이핑 인디케이터만 붙이면 이 자리를
    // 그대로 진짜 LLM 응답 대기로 바꿀 수 있다.
    window.setTimeout(() => {
      const botMsg: ChatMessage = { id: Date.now() + 1, role: 'bot', text: answerFor(text) };
      setMessages((prev) => [...prev, botMsg]);
      setTyping(false);
    }, 500);
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-40 flex h-[28rem] w-80 flex-col overflow-hidden rounded-2xl border border-hairline bg-surface-canvas shadow-float">
          <div className="flex items-center gap-2.5 bg-brand-ink px-4 py-3 text-white">
            <JangdanMark size={14} variant="dark" />
            <span className="text-sm font-semibold">CredoBounty AI 도우미</span>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-brand-clay text-white'
                      : 'bg-surface-raised text-ink-900'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl bg-surface-raised px-3 py-2.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-ink-400"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="flex items-center gap-2 border-t border-hairline p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send();
              }}
              placeholder="궁금한 걸 물어보세요"
              className="flex-1 rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs outline-none focus:border-brand-clay"
            />
            <button
              onClick={send}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-clay text-white hover:opacity-90"
              aria-label="전송"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-clay text-white shadow-float transition-transform hover:scale-105"
        aria-label="AI 챗봇 열기"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </>
  );
}
