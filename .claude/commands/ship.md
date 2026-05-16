Create a new git branch for the current changes, commit everything, and push to remote.

## Steps

1. Run `git status` and `git diff` to understand what has changed.
2. Run `git log --oneline -5` to see recent commit style.
3. Based on the changes, suggest a short kebab-case branch name (e.g. `feat/seo-meta-updates`, `fix/navbar-overflow`, `chore/update-deps`). If the user provided a name in their message, use that instead.
4. Confirm the branch name with the user before proceeding.
5. Once confirmed:
   - Run `git checkout -b <branch-name>`
   - Stage all modified/new files relevant to the changes (prefer specific files over `git add .`)
   - Commit with a clear message following the repo's commit style. 
   - Run `git push -u origin <branch-name>`
6. Report the branch name and confirm the push succeeded.
