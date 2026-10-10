// Grupo de WhatsApp da comunidade. O link fica numa variável de ambiente: enquanto ela não existir,
// nenhum convite aparece na plataforma nem é enviado por e-mail.
export const COMMUNITY_URL: string | null = process.env.NEXT_PUBLIC_WHATSAPP_GROUP_URL?.trim() || null;
