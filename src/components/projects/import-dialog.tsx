// Track Your Shit - Import Dialog Component
// Multi-step modal for importing projects from filesystem
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FolderOpen,
  FolderSearch,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  Rocket,
  RefreshCw,
  Terminal,
  FileText,
} from "lucide-react";
import { useImportProjectEnhanced } from "@/lib/queries";
import {
  pickFolder,
  detectTechStack,
  readProjectDocs,
  indexProjectMarkdown,
  onPtyOutput,
  onPtyExit,
  type TechStack,
  type ProjectDocs,
  type PtyOutputEvent,
  type PtyExitEvent,
  type MarkdownScanResult,
} from "@/lib/tauri";
import { TerminalView, type TerminalViewRef } from "@/components/terminal";
import { getErrorMessage } from "@/lib/utils";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (projectId: string) => void;
}

type Step = "select" | "preview" | "no-planning" | "importing" | "generating" | "complete" | "error";

/**
 * Import dialog component with multi-step flow.
 * Steps:
 *   - Select folder
 *   -> [detect project type]
 *       ├─ has .planning  → preview (GSD import notice) → importing → complete
 *       └─ neither        → no-planning (warning + suggestions) → importing → complete
 */
export function ImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportDialogProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("select");
  const [path, setPath] = useState<string | null>(null);
  const [techStack, setTechStack] = useState<TechStack | null>(null);
  const [projectDocs, setProjectDocs] = useState<ProjectDocs | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [convertGsd, setConvertGsd] = useState(false);
  const [ptySessionId, setPtySessionId] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<string | null>(null);
  const [ptyExitCode, setPtyExitCode] = useState<number | null>(null);
  const [ptyExited, setPtyExited] = useState(false);
  const [markdownScan, setMarkdownScan] = useState<MarkdownScanResult | null>(null);
  const terminalRef = useRef<TerminalViewRef>(null);
  const outputBufferRef = useRef<string[]>([]);
  const terminalReadyRef = useRef(false);
  const finishImportCalledRef = useRef(false);

  const importProject = useImportProjectEnhanced();

  // Reset dialog state
  const resetDialog = useCallback(() => {
    setStep("select");
    setPath(null);
    setTechStack(null);
    setProjectDocs(null);
    setProjectId(null);
    setError(null);
    setIsDetecting(false);
    setConvertGsd(false);
    finishImportCalledRef.current = false;
    setPtySessionId(null);
    setImportMode(null);
    setPtyExitCode(null);
    setPtyExited(false);
    setMarkdownScan(null);
    // Reset terminal buffer refs
    outputBufferRef.current = [];
    terminalReadyRef.current = false;
  }, []);

  // Handle dialog close
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        // Don't allow closing during import or generation
        if (step === "importing" || step === "generating") return;
        resetDialog();
      }
      onOpenChange(open);
    },
    [onOpenChange, resetDialog, step]
  );

  // Handle folder selection
  const handleSelectFolder = useCallback(async () => {
    try {
      const selectedPath = await pickFolder();
      if (selectedPath) {
        setPath(selectedPath);
        setIsDetecting(true);
        setError(null);

        try {
          // Detect tech stack
          const stack = await detectTechStack(selectedPath);
          setTechStack(stack);

          // Read project docs
          const docs = await readProjectDocs(selectedPath);
          setProjectDocs(docs);

          // Determine which step to go to
          if (stack.has_planning) {
            setStep("preview");
          } else {
            setStep("no-planning");
          }
        } catch {
          // Still proceed to no-planning step
          setTechStack(null);
          setProjectDocs(null);
          setStep("no-planning");
        } finally {
          setIsDetecting(false);
        }
      }
    } catch {
      setError("Failed to select folder");
    }
  }, []);

  // Handle import start
  const handleStartImport = useCallback(async () => {
    if (!path) return;

    setStep("importing");
    setError(null);

    // GSD projects: skip conversion unless user opted in
    const isGsd = !!(techStack?.has_planning);
    const skipConversion = isGsd && !convertGsd;

    // Determine if this import will use a PTY (bare project)
    const willUsePty = !techStack?.has_planning && !skipConversion;

    // If PTY will be used, generate session ID and set up listeners FIRST
    // This ensures we don't miss any output events
    let preGeneratedSessionId: string | undefined;
    if (willUsePty) {
      preGeneratedSessionId = crypto.randomUUID();
      setPtySessionId(preGeneratedSessionId);

      // Give React a moment to process the state change and set up listeners
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      const shouldAutoSync = !!techStack?.has_planning || skipConversion;
      const result = await importProject.mutateAsync({
        path,
        autoSyncRoadmap: shouldAutoSync,
        ptySessionId: preGeneratedSessionId,
        skipConversion,
      });
      setProjectId(result.project.id);
      setImportMode(result.import_mode);
      setMarkdownScan(result.markdown_scan);

      // If a PTY session was started, switch to generating step
      if (result.pty_session_id) {
        setStep("generating");
      } else {
        // Existing or skip-conversion project - import complete
        setStep("complete");
        onSuccess?.(result.project.id);
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setStep("error");
    }
  }, [path, importProject, onSuccess, convertGsd, techStack]);

  // Handle view project
  const handleViewProject = useCallback(() => {
    if (projectId) {
      void navigate(`/projects/${projectId}`);
      handleOpenChange(false);
    }
  }, [projectId, navigate, handleOpenChange]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setStep("select");
    setError(null);
  }, []);

  // PTY event listeners - set up as soon as we have a session ID
  // This prevents missing output that arrives before the terminal renders
  useEffect(() => {
    if (!ptySessionId) return;

    let unlistenOutput: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;

    const setupListeners = async () => {
      // Listen for PTY output
      unlistenOutput = await onPtyOutput(ptySessionId, (event: PtyOutputEvent) => {
        const data = new Uint8Array(event.data);
        const text = new TextDecoder().decode(data);

        // If terminal is ready, write directly
        if (terminalRef.current && terminalReadyRef.current) {
          terminalRef.current.write(text);
        } else {
          outputBufferRef.current.push(text);
        }
      });

      // Listen for PTY exit
      unlistenExit = await onPtyExit(ptySessionId, (event: PtyExitEvent) => {
        setPtyExitCode(event.exit_code);
        setPtyExited(true);
      });

    };

    void setupListeners();

    return () => {
      unlistenOutput?.();
      unlistenExit?.();
    };
  }, [ptySessionId]);

  // Flush buffered output when terminal becomes ready
  useEffect(() => {
    if (step !== "generating") {
      // Reset when not in generating step
      terminalReadyRef.current = false;
      return;
    }

    // Poll for terminal to be ready (it initializes asynchronously)
    const checkTerminalReady = () => {
      if (terminalRef.current && !terminalReadyRef.current) {
        terminalReadyRef.current = true;

        // Flush any buffered output
        if (outputBufferRef.current.length > 0) {
          const buffered = outputBufferRef.current.join('');
          terminalRef.current.write(buffered);
          outputBufferRef.current = [];
        }
        return true;
      }
      return false;
    };

    // Check immediately
    if (checkTerminalReady()) return;

    // If not ready, poll briefly (terminal initializes in requestAnimationFrame)
    const interval = setInterval(() => {
      if (checkTerminalReady()) {
        clearInterval(interval);
      }
    }, 50);

    // Stop polling after 2 seconds as a safety measure
    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [step]);

  // Handle PTY completion - sync roadmap and transition to complete
  useEffect(() => {
    if (!ptyExited || !projectId || finishImportCalledRef.current) return;
    finishImportCalledRef.current = true;

    const finishImport = async () => {
      // Check if conversion failed (non-zero exit code)
      if (ptyExitCode !== null && ptyExitCode !== 0) {
        setError(`Conversion failed with exit code ${ptyExitCode}`);
        setStep("error");
        return;
      }

      // Trigger async markdown indexing for newly generated projects
      if (path) {
        void indexProjectMarkdown(projectId, path);
      }

      setStep("complete");
      onSuccess?.(projectId);
    };

    void finishImport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ptyExited, ptyExitCode, projectId]);

  // Get folder name from path
  const folderName = path ? path.split("/").pop() || path : "";

  // Determine project type
  const isGsdProject = techStack?.has_planning;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={step === "generating" ? "sm:max-w-2xl" : "sm:max-w-lg"}>
        <DialogHeader>
          <DialogTitle>Import Project</DialogTitle>
          <DialogDescription>
            {step === "select" && "Select a project folder to import."}
            {step === "preview" && "Review project details before importing."}
            {step === "no-planning" && "Project structure not found."}
            {step === "importing" && "Importing project..."}
            {step === "generating" && "Generating project structure..."}
            {step === "complete" && "Project imported successfully."}
            {step === "error" && "Failed to import project."}
          </DialogDescription>
        </DialogHeader>

        {/* Step: Select */}
        {step === "select" && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg border-dashed">
              <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Select Project Folder</h3>
              <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                Choose a folder containing your project. Tech stack will be
                automatically detected.
              </p>
              <Button
                onClick={() => void handleSelectFolder()}
                disabled={isDetecting}
                className="mt-4"
              >
                {isDetecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FolderSearch className="mr-2 h-4 w-4" />
                )}
                {isDetecting ? "Detecting..." : "Browse"}
              </Button>
            </div>
            {error && (
              <div className="text-sm text-destructive text-center">{error}</div>
            )}
          </div>
        )}

        {/* Step: Preview (GSD project) */}
        {step === "preview" && (
          <div className="space-y-4 py-4">
            {/* Project type badge */}
            {isGsdProject && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-status-info/10 border border-status-info/20">
                  <Info className="h-5 w-5 text-status-info flex-shrink-0" />
                  <div>
                    <p className="font-medium text-status-info">GSD Project Detected</p>
                    <p className="text-xs text-muted-foreground">
                      This project uses the .planning directory structure
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground pl-11">
                  {convertGsd
                    ? "Will generate project structure from .planning files (requires Claude Code)"
                    : "Import as-is — roadmap will sync directly from .planning files"
                  }
                </p>
              </div>
            )}

            {/* Path display */}
            <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <FolderOpen className="h-8 w-8 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{folderName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {path}
                  </p>
                </div>
              </div>
            </div>

            {/* Project docs */}
            {projectDocs && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Detected Documentation</p>
                {projectDocs.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {projectDocs.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Source: {projectDocs.source}
                </p>
              </div>
            )}

            {/* Tech stack preview */}
            {techStack && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Detected Tech Stack</p>
                <div className="flex flex-wrap gap-2">
                  {techStack.framework && (
                    <Badge variant="secondary">{techStack.framework}</Badge>
                  )}
                  {techStack.language && (
                    <Badge variant="secondary">{techStack.language}</Badge>
                  )}
                  {techStack.package_manager && (
                    <Badge variant="secondary">{techStack.package_manager}</Badge>
                  )}
                  {techStack.database && (
                    <Badge variant="secondary">{techStack.database}</Badge>
                  )}
                  {techStack.test_framework && (
                    <Badge variant="secondary">{techStack.test_framework}</Badge>
                  )}
                </div>
              </div>
            )}

            {/* Change folder button */}
            <div className="text-center">
              <Button
                variant="link"
                size="sm"
                onClick={() => void handleSelectFolder()}
                className="text-xs"
              >
                Select different folder
              </Button>
            </div>
          </div>
        )}

        {/* Step: No Planning Warning */}
        {step === "no-planning" && (
          <div className="space-y-4 py-4">
            {/* Warning banner */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-status-warning/10 border border-status-warning/20">
              <AlertTriangle className="h-5 w-5 text-status-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-status-warning">
                  No Project Structure Found
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  This folder doesn't have a .planning directory.
                </p>
              </div>
            </div>

            {/* Path display */}
            <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{folderName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {path}
                  </p>
                </div>
              </div>
            </div>

            {/* Tech stack preview if available */}
            {techStack && (techStack.framework || techStack.language) && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Detected Tech Stack</p>
                <div className="flex flex-wrap gap-2">
                  {techStack.framework && (
                    <Badge variant="secondary">{techStack.framework}</Badge>
                  )}
                  {techStack.language && (
                    <Badge variant="secondary">{techStack.language}</Badge>
                  )}
                  {techStack.package_manager && (
                    <Badge variant="secondary">{techStack.package_manager}</Badge>
                  )}
                </div>
              </div>
            )}

            {/* Suggestion to initialize planning */}
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-sm font-medium mb-2">Initialize Project Structure</p>
              <p className="text-xs text-muted-foreground mb-3">
                Run <code className="bg-muted px-1 rounded">/gsd:new-project</code> in Claude Code
                to generate a .planning directory and project structure.
              </p>
            </div>

            {/* Change folder button */}
            <div className="text-center">
              <Button
                variant="link"
                size="sm"
                onClick={() => void handleSelectFolder()}
                className="text-xs"
              >
                Select different folder
              </Button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">
              Importing {folderName}...
            </p>
          </div>
        )}

        {/* Step: Generating (PTY session running) */}
        {step === "generating" && (
          <div className="space-y-4 py-4">
            {/* Status banner */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-status-info/10 border border-status-info/20">
              <Terminal className="h-5 w-5 text-status-info" />
              <div className="flex-1">
                <p className="font-medium text-status-info">
                  {importMode === "gsd" ? "Converting GSD Project" : "Generating Project Structure"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {importMode === "gsd"
                    ? "Setting up project structure..."
                    : "Generating project structure..."
                  }
                </p>
              </div>
              <Loader2 className="h-4 w-4 animate-spin text-status-info" />
            </div>

            {/* Embedded terminal */}
            <div className="h-64 border rounded-lg overflow-hidden">
              <TerminalView
                ref={terminalRef}
                className="h-full"
                fontSize={12}
              />
            </div>

            {/* Progress hint */}
            <p className="text-xs text-muted-foreground text-center">
              This may take a moment. The terminal will show progress...
            </p>
          </div>
        )}

        {/* Step: Complete */}
        {step === "complete" && (
          <div className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-status-success mb-4" />
            <h3 className="text-lg font-medium">Project Imported</h3>
            <p className="text-muted-foreground mt-1 text-center">
              {folderName} has been successfully imported.
            </p>
            {importMode === "gsd" && (
              <div className="flex items-center gap-2 mt-3 text-sm text-status-info">
                <RefreshCw className="h-4 w-4" />
                Converted from GSD format
              </div>
            )}
            {importMode === "existing" && isGsdProject && (
              <div className="flex items-center gap-2 mt-3 text-sm text-status-info">
                <Info className="h-4 w-4" />
                Imported from GSD .planning files
              </div>
            )}
            {importMode === "bare" && (
              <div className="flex items-center gap-2 mt-3 text-sm text-status-info">
                <Rocket className="h-4 w-4" />
                Project structure generated
              </div>
            )}
            {markdownScan && markdownScan.total_files > 0 && (
              <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                {markdownScan.total_files} docs found across{" "}
                {markdownScan.folders.length} folders
              </div>
            )}
          </div>
        )}

        {/* Step: Error */}
        {step === "error" && (
          <div className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-medium">Import Failed</h3>
            <p className="text-destructive mt-1 text-sm text-center max-w-sm">
              {error}
            </p>
          </div>
        )}

        <DialogFooter>
          {/* Select step */}
          {step === "select" && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          )}

          {/* Preview step */}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("select")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={() => void handleStartImport()}>
                Import Project
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}

          {/* No-planning step */}
          {step === "no-planning" && (
            <>
              <Button variant="outline" onClick={() => setStep("select")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button variant="secondary" onClick={() => void handleStartImport()}>
                Import Anyway
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}

          {/* Importing step */}
          {step === "importing" && (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing...
            </Button>
          )}

          {/* Generating step */}
          {step === "generating" && (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {importMode === "gsd" ? "Converting..." : "Generating..."}
            </Button>
          )}

          {/* Complete step */}
          {step === "complete" && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleViewProject}>
                View Project
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}

          {/* Error step */}
          {step === "error" && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleRetry}>Try Again</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
