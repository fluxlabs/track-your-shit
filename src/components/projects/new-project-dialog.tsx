// Track Your Shit - New Project Dialog Component
// Multi-step modal for creating new projects from scratch
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FolderOpen,
  FolderPlus,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Rocket,
  Terminal,
  Sparkles,
  Zap,
  Code,
  FileCode,
} from "lucide-react";
import {
  useCreateProject,
  useFinalizeProjectCreation,
} from "@/lib/queries";
import {
  pickFolder,
  checkProjectPath,
  ptyWrite,
  onPtyOutput,
  onPtyExit,
  type PtyOutputEvent,
  type PtyExitEvent,
} from "@/lib/tauri";
import { TerminalView, type TerminalViewRef } from "@/components/terminal";
import { cn, getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (projectId: string) => void;
}

type Step =
  | "name"
  | "location"
  | "options"
  | "preview"
  | "creating"
  | "complete"
  | "error";

type Template = "blank" | "nextjs-supabase" | "fastapi-postgres" | "cli-tool";
type DiscoveryMode = "quick" | "full";

interface TemplateOption {
  id: Template;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const TEMPLATES: TemplateOption[] = [
  {
    id: "blank",
    name: "Blank Project",
    description: "Start from scratch with project discovery",
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    id: "nextjs-supabase",
    name: "Next.js + Supabase",
    description: "Full-stack web app with auth and database",
    icon: <Code className="h-5 w-5" />,
  },
  {
    id: "fastapi-postgres",
    name: "FastAPI + PostgreSQL",
    description: "Python backend API with database",
    icon: <FileCode className="h-5 w-5" />,
  },
  {
    id: "cli-tool",
    name: "CLI Tool",
    description: "Node.js command-line application",
    icon: <Terminal className="h-5 w-5" />,
  },
];

/**
 * Validate project name: lowercase, numbers, hyphens only, min 2 chars
 */
const isValidProjectName = (name: string): boolean => {
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name) && name.length >= 2;
};

/**
 * New Project dialog component with multi-step flow.
 * Steps:
 *   1. name - Enter project name
 *   2. location - Select parent folder
 *   3. options - Choose template and discovery mode
 *   4. preview - Review and check Claude status
 *   5. creating - Terminal showing initialization
 *   6. complete - Success state
 *   7. error - Error state with retry
 */
export function NewProjectDialog({
  open,
  onOpenChange,
  onSuccess,
}: NewProjectDialogProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("name");
  const [projectName, setProjectName] = useState("");
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [template, setTemplate] = useState<Template>("blank");
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>("quick");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [ptySessionId, setPtySessionId] = useState<string | null>(null);
  const [ptyExitCode, setPtyExitCode] = useState<number | null>(null);
  const [ptyExited, setPtyExited] = useState(false);
  const [hasTerminalOutput, setHasTerminalOutput] = useState(false);
  const [scriptCompleted, setScriptCompleted] = useState(false);
  const terminalRef = useRef<TerminalViewRef>(null);
  const outputBufferRef = useRef<string[]>([]);
  const terminalReadyRef = useRef(false);
  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const createProject = useCreateProject();
  const finalizeProject = useFinalizeProjectCreation();

  // Reset dialog state
  const resetDialog = useCallback(() => {
    setStep("name");
    setProjectName("");
    setParentPath(null);
    setTemplate("blank");
    setDiscoveryMode("quick");
    setProjectId(null);
    setError(null);
    setNameError(null);
    setPtySessionId(null);
    setPtyExitCode(null);
    setPtyExited(false);
    setHasTerminalOutput(false);
    setScriptCompleted(false);
    outputBufferRef.current = [];
    terminalReadyRef.current = false;
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }
  }, []);

  // Handle dialog close
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        // Don't allow closing during creation
        if (step === "creating") return;
        resetDialog();
      }
      onOpenChange(open);
    },
    [onOpenChange, resetDialog, step]
  );

  // Validate project name on change
  const handleNameChange = useCallback((value: string) => {
    // Convert to lowercase and replace spaces with hyphens
    const normalized = value.toLowerCase().replace(/\s+/g, "-");
    setProjectName(normalized);

    if (normalized.length === 0) {
      setNameError(null);
    } else if (normalized.length < 2) {
      setNameError("Name must be at least 2 characters");
    } else if (!isValidProjectName(normalized)) {
      setNameError("Use lowercase letters, numbers, and hyphens only");
    } else {
      setNameError(null);
    }
  }, []);

  // Handle folder selection
  const handleSelectFolder = useCallback(async () => {
    try {
      const selectedPath = await pickFolder();
      if (selectedPath) {
        setParentPath(selectedPath);
        setError(null);

        // Validate that target path is available
        try {
          await checkProjectPath(selectedPath, projectName);
          setStep("options");
        } catch (_pathErr) {
          // Path validation failed - show warning but still allow proceeding
          const pathError = getErrorMessage(_pathErr);
          if (pathError.includes("not empty")) {
            setError(`Warning: ${pathError}. Choose a different name or location.`);
            // Stay on location step so they can choose differently
          } else {
            setStep("options");
          }
        }
      }
    } catch {
      setError("Failed to select folder");
    }
  }, [projectName]);

  // Handle create project
  const handleCreateProject = useCallback(async () => {
    if (!parentPath || !projectName) return;

    setStep("creating");
    setError(null);

    // Pre-generate PTY session ID for event listeners
    const preGeneratedSessionId = crypto.randomUUID();
    setPtySessionId(preGeneratedSessionId);

    // Give React a moment to process the state change and set up listeners
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      const result = await createProject.mutateAsync({
        parentPath,
        projectName,
        template: template === "blank" ? undefined : template,
        discoveryMode,
        ptySessionId: preGeneratedSessionId,
      });

      setProjectId(result.project.id);
    } catch (err) {
      // Tauri errors come as strings, not Error objects
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      setStep("error");
    }
  }, [parentPath, projectName, template, discoveryMode, createProject]);

  // Handle view project
  const handleViewProject = useCallback(() => {
    if (projectId) {
      void navigate(`/projects/${projectId}`);
      handleOpenChange(false);
    }
  }, [projectId, navigate, handleOpenChange]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setStep("name");
    setError(null);
  }, []);

  // Handle terminal input - send to PTY
  const handleTerminalInput = useCallback(
    async (data: string) => {
      if (ptySessionId) {
        try {
          const encoder = new TextEncoder();
          await ptyWrite(ptySessionId, encoder.encode(data));
        } catch {
          // Non-critical - user can see the terminal isn't responding
        }
      }
    },
    [ptySessionId]
  );

  // PTY event listeners
  useEffect(() => {
    if (!ptySessionId) return;

    let unlistenOutput: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;

    const setupListeners = async () => {
      unlistenOutput = await onPtyOutput(ptySessionId, (event: PtyOutputEvent) => {
        const data = new Uint8Array(event.data);
        const text = new TextDecoder().decode(data);
        // Mark that we've received output (hides loading indicator)
        setHasTerminalOutput(true);

        // Detect script completion marker (workaround for PTY exit not firing)
        if (text.includes("PROJECT INITIALIZED")) {
          setScriptCompleted(true);
        }

        if (terminalRef.current && terminalReadyRef.current) {
          terminalRef.current.write(text);
        } else {
          outputBufferRef.current.push(text);
        }
      });

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

  // Flush buffered output when terminal becomes ready and auto-focus
  useEffect(() => {
    if (step !== "creating") {
      terminalReadyRef.current = false;
      return;
    }

    const checkTerminalReady = () => {
      if (terminalRef.current && !terminalReadyRef.current) {
        terminalReadyRef.current = true;

        if (outputBufferRef.current.length > 0) {
          const buffered = outputBufferRef.current.join("");
          terminalRef.current.write(buffered);
          outputBufferRef.current = [];
        }

        // Auto-focus the terminal so user can type immediately
        terminalRef.current.focus();
        return true;
      }
      return false;
    };

    if (checkTerminalReady()) return;

    const interval = setInterval(() => {
      if (checkTerminalReady()) {
        clearInterval(interval);
      }
    }, 50);

    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [step]);

  // Handle script completion (detected via output marker)
  // This is a workaround for PTY exit events not always firing
  useEffect(() => {
    if (!scriptCompleted || !projectId || step !== "creating") return;

    // Small delay to let remaining output flush
    completionTimeoutRef.current = setTimeout(() => {
      void (async () => {
        // Finalize project creation
        try {
          await finalizeProject.mutateAsync({ projectId, success: true });
        } catch {
          // Non-critical cleanup
        }

        setStep("complete");
        onSuccess?.(projectId);

        // Show toast with next steps
        toast.success("Project created successfully!", {

          action: {
            label: "Open Project",
            onClick: () => void navigate(`/projects/${projectId}?tab=gsd`),
          },
        });
      })();
    }, 500);

    return () => {
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
      }
    };
  }, [scriptCompleted, projectId, step, finalizeProject, onSuccess, navigate]);

  // Handle PTY completion (fallback for when exit event fires)
  useEffect(() => {
    if (!ptyExited || !projectId || scriptCompleted) return;

    const finishCreation = async () => {
      const success = ptyExitCode === null || ptyExitCode === 0;

      if (!success) {
        setError(`Project initialization failed with exit code ${ptyExitCode}`);
        setStep("error");
        return;
      }

      // Finalize project creation
      try {
        await finalizeProject.mutateAsync({ projectId, success: true });
      } catch {
        // Non-critical cleanup
      }

      setStep("complete");
      onSuccess?.(projectId);

      // Show toast with next steps
      toast.success("Project created successfully!", {

        action: {
          label: "Open Project",
          onClick: () => void navigate(`/projects/${projectId}?tab=gsd`),
        },
      });
    };

    void finishCreation();
  }, [ptyExited, ptyExitCode, projectId, scriptCompleted, finalizeProject, onSuccess, navigate]);

  // Get folder name from path
  const folderName = parentPath ? parentPath.split("/").pop() || parentPath : "";

  // Full project path for display
  const fullProjectPath = parentPath ? `${parentPath}/${projectName}` : "";

  // Can proceed from preview step
  const canCreate = projectName && parentPath;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          step === "creating"
            ? "sm:max-w-5xl h-[80vh] flex flex-col overflow-hidden"
            : step === "preview" || step === "options"
              ? "sm:max-w-xl"
              : "sm:max-w-lg"
        )}
        onOpenAutoFocus={(e) => {
          // Prevent default focus behavior when terminal is shown
          // so the terminal can receive focus instead
          if (step === "creating") {
            e.preventDefault();
            setTimeout(() => terminalRef.current?.focus(), 100);
          }
        }}
        onInteractOutside={(e) => {
          // Prevent closing when in creating step
          if (step === "creating") {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-primary" />
            New Project
          </DialogTitle>
          <DialogDescription>
            {step === "name" && "Enter a name for your new project."}
            {step === "location" && "Select where to create your project."}
            {step === "options" && "Configure project template and discovery."}
            {step === "preview" && "Review and create your project."}
            {step === "creating" && "Initializing project structure..."}
            {step === "complete" && "Project created successfully."}
            {step === "error" && "Failed to create project."}
          </DialogDescription>
        </DialogHeader>

        {/* Step: Name */}
        {step === "name" && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                placeholder="my-awesome-project"
                value={projectName}
                onChange={(e) => handleNameChange(e.target.value)}
                className={cn(nameError && "border-destructive")}
                autoFocus
              />
              {nameError ? (
                <p className="text-xs text-destructive">{nameError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Lowercase letters, numbers, and hyphens only
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step: Location */}
        {step === "location" && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg border-dashed">
              <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Select Parent Folder</h3>
              <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                Choose where to create the <code className="bg-muted px-1 rounded">{projectName}</code> folder.
              </p>
              <Button onClick={() => void handleSelectFolder()} className="mt-4">
                <FolderOpen className="mr-2 h-4 w-4" />
                Browse
              </Button>
            </div>
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-destructive">{error}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Go back to change the project name, or select a different folder.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step: Options */}
        {step === "options" && (
          <div className="space-y-6 py-4">
            {/* Template selection */}
            <div className="space-y-3">
              <Label>Project Template</Label>
              <div className="grid grid-cols-2 gap-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTemplate(t.id)}
                    className={cn(
                      "flex flex-col items-start gap-2 p-3 rounded-lg border text-left transition-all",
                      template === t.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "p-1.5 rounded",
                          template === t.id
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {t.icon}
                      </div>
                      <span className="font-medium text-sm">{t.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Discovery mode */}
            <div className="space-y-3">
              <Label>Discovery Mode</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setDiscoveryMode("quick")}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-all",
                    discoveryMode === "quick"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  <Zap
                    className={cn(
                      "h-5 w-5",
                      discoveryMode === "quick"
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  />
                  <div className="text-left">
                    <p className="font-medium text-sm">Quick</p>
                    <p className="text-xs text-muted-foreground">
                      Fast setup with defaults
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => setDiscoveryMode("full")}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-all",
                    discoveryMode === "full"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  <Sparkles
                    className={cn(
                      "h-5 w-5",
                      discoveryMode === "full"
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  />
                  <div className="text-left">
                    <p className="font-medium text-sm">Full</p>
                    <p className="text-xs text-muted-foreground">
                      Interactive discovery
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && (
          <div className="space-y-4 py-4">
            {/* Warning if parent folder name matches project name */}
            {folderName === projectName && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-status-warning/10 border border-status-warning/20">
                <AlertTriangle className="h-5 w-5 text-status-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-status-warning">
                    Possible duplicate folder
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    The parent folder has the same name as your project. This will create: <code className="bg-muted px-1 rounded">{folderName}/{projectName}</code>
                  </p>
                </div>
              </div>
            )}

            {/* Project summary */}
            <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Rocket className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{projectName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {fullProjectPath}
                  </p>
                </div>
              </div>
            </div>

            {/* Configuration summary */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Template</span>
                <span className="font-medium">
                  {TEMPLATES.find((t) => t.id === template)?.name}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Discovery Mode</span>
                <span className="font-medium capitalize">{discoveryMode}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Parent Folder</span>
                <span className="font-medium truncate max-w-[200px]" title={parentPath || ""}>
                  {folderName}/
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Project will be initialized using <code className="bg-muted px-1 rounded">/gsd:new-project</code> via Claude Code.
            </p>
          </div>
        )}

        {/* Step: Creating */}
        {step === "creating" && (
          <div className="flex flex-col flex-1 min-h-0 gap-4 py-4">
            {/* Status banner */}
            <div className="flex-shrink-0 flex items-center gap-2 p-3 rounded-lg bg-status-info/10 border border-status-info/20">
              <Terminal className="h-5 w-5 text-status-info" />
              <div className="flex-1">
                <p className="font-medium text-status-info">
                  Creating Project
                </p>
                <p className="text-xs text-muted-foreground">
                  Initializing .planning/ structure...
                </p>
              </div>
              <Loader2 className="h-4 w-4 animate-spin text-status-info" />
            </div>

            {/* Embedded terminal - interactive */}
            <div
              className="relative flex-1 min-h-0 border rounded-lg overflow-hidden cursor-text"
              onClick={() => terminalRef.current?.focus()}
            >
              <TerminalView
                ref={terminalRef}
                className="h-full"
                fontSize={14}
                onData={(data) => void handleTerminalInput(data)}
              />

              {/* Loading overlay - shown until terminal output arrives */}
              {!hasTerminalOutput && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-10">
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <div className="h-16 w-16 rounded-full border-4 border-primary/20" />
                      <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-transparent border-t-primary animate-spin" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">
                        Preparing project...
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Detecting project structure
                      </p>
                    </div>
                    {/* Animated dots */}
                    <div className="flex gap-1">
                      <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                      <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                      <div className="h-2 w-2 rounded-full bg-primary animate-bounce" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Progress hint */}
            <p className="flex-shrink-0 text-xs text-muted-foreground text-center">
              {hasTerminalOutput
                ? "Initializing project structure..."
                : "Starting initialization script..."}
            </p>
          </div>
        )}

        {/* Step: Complete */}
        {step === "complete" && (
          <div className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-status-success mb-4" />
            <h3 className="text-lg font-medium">Project Created</h3>
            <p className="text-muted-foreground mt-1 text-center">
              {projectName} has been successfully created.
            </p>
            <div className="flex items-center gap-2 mt-3 text-sm text-status-success">
              <Rocket className="h-4 w-4" />
              Ready for development
            </div>
            <p className="text-xs text-muted-foreground mt-4 text-center max-w-sm">
              Run <code className="bg-muted px-1 rounded">/gsd:progress</code> from the project shell to view planning status.
            </p>
          </div>
        )}

        {/* Step: Error */}
        {step === "error" && (
          <div className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-medium">Creation Failed</h3>
            <p className="text-destructive mt-1 text-sm text-center max-w-sm">
              {error}
            </p>
          </div>
        )}

        <DialogFooter>
          {/* Name step */}
          {step === "name" && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => setStep("location")}
                disabled={!projectName || !!nameError}
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}

          {/* Location step */}
          {step === "location" && (
            <>
              <Button variant="outline" onClick={() => setStep("name")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </>
          )}

          {/* Options step */}
          {step === "options" && (
            <>
              <Button variant="outline" onClick={() => setStep("location")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={() => setStep("preview")}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}

          {/* Preview step */}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("options")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={() => void handleCreateProject()} disabled={!canCreate}>
                <Rocket className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            </>
          )}

          {/* Creating step */}
          {step === "creating" && (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
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
