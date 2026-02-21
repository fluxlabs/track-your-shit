// Track Your Shit - Code Block Component
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  children: string;
  className?: string;
  language?: string;
}

export function CodeBlock({ children, className, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <button
        onClick={() => void handleCopy()}
        className={cn(
          "absolute right-2 top-2 p-1.5 rounded-md",
          "opacity-0 group-hover:opacity-100 transition-opacity",
          "bg-muted hover:bg-muted/80 text-muted-foreground"
        )}
        title="Copy code"
      >
        {copied ? (
          <Check className="h-4 w-4 text-status-success" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>
      <pre className={cn("rounded-md overflow-x-auto", className)}>
        <code className={language ? `language-${language}` : undefined}>
          {children}
        </code>
      </pre>
    </div>
  );
}
