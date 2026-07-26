# Prompt Antigravity — P00: crear el punto de restauración (ANTES de todo)

> **Orden:** este prompt va **primero**, solo. Cuando Antigravity reporte el hash del commit y el tag, recién ahí seguís con `PROMPT_ANTIGRAVITY_CIERRE_PLANOS.md` (P0 → P3).
>
> **Auditado el 2026-07-26 contra el repo real.** Chequeos ya hechos por mí, no hace falta que los repitas:
> - `server/.env`, `client/.env`, `client_secret_*.json` y `recovery-codes-VERCEL.txt` → **los cuatro están gitignored**. `git add -A` no filtra secretos.
> - `git user.name` / `user.email` → configurados (Eduardo Ventura).
> - Último commit: `01b4fe8`. Sin commitear: **42 archivos, ~1.700 líneas**.
> - `_plan_review/` (4,3 MB, 105 PNG/SVG temporales) **no debe entrar al commit**.

---

## P00 — Commit de seguridad

```
You are a Senior Engineer with git access to the Orbin AI repository.

MISSION: create a restore point. Commit the current working tree and tag it.
That is ALL. You are not fixing, refactoring, or improving anything in this task.

CONTEXT: the working tree holds ~1,700 uncommitted lines from a drawing/parser
session, and several test files that protect that work are still UNTRACKED. There
is currently no restore point. Until this commit exists, any destructive git
operation loses the work permanently.

=== ABSOLUTELY FORBIDDEN IN THIS TASK ===
Do not run, under any circumstance:
  git clean          git checkout -- / git restore
  git reset --hard   git stash        git rm
  git push           git rebase       git merge        git branch -D
  Any file deletion or edit of any kind.
You may ONLY run: git status, git diff, git log, git check-ignore, git ls-files,
git add, git commit, git tag, git rev-parse, git show.
If you believe a forbidden command is needed, STOP and report instead.

=== STEPS ===

STEP 1 — Inspect, change nothing. Run and show me the output:
    git status --porcelain
    git log --oneline -1
Confirm the last commit is 01b4fe8. If it is NOT, STOP and report — the repo is
not in the state I expect.

STEP 2 — Secret safety gate. Run:
    git check-ignore -v server/.env client/.env recovery-codes-VERCEL.txt
    git status --porcelain | grep '^??'
All four secret files must report as ignored. Additionally, scan the untracked
list for anything that looks like a credential (*.env*, *secret*, *credential*,
*token*, *.pem, *.key, recovery*). If ANY such file would be added, STOP and
report it. Do not commit.

STEP 3 — Exclude the scratch folder. `_plan_review/` is 4.3 MB of temporary
rendered PNG/SVG audit output. It must NOT be committed.
Append to .gitignore (create the file if absent; do not reorder or remove any
existing line):

    # Scratch: rendered plan audits (temporary, regenerable)
    _plan_review/

Then verify with: git check-ignore -v _plan_review

STEP 4 — Stage everything else and SHOW ME THE LIST BEFORE COMMITTING:
    git add -A
    git status --porcelain
Expected to include, among others, these files that must NOT be missed — they are
the test safety net and a new shared constants module:
    server/src/engine/mountHeight.test.js
    server/src/engine/aereo.test.js
    server/src/engine/drawerPrivacy.test.js
    server/src/engine/nlParser.test.js
    server/src/routes/hitlPreview.test.js
    server/src/routes/ttlStore.test.js
    client/src/engine/domainConstants.js
    client/src/engine/elevationModel.js
If any of those is missing from the staged list, STOP and report.
Confirm no .env and no _plan_review/ file is staged.

STEP 5 — Commit with exactly this message:

    feat(planos): conjunto reacotado, aereo colgado y escala real en papel

    - Vista de conjunto: dueno unico del etiquetado (dims:false), piso anclado,
      cotas sin colisiones, ID legible.
    - Aereo colgado a su altura de instalacion, con cota desde el piso.
    - mountHeight cableado motor -> paramContract -> nlParser/offlineParser -> UI/3D;
      sentinela null, red de clamps y extraccion preposicional (ES/PT/EN).
    - Plano de montaje: escala REAL en papel (1:2 -> 1:10), sin distorsion del PNG
      en A4 (estiramiento horizontal 4.66% eliminado), leyenda contextual,
      observaciones con wrap, planta rotulada segun topologia.
    - i18n: normLang unica, elimina hojas en idioma mezclado.
    - Candados: mountHeight.test.js + suite engine/ai en 149 pass / 0 fail.

STEP 6 — Tag and report:
    git tag pre-antigravity-cierre
    git rev-parse HEAD
    git log --oneline -1
    git status --porcelain          # must now be clean or near-clean

DO NOT PUSH. Report the commit hash, the tag name, and the final `git status`.
Then stop and wait for my next prompt.
```

---

## Verificación tuya (10 segundos, después de que reporte)

```bash
git log --oneline -1          # debe mostrar el commit nuevo
git tag | grep pre-antigravity-cierre
git status --short            # limpio (o solo _plan_review si no lo ignoró)
git show --stat HEAD | tail -5
```

Si algo no cuadra, el rollback ahora **sí** existe:

```bash
git reset --hard pre-antigravity-cierre
```

---

## Nota honesta sobre delegar esto

Delegar el commit es la tarea donde el agente aporta menos y arriesga más: son cinco comandos, y el error que querés evitar (un `clean` o un `reset --hard`) ocurriría justo **antes** de que exista la red que lo repara. Por eso el prompt es casi todo prohibiciones y verificaciones, no acción.

Si preferís hacerlo vos, son estas cuatro líneas y terminás en 30 segundos:

```bash
cd Orbin
printf '\n# Scratch: rendered plan audits (temporary, regenerable)\n_plan_review/\n' >> .gitignore
git add -A && git commit -m "feat(planos): conjunto reacotado, aereo colgado y escala real en papel"
git tag pre-antigravity-cierre && git rev-parse HEAD
```
