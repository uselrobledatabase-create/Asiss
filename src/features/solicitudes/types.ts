
import { TerminalCode } from '../../shared/types/terminal';

export type SolicitudEstado = 'abierta' | 'en_proceso' | 'cerrada' | 'listo';

export interface SolicitudViewModel {
  id: string;
  solicitante: string;
  tipo: string;
  fecha: string;
  estado: SolicitudEstado;
  terminal: TerminalCode;
  video_url?: string; // Optional link to the video
  ppu?: string;      // Optional license plate (Patente)
  reviewed?: boolean; // Track if the request has been reviewed/processed by the user
}

export interface SolicitudFilters {
  estado?: SolicitudEstado | 'todas';
}
