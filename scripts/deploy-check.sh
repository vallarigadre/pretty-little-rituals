#!/bin/bash
# Netlify runs this before every build to decide whether to deploy.
# Exit 1 = build and deploy. Exit 0 = skip (a skipped build costs no credits).
#
# Free plan: each live (production) deploy costs 15 credits, so the live site is only
# rebuilt when the latest commit message starts with one of these words:
#   Publish:  a new post goes live (also carries any photos, links or fixes saved since)
#   Links:    links swapped on live posts, when V asks for them right away
#   Site:     a design or settings change, or a new product page
# or contains [deploy]. Everything else (Draft:, Photos:, small edits, GitHub web
# uploads) waits and goes live with the next Publish.
# The "drafts" branch always builds: branch deploys are free and give the draft preview.

branch="${BRANCH:-$HEAD}"
if [ "$branch" != "main" ]; then
  echo "Branch '$branch': free branch deploy, building."
  exit 1
fi

msg="$(git log -1 --pretty=%s 2>/dev/null)"
case "$msg" in
  Publish:*|Links:*|Site:*|*"[deploy]"*)
    echo "Deploying: $msg"
    exit 1 ;;
esac
echo "Skipping this live deploy to save credits. It goes live with the next Publish: $msg"
exit 0
