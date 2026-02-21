// Track Your Shit - Import Existing Project Dialog
// Import an existing codebase into GSD
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState, useCallback } from "react";
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
import { Label } from "@/components/ui/label";
import {
  FolderOpen,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  FolderInput,
  Terminal,
  FileCode,
  Package,
  Globe,
  Server,
  AlertTriangle,
} from "lucide-react";
import { useImportProjectEnhanced } from "@/lib/queries";
import { pickFolder } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ImportProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (projectId: string) => void;
}

type Step = "select" | "detecting" | "configure" | "importing" | "complete" | "error";

interface DetectedProject {
  path: string;
  name: string;
  type: "web" | "api" | "cli" | "library" | "unknown";
  hasPlanning: boolean;
}

const PROJECT_TYPE_INFO = {
  web: { icon: Globe, label: "Web Application", color: "text-blue-500" },
  api: { icon: Server, label: "API / Backend", color: "text-green-500" },
  cli: { icon: Terminal, label: "CLI Tool", color: "text-purple-500" },
  library: { icon: Package, label: "Library / Package", color: "text-orange-500" },
  unknown: { icon: FileCode, label: "Unknown", color: "text-gray-500" },
};

export function ImportProjectDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportProjectDialogProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("select");
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [detectedProject, setDetectedProject] = useState<DetectedProject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(true);
  const [projectId, setProjectId] = useState<string | null>(null);

  const importProject = useImportProjectEnhanced();

  // Reset dialog state
  const resetDialog = useCallback(() => {
    setStep("select");
    setProjectPath(null);
    setDetectedProject(null);
    setError(null);
    setAutoSync(true);
    setProjectId(null);
  }, []);

  // Handle open change
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        resetDialog();
      }
      onOpenChange(open);
    },
    [onOpenChange, resetDialog]
  );

  // Handle folder selection
  const handleSelectFolder = useCallback(async () => {
    try {
      const selectedPath = await pickFolder();
      if (selectedPath) {
        setProjectPath(selectedPath);
        setStep("detecting");
        setError(null);

        // Extract name from path
        const name = selectedPath.split("/").pop() || "Unknown";

        // Simulated detection - in real implementation would scan the folder
        const type = "web";
        const hasPlanning = false;

        setDetectedProject({
          path: selectedPath,
          name,
          type,
          hasPlanning,
        });
        setStep("configure");
      }
    } catch {
      setError("Failed to select folder");
      setStep("select");
    }
  }, []);

  // Handle import
  const handleImport = useCallback(async () => {
    if (!projectPath) return;

    setStep("importing");
    setError(null);

    try {
      const result = await importProject.mutateAsync({
        path: projectPath,
        autoSyncRoadmap: autoSync,
        ptySessionId: undefined,
        skipConversion: undefined,
      });

      setProjectId(result.project.id);

      setStep("complete");
      onSuccess?.(result.project.id);

      toast.success("Project imported successfully!", {
        
        action: {
          label: "Open Project",
          onClick: () => void navigate(`/projects/${result.project.id}?tab=gsd`),
        },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setStep("error");
    }
  }, [projectPath, autoSync, importProject, onSuccess, navigate]);

  // Handle view project
  const handleViewProject = useCallback(() => {
    if (projectId) {
      void navigate(`/projects/${projectId}`);
      handleOpenChange(false);
    }
  }, [projectId, navigate, handleOpenChange]);

  // Get project type info
  const typeInfo = detectedProject
    ? PROJECT_TYPE_INFO[detectedProject.type]
    : PROJECT_TYPE_INFO.unknown;
  const TypeIcon = typeInfo.icon;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="h-5 w-5 text-primary" />
            Import Existing Project
          </DialogTitle>
          <DialogDescription>
            {step === "select" && "Select a folder containing your existing project."}
            {step === "detecting" && "Detecting project type and structure..."}
            {step === "configure" && "Review detected project details."}
            {step === "importing" && "Importing project into Track Your Shit..."}
            {step === "complete" && "Project imported successfully."}
            {step === "error" && "Failed to import project."}
          </DialogDescription>
        </DialogHeader>

        {/* Step: Select Folder */}
        {step === "select" && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg border-dashed">
              <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Select Project Folder</h3>
              <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                Choose the folder containing your existing codebase.
              </p>
              <Button onClick={() => void handleSelectFolder()} className="mt-4">
                <FolderOpen className="mr-2 h-4 w-4" />
                Browse
              </Button>
            </div>
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Step: Detecting */}
        {step === "detecting" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Detecting project type...</p>
          </div>
        )}

        {/* Step: Configure */}
        {step === "configure" && detectedProject && (
          <div className="space-y-4 py-4">
            {/* Project info card */}
            <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg bg-muted", typeInfo.color)}>
                  <TypeIcon className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{detectedProject.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {detectedProject.path}
                  </p>
                </div>
              </div>
            </div>

            {/* Project type */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Project Type</span>
              <span className={cn("font-medium flex items-center gap-2", typeInfo.color)}>
                <TypeIcon className="h-4 w-4" />
                {typeInfo.label}
              </span>
            </div>

            {/* Existing state */}
            <div className="space-y-2">
              <Label>Existing Configuration</Label>
              <div className="flex gap-4">
                <div
                  className={cn(
                    "flex items-center gap-2 text-sm px-3 py-2 rounded-lg border",
                    detectedProject.hasPlanning
                      ? "bg-status-success/10 border-status-success/30 text-status-success"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {detectedProject.hasPlanning ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  GSD
                </div>
                <div
                  className={cn(
                    "flex items-center gap-2 text-sm px-3 py-2 rounded-lg border",
                    detectedProject.hasPlanning
                      ? "bg-status-warning/10 border-status-warning/30 text-status-warning"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {detectedProject.hasPlanning ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  GSD (.planning/)
                </div>
              </div>
            </div>

            {/* Auto-sync option */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoSync"
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                className="rounded border-border"
              />
              <Label htmlFor="autoSync" className="text-sm font-normal">
                Automatically sync roadmap after import
              </Label>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Importing project...</p>
          </div>
        )}

        {/* Step: Complete */}
        {step === "complete" && (
          <div className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-status-success mb-4" />
            <h3 className="text-lg font-medium">Project Imported</h3>
            <p className="text-muted-foreground mt-1 text-center">
              {detectedProject?.name} has been imported successfully.
            </p>
            <div className="flex items-center gap-2 mt-3 text-sm text-status-success">
              <CheckCircle className="h-4 w-4" />
              Ready for development
            </div>
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
          {step === "select" && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
            </>
          )}

          {step === "configure" && (
            <>
              <Button variant="outline" onClick={() => setStep("select")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={() => void handleImport()} disabled={importProject.isPending}>
                Import Project
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}

          {step === "importing" && (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing...
            </Button>
          )}

          {step === "complete" && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleViewProject}>
                View Project
              </Button>
            </>
          )}

          {step === "error" && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button onClick={() => setStep("select")}>Try Again</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
