import { EmailPayload, EmailService } from '../types/email';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const EMAIL_API_URL = import.meta.env.VITE_EMAIL_API_URL ?? (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/send-email` : '/functions/v1/send-email');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const emailService: EmailService = {
  sendEmail: async (payload: EmailPayload) => {
    const response = await fetch(EMAIL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Email send failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return { accepted: data.accepted ?? true, messageId: data.messageId ?? 'pending' };
  },
};
