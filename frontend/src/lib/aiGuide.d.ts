// aiGuide.js(공용 AI 길 안내 엔진)의 타입 선언. 엔진은 순수 JS로 여러 프로젝트가 함께 쓴다.
export interface AiGuideButton { label: string; value: string; main?: boolean }
export interface AiGuideSay { kicker?: string; buttons?: AiGuideButton[]; [k: string]: unknown }
export interface AiGuideExplain { title?: string; text: string }
export interface AiGuideOptions {
  name?: string;
  accent?: string[];
  effect?: 'splash' | 'glow' | 'ribbons' | 'text' | 'pixel' | 'none';
  calm?: boolean;
  fade?: number;
  radius?: number;
  trail?: number;
  sim?: number;
  dye?: number;
  bloom?: boolean;
  iter?: number;
  inkStrong?: string;
  cursor?: boolean;
  magnify?: boolean;
  zoom?: number;
  explain?: (el: Element) => AiGuideExplain | null;
  where?: () => string;
  hud?: () => boolean;
  onQuit?: () => void;
  [k: string]: unknown;
}
export interface AiGuide {
  run: (...args: any[]) => any;
  menu: (...args: any[]) => any;
  point: (...args: any[]) => Promise<any>;
  sweep: (...args: any[]) => Promise<any>;
  speak: (text: string, opt?: AiGuideSay) => Promise<string | null>;
  stop: () => void;
  spark: (x: number, y: number) => void;
  setDots: (...args: any[]) => void;
  explainEl: (el: Element) => AiGuideExplain | null;
  [k: string]: any;
}
export function createAiGuide(opt?: AiGuideOptions): AiGuide;
