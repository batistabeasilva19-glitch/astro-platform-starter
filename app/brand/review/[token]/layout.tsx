import { portalNav, resolveIdentityToken } from '@/lib/data/identity-portal';
import { BrandElement, Logo, Sparkle } from '@/components/brand/Brand';
import { PortalNav } from '@/components/identity/PortalNav';
import { Avatar } from '@/components/ui/Misc';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Identidade visual' };

export default async function IdentityPortalLayout({ children, params }: { children: React.ReactNode; params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await resolveIdentityToken(token);

  if (!session) {
    return (
      <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-wine px-6 text-center text-white">
        <Logo tone="light" withTagline className="w-72 max-w-full" />
        <h1 className="script mt-10 text-5xl">Link indisponível</h1>
        <p className="mt-4 max-w-sm text-sm text-white/80">Este link não está mais ativo. Peça um novo link para a Soltria pelo WhatsApp.</p>
        <BrandElement name="sparkles" className="absolute right-8 top-8 w-16 opacity-60" />
      </main>
    );
  }
  const stages = await portalNav(session);
  const approved = session.project.status === 'approved' || session.project.status === 'finalized';

  return (
    <div className="min-h-dvh">
      <header className="bg-wine text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <Logo tone="light" className="w-24 sm:w-28" />
          <div className="flex items-center gap-3">
            <span className="hidden text-right text-xs leading-tight text-white/80 sm:block">
              Identidade visual
              <br />
              <span className="text-white">{session.client.company_name}</span>
            </span>
            <Avatar name={session.client.company_name} src={session.avatarUrl} className="size-10 text-xs ring-2 ring-white/40" />
          </div>
        </div>
      </header>
      <PortalNav token={token} stages={stages} projectApproved={approved} />
      <main className="mx-auto max-w-5xl px-5 py-10 sm:py-14">{children}</main>
      <footer className="pb-12 pt-6 text-center">
        <Sparkle className="size-3 text-wine/50" />
        <p className="label mt-2 text-wine/60">Feito com carinho por Soltria</p>
      </footer>
    </div>
  );
}
