import { resolveTokenGate } from '@/lib/data/portal';
import { LoginForm } from '@/components/portal/LoginForm';
import { LogoutButton } from '@/components/portal/LogoutButton';
import { BrandElement, Logo, Sparkle } from '@/components/brand/Brand';
import { Avatar } from '@/components/ui/Misc';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Aprovação de conteúdo' };

export default async function ReviewLayout({ children, params }: { children: React.ReactNode; params: Promise<{ token: string }> }) {
  const { token } = await params;
  const gate = await resolveTokenGate(token);
  const session = gate?.session;

  if (!session) {
    return (
      <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-wine px-6 text-center text-white">
        <Logo tone="light" withTagline className="w-72 max-w-full" />
        <h1 className="script mt-10 text-5xl">Link indisponível</h1>
        <p className="mt-4 max-w-sm text-sm text-white/80">Este link de aprovação não está mais ativo. Peça um novo link para a Soltria pelo WhatsApp.</p>
        <BrandElement name="sparkles" className="absolute right-8 top-8 w-16 opacity-60" />
      </main>
    );
  }

  if (gate.locked) {
    return (
      <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-wine px-6 text-center text-white">
        <Logo tone="light" withTagline className="w-72 max-w-full" />
        <h1 className="script mt-10 text-5xl">Bem-vinda</h1>
        <p className="mt-3 max-w-sm text-sm text-white/80">Entre com o e-mail e a senha que a Soltria enviou para ver o portal de {session.client.company_name}.</p>
        <div className="mt-2 w-full max-w-sm rounded-3xl bg-white p-6 text-ink [&_label]:text-wine/70">
          <LoginForm token={token} />
        </div>
        <BrandElement name="sparkles" className="absolute right-8 top-8 w-16 opacity-60" />
      </main>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="bg-wine text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <Logo tone="light" className="w-24 sm:w-28" />
          <div className="flex items-center gap-3">
            <span className="hidden text-right text-xs leading-tight text-white/80 sm:block">
              Portal de aprovação
              <br />
              <span className="text-white">{session.client.company_name}</span>
            </span>
            {(session.client as { portal_login_required?: boolean }).portal_login_required && <LogoutButton token={token} />}
            <Avatar name={session.client.company_name} src={session.avatarUrl} className="size-10 text-xs ring-2 ring-white/40" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-10 sm:py-14">{children}</main>
      <footer className="pb-12 pt-6 text-center">
        <Sparkle className="size-3 text-wine/50" />
        <p className="label mt-2 text-wine/60">Feito com carinho por Soltria</p>
      </footer>
    </div>
  );
}
