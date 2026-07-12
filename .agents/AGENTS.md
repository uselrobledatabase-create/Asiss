# Deployment Rules

- The user's primary GitHub account (iag-lol) has exhausted GitHub Actions minutes.
- DO NOT rely on automatic GitHub Actions (deploy.yml) for deployments.
- Whenever you need to deploy the application, you MUST do it manually by running:
  `npm run build && cd dist && git init && git checkout -b gh-pages && git add . && git commit -m "Manual deploy" && gh auth switch --user iag-lol && git push -f https://github.com/iag-lol/Asiss.git gh-pages`
