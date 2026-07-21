"""
Importa CSVs do backup VHSYS para o Supabase.
- Clientes:   dedup por cpf_cnpj (só insere quem não existe)
- OS:         dedup por numero_os (só insere quem não existe)
- Recebimentos: insere todos com fonte='VHSYS' (seguro re-rodar: limpa antes)
- Pagamentos:   insere todos com fonte='VHSYS' (seguro re-rodar: limpa antes)

Uso: python importar_csvs.py [SERVICE_ROLE_KEY]
"""

import sys, os, csv, re, time
from datetime import datetime

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

BASE = "C:/Users/User/OneDrive - Grupo Marista/Desktop/DevSamurai/sistema-gestão/databases/backup_329321_21072026122058/"

# ── Helpers ───────────────────────────────────────────────────────────────────

def ler_csv(path):
    with open(path, encoding="utf-8-sig", errors="replace") as f:
        reader = csv.DictReader(f, delimiter=";")
        return list(reader)

def normalizar_cpf(v):
    return re.sub(r"\D", "", v or "")

def parse_valor(v):
    if not v or not v.strip():
        return 0.0
    v = v.strip().replace(".", "").replace(",", ".")
    try:
        return float(v)
    except:
        return 0.0

def parse_data(v):
    if not v or v.strip() in ("", "0000-00-00"):
        return None
    v = v.strip()
    # Formato dd/mm/yyyy
    if "/" in v:
        try:
            return datetime.strptime(v, "%d/%m/%Y").date().isoformat()
        except:
            return None
    # Formato yyyy-mm-dd
    if len(v) >= 10:
        return v[:10]
    return None

def inserir_em_lotes(tabela, rows, lote=500, delay=0.15):
    erros = 0
    for i in range(0, len(rows), lote):
        batch = rows[i:i+lote]
        try:
            sb.table(tabela).insert(batch).execute()
            print(f"  {tabela}: {i+1}–{i+len(batch)} OK", flush=True)
        except Exception as e:
            erros += 1
            print(f"  ERRO {tabela} {i+1}–{i+len(batch)}: {e}", flush=True)
        time.sleep(delay)
    return erros

STATUS_OS = {
    "Atendido": "FATURADA_SEM_NF",
    "Atendida": "FATURADA_SEM_NF",
    "Cancelado": "CANCELADA",
    "Cancelada": "CANCELADA",
    "Pendente": "ABERTA",
    "Em Andamento": "ABERTA",
    "Em andamento": "ABERTA",
    "Andamento": "ABERTA",
    "Aguardando": "ABERTA",
}

CONTA_MAP = {
    "CAIXA": "CAIXA",
    "SICOOB": "SICOOB",
    "MAQUININHA": "MAQUININHA",
}

def mapear_conta(v):
    v = (v or "").upper().strip()
    for k in CONTA_MAP:
        if k in v:
            return CONTA_MAP[k]
    return "SICOOB"  # padrão

def mapear_status_rec(v):
    v = (v or "").strip()
    if v in ("Pago", "Recebido"):
        return "Recebido"
    return "Não Pago"

def mapear_status_pag(v):
    v = (v or "").strip()
    if v == "Pago":
        return "Pago"
    return "Pendente"

# ── 1. CLIENTES ───────────────────────────────────────────────────────────────

def importar_clientes():
    print("\n── CLIENTES ──────────────────────────────────────────────────────", flush=True)
    rows_csv = ler_csv(BASE + "cadastros/clientes.csv")
    print(f"CSV: {len(rows_csv)} registros", flush=True)

    # Busca CPFs já existentes no banco (paginado)
    existentes = set()
    offset = 0
    while True:
        r = sb.table("clientes").select("cpf_cnpj").range(offset, offset+999).execute()
        for c in (r.data or []):
            existentes.add(normalizar_cpf(c["cpf_cnpj"]))
        if len(r.data or []) < 1000:
            break
        offset += 1000
    print(f"Já no banco: {len(existentes)} clientes (por CPF/CNPJ)", flush=True)

    novos = []
    for row in rows_csv:
        cpf = normalizar_cpf(row.get("CNPJ/CPF", ""))
        if not cpf or cpf in existentes:
            continue
        existentes.add(cpf)

        nome = (row.get("Razao Social/Nome") or "").strip()
        if not nome:
            continue

        telefone = (row.get("Telefone") or row.get("Celular") or "").strip()[:30]
        novos.append({
            "nome":             nome[:200],
            "nome_fantasia":    (row.get("Fantasia") or "").strip()[:200] or None,
            "cpf_cnpj":         row.get("CNPJ/CPF", "").strip()[:30],
            "telefone":         telefone or None,
            "email":            (row.get("E-mail") or "").strip()[:200] or None,
            "logradouro":       (row.get("Endereco") or "").strip()[:200] or None,
            "numero":           str(row.get("Numero") or "").strip()[:20] or None,
            "complemento":      (row.get("Complemento") or "").strip()[:100] or None,
            "bairro":           (row.get("Bairro") or "").strip()[:100] or None,
            "municipio":        (row.get("Cidade") or "").strip()[:100] or None,
            "uf":               (row.get("UF") or "").strip()[:2] or None,
            "cep":              (row.get("CEP") or "").strip()[:10] or None,
            "codigo_municipio": (row.get("Codigo IBGE/Cidade") or "").strip()[:20] or None,
            "inscricao_estadual": (row.get("Inscricao Estadual/RG") or "").strip()[:50] or None,
        })

    print(f"Novos a inserir: {len(novos)}", flush=True)
    if not novos:
        print("Nenhum cliente novo. Pulando.", flush=True)
        return 0
    return inserir_em_lotes("clientes", novos)

# ── 2. ORDENS DE SERVIÇO ──────────────────────────────────────────────────────

def importar_os():
    print("\n── ORDENS DE SERVIÇO ─────────────────────────────────────────────", flush=True)
    rows_csv = ler_csv(BASE + "servicos/ordensservico.csv")
    print(f"CSV: {len(rows_csv)} registros", flush=True)

    # Busca numero_os já existentes (paginado)
    existentes = set()
    offset = 0
    while True:
        r = sb.table("ordens_servico").select("numero_os").range(offset, offset+999).execute()
        for o in (r.data or []):
            existentes.add(str(o["numero_os"]).strip())
        if len(r.data or []) < 1000:
            break
        offset += 1000
    print(f"Já no banco: {len(existentes)} OS", flush=True)

    novos = []
    for row in rows_csv:
        num = str(row.get("Ordem") or "").strip()
        if not num or num in existentes:
            continue
        existentes.add(num)

        valor = parse_valor(row.get("Valor Total"))
        desconto = parse_valor(row.get("Valor Desconto"))
        data = parse_data(row.get("Data da OS")) or "2020-01-01"
        status_raw = (row.get("Situacao") or "").strip()
        status = STATUS_OS.get(status_raw, "FATURADA_SEM_NF")
        obs = (row.get("Observacoes") or "").strip()[:500] or "Importado do VHSYS"

        novos.append({
            "numero_os":    num,
            "cliente_nome": (row.get("Cliente") or "").strip()[:200] or None,
            "data_abertura": data,
            "status":       status,
            "valor_total":  valor,
            "desconto":     desconto,
            "valor_final":  valor - desconto,
            "observacoes":  obs,
            "fonte":        "VHSYS",
        })

    print(f"Novas OS a inserir: {len(novos)}", flush=True)
    if not novos:
        print("Nenhuma OS nova. Pulando.", flush=True)
        return 0
    return inserir_em_lotes("ordens_servico", novos, lote=200)

# ── 3. CONTAS A RECEBER ───────────────────────────────────────────────────────

def importar_recebimentos():
    print("\n── CONTAS A RECEBER ──────────────────────────────────────────────", flush=True)

    # Limpa importações anteriores do VHSYS
    print("Limpando recebimentos VHSYS anteriores...", flush=True)
    while True:
        r = sb.table("recebimentos").select("id").eq("fonte", "VHSYS").limit(500).execute()
        ids = [x["id"] for x in (r.data or [])]
        if not ids:
            break
        sb.table("recebimentos").delete().in_("id", ids).execute()
        print(f"  deletados {len(ids)}", flush=True)
        time.sleep(0.1)

    rows_csv = ler_csv(BASE + "financeiro/contasreceber.csv")
    print(f"CSV: {len(rows_csv)} registros", flush=True)

    novos = []
    for row in rows_csv:
        data = parse_data(row.get("Vencimento"))
        if not data:
            continue
        valor = parse_valor(row.get("Valor"))
        if valor <= 0:
            continue
        status = mapear_status_rec(row.get("Situacao"))
        data_rec = parse_data(row.get("Data de Pagamento")) if status == "Recebido" else None

        novos.append({
            "data":             data,
            "valor":            valor,
            "tipo":             "entrada",
            "descricao":        (row.get("Nome Receita") or "").strip()[:300] or "Receita VHSYS",
            "categoria":        (row.get("Categoria") or "").strip()[:100] or "Outros",
            "status":           status,
            "cliente_nome":     (row.get("Cliente") or "").strip()[:200] or None,
            "conta_bancaria":   mapear_conta(row.get("Conta")),
            "data_recebimento": data_rec,
            "fonte":            "VHSYS",
        })

    print(f"Registros a inserir: {len(novos)}", flush=True)
    return inserir_em_lotes("recebimentos", novos)

# ── 4. CONTAS A PAGAR ─────────────────────────────────────────────────────────

def importar_pagamentos():
    print("\n── CONTAS A PAGAR ────────────────────────────────────────────────", flush=True)

    # Limpa importações anteriores do VHSYS
    print("Limpando pagamentos VHSYS anteriores...", flush=True)
    while True:
        r = sb.table("pagamentos").select("id").eq("fonte", "VHSYS").limit(500).execute()
        ids = [x["id"] for x in (r.data or [])]
        if not ids:
            break
        sb.table("pagamentos").delete().in_("id", ids).execute()
        print(f"  deletados {len(ids)}", flush=True)
        time.sleep(0.1)

    rows_csv = ler_csv(BASE + "financeiro/contaspagar.csv")
    print(f"CSV: {len(rows_csv)} registros", flush=True)

    novos = []
    for row in rows_csv:
        data = parse_data(row.get("Vencimento"))
        if not data:
            continue
        valor = parse_valor(row.get("Valor"))
        if valor <= 0:
            continue
        status = mapear_status_pag(row.get("Situacao"))
        data_pag = parse_data(row.get("Data de Pagamento")) if status == "Pago" else None
        fornecedor = (row.get("Fornecedor") or "").strip()[:200] or None

        desc = (row.get("Nome Despesa") or "").strip()[:300]
        if fornecedor:
            desc = f"{desc} — {fornecedor}" if desc else fornecedor

        novos.append({
            "data":           data,
            "valor":          valor,
            "tipo":           "saida",
            "descricao":      desc or "Despesa VHSYS",
            "categoria":      (row.get("Categoria") or "").strip()[:100] or "Outros",
            "status":         status,
            "conta_bancaria": mapear_conta(row.get("Conta")),
            "data_pagamento": data_pag,
            "fonte":          "VHSYS",
        })

    print(f"Registros a inserir: {len(novos)}", flush=True)
    return inserir_em_lotes("pagamentos", novos)

# ── MAIN ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=== IMPORTAÇÃO DE CSVs VHSYS ===", flush=True)

    erros = 0
    erros += importar_clientes()
    erros += importar_os()
    erros += importar_recebimentos()
    erros += importar_pagamentos()

    print("\n=== CONCLUÍDO ===", flush=True)
    if erros:
        print(f"  Atenção: {erros} lote(s) com erro. Verifique acima.", flush=True)
    else:
        print("  Sem erros!", flush=True)
