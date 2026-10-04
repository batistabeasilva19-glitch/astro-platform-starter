'use client';

import { useState } from 'react';
import type { ContentDetail } from '@/lib/types';
import { addClientComment, reactClientComment } from '@/lib/actions/portal';
import { InstagramPost } from '@/components/content/InstagramPost';
import { CommentThread, HistoryList } from '@/components/content/Thread';
import { ApprovalActions } from './ApprovalActions';
import { cn, fmtStamp } from '@/lib/utils';

interface Props {
  token: string;
  content: ContentDetail;
  client: { handle: string; displayName: string; avatarUrl: string | null };
}

export function ReviewContent({ token, content, client }: Props) {
  const current = content.versions.find((v) => v.version_number === content.current_version) ?? content.versions[content.versions.length - 1];
  const [selectedId, setSelectedId] = useState(current.id);
  const [slide, setSlide] = useState(0);
  const selected = content.versions.find((v) => v.id === selectedId) ?? current;
  const isCurrent = selected.id === current.id;
  const pad = (n: number) => String(n).padStart(2, '0');
  const slideCount = selected.media.filter((m) => m.kind === 'image').length;
  const versionNumbers = Object.fromEntries(content.versions.map((v) => [v.id, v.version_number]));
  const older = content.versions.filter((v) => v.id !== current.id);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,500px)_minmax(0,1fr)] lg:gap-14">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className={cn('rounded-full px-3 py-1 text-[0.7rem]', isCurrent ? 'bg-wine text-white' : 'border border-wine/30 text-wine')}>
            {isCurrent ? `Versão atual · ${pad(selected.version_number)}` : `Versão ${pad(selected.version_number)} · anterior`}
          </span>
          {older.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[...content.versions].reverse().map((v) => (
                <button key={v.id} onClick={() => setSelectedId(v.id)} className={cn('rounded-full border px-2.5 py-1 text-[0.7rem] transition', selectedId === v.id ? 'border-wine bg-blush text-wine' : 'border-wine/20 text-ink/60 hover:bg-blush')}>
                  V{pad(v.version_number)}
                </button>
              ))}
            </div>
          )}
        </div>
        <InstagramPost handle={client.handle} displayName={client.displayName} avatarUrl={client.avatarUrl} format={content.format} version={selected} slideIndex={slide} onSlideChange={setSlide} />
        {selected.note && (
          <p className="mx-auto mt-4 max-w-[470px] rounded-2xl bg-blush px-4 py-3 text-sm text-wine">
            <strong className="font-normal">O que mudou:</strong> {selected.note}
          </p>
        )}
        {!isCurrent && (
          <p className="mx-auto mt-4 max-w-[470px] rounded-2xl border border-dashed border-wine/40 px-4 py-3 text-sm text-wine">
            Você está vendo uma versão anterior ({fmtStamp(selected.created_at)}). A aprovação vale para a versão atual.{' '}
            <button className="underline underline-offset-2" onClick={() => setSelectedId(current.id)}>Voltar para a versão atual</button>
          </p>
        )}
      </div>

      <div className="space-y-10">
        <ApprovalActions
          token={token}
          contentId={content.id}
          versionId={current.id}
          versionNumber={current.version_number}
          format={content.format}
          status={content.status}
          approvedBy={content.approved_by}
          approvedAt={content.approved_at}
          isCurrent={isCurrent}
        />
        <CommentThread
          comments={content.comments}
          viewer="client"
          slideCount={slideCount}
          slideIndex={slide}
          onPickSlide={setSlide}
          versionNumbers={versionNumbers}
          onSend={(m, s, r) => addClientComment(token, content.id, m, s, r)}
          onReact={(id, e) => reactClientComment(token, content.id, id, e)}
          canReply
        />
        <HistoryList history={content.history} />
      </div>
    </div>
  );
}
