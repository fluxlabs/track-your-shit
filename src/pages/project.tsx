// Track Your Shit - Project Page
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  LayoutDashboard,
  ClipboardList,
  SquareTerminal,
  FolderTree,
  Package,
  CheckSquare,
  Bug,
  Flag,
  FileText,
  ShieldCheck,
  Key,
  Lightbulb,
  FlaskConical,
  ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ProjectHeader,
  ProjectOverviewTab,
  FileBrowser,
  GsdPlansTab,
  GsdTodosTab,
  GsdDebugTab,
  GsdMilestonesTab,
  GsdVerificationTab,
  GsdContextTab,
  GsdValidationPlanTab,
  GsdUatTab,
  DependenciesTab,
  KnowledgeTab,
  TabGroup,
  EnvVarsTab,
} from "@/components/project";
import { TerminalTabs } from "@/components/terminal";
import { watchProjectFiles } from "@/lib/tauri";
import { useGsdFileWatcher } from "@/hooks/use-gsd-file-watcher";
import {
  useProject,
  useGsdSync,
  useDeleteProject,
} from "@/lib/queries";
import { truncatePath } from "@/lib/utils";

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: project, isLoading: projectLoading } = useProject(id!);
  const syncProject = useGsdSync();
  const deleteProject = useDeleteProject();

  const hasPlanning = project?.tech_stack?.has_planning ?? false;

  // Stable ref to avoid listener leaks in useGsdFileWatcher
  const syncProjectRef = useRef(syncProject);
  syncProjectRef.current = syncProject;

  const handleGsdSync = useCallback(() => {
    if (id && !syncProjectRef.current.isPending) {
      syncProjectRef.current.mutate(id);
    }
  }, [id]);

  // Real-time GSD file watcher
  useGsdFileWatcher(id!, project?.path ?? '', hasPlanning, handleGsdSync);

  // Start file watcher for GSD projects on mount
  useEffect(() => {
    if (project?.path && hasPlanning) {
      void watchProjectFiles(project.path);
    }
  }, [project?.path, hasPlanning]);

  // Auto-sync GSD data on project load
  const syncAttemptedRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      project &&
      project.tech_stack?.has_planning &&
      !syncProject.isPending &&
      syncAttemptedRef.current !== project.id
    ) {
      syncAttemptedRef.current = project.id;
      syncProject.mutate(project.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, project?.tech_stack]);

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  const handleDeleteProject = () => {
    deleteProject.mutate(project!.id, {
      onSuccess: () => {
        void navigate("/");
      },
    });
  };

  if (projectLoading) {
    return (
      <div className="p-8">
        <div className="text-center py-8 text-muted-foreground">Loading project...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8">
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">Project not found</p>
          <Button asChild variant="outline">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <ProjectHeader
        project={project}
        onDelete={() => setShowDeleteDialog(true)}
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0 p-6">
        <TabsList className="w-fit flex-shrink-0 mb-6">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="project" className="gap-2">
            <Package className="h-4 w-4" />
            Project
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Knowledge
          </TabsTrigger>
          <TabsTrigger value="shell" className="gap-2">
            <SquareTerminal className="h-4 w-4" />
            Shell
          </TabsTrigger>
          <TabsTrigger value="envvars" className="gap-2">
            <Key className="h-4 w-4" />
            Env Vars
          </TabsTrigger>
          {hasPlanning && (
            <TabsTrigger value="gsd" className="gap-2">
              <CheckSquare className="h-4 w-4" />
              GSD
            </TabsTrigger>
          )}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-2">
          <ProjectOverviewTab
            project={project}
            onOpenShell={() => setSearchParams({ tab: "shell" })}
          />
        </TabsContent>

        {/* Project — Files + Dependencies */}
        <TabsContent value="project" className="flex-1 min-h-0">
          <TabGroup
            defaultTab="files"
            tabs={[
              {
                id: "files",
                label: "Files",
                icon: FolderTree,
                content: <FileBrowser projectId={project.id} projectPath={project.path} />,
              },
              {
                id: "dependencies",
                label: "Dependencies",
                icon: Package,
                content: <DependenciesTab projectId={project.id} projectPath={project.path} />,
              },
            ]}
          />
        </TabsContent>

        {/* Knowledge */}
        <TabsContent value="knowledge" className="flex-1 min-h-0">
          <KnowledgeTab projectId={project.id} />
        </TabsContent>

        {/* Shell */}
        <TabsContent value="shell" forceMount className="flex-1 flex flex-col min-h-0">
          <TerminalTabs
            projectId={project.id}
            workingDirectory={project.path}
            className="flex-1 min-h-0"
          />
        </TabsContent>

        {/* Env Vars */}
        <TabsContent value="envvars" className="flex-1 min-h-0 overflow-y-auto">
          <EnvVarsTab projectId={project.id} projectPath={project.path} />
        </TabsContent>

        {/* GSD — workflow order: Plans → Context → Todos → Validation → UAT → Verification → Milestones → Debug */}
        {hasPlanning && (
          <TabsContent value="gsd" className="flex-1 min-h-0">
            <TabGroup
              defaultTab="gsd-plans"
              tabs={[
                {
                  id: "gsd-plans",
                  label: "Plans",
                  icon: FileText,
                  content: <GsdPlansTab projectId={project.id} />,
                },
                {
                  id: "gsd-context",
                  label: "Context",
                  icon: Lightbulb,
                  content: <GsdContextTab projectId={project.id} />,
                },
                {
                  id: "gsd-todos",
                  label: "Todos",
                  icon: CheckSquare,
                  content: <GsdTodosTab projectId={project.id} />,
                },
                {
                  id: "gsd-validation",
                  label: "Validation",
                  icon: FlaskConical,
                  content: <GsdValidationPlanTab projectId={project.id} />,
                },
                {
                  id: "gsd-uat",
                  label: "UAT",
                  icon: ClipboardCheck,
                  content: <GsdUatTab projectId={project.id} />,
                },
                {
                  id: "gsd-verification",
                  label: "Verification",
                  icon: ShieldCheck,
                  content: <GsdVerificationTab projectId={project.id} />,
                },
                {
                  id: "gsd-milestones",
                  label: "Milestones",
                  icon: Flag,
                  content: <GsdMilestonesTab projectId={project.id} />,
                },
                {
                  id: "gsd-debug",
                  label: "Debug",
                  icon: Bug,
                  content: <GsdDebugTab projectId={project.id} />,
                },
              ]}
            />
          </TabsContent>
        )}
      </Tabs>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <span className="font-semibold">{project.name}</span> from Track Your Shit.
              <br /><br />
              <span className="text-foreground">Your project files will NOT be deleted.</span> The project folder at{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">{truncatePath(project.path, 50)}</code>{" "}
              will remain untouched. You can re-import this project at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProject.isPending ? "Removing..." : "Remove Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
