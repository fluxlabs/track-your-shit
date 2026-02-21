// Track Your Shit - Terminal View Component
// xterm.js terminal emulator wrapper with smart scroll behavior
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import "@xterm/xterm/css/xterm.css";
import { cn } from "@/lib/utils";
import { TerminalSearchBar } from "./terminal-search-bar";

/**
 * Methods exposed via ref for external control
 */
export interface TerminalViewRef {
  /** Write data to the terminal */
  write: (data: string) => void;
  /** Clear the terminal */
  clear: () => void;
  /** Scroll to the bottom of the terminal */
  scrollToBottom: () => void;
  /** Check if terminal is scrolled to bottom */
  isAtBottom: () => boolean;
  /** Focus the terminal */
  focus: () => void;
}

interface TerminalViewProps {
  /** Callback when user types in terminal */
  onData?: (data: string) => void;
  /** Callback when terminal is resized (cols, rows) */
  onResize?: (cols: number, rows: number) => void;
  /** Additional CSS classes */
  className?: string;
  /** Font size in pixels (default: 14) */
  fontSize?: number;
  /** Line height multiplier (default: 1.2) */
  lineHeight?: number;
}

/**
 * Terminal view component using xterm.js
 *
 * Features:
 * - Dark theme matching dashboard
 * - FitAddon for responsive sizing
 * - WebLinksAddon for clickable URLs
 * - Smart scroll behavior (auto-follow when at bottom)
 * - ResizeObserver for responsive fit
 * - Proper cleanup on unmount
 */
export const TerminalView = forwardRef<TerminalViewRef, TerminalViewProps>(
  function TerminalView(
    { onData, onResize, className, fontSize = 14, lineHeight = 1.2 },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const searchAddonRef = useRef<SearchAddon | null>(null);
    const [searchAddon, setSearchAddon] = useState<SearchAddon | null>(null);
    const isAtBottomRef = useRef(true);
    const [showSearch, setShowSearch] = useState(false);

    /**
     * Check if terminal is scrolled to bottom
     */
    const checkIsAtBottom = useCallback((): boolean => {
      const terminal = terminalRef.current;
      if (!terminal) return true;

      const buffer = terminal.buffer.active;
      const viewportY = buffer.viewportY;
      const baseY = buffer.baseY;
      // At bottom if viewport is at or near the base (within 1 line)
      return viewportY >= baseY - 1;
    }, []);

    /**
     * Write data to terminal, auto-scrolling if user was at bottom
     */
    const write = useCallback((data: string) => {
      const terminal = terminalRef.current;
      if (!terminal) return;

      const wasAtBottom = isAtBottomRef.current;
      terminal.write(data);

      // Auto-scroll if user was at bottom before write
      if (wasAtBottom) {
        terminal.scrollToBottom();
      }
    }, []);

    /**
     * Clear terminal content (resets entire terminal including scrollback)
     */
    const clear = useCallback(() => {
      const terminal = terminalRef.current;
      if (!terminal) return;
      terminal.reset();
      terminal.clear();
    }, []);

    /**
     * Scroll to bottom of terminal
     */
    const scrollToBottom = useCallback(() => {
      terminalRef.current?.scrollToBottom();
      isAtBottomRef.current = true;
    }, []);

    /**
     * Focus the terminal
     */
    const focus = useCallback(() => {
      terminalRef.current?.focus();
    }, []);

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        write,
        clear,
        scrollToBottom,
        isAtBottom: () => isAtBottomRef.current,
        focus,
      }),
      [write, clear, scrollToBottom, focus]
    );

    // Initialize terminal
    useEffect(() => {
      if (!containerRef.current) return;

      const terminal = new Terminal({
        cursorBlink: true,
        cursorStyle: "block",
        theme: {
          background: "#0a0a0a",
          foreground: "#fafafa",
          cursor: "#fafafa",
          cursorAccent: "#0a0a0a",
          selectionBackground: "#3b3b3b",
          selectionForeground: "#fafafa",
          black: "#000000",
          red: "#ff5555",
          green: "#50fa7b",
          yellow: "#f1fa8c",
          blue: "#6272a4",
          magenta: "#ff79c6",
          cyan: "#8be9fd",
          white: "#f8f8f2",
          brightBlack: "#6272a4",
          brightRed: "#ff6e6e",
          brightGreen: "#69ff94",
          brightYellow: "#ffffa5",
          brightBlue: "#d6acff",
          brightMagenta: "#ff92df",
          brightCyan: "#a4ffff",
          brightWhite: "#ffffff",
        },
        fontFamily: '"JetBrains Mono Variable", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
        fontSize,
        lineHeight,
        scrollback: 10000,
        convertEol: true,
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      const searchAddon = new SearchAddon();

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);
      terminal.loadAddon(searchAddon);
      terminal.open(containerRef.current);
      searchAddonRef.current = searchAddon;
      setSearchAddon(searchAddon);

      // Intercept Cmd/Ctrl+F for search
      terminal.attachCustomKeyEventHandler((e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'f' && e.type === 'keydown') {
          setShowSearch(true);
          return false;
        }
        return true;
      });

      // Initial fit after short delay to ensure container has dimensions
      requestAnimationFrame(() => {
        fitAddon.fit();
      });

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      // Handle user input
      if (onData) {
        terminal.onData(onData);
      }

      // Track scroll position to determine if user is at bottom
      const viewport = terminal.element?.querySelector(".xterm-viewport");
      const handleScroll = () => {
        isAtBottomRef.current = checkIsAtBottom();
      };
      viewport?.addEventListener("scroll", handleScroll);

      // ResizeObserver for responsive fit with debouncing
      let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
      const resizeObserver = new ResizeObserver(() => {
        // Debounce resize events (150ms) to prevent thrashing
        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }
        resizeTimeout = setTimeout(() => {
          fitAddon.fit();
          // Notify parent of new dimensions
          if (onResize && terminal.cols && terminal.rows) {
            onResize(terminal.cols, terminal.rows);
          }
        }, 150);
      });
      resizeObserver.observe(containerRef.current);

      // IntersectionObserver to refit when container becomes visible
      // Handles forceMount tabs where display transitions from none to flex
      const intersectionObserver = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) {
          fitAddon.fit();
        }
      });
      intersectionObserver.observe(containerRef.current);

      // Cleanup
      return () => {
        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }
        viewport?.removeEventListener("scroll", handleScroll);
        resizeObserver.disconnect();
        intersectionObserver.disconnect();
        terminal.dispose();
        terminalRef.current = null;
        fitAddonRef.current = null;
        searchAddonRef.current = null;
        setSearchAddon(null);
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onData, onResize, checkIsAtBottom]); // Note: fontSize/lineHeight changes handled separately

    // Update font size without reinitializing terminal
    useEffect(() => {
      if (terminalRef.current) {
        terminalRef.current.options.fontSize = fontSize;
        terminalRef.current.options.lineHeight = lineHeight;
        // Refit after font change
        fitAddonRef.current?.fit();
      }
    }, [fontSize, lineHeight]);

    return (
      <div className={cn("relative h-full w-full", className)}>
        <TerminalSearchBar
          searchAddon={searchAddon}
          visible={showSearch}
          onClose={() => setShowSearch(false)}
        />
        <div
          ref={containerRef}
          className="h-full w-full bg-[#0a0a0a] rounded-lg overflow-hidden"
        />
      </div>
    );
  }
);

export default TerminalView;
