// Track Your Shit - File Browser Component
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import 'highlight.js/styles/github-dark.css';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import * as api from '@/lib/tauri';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import hljs from 'highlight.js';
import Editor from 'react-simple-code-editor';
import {
  Folder,
  FolderOpen,
  FileText,
  Search,
  ChevronRight,
  ChevronDown,
  File,
  Loader2,
  Edit3,
  Save,
  X,
} from 'lucide-react';

interface FileBrowserProps {
  projectId: string;
  projectPath: string;
}

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  lua: 'lua',
  pl: 'perl',
  r: 'r',
  scala: 'scala',
  dart: 'dart',
  vue: 'xml',
  svelte: 'xml',
  html: 'xml',
  xml: 'xml',
  css: 'css',
  scss: 'scss',
  less: 'less',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  md: 'markdown',
  markdown: 'markdown',
  sql: 'sql',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  shell: 'bash',
  ps1: 'powershell',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  gradle: 'gradle',
  m: 'objectivec',
  mm: 'objectivec',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  hs: 'haskell',
  ml: 'ocaml',
  vim: 'vim',
  graphql: 'graphql',
  gql: 'graphql',
  tf: 'hcl',
  sol: 'solidity',
};

function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return EXTENSION_TO_LANGUAGE[ext] || 'plaintext';
}

function highlightCode(code: string, language: string): string {
  try {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language }).value;
    }
    return hljs.highlightAuto(code).value;
  } catch {
    return code;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function FileBrowser({ projectId, projectPath }: FileBrowserProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editedContent, setEditedContent] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const queryClient = useQueryClient();

  const { data: fileTree, isLoading: isLoadingTree } = useQuery({
    queryKey: queryKeys.codeFiles(projectPath),
    queryFn: () => api.listCodeFiles(projectPath),
    enabled: !!projectPath,
  });

  const { data: fileContent, isLoading: isLoadingContent } = useQuery({
    queryKey: ['file-content', projectId, selectedFile],
    queryFn: () => api.readProjectFile(projectPath, selectedFile!),
    enabled: !!selectedFile && !!projectPath,
  });

  const saveMutation = useMutation({
    mutationFn: ({ filename, content }: { filename: string; content: string }) =>
      api.writeProjectFile(projectPath, filename, content),
    onSuccess: () => {
      toast.success('File saved successfully');
      setEditedContent(editContent);
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['file-content', projectId, selectedFile] });
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error}`);
    },
  });

  const language = selectedFile ? detectLanguage(selectedFile.split('/').pop() || '') : 'plaintext';
  const highlightedContent = useMemo(() => {
    return fileContent ? highlightCode(fileContent, language) : '';
  }, [fileContent, language]);
  const hasChanges = editContent !== editedContent;

  const editorHighlight = useCallback((code: string) => {
    return highlightCode(code, language);
  }, [language]);

  const handleEdit = () => {
    setEditContent(fileContent || '');
    setEditedContent(fileContent || '');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditContent('');
    setEditedContent('');
  };

  const handleSave = () => {
    if (selectedFile) {
      saveMutation.mutate({ filename: selectedFile, content: editContent });
    }
  };

  useEffect(() => {
    setIsEditing(false);
    setEditContent('');
    setEditedContent('');
  }, [selectedFile]);

  const folders = fileTree?.folders;
  const filteredFolders = useMemo(() => {
    if (!folders) return [];
    if (!debouncedSearch.trim()) return folders;

    const query = debouncedSearch.toLowerCase();
    return folders
      .map((folder) => ({
        ...folder,
        files: folder.files.filter(
          (file) =>
            file.display_name.toLowerCase().includes(query) ||
            file.relative_path.toLowerCase().includes(query),
        ),
      }))
      .filter((folder) => folder.files.length > 0);
  }, [folders, debouncedSearch]);

  const toggleFolder = (folderName: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderName)) {
        next.delete(folderName);
      } else {
        next.add(folderName);
      }
      return next;
    });
  };

  const handleFileClick = (filePath: string) => {
    setSelectedFile(filePath);
  };

  const allFilesCount = fileTree?.total_files ?? 0;
  const filteredFilesCount = filteredFolders.reduce(
    (sum, folder) => sum + folder.files.length,
    0,
  );

  return (
    <div className="h-full flex gap-4">
      {/* File Tree Panel */}
      <div className="w-64 flex flex-col gap-3 flex-shrink-0">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* File Tree */}
        <ScrollArea className="flex-1 border rounded-lg">
          {isLoadingTree ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredFolders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Folder className="h-8 w-8 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {debouncedSearch.trim() ? 'No files match your search.' : 'No files found.'}
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredFolders.map((folder) => {
                const isExpanded = expandedFolders.has(folder.name);
                const FolderIcon = isExpanded ? FolderOpen : Folder;

                return (
                  <div key={folder.name}>
                    {/* Folder Header */}
                    <button
                      onClick={() => toggleFolder(folder.name)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1.5 rounded-md',
                        'hover:bg-accent transition-colors text-left',
                      )}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <FolderIcon className="h-4 w-4 text-brand-blue flex-shrink-0" />
                      <span className="text-sm font-medium flex-1 truncate">
                        {folder.display_name}
                      </span>
                      <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                        {folder.files.length}
                      </Badge>
                    </button>

                    {/* Files */}
                    {isExpanded && (
                      <div className="ml-6 mt-1 space-y-0.5">
                        {folder.files.map((file) => {
                          const isSelected = selectedFile === file.relative_path;

                          return (
                            <button
                              key={file.relative_path}
                              onClick={() => handleFileClick(file.relative_path)}
                              className={cn(
                                'w-full flex items-center gap-2 px-2 py-1.5 rounded-md',
                                'transition-colors text-left group',
                                isSelected
                                  ? 'bg-primary/10 text-primary'
                                  : 'hover:bg-accent',
                              )}
                            >
                              <FileText className="h-4 w-4 flex-shrink-0" />
                              <span className="text-sm flex-1 truncate">
                                {file.display_name}
                              </span>
                              <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                                {formatFileSize(file.size_bytes)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* File Count Badge */}
        {!isLoadingTree && allFilesCount > 0 && (
          <div className="text-xs text-muted-foreground text-center">
            {debouncedSearch.trim()
              ? `${filteredFilesCount} of ${allFilesCount} files`
              : `${allFilesCount} files`}
          </div>
        )}
      </div>

      {/* File Preview Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedFile ? (
          <div className="flex-1 flex items-center justify-center border rounded-lg bg-muted/30">
            <div className="text-center">
              <File className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Select a file to view its contents
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col border rounded-lg overflow-hidden">
            {/* File Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium truncate">{selectedFile.split('/').pop()}</span>
                <Badge variant="secondary" className="text-xs">{language}</Badge>
              </div>
              <div className="flex items-center gap-1">
                {isEditing ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSave}
                      disabled={saveMutation.isPending || !hasChanges}
                      className="flex-shrink-0"
                    >
                      <Save className="h-4 w-4 mr-1" />
                      {saveMutation.isPending ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancel}
                      disabled={saveMutation.isPending}
                      className="flex-shrink-0"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEdit}
                    className="flex-shrink-0"
                  >
                    <Edit3 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                  className="flex-shrink-0"
                >
                  Close
                </Button>
              </div>
            </div>

            {/* File Content */}
            <ScrollArea className="flex-1">
              {isLoadingContent ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : isEditing ? (
                <div className="h-full overflow-auto bg-card border rounded-md m-1">
                  <Editor
                    value={editContent}
                    onValueChange={(code) => setEditContent(code)}
                    highlight={editorHighlight}
                    padding={16}
                    style={{
                      fontFamily: '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontSize: '12px',
                      lineHeight: '1.5',
                      backgroundColor: 'transparent',
                    }}
                  />
                </div>
              ) : (
                <div className="p-4">
                  <pre className="text-xs font-mono leading-relaxed">
                    <code
                      className={`language-${language}`}
                      dangerouslySetInnerHTML={{ __html: highlightedContent }}
                    />
                  </pre>
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
