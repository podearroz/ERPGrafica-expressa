"""
Executa o import via Supabase REST API (PostgREST) em lotes.
Funciona porque RLS está desabilitado nas tabelas.
"""
import pdfplumber, csv, re, uuid, io, os, json, requests, time

SUPABASE_URL = "https://vebswpvfgqoikgfpejtu.supabase.co"
SUPABASE_KEY = "sb_publishable_pWIkSUniojUauvVJu7DcsA_D4DM6t9B"
BASE = r"C:\Users\User\OneDrive - Grupo Marista\Desktop\DevSamurai\sistema-gestão\databases"
CSV_FILE = r"C:\Users\User\OneDrive - Grupo Marista\Desktop\DevSamurai\sistema-gestão\Clientes_Fornecedores_329321_20260430.csv"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=ignore-duplicates",
}

def insert_batch(table, records, batch_size=200):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    total = len(records)
    inserted = 0
    errors = 0
    for i in range(0, total, batch_size):
        batch = records[i:i+batch_size]
        resp = requests.post(url, headers=HEADERS, json=batch, timeout=60)
        if resp.status_code in (200, 201):
            inserted += len(batch)
        else:
            errors += len(batch)
            print(f"  ERRO batch {i//batch_size+1}: {resp.status_code} - {resp.text[:200]}")
        if i % (batch_size * 5) == 0:
            print(f"  {table}: {min(i+batch_size, total)}/{total}...")
    return inserted, errors

def parse_money(s):
    s = re.sub(r'R\$\s*', '', str(s)).strip().replace('.','').replace(',','.')
    try: return float(s)
    except: return 0.0

# ============================================================
# 1. CLIENTES
# ============================================================
print("\n=== CLIENTES ===")
clients = []
with open(CSV_FILE, encoding='latin-1') as f:
    content = f.read()
reader = csv.reader(io.StringIO(content), delimiter=';')
next(reader)
for row in reader:
    if len(row) < 28: continue
    situacao = row[27].strip().strip('"')
    if situacao != 'Ativo': continue
    nome = row[4].strip().strip('"').strip()
    if not nome: continue
    telefone = row[15].strip() or row[16].strip()
    logradouro = row[6].strip().strip('"').strip()
    numero = row[7].strip().strip('"').strip()
    bairro = row[8].strip().strip('"').strip()
    complemento = row[9].strip().strip('"').strip()
    endereco_parts = [x for x in [logradouro, numero, bairro] if x]
    endereco = ', '.join(endereco_parts) or None

    clients.append({
        'id': str(uuid.uuid4()),
        'nome': nome[:255],
        'nome_fantasia': row[5].strip().strip('"').strip()[:255] or None,
        'cpf_cnpj': row[3].strip()[:20] or None,
        'logradouro': logradouro[:255] or None,
        'numero': numero[:20] or None,
        'bairro': bairro[:100] or None,
        'complemento': complemento[:100] or None,
        'cep': row[10].strip()[:9] or None,
        'municipio': row[11].strip().strip('"').strip()[:100] or None,
        'codigo_municipio': row[12].strip()[:10] or None,
        'uf': row[13].strip()[:2] or None,
        'telefone': telefone[:20] or None,
        'email': row[18].strip().strip('"').strip()[:100] or None,
        'inscricao_estadual': row[19].strip().strip('"').strip()[:30] or None,
        'endereco': endereco[:500] if endereco else None,
    })

print(f"Parsed: {len(clients)} clientes")
ins, err = insert_batch('clientes', clients, batch_size=200)
print(f"Resultado: {ins} inseridos, {err} erros")

# ============================================================
# 2. CONTAS A PAGAR
# ============================================================
print("\n=== CONTAS A PAGAR ===")
pagamentos = []
with pdfplumber.open(os.path.join(BASE, "ContasPag-20260706113035.pdf")) as pdf:
    for page in pdf.pages:
        text = page.extract_text() or ''
        for line in text.split('\n'):
            m = re.match(r'^(\d{2}/\d{2}/\d{4})\s+(.+?)\s+(Em Aberto[^R]*|Pago|Vencido)\s+(?:FIXO\s+)?R\$\s*([\d.,]+)', line)
            if m:
                data_br, desc, status_raw, valor_str = m.groups()
                d = data_br.split('/')
                data_iso = f"{d[2]}-{d[1]}-{d[0]}"
                pagamentos.append({
                    'id': str(uuid.uuid4()),
                    'data': data_iso,
                    'descricao': desc.strip()[:200],
                    'valor': round(parse_money(valor_str), 2),
                    'status': 'Pendente' if 'Em Aberto' in status_raw else 'Pago',
                    'tipo': 'saida',
                    'categoria': 'Contas a Pagar',
                })

print(f"Parsed: {len(pagamentos)} pagamentos")
ins, err = insert_batch('pagamentos', pagamentos, batch_size=200)
print(f"Resultado: {ins} inseridos, {err} erros")

# ============================================================
# 3. CONTAS A RECEBER
# ============================================================
print("\n=== CONTAS A RECEBER ===")
recebimentos = []
with pdfplumber.open(os.path.join(BASE, "ContasRec-20260706113103.pdf")) as pdf:
    for page in pdf.pages:
        text = page.extract_text() or ''
        for line in text.split('\n'):
            m = re.match(r'^(\d{2}/\d{2}/\d{4})\s+(.+?)\s+(Ordem de Servi.o\s+\d+|[\w\s]+?)\s+(Em Atraso|Em Aberto|Pago|Recebido)\s+R\$\s*([\d.,]+)', line)
            if m:
                data_br, cliente_nome, descricao, status_raw, valor_str = m.groups()
                d = data_br.split('/')
                data_iso = f"{d[2]}-{d[1]}-{d[0]}"
                if 'Atraso' in status_raw or 'Aberto' in status_raw:
                    status = 'Não Pago'
                else:
                    status = 'Recebido'
                recebimentos.append({
                    'id': str(uuid.uuid4()),
                    'data': data_iso,
                    'cliente_nome': cliente_nome.strip()[:100],
                    'descricao': descricao.strip()[:200],
                    'valor': round(parse_money(valor_str), 2),
                    'status': status,
                    'tipo': 'entrada',
                    'categoria': 'Contas a Receber',
                })

print(f"Parsed: {len(recebimentos)} recebimentos")
ins, err = insert_batch('recebimentos', recebimentos, batch_size=200)
print(f"Resultado: {ins} inseridos, {err} erros")

# ============================================================
# 4. ORDENS DE SERVIÇO + ITENS
# ============================================================
print("\n=== ORDENS DE SERVIÇO ===")

def parse_os_status(s):
    s = s.strip()
    if 'Atendido' in s: return 'FATURADA_SEM_NF'
    if 'Cancelado' in s or 'Cancelada' in s: return 'CANCELADA'
    return 'ABERTA'

os_records = {}
os_items = []

OS_HDR = re.compile(r'^(\d+)\s+(.+?)\s+R\$\s*([\d.,]+)\s+(\d{2}/\d{2}/\d{4})\s+(.+)$')
OS_ITEM = re.compile(r'^(.+?)\s+(?:Servi.o|Produto)\s+(\d+)\s+R\$\s*([\d.,]+)\s+R\$\s*([\d.,]+)\s+(Sim|N.o)$', re.IGNORECASE)

for fname in ["OrdemServico-20260706102849.pdf", "OrdemServico-20260706103131.pdf"]:
    fpath = os.path.join(BASE, fname)
    current_os_num = None
    print(f"  Lendo {fname}...")
    with pdfplumber.open(fpath) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ''
            for line in text.split('\n'):
                line = line.strip()
                if not line: continue
                if line.startswith('Relat') or line.startswith('OS ') or line.startswith('Tipo Qtde') or line.startswith('06/07/2026'): continue

                hdr = OS_HDR.match(line)
                if hdr:
                    num, cliente, valor, data_br, status_raw = hdr.groups()
                    d = data_br.split('/')
                    data_iso = f"{d[2]}-{d[1]}-{d[0]}"
                    current_os_num = num
                    if num not in os_records:
                        os_records[num] = {
                            'id': str(uuid.uuid4()),
                            'numero_os': num,
                            'cliente_nome': cliente.strip()[:200],
                            'data_abertura': data_iso,
                            'valor_total': round(parse_money(valor), 2),
                            'valor_final': round(parse_money(valor), 2),
                            'status': parse_os_status(status_raw),
                        }
                    continue

                item_m = OS_ITEM.match(line)
                if item_m and current_os_num and current_os_num in os_records:
                    desc, qty, vunit, vtotal, rejected = item_m.groups()
                    os_items.append({
                        'id': str(uuid.uuid4()),
                        'os_id': os_records[current_os_num]['id'],
                        'descricao': desc.strip()[:255],
                        'quantidade': int(qty),
                        'valor_unitario': round(parse_money(vunit), 2),
                        'valor_total': round(parse_money(vtotal), 2),
                    })

os_list = list(os_records.values())
print(f"Parsed: {len(os_list)} OS, {len(os_items)} itens")

print("  Inserindo ordens_servico...")
ins, err = insert_batch('ordens_servico', os_list, batch_size=200)
print(f"  Resultado OS: {ins} inseridos, {err} erros")

print("  Inserindo itens_os...")
ins, err = insert_batch('itens_os', os_items, batch_size=300)
print(f"  Resultado itens: {ins} inseridos, {err} erros")

print("\n=== IMPORT CONCLUIDO ===")
