import type { Config } from 'tailwindcss';

/**
 * 기획서 표지/본문에서 쓰인 색상 팔레트를 그대로 옮겨왔다.
 * teal(청록) = 브랜드 포인트 컬러, navy = 헤더/다크 영역,
 * amber(주황) = Category B, blue = Category C 강조에 사용.
 */
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: '#14b8a6',
          navy: '#0f172a',
          amber: '#c2760c',
          blue: '#3b6fc9',
          red: '#b3413e',
        },
      },
    },
  },
  plugins: [],
};
export default config;
