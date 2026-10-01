import { allColors, getFonts, getPalettes } from '@/lib/identity/color';
import { FAV_LABEL, lastApproval, resolveFavorites } from '@/lib/identity/favorites';
import { FONT_ROLES, STAGE_BY_KEY, type FavKind, type IdentityDetail } from '@/lib/identity/types';
import { fmtFullDate, fmtStamp } from '@/lib/utils';

const H = ({ children }: { children: React.ReactNode }) => <p className="label mb-3 text-wine/70">{children}</p>;
const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="card p-5 sm:p-6">
    <H>{title}</H>
    {children}
  </section>
);
const Muted = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-ink/50">{children}</p>;

/** DECISÕES DO CLIENTE — tudo o que foi escolhido, favoritado e pedido, sem caçar nos comentários. */
export function DecisionsPanel({ detail }: { detail: IdentityDetail }) {
  const { stages, favorites } = detail;
  const fav = resolveFavorites(detail);
  const stage = (k: string) => stages.find((s) => s.stage_key === k);
  const cur = (k: string) => {
    const s = stage(k);
    return (s?.versions.find((v) => v.version_number === s.current_version) ?? s?.versions[s.versions.length - 1])?.content;
  };

  const logoApproval = lastApproval(detail, 'logo');
  const chosen = stage('logo')?.proposals.find((p) => p.is_chosen);
  const approvedLogo = logoApproval?.snapshot.logo;

  const colorsContent = cur('colors') ?? {};
  const palettes = getPalettes(colorsContent);
  const favPalette = fav.palette[0];
  const sel = [...detail.selections].reverse().find((s) => s.kind === 'colors');
  const picked = allColors(colorsContent).filter((c) => (sel?.payload.colorIds ?? []).includes(c.id));

  const typoStage = stage('typography');
  const fonts = getFonts(cur('typography') ?? {}).filter((f) => f.name.trim());
  const typoApproved = typoStage?.status === 'approved';
  const finalApproval = lastApproval(detail, 'final');

  const changeRequests = stages.flatMap((s) => s.comments.filter((c) => c.is_change_request).map((c) => ({ ...c, stage: s })));
  changeRequests.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const kinds: FavKind[] = ['logo', 'palette', 'color', 'font', 'application'];
  const totalDownloads = Object.values(detail.downloads).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      {finalApproval && (
        <section className="rounded-[2rem] bg-wine p-6 text-white sm:p-8">
          <p className="script text-4xl text-blush">Identidade aprovada ♡</p>
          <p className="mt-2 text-sm text-white/85">Aprovada por {finalApproval.client_name} em {fmtStamp(finalApproval.created_at)}</p>
          {finalApproval.snapshot.logo && <p className="mt-1 text-sm text-white/85">Logo: {finalApproval.snapshot.logo.label} · V{finalApproval.snapshot.logo.versionNumber}</p>}
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Proposta favorita">
          {fav.logo.length ? (
            <ul className="space-y-1">{fav.logo.map((i) => <li key={i.refId} className="h-display text-2xl text-wine">{i.label}</li>)}</ul>
          ) : (
            <Muted>O cliente ainda não favoritou nenhuma proposta.</Muted>
          )}
        </Card>

        <Card title="Logo aprovada">
          {approvedLogo ? (
            <>
              <p className="h-display text-2xl text-wine">{approvedLogo.label} - V{approvedLogo.versionNumber}</p>
              <p className="mt-1 text-xs text-ink/55">Aprovada por {logoApproval!.client_name} em {fmtStamp(logoApproval!.created_at)}</p>
            </>
          ) : chosen ? (
            <p className="text-sm text-ink/70">Escolhida: <strong className="font-normal text-wine">{chosen.label}</strong> — ainda não aprovada.</p>
          ) : (
            <Muted>Nenhuma logo aprovada ainda.</Muted>
          )}
        </Card>

        <Card title="Paleta favorita">
          {favPalette && favPalette.kind === 'palette' ? (
            <>
              <p className="h-display mb-3 text-2xl text-wine">{favPalette.label}</p>
              <div className="flex h-12 overflow-hidden rounded-xl border border-wine/15">{favPalette.palette.colors.map((c) => <span key={c.id} className="flex-1" style={{ backgroundColor: c.hex }} />)}</div>
            </>
          ) : (
            <Muted>{palettes.length ? 'O cliente ainda não marcou uma paleta favorita.' : 'Sem paletas cadastradas.'}</Muted>
          )}
        </Card>

        <Card title="Cores escolhidas">
          {picked.length ? (
            <>
              <ul className="space-y-2">
                {picked.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 text-sm">
                    <span className="size-8 rounded-full border border-wine/15" style={{ backgroundColor: c.hex }} />
                    <span className="font-mono">{c.hex.toUpperCase()}</span>
                    <span className="text-ink/55">{c.name}</span>
                  </li>
                ))}
              </ul>
              {sel && <p className="mt-3 text-xs text-ink/55">Seleção enviada por {sel.client_name} em {fmtStamp(sel.created_at)}</p>}
            </>
          ) : (
            <Muted>O cliente ainda não enviou uma seleção de cores.</Muted>
          )}
        </Card>

        <Card title={`Tipografia ${typoApproved ? 'aprovada' : 'proposta'}`}>
          {fonts.length ? (
            <ul className="space-y-3">
              {[...fonts].sort((a, b) => FONT_ROLES.findIndex(([r]) => r === a.role) - FONT_ROLES.findIndex(([r]) => r === b.role)).map((f) => (
                <li key={f.id}>
                  <p className="label text-wine/70">{FONT_ROLES.find(([r]) => r === f.role)?.[1]}</p>
                  <p className="h-display text-2xl text-wine">{f.name}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Muted>Sem fontes cadastradas.</Muted>
          )}
          {!typoApproved && fonts.length > 0 && <p className="mt-3 text-xs text-ink/55">Ainda não aprovada pelo cliente.</p>}
        </Card>

        <Card title="Alterações solicitadas">
          {changeRequests.length ? (
            <ul className="space-y-3">
              {changeRequests.slice(0, 8).map((c) => (
                <li key={c.id} className="rounded-2xl bg-blush/50 p-3 text-sm">
                  <p className="label mb-1 text-wine">{STAGE_BY_KEY[c.stage.stage_key].label} · {fmtStamp(c.created_at)}{c.stage.status === 'changes_requested' ? ' · pendente' : ''}</p>
                  <p className="whitespace-pre-line">{c.message}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Muted>Nenhum pedido de alteração.</Muted>
          )}
        </Card>
      </div>

      <section className="card p-5 sm:p-6">
        <H>Favoritos do cliente</H>
        {favorites.length ? (
          <div className="space-y-5">
            {kinds.filter((k) => fav[k].length).map((k) => (
              <div key={k}>
                <p className="mb-2 text-sm text-wine">{FAV_LABEL[k]}</p>
                <div className="flex flex-wrap gap-3">
                  {fav[k].map((i) => (
                    <div key={i.refId} className="flex items-center gap-2 rounded-full border border-wine/20 py-1 pl-1 pr-4 text-sm">
                      {i.kind === 'color' && <span className="size-7 rounded-full border border-wine/15" style={{ backgroundColor: i.color.hex }} />}
                      {i.kind === 'palette' && <span className="flex h-7 w-14 overflow-hidden rounded-full border border-wine/15">{i.palette.colors.map((c) => <span key={c.id} className="flex-1" style={{ backgroundColor: c.hex }} />)}</span>}
                      {(i.kind === 'logo' || i.kind === 'application') && i.imageUrl && <img src={i.imageUrl} alt="" className="size-7 rounded-full bg-blush object-cover" />}
                      {i.kind === 'font' && <span className="flex size-7 items-center justify-center rounded-full bg-blush text-xs text-wine">Aa</span>}
                      {i.label}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Muted>O cliente ainda não favoritou nada. (Favoritar não significa aprovar.)</Muted>
        )}
      </section>

      {totalDownloads > 0 && (
        <p className="text-xs text-ink/55">Downloads dos arquivos finais: {totalDownloads}. Último: {detail.activity.filter((a) => a.action === 'download').slice(-1).map((a) => fmtFullDate(a.created_at))[0] ?? '—'}</p>
      )}
    </div>
  );
}
