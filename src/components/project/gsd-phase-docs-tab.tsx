// VCCA - GSD Phase Docs Tab
// Read-only viewer for phase-level spec/design and quality/security artifacts (ARTF-01, ARTF-02)
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState } from 'react';
import { FileText, ChevronDown, ChevronRight, FileSearch } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MarkdownRenderer } from '@/components/knowledge/markdown-renderer';
import {
  useGsdPlans,
  useGsdPhaseSpec,
  useGsdPhaseSecurity,
  useGsdPhaseValidationDoc,
  useGsdPhaseReview,
} from '@/lib/queries';
import type { GsdPhaseDoc, GsdPhaseDocSet } from '@/lib/tauri';

interface GsdPhaseDocsTabProps {
  projectId: string;
}

export function GsdPhaseDocsTab({ projectId }: GsdPhaseDocsTabProps) {
  const { data: plans, isLoading: plansLoading } = useGsdPlans(projectId);

  // Derive unique sorted phase numbers from the plans list (mirrors gsd-context-tab)
  const phaseNumbers: number[] = Array.from(
    new Set((plans ?? []).map((p) => p.phase_number)),
  ).sort((a, b) => a - b);

  const [selectedPhase, setSelectedPhase] = useState<number | null>(null);

  // Default to first phase once plans load
  const resolvedPhase =
    selectedPhase ?? (phaseNumbers.length > 0 ? phaseNumbers[0] : null);

  if (plansLoading) {
    return (
      <div className="space-y-4">
        {/* Skeleton phase pills */}
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-8 w-20 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
        {/* Skeleton cards */}
        <div className="h-32 rounded-lg bg-muted animate-pulse" />
        <div className="h-24 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  if (phaseNumbers.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <FileSearch className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No phases found.</p>
          <p className="text-xs mt-1">
            Run /gsd:plan-phase to create phase artifacts.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Phase selector pills */}
      <div className="flex gap-2 flex-wrap">
        {phaseNumbers.map((phase) => (
          <Button
            key={phase}
            variant={resolvedPhase === phase ? 'default' : 'outline'}
            size="sm"
            className="h-8"
            onClick={() => setSelectedPhase(phase)}
          >
            Phase {phase}
          </Button>
        ))}
      </div>

      {/* Phase docs panel for the selected phase */}
      {resolvedPhase != null && (
        <PhaseDocsPanel projectId={projectId} phase={resolvedPhase} />
      )}
    </div>
  );
}

// Inner panel — fetches all six phase docs for the selected phase
function PhaseDocsPanel({
  projectId,
  phase,
}: {
  projectId: string;
  phase: number;
}) {
  const { data: specSet, isLoading: specLoading } = useGsdPhaseSpec(projectId, phase);
  const { data: security, isLoading: securityLoading } = useGsdPhaseSecurity(projectId, phase);
  const { data: validation, isLoading: validationLoading } = useGsdPhaseValidationDoc(projectId, phase);
  const { data: review, isLoading: reviewLoading } = useGsdPhaseReview(projectId, phase);

  const isLoading = specLoading || securityLoading || validationLoading || reviewLoading;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-28 rounded-lg bg-muted animate-pulse" />
        <div className="h-20 rounded-lg bg-muted animate-pulse" />
        <div className="h-20 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Spec & Design group: SPEC, AI-SPEC, UI-SPEC */}
      <SpecGroup
        label="Spec & Design"
        specSet={specSet ?? null}
        projectId={projectId}
        phase={phase}
      />

      {/* Quality & Security group: SECURITY, VALIDATION, REVIEW */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground px-1">Quality & Security</h3>
        <div className="space-y-2">
          <ArtifactCard
            doc={security ?? null}
            label="SECURITY.md"
            projectId={projectId}
            phase={phase}
          />
          <ArtifactCard
            doc={validation ?? null}
            label="VALIDATION.md"
            projectId={projectId}
            phase={phase}
          />
          <ArtifactCard
            doc={review ?? null}
            label="REVIEW.md"
            projectId={projectId}
            phase={phase}
          />
        </div>
      </div>
    </div>
  );
}

// Renders the Spec & Design group from the GsdPhaseDocSet
function SpecGroup({
  label,
  specSet,
  projectId,
  phase,
}: {
  label: string;
  specSet: GsdPhaseDocSet | null;
  projectId: string;
  phase: number;
}) {
  // If no specSet returned, render three absent cards
  const docs: (GsdPhaseDoc | null)[] = specSet
    ? [
        specSet.docs.find((d) => d.doc_type === 'SPEC') ?? null,
        specSet.docs.find((d) => d.doc_type === 'AI-SPEC') ?? null,
        specSet.docs.find((d) => d.doc_type === 'UI-SPEC') ?? null,
      ]
    : [null, null, null];
  const docLabels = ['SPEC.md', 'AI-SPEC.md', 'UI-SPEC.md'];

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground px-1">{label}</h3>
      <div className="space-y-2">
        {docs.map((doc, i) => (
          <ArtifactCard
            key={docLabels[i]}
            doc={doc}
            label={docLabels[i]}
            projectId={projectId}
            phase={phase}
          />
        ))}
      </div>
    </div>
  );
}

// Single artifact card: shows presence badge + collapsible MarkdownRenderer or "Not present" state
function ArtifactCard({
  doc,
  label,
  projectId,
  phase,
}: {
  doc: GsdPhaseDoc | null;
  label: string;
  projectId: string;
  phase: number;
}) {
  const [open, setOpen] = useState(false);

  const isPresent = doc?.present === true && doc?.raw_content != null && doc.raw_content.trim().length > 0;
  // Derive a plausible filePath for the markdown renderer bookmark system
  const filePath = doc?.source_file ?? `.planning/phases/${phase}-phase/${label}`;

  return (
    <Card>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors rounded-lg text-left"
        onClick={() => isPresent && setOpen((o) => !o)}
        disabled={!isPresent}
        aria-expanded={open}
      >
        {isPresent ? (
          open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        )}
        <span className="flex-1 font-mono text-xs">{label}</span>
        <Badge
          variant={isPresent ? 'default' : 'secondary'}
          className="text-[10px] px-1.5 py-0 ml-auto"
        >
          {isPresent ? 'present' : '—'}
        </Badge>
      </button>

      {isPresent && open && doc?.raw_content != null && (
        <CardContent className="pt-0 px-4 pb-4">
          <MarkdownRenderer
            content={doc.raw_content}
            projectId={projectId}
            filePath={filePath}
          />
        </CardContent>
      )}

      {!isPresent && (
        <CardHeader className="pt-0 pb-3 px-4">
          <CardTitle className="text-xs text-muted-foreground font-normal">
            Not present for this phase
          </CardTitle>
        </CardHeader>
      )}
    </Card>
  );
}
