import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function createIcon(d: string, viewBox = '0 0 24 24') {
  return ({ size = 16, ...p }: IconProps) => (
    <svg width={size} height={size} viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      {d.split('|').map((seg, i) => {
        const [dAttr, ...rest] = seg.trim().split(' ')
        if (dAttr === 'circle') {
          const [cx, cy, r] = rest
          return <circle key={i} cx={cx} cy={cy} r={r} />
        }
        if (dAttr === 'rect') {
          const [x, y, w, h, rx] = rest
          return <rect key={i} x={x} y={y} width={w} height={h} rx={rx || '0'} />
        }
        return <path key={i} d={seg.trim()} />
      })}
    </svg>
  )
}

export const Icons = {
  Home: createIcon('M3 12 12 3l9 9|M5 10v10h14V10'),
  CreditCard: createIcon('M2 5h20v14H2z|M2 10h20'),
  Coins: createIcon('M9 9a6 6 0 1 0 0 12 6 6 0 0 0 0-12z|M15 15a6 6 0 1 0 0 12 6 6 0 0 0 0-12z', '0 0 24 24'),
  Undo: createIcon('M3 7v6h6|M3 13a9 9 0 1 0 3-7'),
  Send: createIcon('m22 2-7 20-4-9-9-4 20-7Z'),
  Receipt: createIcon('M4 2h16v20l-3-2-3 2-2-2-2 2-3-2-3 2V2Z|M8 7h8|M8 11h8|M8 15h6'),
  Logs: createIcon('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M8 13h8|M8 17h5'),
  Settings: createIcon('circle 12 12 3|M19 12h2|M3 12h2|M12 3v2|M12 19v2|M5.6 5.6l1.4 1.4|M17 17l1.4 1.4|M5.6 18.4 7 17|M17 7l1.4-1.4'),
  Search: createIcon('circle 11 11 7|M21 21l-4.3-4.3', '0 0 24 24'),
  Bell: createIcon('M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9|M10 21a2 2 0 0 0 4 0'),
  Chevron: createIcon('m9 18 6-6-6-6'),
  Down: createIcon('m6 9 6 6 6-6'),
  Plus: createIcon('M12 5v14|M5 12h14'),
  Filter: createIcon('M3 4h18l-7 9v6l-4 2v-8z'),
  Calendar: createIcon('rect 3 5 18 16 2|M3 9h18|M8 3v4|M16 3v4'),
  Download: createIcon('M12 3v12|M7 10l5 5 5-5|M5 21h14'),
  Copy: createIcon('rect 9 9 11 11 2|M5 15V5a2 2 0 0 1 2-2h10'),
  Dots: createIcon('circle 5 12 1|circle 12 12 1|circle 19 12 1', '0 0 24 24'),
  Check: createIcon('M5 13l4 4L19 7'),
  Minus: createIcon('M5 12h14'),
  X: createIcon('M18 6 6 18|M6 6l12 12'),
  Trend: createIcon('M3 17l6-6 4 4 8-8|M14 7h7v7'),
  TrendDown: createIcon('M3 7l6 6 4-4 8 8|M14 17h7v-7'),
  Eye: createIcon('M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z|circle 12 12 3', '0 0 24 24'),
  Retry: createIcon('M21 12a9 9 0 1 1-3-6.7|M21 3v6h-6'),
  Print: createIcon('M6 9V2h12v7|rect 6 14 12 8 0|M6 18H2v-7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v7h-4'),
  Mail: createIcon('rect 2 4 20 16 2|M2 6l10 7 10-7'),
  AlertTri: createIcon('M12 3 2 21h20L12 3Z|M12 10v5|M12 18h.01'),
  Info: createIcon('circle 12 12 9|M12 8h.01|M11 12h1v5h1', '0 0 24 24'),
  Bike: createIcon('circle 6 17 3.5|circle 18 17 3.5|M6 17 11 6h3l3 5h-7|M14 6h3'),
  Menu: createIcon('M4 6h16|M4 12h16|M4 18h16'),
  Close: createIcon('M18 6 6 18|M6 6l12 12'),
  Logout: createIcon('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4|M16 17l5-5-5-5|M21 12H9'),
  Lock: createIcon('rect 3 11 18 11 2|M7 11V7a5 5 0 0 1 10 0v4'),
  Cog: createIcon('circle 12 12 3|M19 12h2|M3 12h2|M12 3v2|M12 19v2|M5.6 5.6l1.4 1.4|M17 17l1.4 1.4|M5.6 18.4 7 17|M17 7l1.4-1.4'),
}

export function Glyph({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="BiciMarket" role="img">
      <circle cx="6" cy="17" r="3.2" />
      <circle cx="18" cy="17" r="3.2" />
      <path d="M6 17 11 7h3l3 6h-7" />
    </svg>
  )
}
