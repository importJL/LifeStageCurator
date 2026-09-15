import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#202623',
        muted: '#68716a',
        line: '#d9ded7',
        paper: '#f7f8f4',
        coral: '#ed765f',
        sage: '#cad9c8',
        honey: '#efd99e',
        sky: '#c7dde1',
        plum: '#d8c6d5'
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
        display: ['Fraunces', 'serif']
      },
      boxShadow: {
        offset: '5px 5px 0 #d9ded7',
        modal: '10px 10px 0 #202623'
      }
    }
  },
  plugins: []
};

export default config;
