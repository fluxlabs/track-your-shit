// Track Your Shit - Project Selector Component
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useNavigate } from "react-router-dom";
import { useProjects } from "@/lib/queries";
import { ChevronDown, FolderOpen } from "lucide-react";

interface ProjectSelectorProps {
  selectedProjectId?: string;
  basePath: string;
  placeholder?: string;
}

export function ProjectSelector({
  selectedProjectId,
  basePath,
  placeholder = "Select a project",
}: ProjectSelectorProps) {
  const navigate = useNavigate();
  const { data: projects, isLoading } = useProjects();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const projectId = e.target.value;
    if (projectId) {
      void navigate(`${basePath}/${projectId}`);
    } else {
      void navigate(basePath);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted animate-pulse">
        <div className="h-4 w-32 bg-muted-foreground/20 rounded" />
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
      </div>
      <select
        value={selectedProjectId || ""}
        onChange={handleChange}
        className="w-full pl-9 pr-8 py-2 border rounded-md bg-background appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">{placeholder}</option>
        {projects?.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}
