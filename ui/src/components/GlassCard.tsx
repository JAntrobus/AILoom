import { type ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
  padding?: boolean
}

export default function GlassCard({ children, className = '', hover = false, onClick, padding = true }: Props) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`glass rounded-2xl ${padding ? 'p-5' : ''} ${hover ? 'glass-hover cursor-pointer' : ''} ${className} ${onClick ? 'text-left w-full' : ''}`}
    >
      {children}
    </Tag>
  )
}
