"""
Atualiza o campo 'observacoes' das ordens_servico no Supabase
com as descrições completas vindas do CSV do VHSYS (ordensservico.csv).

Uso: python atualizar_descricoes_os.py [SERVICE_ROLE_KEY]
"""

import sys, os, csv

SUPABASE_URL = "https://vebswpvfgqoikgfpejtu.supabase.co"

SERVICE_ROLE_KEY = None
if len(sys.argv) > 1:
    SERVICE_ROLE_KEY = sys.argv[1]
elif os.environ.get("SUPABASE_SERVICE_KEY"):
    SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
else:
    print("Cole a SERVICE ROLE KEY do Supabase (Settings > API):")
    SERVICE_ROLE_KEY = input().strip()

from supabase import create_client
sb = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)

CSV_PATH = (
    "C:/Users/User/OneDrive - Grupo Marista/Desktop/DevSamurai/"
    "sistema-gestão/databases/backup_329321_21072026122058/"
    "servicos/ordensservico.csv"
)

# ── Lê o CSV ──────────────────────────────────────────────────────────────────
print("Lendo CSV...")
with open(CSV_PATH, encoding="utf-8-sig", errors="replace") as f:
    reader = csv.DictReader(f, delimiter=";")
    rows = list(reader)

print(f"  {len(rows)} OS encontradas no CSV")

# ── Filtra apenas as que têm Observacoes preenchidas ──────────────────────────
com_desc = [
    r for r in rows
    if r.get("Observacoes", "").strip()
]
print(f"  {len(com_desc)} OS com descrição preenchida")

# ── Busca todos os numero_os existentes no banco ─────────────────────────────
print("Buscando OS no banco...")
res = sb.table("ordens_servico").select("id, numero_os").range(0, 9999).execute()
banco = {str(r["numero_os"]).strip(): r["id"] for r in res.data}
print(f"  {len(banco)} OS no banco")

# ── Atualiza uma por uma ──────────────────────────────────────────────────────
atualizadas = 0
nao_encontradas = 0

for row in com_desc:
    num = str(row.get("Ordem", "")).strip()
    obs = row.get("Observacoes", "").strip()

    if not num or not obs:
        continue

    os_id = banco.get(num)
    if not os_id:
        nao_encontradas += 1
        continue

    sb.table("ordens_servico").update({"observacoes": obs}).eq("id", os_id).execute()
    atualizadas += 1
    if atualizadas % 100 == 0:
        print(f"  {atualizadas} atualizadas...")

print(f"\n✅ Concluído!")
print(f"   Atualizadas:     {atualizadas}")
print(f"   Não encontradas: {nao_encontradas} (OS do VHSYS sem correspondência no banco)")
