'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check } from 'lucide-react'
import remarkGfm from 'remark-gfm'

export default function MarkdownMessage({ content }) {
  const [copiedCode, setCopiedCode] = useState(null)

  const copyToClipboard = (code, index) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(index)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const codeString = String(children).replace(/\n$/, '')
            const language = match ? match[1] : ''
            const codeIndex = `${codeString.substring(0, 20)}-${Date.now()}`

            return !inline && match ? (
              <div className="relative group my-4">
                {/* Language label and copy button */}
                <div className="flex items-center justify-between bg-[#1e1e1e] text-gray-300 px-4 py-2 rounded-t-lg border-b border-gray-700">
                  <span className="text-xs font-mono">{language}</span>
                  <button
                    onClick={() => copyToClipboard(codeString, codeIndex)}
                    className="flex items-center gap-1.5 text-xs hover:bg-gray-700 px-2 py-1 rounded transition-colors"
                    title="Copy code"
                  >
                    {copiedCode === codeIndex ? (
                      <>
                        <Check size={14} />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copy code</span>
                      </>
                    )}
                  </button>
                </div>
                {/* Code block */}
                <SyntaxHighlighter
                  style={vscDarkPlus}
                  language={language}
                  PreTag="div"
                  className="!mt-0 !rounded-t-none !rounded-b-lg"
                  customStyle={{
                    margin: 0,
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 0,
                  }}
                  {...props}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            ) : (
              <code
                className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono"
                {...props}
              >
                {children}
              </code>
            )
          },
          p({ children }) {
            return <p className="mb-3 leading-7">{children}</p>
          },
          ul({ children }) {
            return <ul className="mb-3 ml-4 list-disc">{children}</ul>
          },
          ol({ children }) {
            return <ol className="mb-3 ml-4 list-decimal">{children}</ol>
          },
          li({ children }) {
            return <li className="mb-1">{children}</li>
          },
          h1({ children }) {
            return <h1 className="text-2xl font-bold mb-3 mt-4">{children}</h1>
          },
          h2({ children }) {
            return <h2 className="text-xl font-bold mb-3 mt-4">{children}</h2>
          },
          h3({ children }) {
            return <h3 className="text-lg font-bold mb-2 mt-3">{children}</h3>
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-gray-300 pl-4 italic my-3 text-gray-700">
                {children}
              </blockquote>
            )
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#3d6964] hover:underline"
              >
                {children}
              </a>
            )
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full border border-gray-300">
                  {children}
                </table>
              </div>
            )
          },
          th({ children }) {
            return (
              <th className="border border-gray-300 px-4 py-2 bg-gray-100 font-semibold text-left">
                {children}
              </th>
            )
          },
          td({ children }) {
            return (
              <td className="border border-gray-300 px-4 py-2">
                {children}
              </td>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
