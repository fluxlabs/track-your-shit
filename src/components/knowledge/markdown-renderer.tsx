// Track Your Shit - Markdown Renderer Component
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { Children } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Bookmark } from 'lucide-react';
import { CodeBlock } from './code-block';
import { cn } from '@/lib/utils';
import { slugify } from './knowledge-toc';
import { useCreateKnowledgeBookmark } from '@/lib/queries';
import 'highlight.js/styles/github-dark.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  projectId?: string;
  filePath?: string;
}

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && 'props' in node) {
    const el = node as React.ReactElement<{ children?: React.ReactNode }>;
    return extractText(el.props.children);
  }
  return '';
}

export function MarkdownRenderer({
  content,
  className,
  projectId,
  filePath,
}: MarkdownRendererProps) {
  const createBookmark = useCreateKnowledgeBookmark();

  const handleBookmark = (text: string, level: number) => {
    if (!projectId || !filePath) return;
    createBookmark.mutate({
      projectId,
      filePath,
      heading: text,
      headingLevel: level,
    });
  };

  return (
    <div className={cn('markdown-content', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Custom code block rendering
          pre({ children }) {
            return <div className="my-4">{children}</div>;
          },
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;
            const content = extractText(children).replace(/\n$/, '');

            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono" {...props}>
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock language={match?.[1]} className={className}>
                {content}
              </CodeBlock>
            );
          },
          // Styled headings with IDs for ToC and bookmark icons
          h1: ({ children }) => {
            const text = extractText(Children.toArray(children));
            return (
              <h1
                id={slugify(text)}
                className="group text-3xl font-bold mt-8 mb-4 pb-2 border-b flex items-center gap-2"
              >
                <span className="flex-1">{children}</span>
                {projectId && filePath && (
                  <button
                    onClick={() => handleBookmark(text, 1)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-accent flex-shrink-0"
                    title="Bookmark this heading"
                  >
                    <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </h1>
            );
          },
          h2: ({ children }) => {
            const text = extractText(Children.toArray(children));
            return (
              <h2
                id={slugify(text)}
                className="group text-2xl font-bold mt-6 mb-3 flex items-center gap-2"
              >
                <span className="flex-1">{children}</span>
                {projectId && filePath && (
                  <button
                    onClick={() => handleBookmark(text, 2)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-accent flex-shrink-0"
                    title="Bookmark this heading"
                  >
                    <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </h2>
            );
          },
          h3: ({ children }) => {
            const text = extractText(Children.toArray(children));
            return (
              <h3
                id={slugify(text)}
                className="group text-xl font-semibold mt-5 mb-2 flex items-center gap-2"
              >
                <span className="flex-1">{children}</span>
                {projectId && filePath && (
                  <button
                    onClick={() => handleBookmark(text, 3)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-accent flex-shrink-0"
                    title="Bookmark this heading"
                  >
                    <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </h3>
            );
          },
          h4: ({ children }) => {
            const text = extractText(Children.toArray(children));
            return (
              <h4
                id={slugify(text)}
                className="group text-lg font-semibold mt-4 mb-2 flex items-center gap-2"
              >
                <span className="flex-1">{children}</span>
                {projectId && filePath && (
                  <button
                    onClick={() => handleBookmark(text, 4)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-accent flex-shrink-0"
                    title="Bookmark this heading"
                  >
                    <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </h4>
            );
          },
          // Paragraphs
          p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              {children}
            </a>
          ),
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-muted-foreground/30 pl-4 italic text-muted-foreground my-4">
              {children}
            </blockquote>
          ),
          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="w-full border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
          th: ({ children }) => (
            <th className="border px-4 py-2 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => <td className="border px-4 py-2">{children}</td>,
          // Horizontal rule
          hr: () => <hr className="my-6 border-border" />,
          // Images
          img: ({ src, alt }) => (
            <img src={src} alt={alt} className="max-w-full h-auto rounded-md my-4" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
