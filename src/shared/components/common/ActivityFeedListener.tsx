/**
 * Escucha el feed de actividad en línea y muestra las acciones de los
 * demás usuarios conectados como notificaciones en tiempo real,
 * en cualquier sección del dashboard.
 */

import { useEffect } from 'react';
import { onActivity } from '../../services/activityFeed';
import { useToastStore } from '../../state/toastStore';
import { useSessionStore } from '../../state/sessionStore';

export const ActivityFeedListener = () => {
    const supervisorName = useSessionStore((s) => s.session?.supervisorName);

    useEffect(() => {
        const unsubscribe = onActivity((ev) => {
            // Redundante con broadcast self:false, pero por si hay
            // dos sesiones con el mismo nombre en distintos equipos
            if (supervisorName && ev.actor === supervisorName) return;

            useToastStore.getState().addToast({
                type: 'info',
                title: `En línea · ${ev.seccion}`,
                message: `${ev.accion} ${ev.objetivo}${ev.detalle ? ` — ${ev.detalle}` : ''}`,
                createdBy: ev.actor,
                duration: 8000,
            });
        });
        return unsubscribe;
    }, [supervisorName]);

    return null;
};
