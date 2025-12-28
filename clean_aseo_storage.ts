/**
 * Script para eliminar todas las imágenes del bucket aseo-photos
 * Ejecutar con: npx tsx clean_aseo_storage.ts
 */

import { createClient } from '@supabase/supabase-js';

// Configurar Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY requeridas');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanAseoStorage() {
    console.log('🧹 Iniciando limpieza de storage aseo-photos...\n');

    try {
        // 1. Listar todos los archivos en el bucket
        console.log('📋 Listando archivos...');
        const { data: files, error: listError } = await supabase.storage
            .from('aseo-photos')
            .list('', {
                limit: 1000,
                sortBy: { column: 'created_at', order: 'desc' }
            });

        if (listError) {
            console.error('❌ Error al listar archivos:', listError);
            return;
        }

        if (!files || files.length === 0) {
            console.log('✅ No hay archivos para eliminar');
            return;
        }

        console.log(`📁 Encontrados ${files.length} archivos\n`);

        // 2. Eliminar todos los archivos
        const filePaths = files.map(file => file.name);

        console.log('🗑️  Eliminando archivos...');
        const { data: deleteData, error: deleteError } = await supabase.storage
            .from('aseo-photos')
            .remove(filePaths);

        if (deleteError) {
            console.error('❌ Error al eliminar archivos:', deleteError);
            return;
        }

        console.log(`✅ ${filePaths.length} archivos eliminados exitosamente\n`);

        // 3. Verificar que el bucket está vacío
        const { data: remainingFiles } = await supabase.storage
            .from('aseo-photos')
            .list();

        console.log(`📊 Archivos restantes: ${remainingFiles?.length || 0}`);

        if (remainingFiles && remainingFiles.length > 0) {
            console.warn('⚠️  Advertencia: Aún quedan archivos en el bucket');
        } else {
            console.log('✅ Bucket completamente limpio');
        }

    } catch (error) {
        console.error('❌ Error inesperado:', error);
    }
}

// Ejecutar
cleanAseoStorage()
    .then(() => {
        console.log('\n✅ Proceso completado');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Error fatal:', error);
        process.exit(1);
    });
