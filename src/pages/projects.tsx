// Track Your Shit - Projects Page
// Dedicated project management with search and filtering
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState, useMemo } from "react";
import {
  Plus,
  FolderOpen,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectWizardDialog, ProjectCard, BulkProjectBar } from "@/components/projects";
import { SkeletonProjectItem } from "@/components/ui/skeleton";
import { useProjectsWithStats, useUpdateProject, useDeleteProject } from "@/lib/queries";
import { getProjectType, type ProjectType } from "@/lib/design-tokens";
import { PageHeader } from "@/components/layout/page-header";

type StatusFilter = "all" | "active" | "archived";
type TypeFilter = "all" | ProjectType;

export function ProjectsPage() {
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { data: projects, isLoading } = useProjectsWithStats();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    return projects.filter((p) => {
      // Status filter
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      // Type filter
      if (typeFilter !== "all" && getProjectType(p.tech_stack) !== typeFilter)
        return false;
      // Search filter (includes description)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.path.toLowerCase().includes(q) ||
          (p.description?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [projects, searchQuery, statusFilter, typeFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleBulkArchive = async () => {
    const ids = Array.from(selectedIds);
    let successCount = 0;

    for (const id of ids) {
      try {
        await updateProject.mutateAsync({ id, updates: { status: "archived" } });
        successCount++;
      } catch {
        // Error already handled by mutation
      }
    }

    if (successCount > 0) {
      toast.success(`Archived ${successCount} project${successCount !== 1 ? 's' : ''}`);
    }
    deselectAll();
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    let successCount = 0;

    for (const id of ids) {
      try {
        await deleteProject.mutateAsync(id);
        successCount++;
      } catch {
        // Error already handled by mutation
      }
    }

    if (successCount > 0) {
      toast.success(`Deleted ${successCount} project${successCount !== 1 ? 's' : ''}`);
    }
    deselectAll();
  };

  return (
    <div className="h-full overflow-auto p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader
        title="Projects"
        description="Manage and browse all your projects"
        icon={<FolderOpen className="h-6 w-6 text-muted-foreground" />}
        actions={
          <Button onClick={() => setAddProjectOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Project
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, path, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status filter */}
            <div>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Type filter */}
            <div>
              <Select
                value={typeFilter}
                onValueChange={(value) => setTypeFilter(value as TypeFilter)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="gsd">GSD</SelectItem>
                  <SelectItem value="bare">Bare</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <BulkProjectBar
          selectedCount={selectedIds.size}
          onArchive={() => void handleBulkArchive()}
          onDelete={() => void handleBulkDelete()}
          onDeselectAll={deselectAll}
          isArchiving={updateProject.isPending}
          isDeleting={deleteProject.isPending}
        />
      )}

      {/* Results */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {isLoading
              ? "Loading..."
              : `${filteredProjects.length} project${filteredProjects.length !== 1 ? "s" : ""}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <SkeletonProjectItem />
              <SkeletonProjectItem />
              <SkeletonProjectItem />
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-4 rounded-full bg-gradient-to-br from-brand-blue/10 to-brand-purple/10 w-fit mx-auto mb-4">
                <FolderOpen className="h-12 w-12 text-brand-blue" />
              </div>
              <h3 className="text-lg font-medium mb-2">
                {searchQuery || statusFilter !== "all" || typeFilter !== "all"
                  ? "No Matching Projects"
                  : "No Projects Yet"}
              </h3>
              <p className="text-sm text-muted-foreground mb-5">
                {searchQuery || statusFilter !== "all" || typeFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Import a GSD project to get started"}
              </p>
              {!searchQuery && statusFilter === "all" && typeFilter === "all" && (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    onClick={() => setAddProjectOpen(true)}
                    variant="default"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Project
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  showDescription
                  selected={selectedIds.has(project.id)}
                  onToggleSelect={() => toggleSelect(project.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ProjectWizardDialog
        open={addProjectOpen}
        onOpenChange={setAddProjectOpen}
      />
    </div>
  );
}
