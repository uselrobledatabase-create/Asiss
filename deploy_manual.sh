#!/bin/bash
echo "🚀 Iniciando despliegue manual..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Error en la compilación. Abortando."
    exit 1
fi
cd dist
git init
git checkout -b gh-pages
git add .
git commit -m "Manual deploy bypassing actions"
gh auth switch --user iag-lol
git push -f https://github.com/iag-lol/Asiss.git gh-pages
echo "✅ ¡Despliegue completado! Tu web se actualizará en asiss.online pronto."
