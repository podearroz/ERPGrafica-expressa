"""
Aplica os dados extraídos diretamente no Supabase via Python.
Usa supabase-py com service role key para bypass de RLS.

Uso: python apply_vhsys.py [SERVICE_ROLE_KEY]
Se não passar a key, lê do .env ou pede no input.
"""

import sys
import os
import time

# ── Credenciais ───────────────────────────────────────────────────────────────
SUPABASE_URL = "https://vebswpvfgqoikgfpejtu.supabase.co"

# Tenta obter a service role key
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

# ── Importa a extração ────────────────────────────────────────────────────────
BASE = 'C:/Users/User/OneDrive - Grupo Marista/Desktop/DevSamurai/sistema-gestão/databases/'

# Reutiliza o extractor do import_vhsys.py
sys.path.insert(0, BASE)
from import_vhsys import extract_orders, PDF_FILES, STATUS_MAP

BATCH_OS = 100   # OS por batch de INSERT

def run():
    print("Extraindo OS dos PDFs...", flush=True)
    all_orders = []
    for pdf in PDF_FILES:
        print(f"  Lendo {pdf.split('/')[-1]}...", flush=True)
        orders = extract_orders(pdf)
        print(f"  -> {len(orders)} OS", flush=True)
        all_orders.extend(orders)

    # Deduplica
    seen = set()
    unique = []
    for o in all_orders:
        if o['numero_os'] not in seen:
            seen.add(o['numero_os'])
            unique.append(o)

    print(f"\nTotal: {len(unique)} OS com {sum(len(o['itens']) for o in unique)} itens", flush=True)

    # Limpa importações anteriores em lotes (evita statement timeout)
    print("\nLimpando importações anteriores...", flush=True)
    for tabela in ("itens_os", "ordens_servico"):
        while True:
            resp = sb.table(tabela).select("id").eq("fonte", "VHSYS").limit(500).execute()
            ids = [r["id"] for r in (resp.data or [])]
            if not ids:
                break
            sb.table(tabela).delete().in_("id", ids).execute()
            print(f"  {tabela}: deletados {len(ids)}", flush=True)
            time.sleep(0.1)
    print("Limpeza OK", flush=True)

    # Insere OS em batches
    print(f"\nInserindo {len(unique)} OS em batches de {BATCH_OS}...", flush=True)
    erros_os = 0
    for i in range(0, len(unique), BATCH_OS):
        batch = unique[i:i+BATCH_OS]
        rows = []
        for o in batch:
            rows.append({
                "numero_os":    o["numero_os"],
                "cliente_nome": (o["cliente_nome"] or "")[:200],
                "data_abertura": o["data"],
                "status":       o["status"],
                "valor_total":  o["valor"],
                "desconto":     0,
                "valor_final":  o["valor"],
                "observacoes":  "Importado do VHSYS",
                "fonte":        "VHSYS",
            })
        try:
            sb.table("ordens_servico").insert(rows).execute()
            print(f"  OS {i+1}-{i+len(batch)} OK", flush=True)
        except Exception as e:
            erros_os += 1
            print(f"  ERRO batch OS {i+1}-{i+len(batch)}: {e}", flush=True)
        time.sleep(0.2)

    if erros_os > 0:
        print(f"\nAVISO: {erros_os} batches de OS com erro. Verifique acima.", flush=True)

    # Busca os IDs inseridos (por numero_os) para inserir os itens — pagina de 1000 em 1000
    print("\nBuscando IDs das OS inseridas...", flush=True)
    id_map = {}
    offset = 0
    PAGE = 1000
    while True:
        resp = sb.table("ordens_servico").select("id,numero_os").eq("fonte", "VHSYS").range(offset, offset + PAGE - 1).execute()
        batch_data = resp.data or []
        for r in batch_data:
            id_map[r["numero_os"]] = r["id"]
        if len(batch_data) < PAGE:
            break
        offset += PAGE
    print(f"  {len(id_map)} OS encontradas no banco", flush=True)

    # Insere itens
    all_items = []
    for o in unique:
        os_id = id_map.get(o["numero_os"])
        if not os_id:
            continue
        for item in o["itens"]:
            all_items.append({
                "os_id":          os_id,
                "descricao":      (item["descricao"] or "")[:300],
                "quantidade":     int(float(item["quantidade"])),
                "valor_unitario": item["valor_unitario"],
                "valor_total":    item["valor_total"],
                "estoque_baixado": False,
                "fonte":          "VHSYS",
            })

    print(f"\nInserindo {len(all_items)} itens em batches de 500...", flush=True)
    erros_it = 0
    BATCH_IT = 500
    for i in range(0, len(all_items), BATCH_IT):
        batch = all_items[i:i+BATCH_IT]
        try:
            sb.table("itens_os").insert(batch).execute()
            print(f"  Itens {i+1}-{i+len(batch)} OK", flush=True)
        except Exception as e:
            erros_it += 1
            print(f"  ERRO batch itens {i+1}-{i+len(batch)}: {e}", flush=True)
        time.sleep(0.2)

    # Resumo final
    res = sb.table("ordens_servico").select("id", count="exact").eq("fonte", "VHSYS").execute()
    res_it = sb.table("itens_os").select("id", count="exact").eq("fonte", "VHSYS").execute()
    print(f"\n=== IMPORTACAO CONCLUIDA ===", flush=True)
    print(f"  OS inseridas: {res.count}", flush=True)
    print(f"  Itens inseridos: {res_it.count}", flush=True)
    if erros_os or erros_it:
        print(f"  Erros OS: {erros_os} | Erros itens: {erros_it}", flush=True)

if __name__ == "__main__":
    run()
