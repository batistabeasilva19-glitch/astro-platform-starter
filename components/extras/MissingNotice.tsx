export function MissingNotice({ file = '0012_portal_roteiros_calendario_stories.sql' }: { file?: string }) {
  return (
    <div className="card border-dashed p-8 text-center">
      <p className="h-display text-2xl text-wine">Falta um passo no Supabase</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink/65">Rode a migration <code className="rounded bg-blush px-1.5 py-0.5">supabase/migrations/{file}</code> no SQL Editor do Supabase e recarregue esta página.</p>
    </div>
  );
}
