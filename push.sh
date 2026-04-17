#!/bin/bash
cd "$(dirname "$0")"
git init
git add -A
git commit -m "initial commit - instagram bulk publisher"
git branch -M main
git remote add origin https://github.com/5amrath/instagram-publisher.git 2>/dev/null
git push -u origin main
echo ""
echo "Done! Code pushed to GitHub. Now go back to Netlify and deploy."
