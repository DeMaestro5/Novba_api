# Contributing to Novba

## Branch Protection Rules

**Direct commits to `main` are blocked.**
All changes must go through a Pull Request.

## Workflow

### Starting new work

```bash
# Always start from latest main
git checkout main
git pull origin main

# Create your branch
git checkout -b feature/your-feature-name
```

### Branch naming

| Type | Pattern | Example |
|------|---------|---------|
| New feature | `feature/` | `feature/client-health-scores` |
| Bug fix | `fix/` | `fix/decimal-calculation` |
| Config/deps | `chore/` | `chore/update-prisma` |
| Urgent fix | `hotfix/` | `hotfix/payment-route-crash` |

### Commit messages

Follow this format:

```
type: short description of change
```

Examples:
```
feat: add AI pricing coach endpoint
fix: correct Number() wrapping on expense totals
chore: update Prisma to 5.x
refactor: extract dashboard into components
```

### Opening a Pull Request

1. Push your branch: `git push origin feature/your-branch`
2. Open PR on GitHub targeting `main`
3. CI runs automatically — wait for green checks
4. Request review from co-founder
5. Merge only after approval + CI passes
6. Delete branch after merge

### Never do this

```bash
git push origin main          # blocked
git push origin main --force  # blocked
git commit --no-verify        # bypasses hooks — don't
```

## Environment Variables

Never commit `.env` files.
All secrets go in GitHub repo Settings → Secrets and variables → Actions.

## Questions

Open a GitHub Discussion or message the team.
