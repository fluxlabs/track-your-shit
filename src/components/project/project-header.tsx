// Track Your Shit - Project Header Component
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { Link } from "react-router-dom";
import { ArrowLeft, FolderOpen, MoreVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { truncatePath, cn } from "@/lib/utils";
import { getProjectType, projectTypeConfig } from "@/lib/design-tokens";
import type { Project } from "@/lib/tauri";

interface ProjectHeaderProps {
  project: Project;
  currentExecution?: undefined;
  onDelete: () => void;
}

export function ProjectHeader({ project, onDelete }: ProjectHeaderProps) {
  const projectType = getProjectType(project.tech_stack);
  const typeConfig = projectTypeConfig[projectType];

  return (
    <div className="flex items-center gap-4 px-6 py-4 flex-shrink-0 border-b">
      <Button asChild variant="ghost" size="icon">
        <Link to="/">
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>
      <div className="flex-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn('text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border', typeConfig.classes)}>
                {typeConfig.label}
              </span>
            </TooltipTrigger>
            <TooltipContent>{typeConfig.tooltip}</TooltipContent>
          </Tooltip>
        </div>
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <FolderOpen className="h-4 w-4" />
          {truncatePath(project.path, 60)}
        </p>
      </div>
      <div className="flex items-center gap-4">
        {project.tech_stack && (
          <div className="flex items-center gap-2">
            {project.tech_stack.framework && (
              <span className="text-sm bg-muted px-2 py-1 rounded">{project.tech_stack.framework}</span>
            )}
            {project.tech_stack.language && (
              <span className="text-sm bg-muted px-2 py-1 rounded">{project.tech_stack.language}</span>
            )}
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Remove Project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
