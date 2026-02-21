// Track Your Shit - Keyboard Shortcuts Provider
// Registers global hotkeys and exposes search/help open state
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { ReactNode, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTerminalContext } from '@/contexts/terminal-context';

interface ShortcutsState {
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
}

interface KeyboardShortcutsProviderProps {
  children: (state: ShortcutsState) => ReactNode;
}

export function KeyboardShortcutsProvider({
  children,
}: KeyboardShortcutsProviderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const navigate = useNavigate();
  const { shellPanelCollapsed, setShellPanelCollapsed } = useTerminalContext();

  const toggleSearch = useCallback(() => {
    setSearchOpen((prev) => !prev);
  }, []);

  const toggleHelp = useCallback(() => {
    setHelpOpen((prev) => !prev);
  }, []);

  const toggleShell = useCallback(() => {
    setShellPanelCollapsed(!shellPanelCollapsed);
  }, [shellPanelCollapsed, setShellPanelCollapsed]);

  // Search: Cmd/Ctrl+K
  useHotkeys('mod+k', (e) => {
    e.preventDefault();
    toggleSearch();
  }, { enableOnFormTags: false });

  // Navigation shortcuts
  useHotkeys('mod+1', (e) => {
    e.preventDefault();
    void navigate('/');
  }, { enableOnFormTags: false });

  useHotkeys('mod+2', (e) => {
    e.preventDefault();
    void navigate('/projects');
  }, { enableOnFormTags: false });

  useHotkeys('mod+3', (e) => {
    e.preventDefault();
    void navigate('/terminal');
  }, { enableOnFormTags: false });

  // Shell toggle: Cmd/Ctrl+\
  useHotkeys('mod+\\', (e) => {
    e.preventDefault();
    toggleShell();
  }, { enableOnFormTags: false });

  // Help: Shift+/ (i.e. ?)
  useHotkeys('shift+/', (e) => {
    e.preventDefault();
    toggleHelp();
  }, { enableOnFormTags: false });

  // Settings: Cmd/Ctrl+,
  useHotkeys('mod+,', (e) => {
    e.preventDefault();
    void navigate('/settings');
  }, { enableOnFormTags: false });

  // Escape closes search/help
  useHotkeys('escape', () => {
    if (searchOpen) setSearchOpen(false);
    if (helpOpen) setHelpOpen(false);
  });

  return (
    <>
      {children({ searchOpen, setSearchOpen, helpOpen, setHelpOpen })}
    </>
  );
}
