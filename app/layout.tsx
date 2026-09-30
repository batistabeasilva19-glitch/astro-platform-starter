import type { Metadata, Viewport } from 'next';
import '@fontsource/poppins/300.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/bodoni-moda/400.css';
import '@fontsource/bodoni-moda/500.css';
import '@fontsource/mrs-saint-delafield/400.css';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: { default: 'Soltria · Portal de Aprovação', template: '%s · Soltria' },
  description: 'Portal de aprovação de conteúdo da Soltria — Beatriz Batista, Publicitária.',
  robots: { index: false, follow: false }, // portal privado
  icons: { icon: '/brand/sparkles-wine.png' },
};

export const viewport: Viewport = { themeColor: '#771430', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
