-- ════════════════════════════════════════════════════════════════════
-- Soltria · WhatsApp do cliente (0017)
-- ADITIVA e segura: só acrescenta uma coluna opcional. Usada para abrir a conversa
-- do cliente no WhatsApp Web já com a mensagem escrita.
-- ════════════════════════════════════════════════════════════════════
alter table public.clients add column if not exists contact_phone text;
