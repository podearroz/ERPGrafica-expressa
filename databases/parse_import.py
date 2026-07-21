import pdfplumber, csv, re, uuid, io, os, sys

BASE = r"C:\Users\User\OneDrive - Grupo Marista\Desktop\DevSamurai\sistema-gestão\databases"
CSV_FILE = r"C:\Users\User\OneDrive - Grupo Marista\Desktop\DevSamurai\sistema-gestão\Clientes_Fornecedores_329321_20260430.csv"

def esc(s):
    if s is None or str(s).strip() == '' or str(s).strip() == '0000-00-00':
        return 'NULL'
    return "'" + str(s).replace("'", "''").strip() + "'"

def parse_money(s):
    s = re.sub(r'R\$\s*', '', str(s)).strip().replace('.','').replace(',','.')
    try: return float(s)
    except: return 0.0

# ============================================================
# 1. CLIENTES
# ============================================================
clients = []
with open(CSV_FILE, encoding='latin-1') as f:
    content = f.read()
reader = csv.reader(io.StringIO(content), delimiter=';')
next(reader)  # skip header
for row in reader:
    if len(row) < 28: continue
    situacao = row[27].strip().strip('"')
    if situacao != 'Ativo': continue
    nome = row[4].strip().strip('"').strip()
    if not nome: continue
    telefone = row[15].strip() or row[16].strip()
    clients.append({
        'id': str(uuid.uuid4()),
        'nome': nome,
        'nome_fantasia': row[5].strip().strip('"').strip(),
        'cpf_cnpj': row[3].strip(),
        'logradouro': row[6].strip().strip('"').strip(),
        'numero': row[7].strip().strip('"').strip(),
        'bairro': row[8].strip().strip('"').strip(),
        'complemento': row[9].strip().strip('"').strip(),
        'cep': row[10].strip(),
        'municipio': row[11].strip().strip('"').strip(),
        'codigo_municipio': row[12].strip(),
        'uf': row[13].strip(),
        'telefone': telefone,
        'email': row[18].strip().strip('"').strip(),
        'inscricao_estadual': row[19].strip().strip('"').strip(),
    })

print(f"Clientes ativos: {len(clients)}")

# ============================================================
# 2. CONTAS A PAGAR
# ============================================================
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
                status = 'Pendente' if 'Em Aberto' in status_raw else 'Pago'
                pagamentos.append({
                    'id': str(uuid.uuid4()),
                    'data': data_iso,
                    'descricao': desc.strip(),
                    'valor': parse_money(valor_str),
                    'status': status,
                    'tipo': 'saida',
                    'categoria': 'Contas a Pagar',
                })

print(f"Contas a Pagar: {len(pagamentos)}")

# ============================================================
# 3. CONTAS A RECEBER
# ============================================================
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
                    'valor': parse_money(valor_str),
                    'status': status,
                    'tipo': 'entrada',
                    'categoria': 'Contas a Receber',
                })

print(f"Contas a Receber: {len(recebimentos)}")

# ============================================================
# 4. ORDENS DE SERVIÇO
# ============================================================
def parse_os_status(s):
    s = s.strip()
    if 'Atendido' in s: return 'FATURADA_SEM_NF'
    if 'Cancelado' in s or 'Cancelada' in s: return 'CANCELADA'
    return 'ABERTA'

os_records = {}   # numero_os -> dict
os_items = []

OS_HDR = re.compile(r'^(\d+)\s+(.+?)\s+R\$\s*([\d.,]+)\s+(\d{2}/\d{2}/\d{4})\s+(.+)$')
OS_ITEM = re.compile(r'^(.+?)\s+(?:Servi.o|Produto)\s+(\d+)\s+R\$\s*([\d.,]+)\s+R\$\s*([\d.,]+)\s+(Sim|N.o)$', re.IGNORECASE)

for fname in ["OrdemServico-20260706102849.pdf", "OrdemServico-20260706103131.pdf"]:
    fpath = os.path.join(BASE, fname)
    current_os_num = None
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
                    # Skip if looks like a Contas line (has extra columns)
                    d = data_br.split('/')
                    data_iso = f"{d[2]}-{d[1]}-{d[0]}"
                    current_os_num = num
                    if num not in os_records:
                        os_records[num] = {
                            'id': str(uuid.uuid4()),
                            'numero_os': num,
                            'cliente_nome': cliente.strip()[:200],
                            'data_abertura': data_iso,
                            'valor_total': parse_money(valor),
                            'valor_final': parse_money(valor),
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
                        'valor_unitario': parse_money(vunit),
                        'valor_total': parse_money(vtotal),
                    })

print(f"Ordens de Servico unicas: {len(os_records)}")
print(f"Itens de OS: {len(os_items)}")

# Sample check
print("\n--- Amostra OS ---")
for k, v in list(os_records.items())[:5]:
    print(f"  OS#{k}: {v['cliente_nome'][:40]} | {v['data_abertura']} | R${v['valor_total']:.2f} | {v['status']}")
print("\n--- Amostra Itens ---")
for it in os_items[:5]:
    print(f"  {it['descricao'][:40]} | qty={it['quantidade']} | R${it['valor_total']:.2f}")

print("\n--- Amostra Clientes ---")
for c in clients[:3]:
    print(f"  {c['nome'][:40]} | {c['cpf_cnpj']} | {c['municipio']}/{c['uf']}")

print("\n--- Amostra ContasPag ---")
for p in pagamentos[:3]:
    print(f"  {p['data']} | {p['descricao'][:40]} | R${p['valor']:.2f} | {p['status']}")

print("\n--- Amostra ContasRec ---")
for r in recebimentos[:3]:
    print(f"  {r['data']} | {r['cliente_nome'][:30]} | {r['descricao'][:30]} | R${r['valor']:.2f}")
