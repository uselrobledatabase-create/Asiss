export type AsissEmailValue =
  | string
  | number
  | null
  | undefined
  | {
      html: string;
      text?: string;
    };

export type AsissEmailTone = 'status' | 'conflict';

export interface AsissEmailColumn {
  key: string;
  label: string;
  width?: number;
  tone?: AsissEmailTone;
}

export interface BuildAsissLogisticaEmailInput {
  title: string;
  subtitle?: string;
  unitOrTerminal: string;
  requestId?: string | number | null;
  registeredBy: string;
  audience: string;
  sentAt?: string | Date;
  columns: AsissEmailColumn[];
  rowData: Record<string, AsissEmailValue>;
  status: string;
  statusMessage?: string;
  actionUrl?: string | null;
  actionLabel?: string | null;
}

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const STATUS_MESSAGES: Record<string, string> = {
  PENDIENTE: 'Esta solicitud se encuentra pendiente de autorización. Revise los antecedentes antes de aprobar o rechazar.',
  AUTORIZADO: 'La solicitud fue aprobada y el registro fue actualizado correctamente.',
  APROBADO: 'La solicitud fue aprobada y el registro fue actualizado correctamente.',
  RECHAZADO: 'La solicitud fue rechazada. Revise el detalle y las observaciones registradas.',
  OBSERVADO: 'La solicitud fue observada. Revise las observaciones registradas antes de continuar.',
};

const INVALID_TEXT_VALUES = new Set(['undefined', 'null', 'nan', 'invalid date']);

const isHtmlValue = (value: AsissEmailValue): value is { html: string; text?: string } =>
  Boolean(value && typeof value === 'object' && 'html' in value);

const stripTags = (value: string) => value.replace(/<[^>]*>/g, ' ');

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const stripAccents = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const normalizeStatus = (value: string) => stripAccents(value).toUpperCase();

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const isValidText = (value: string) => {
  const text = normalizeWhitespace(stripTags(value));
  return Boolean(text) && !INVALID_TEXT_VALUES.has(text.toLowerCase());
};

export const hasAsissEmailValue = (value: AsissEmailValue): boolean => {
  if (value === null || value === undefined) return false;

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (isHtmlValue(value)) {
    return isValidText(value.text ?? value.html);
  }

  return isValidText(value);
};

const renderTextWithBreaks = (value: string) =>
  escapeHtml(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n/g, '<br>');

const renderValue = (value: AsissEmailValue) => {
  if (!hasAsissEmailValue(value)) return '';

  if (isHtmlValue(value)) {
    return value.html;
  }

  return renderTextWithBreaks(String(value));
};

const textValue = (value: AsissEmailValue) => {
  if (!hasAsissEmailValue(value)) return '';
  if (isHtmlValue(value)) return normalizeWhitespace(stripTags(value.text ?? value.html));
  return normalizeWhitespace(String(value));
};

const parseDateValue = (value: string | Date) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T12:00:00` : trimmed;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatEmailDate = (value?: string | Date | null) => {
  if (!value) return '';
  const date = parseDateValue(value);
  if (!date) return '';

  return date.toLocaleDateString('es-CL', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const formatEmailDateTime = (value?: string | Date | null) => {
  const date = value ? parseDateValue(value) : new Date();
  if (!date) return '';

  return date.toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getStatusMessage = (status: string, fallback?: string) => {
  if (fallback && isValidText(fallback)) return fallback;
  const normalized = normalizeStatus(status);

  if (normalized.includes('RECHAZ')) return STATUS_MESSAGES.RECHAZADO;
  if (normalized.includes('OBSERV')) return STATUS_MESSAGES.OBSERVADO;
  if (normalized.includes('AUTORIZ') || normalized.includes('APROB')) return STATUS_MESSAGES.APROBADO;
  return STATUS_MESSAGES.PENDIENTE;
};

const getToneStyle = (column: AsissEmailColumn, value: AsissEmailValue) => {
  const normalized = normalizeStatus(textValue(value));

  if (column.tone === 'conflict') {
    if (normalized.includes('SIN CONFLICT')) {
      return { background: '#f3fbf6', color: '#168448' };
    }

    if (normalized.includes('CONFLICT') || normalized.includes('ADVERTENCIA')) {
      return { background: '#fff1f1', color: '#c83232' };
    }
  }

  if (column.tone === 'status') {
    if (normalized.includes('RECHAZ')) {
      return { background: '#fff1f1', color: '#c83232' };
    }

    if (normalized.includes('OBSERV')) {
      return { background: '#fff6e8', color: '#b36400' };
    }

    if (normalized.includes('AUTORIZ') || normalized.includes('APROB')) {
      return { background: '#f3fbf6', color: '#168448' };
    }

    if (normalized.includes('PENDIENT')) {
      return { background: '#fff8e8', color: '#a84d00' };
    }
  }

  return { background: '#ffffff', color: '#1b2a43' };
};

const calculateWidths = (columns: AsissEmailColumn[]) => {
  if (!columns.length) return [];

  const baseWidths = columns.map((column) => column.width ?? 100 / columns.length);
  const total = baseWidths.reduce((sum, width) => sum + width, 0);
  return baseWidths.map((width) => `${((width / total) * 100).toFixed(2)}%`);
};

export const buildAsissLogisticaEmail = ({
  title,
  subtitle = 'Solicitud ingresada para revisión y autorización.',
  unitOrTerminal,
  requestId,
  registeredBy,
  audience,
  sentAt,
  columns,
  rowData,
  status,
  statusMessage,
  actionUrl,
  actionLabel = 'REVISAR SOLICITUD',
}: BuildAsissLogisticaEmailInput) => {
  const visibleColumns = columns.filter((column) => hasAsissEmailValue(rowData[column.key]));
  const widths = calculateWidths(visibleColumns);
  const safeStatusMessage = getStatusMessage(status, statusMessage);
  const safeSentAt = formatEmailDateTime(sentAt ?? new Date());
  const safeUnitOrTerminal = textValue(unitOrTerminal || 'ASISS').toUpperCase();
  const safeTitle = textValue(title);
  const safeRegisteredBy = textValue(registeredBy) || 'ASISS';
  const safeAudience = textValue(audience) || 'Revisión y autorización';
  const safeRequestId = hasAsissEmailValue(requestId) ? textValue(requestId) : '';
  const safeActionUrl = actionUrl && hasAsissEmailValue(actionUrl) ? String(actionUrl) : '';
  const safeActionLabel = textValue(actionLabel ?? 'REVISAR SOLICITUD') || 'REVISAR SOLICITUD';

  const headerCells = visibleColumns
    .map((column, index) => `
      <td width="${widths[index]}" align="center" valign="middle" style="background:#17385f;color:#ffffff;font-family:${FONT_STACK};font-size:9px;font-weight:800;letter-spacing:.45px;text-transform:uppercase;line-height:12px;padding:12px 8px;text-align:center;vertical-align:middle;border-right:${index === visibleColumns.length - 1 ? '0' : '1px solid #3e587d'};">
        ${renderTextWithBreaks(column.label.toUpperCase())}
      </td>
    `)
    .join('');

  const valueCells = visibleColumns
    .map((column, index) => {
      const tone = getToneStyle(column, rowData[column.key]);
      return `
        <td width="${widths[index]}" align="center" valign="middle" style="background:${tone.background};color:${tone.color};font-family:${FONT_STACK};font-size:12px;font-weight:800;line-height:16px;padding:16px 8px;text-align:center;vertical-align:middle;border-top:1px solid #d5e0ed;border-right:${index === visibleColumns.length - 1 ? '0' : '1px solid #d5e0ed'};">
          ${renderValue(rowData[column.key])}
        </td>
      `;
    })
    .join('');

  const actionButton = safeActionUrl
    ? `
      <tr>
        <td align="center" style="padding:18px 24px 24px 24px;text-align:center;">
          <a href="${escapeHtml(safeActionUrl)}" target="_blank" style="background:#1f5fe7;color:#ffffff;display:inline-block;font-family:${FONT_STACK};font-size:13px;font-weight:800;letter-spacing:.35px;text-decoration:none;text-transform:uppercase;padding:13px 28px;border-radius:6px;">
            ${renderTextWithBreaks(safeActionLabel.toUpperCase())}
          </a>
        </td>
      </tr>
    `
    : '';

  return `<!DOCTYPE html>
<!-- ASISS_LOGISTICA_EMAIL -->
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${renderTextWithBreaks(safeTitle)}</title>
</head>
<body style="margin:0;padding:0;background:#edf2f8;font-family:${FONT_STACK};color:#1b2a43;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#edf2f8;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:26px 24px 40px 24px;text-align:center;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 14px auto;border-collapse:collapse;">
          <tr>
            <td align="center" style="text-align:center;font-family:${FONT_STACK};">
              <span style="display:block;margin:0;color:#101d36;font-size:24px;font-weight:800;letter-spacing:-0.5px;line-height:26px;">ASISS</span>
              <span style="display:block;margin-top:2px;color:#59708f;font-size:10px;font-weight:700;letter-spacing:2px;line-height:12px;text-transform:uppercase;">LOGÍSTICA</span>
            </td>
          </tr>
        </table>

        <table role="presentation" width="1320" cellspacing="0" cellpadding="0" border="0" style="width:1320px;max-width:1320px;background:#ffffff;border:1px solid #d5e0ed;border-collapse:separate;border-spacing:0;box-shadow:0 4px 16px rgba(38,58,94,.07);">
          <tr>
            <td style="padding:0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#132f55;border-collapse:collapse;">
                <tr>
                  <td align="left" style="padding:11px 24px;text-align:left;color:#dce9fb;font-family:${FONT_STACK};font-size:10px;font-weight:800;letter-spacing:.85px;text-transform:uppercase;line-height:13px;">
                    ${renderTextWithBreaks(`${safeUnitOrTerminal} · NOTIFICACIÓN AUTOMÁTICA`)}
                  </td>
                  <td align="right" style="padding:11px 24px;text-align:right;color:#dce9fb;font-family:${FONT_STACK};font-size:10px;font-weight:800;letter-spacing:.85px;text-transform:uppercase;line-height:13px;">
                    ${safeRequestId ? `SOLICITUD N&deg; ${renderTextWithBreaks(safeRequestId)}` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="left" style="padding:24px 24px 18px 24px;text-align:left;font-family:${FONT_STACK};">
              <span style="display:block;margin:0;color:#13213a;font-size:26px;font-weight:800;letter-spacing:-0.55px;line-height:31px;">${renderTextWithBreaks(safeTitle.toUpperCase())}</span>
              <span style="display:block;margin-top:5px;color:#657792;font-size:13px;font-weight:600;line-height:18px;">${renderTextWithBreaks(subtitle)}</span>
            </td>
          </tr>

          <tr>
            <td style="padding:0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f7faff;border-top:1px solid #dce5f0;border-bottom:1px solid #dce5f0;border-collapse:collapse;">
                <tr>
                  <td width="33.33%" align="left" style="padding:12px 24px;text-align:left;border-right:1px solid #dce5f0;font-family:${FONT_STACK};">
                    <span style="display:block;color:#7285a1;font-size:9px;font-weight:800;letter-spacing:.65px;line-height:12px;text-transform:uppercase;">REGISTRADO POR</span>
                    <span style="display:block;margin-top:4px;color:#1e2f4b;font-size:13px;font-weight:800;line-height:17px;">${renderTextWithBreaks(safeRegisteredBy)}</span>
                  </td>
                  <td width="33.33%" align="left" style="padding:12px 24px;text-align:left;border-right:1px solid #dce5f0;font-family:${FONT_STACK};">
                    <span style="display:block;color:#7285a1;font-size:9px;font-weight:800;letter-spacing:.65px;line-height:12px;text-transform:uppercase;">AUDIENCIA</span>
                    <span style="display:block;margin-top:4px;color:#1e2f4b;font-size:13px;font-weight:800;line-height:17px;">${renderTextWithBreaks(safeAudience)}</span>
                  </td>
                  <td width="33.33%" align="left" style="padding:12px 24px;text-align:left;font-family:${FONT_STACK};">
                    <span style="display:block;color:#7285a1;font-size:9px;font-weight:800;letter-spacing:.65px;line-height:12px;text-transform:uppercase;">FECHA DE ENVÍO</span>
                    <span style="display:block;margin-top:4px;color:#1e2f4b;font-size:13px;font-weight:800;line-height:17px;">${renderTextWithBreaks(safeSentAt)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="left" style="padding:23px 24px 10px 24px;text-align:left;color:#132f55;font-family:${FONT_STACK};font-size:11px;font-weight:800;letter-spacing:.8px;line-height:14px;text-transform:uppercase;">
              RESUMEN COMPLETO DE LA SOLICITUD
            </td>
          </tr>

          <tr>
            <td style="padding:0 24px 0 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border:1px solid #3e587d;border-collapse:collapse;">
                <tr>${headerCells}</tr>
                <tr>${valueCells}</tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 24px 0 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f4f8fe;border:1px solid #dce5f0;border-left:4px solid #1f5fe7;border-collapse:collapse;">
                <tr>
                  <td align="left" style="padding:13px 16px;text-align:left;color:#4f6481;font-family:${FONT_STACK};font-size:12px;font-weight:600;line-height:18px;">
                    ${renderTextWithBreaks(safeStatusMessage)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${actionButton}

          <tr>
            <td align="center" style="padding:16px 24px;text-align:center;border-top:1px solid #dce5f0;color:#7a8ba5;font-family:${FONT_STACK};font-size:10px;font-weight:600;line-height:14px;">
              Notificación automática &middot; Sistema ASISS Logística
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
