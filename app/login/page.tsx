import { Suspense } from 'react';
import { BrandElement, Logo } from '@/components/brand/Brand';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Entrar' };

export default function LoginPage() {
  return (
    <main className="relative grid min-h-dvh overflow-hidden bg-wine lg:grid-cols-2">
      <section className="relative flex flex-col items-center justify-center px-8 py-16 text-center text-white lg:py-0">
        <Logo tone="light" withTagline className="w-[min(86%,30rem)]" />
        <p className="script mt-8 text-4xl text-blush sm:text-5xl">portal de aprovação</p>
        <BrandElement name="sparkles" className="absolute right-10 top-10 hidden w-20 opacity-60 lg:block" />
      </section>
      <section className="flex items-center justify-center bg-blush-soft px-6 py-14 lg:rounded-l-[3rem]">
        <div className="animate-rise w-full max-w-sm">
          <p className="label mb-3 text-wine/70">Área administrativa</p>
          <h1 className="h-display mb-8 text-4xl text-wine">Bem-vinda de volta</h1>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
