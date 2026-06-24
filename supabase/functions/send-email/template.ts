interface EmailTemplateInput {
  subject: string;
  body: string;
  audience: string;
  terminalCodes?: string[];
  brandUrl?: string;
  accentColor?: string;
  module?: 'asistencia' | 'credenciales' | 'informativos' | 'minicheck';
}

// SVG Icons as inline base64 or direct SVG
const ICONS = {
  logo: `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="12" fill="url(#gradient1)"/>
    <path d="M24 12L32 28H16L24 12Z" fill="white" opacity="0.9"/>
    <path d="M24 20L28 28H20L24 20Z" fill="white"/>
    <circle cx="24" cy="32" r="4" fill="white"/>
    <defs>
      <linearGradient id="gradient1" x1="0" y1="0" x2="48" y2="48">
        <stop offset="0%" stop-color="#3b82f6"/>
        <stop offset="100%" stop-color="#1d4ed8"/>
      </linearGradient>
    </defs>
  </svg>`,
  check: `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="30" fill="#dcfce7" stroke="#22c55e" stroke-width="3"/>
    <path d="M20 32L28 40L44 24" stroke="#16a34a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  x: `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="30" fill="#fee2e2" stroke="#ef4444" stroke-width="3"/>
    <path d="M22 22L42 42M42 22L22 42" stroke="#dc2626" stroke-width="4" stroke-linecap="round"/>
  </svg>`,
  clock: `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="30" fill="#fef3c7" stroke="#f59e0b" stroke-width="3"/>
    <circle cx="32" cy="32" r="4" fill="#d97706"/>
    <path d="M32 18V32L42 38" stroke="#d97706" stroke-width="3" stroke-linecap="round"/>
  </svg>`,
  building: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 18V4C3 3.44772 3.44772 3 4 3H10C10.5523 3 11 3.44772 11 4V18" stroke="#64748b" stroke-width="1.5"/>
    <path d="M11 8H15C15.5523 8 16 8.44772 16 9V18" stroke="#64748b" stroke-width="1.5"/>
    <path d="M6 7H8M6 10H8M6 13H8M13 11H14M13 14H14" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M1 18H18" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  calendar: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="4" width="16" height="14" rx="2" stroke="#64748b" stroke-width="1.5"/>
    <path d="M2 8H18" stroke="#64748b" stroke-width="1.5"/>
    <path d="M6 2V5M14 2V5" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  user: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="6" r="4" stroke="#64748b" stroke-width="1.5"/>
    <path d="M3 18C3 14.134 6.13401 11 10 11C13.866 11 17 14.134 17 18" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  id: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="4" width="16" height="12" rx="2" stroke="#64748b" stroke-width="1.5"/>
    <circle cx="7" cy="9" r="2" stroke="#64748b" stroke-width="1.5"/>
    <path d="M4 14C4 12.3431 5.34315 11 7 11C8.65685 11 10 12.3431 10 14" stroke="#64748b" stroke-width="1.5"/>
    <path d="M12 8H16M12 11H15" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  mail: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="4" width="16" height="12" rx="2" stroke="#64748b" stroke-width="1.5"/>
    <path d="M2 6L10 11L18 6" stroke="#64748b" stroke-width="1.5"/>
  </svg>`,
  arrow: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
};

export const renderEmailTemplate = ({
  subject,
  body,
  audience,
  terminalCodes,
  brandUrl = 'https://iag-lol.github.io/Asiss',
  accentColor = '#2563eb',
  module = 'asistencia',
}: EmailTemplateInput) => {
  const trimmedBody = body.trim();
  if (/^<!doctype html/i.test(trimmedBody) || trimmedBody.includes('ASISS_LOGISTICA_EMAIL')) {
    return trimmedBody;
  }

  const terminals = terminalCodes?.length ? terminalCodes.join(', ') : 'Todos';
  const year = new Date().getFullYear();
  const dateTime = new Date().toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    dateStyle: 'full',
    timeStyle: 'short'
  });

  // All emails use the same sender name - subject contains the specific context
  const config = {
    name: 'US El Roble - Notificaciones Logística',
    color: '#2563eb'
  };

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${subject}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  
  <!-- Wrapper Table -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; width: 100%;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        
        <!-- Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; margin: 0 auto;">
          
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding-right: 12px; vertical-align: middle;">
                    ${ICONS.logo}
                  </td>
                  <td style="vertical-align: middle;">
                    <span style="color: #0f172a; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; display: block;">ASISS</span>
                    <span style="color: #64748b; font-size: 10px; letter-spacing: 2px; font-weight: 700; text-transform: uppercase; display: block; margin-top: 2px;">LOGÍSTICA</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                
                <!-- Top Accent Line -->
                <tr>
                  <td style="height: 6px; background: linear-gradient(90deg, ${accentColor} 0%, #1d4ed8 100%);"></td>
                </tr>

                <!-- Card Header -->
                <tr>
                  <td style="padding: 32px 32px 0 32px; text-align: center;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td align="center">
                          <span style="display: inline-block; padding: 6px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 100px; color: #64748b; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">${config.name}</span>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding-top: 16px;">
                          <h1 style="margin: 0; color: #0f172a; font-size: 24px; font-weight: 800; line-height: 1.3; letter-spacing: -0.5px;">${subject}</h1>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Card Body -->
                <tr>
                  <td style="padding: 24px 32px 40px 32px;">
                    
                    <!-- Dynamic Body Content -->
                    <div style="color: #334155; font-size: 15px; line-height: 1.6;">
                      ${body}
                    </div>
                    
                    <!-- Info Cards -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 24px;">
                      <tr>
                        <td width="50%" style="padding-right: 8px; vertical-align: top;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="padding-right: 8px; vertical-align: top; padding-top: 2px;">
                                ${ICONS.building}
                              </td>
                              <td>
                                <span style="display: block; font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Terminales</span>
                                <span style="display: block; font-size: 13px; font-weight: 600; color: #334155;">${terminals}</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td width="50%" style="padding-left: 8px; vertical-align: top;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="padding-right: 8px; vertical-align: top; padding-top: 2px;">
                                ${ICONS.mail}
                              </td>
                              <td>
                                <span style="display: block; font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Audiencia</span>
                                <span style="display: block; font-size: 13px; font-weight: 600; color: #334155;">${audience === 'manual' ? 'Directo' : audience === 'todos' ? 'General' : 'Por Terminal'}</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    

                    
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 32px;">
              <p style="margin: 0 0 8px 0; color: #94a3b8; font-size: 12px;">${dateTime}</p>
              <p style="margin: 0; color: #cbd5e1; font-size: 11px;">© ${year} ASISS · Sistema ASISS Logística</p>
            </td>
          </tr>
          
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>`;
};
