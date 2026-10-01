'use client';

import type { VersionData } from '@/lib/identity/types';
import { ConceptView, FilesView, FinalMessage, GalleryView, IdentitySummary, MoodboardView } from './views/BasicViews';
import { ColorsView } from './views/ColorsView';
import { LogoView } from './views/LogoView';
import { TypographyView } from './views/TypographyView';
import type { ViewCtx } from './view-context';

export { IdentitySummary, FinalMessage };

/** Apresentação de uma etapa (cliente ou pré-visualização da administradora). */
export function StageView({ ctx, version }: { ctx: ViewCtx; version: VersionData }) {
  const { stage } = ctx;
  switch (stage.stage_key) {
    case 'concept':
      return <ConceptView ctx={ctx} content={version.content} images={version.assets} />;
    case 'moodboard':
      return <MoodboardView ctx={ctx} content={version.content} images={version.assets} />;
    case 'logo':
      return <LogoView ctx={ctx} />;
    case 'colors':
      return <ColorsView ctx={ctx} content={version.content} />;
    case 'typography':
      return <TypographyView ctx={ctx} content={version.content} images={version.assets} />;
    case 'elements':
      return <GalleryView ctx={ctx} kind="elements" content={version.content} images={version.assets} />;
    case 'applications':
      return <GalleryView ctx={ctx} kind="applications" content={version.content} images={version.assets} />;
    case 'files':
      return <FilesView ctx={ctx} content={version.content} files={version.assets} />;
    case 'final':
      return (
        <div className="space-y-8">
          <FinalMessage content={version.content} />
          <IdentitySummary ctx={ctx} />
        </div>
      );
  }
}
