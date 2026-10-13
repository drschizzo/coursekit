# La skill `/generate_course`

[`generate_course/SKILL.md`](generate_course/SKILL.md) indique à Claude comment produire un cours
coursekit complet à partir d’un sujet : cadrer, analyser le sujet et ses idées fausses, écrire
et **régler** un modèle exécutable, dessiner les schémas et la scène, écrire le contenu selon les
règles de rédaction, vérifier (`tune`, `check`, `/?shots`, visite dans le navigateur) et livrer.

## Installer

Dans Claude Code, une skill est un dossier contenant un `SKILL.md`. Pour l’utilisateur :

```bash
mkdir -p ~/.claude/skills
cp -R skill/generate_course ~/.claude/skills/
```

Ou pour un projet seulement : copier le dossier dans `.claude/skills/` du projet.

## Utiliser

Ouvrir une session Claude Code dans le dépôt coursekit (ou dans un projet qui l’utilise, voir
[docs/diffusion.md](../docs/diffusion.md)), puis :

```
/generate_course comment fonctionne une fusée
```

La skill crée `courses/<id>`, règle le modèle, écrit le cours, le vérifie jusqu’à
« ✓ prêt (0 remarque) », le relit dans le navigateur et livre un compte rendu.
