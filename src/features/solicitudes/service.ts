
import { createMockListAdapter } from '../../mock/createMockListAdapter';
import { SolicitudFilters, SolicitudViewModel } from './types';

const MOCK_SOLICITUDES: SolicitudViewModel[] = [
  {
    id: 's-1',
    solicitante: 'Ana Pérez',
    tipo: 'Materiales',
    fecha: '2023-12-04',
    estado: 'abierta',
    terminal: 'EL_ROBLE',
    reviewed: false
  },
  {
    id: 's-2',
    solicitante: 'Carlos Vega',
    tipo: 'Grabación',
    fecha: '2023-12-03',
    estado: 'listo',
    terminal: 'LA_REINA',
    video_url: 'https://example.com/video1.mp4',
    ppu: 'LXWP78',
    reviewed: false
  },
  {
    id: 's-3',
    solicitante: 'Laura Soto',
    tipo: 'Tecnología',
    fecha: '2023-12-02',
    estado: 'cerrada',
    terminal: 'EL_SALTO',
    reviewed: true
  },
  {
    id: 's-4',
    solicitante: 'Pedro Diaz',
    tipo: 'Grabación',
    fecha: '2023-12-05',
    estado: 'listo',
    terminal: 'EL_ROBLE',
    video_url: 'https://example.com/video2.mp4',
    ppu: 'ABCD-12',
    reviewed: false
  },
];

export const solicitudesAdapter = createMockListAdapter<SolicitudViewModel, SolicitudFilters>(
  MOCK_SOLICITUDES,
  (row, filters) => {
    const matchEstado = filters?.estado && filters.estado !== 'todas' ? row.estado === filters.estado : true;
    return matchEstado;
  },
);
