import pdfplumber, csv, re, uuid, io, os, json

BASE = r"C:\Users\User\OneDrive - Grupo Marista\Desktop\DevSamurai\sistema-gestão\databases"
CSV_FILE = r"C:\Users\User\OneDrive - Grupo Marista\Desktop\DevSamurai\sistema-gestão\Clientes_Fornecedores_329321_20260430.csv"
OUT_DIR = os.path.join(BASE, "sql_chunks")
os.makedirs(OUT_DIR, exist_ok=True)

def esc(s):
    if s is None or str(s).strip() == '' or str(s).strip() == '0000-00-00':
        return 'NULL'
    return "'" + str(s).replace("'", "''").strip() + "'"

def parse_money(s):
    s = re.sub(r'R\$\s*', '', str(s)).strip().replace('.','').replace(',','.')
    try: return float(s)
    except: return 0.0

def write_chunks(name, rows_sql, chunk_size=300):
    files = []
    for i in range(0, len(rows_sql), chunk_size):
        chunk = rows_sql[i:i+chunk_size]
        fname = os.path.join(OUT_DIR, f"{name}_{i//chunk_size+1:03d}.sql")
        with open(fname, 'w', encoding='utf-8') as f:
            f.write('\n'.join(chunk))
        files.append(fname)
    return files

# ============================================================
# 1. CLIENTES
# ============================================================
print("Parsing clientes CSV...")
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
    endereco = ', '.join(endereco_parts)
    clients.append({
        'id': str(uuid.uuid4()),
        'nome': nome[:255],
        'nome_fantasia': row[5].strip().strip('"').strip()[:255],
        'cpf_cnpj': row[3].strip()[:20],
        'logradouro': logradouro[:255],
        'numero': numero[:20],
        'bairro': bairro[:100],
        'complemento': complemento[:100],
        'cep': row[10].strip()[:10],
        'municipio': row[11].strip().strip('"').strip()[:100],
        'codigo_municipio': row[12].strip()[:10],
        'uf': row[13].strip()[:2],
        'telefone': telefone[:20],
        'email': row[18].strip().strip('"').strip()[:100],
        'inscricao_estadual': row[19].strip().strip('"').strip()[:30],
        'endereco': endereco[:500],
    })

rows_sql = []
for c in clients:
    rows_sql.append(
        f"INSERT INTO clientes (id, nome, nome_fantasia, cpf_cnpj, telefone, email, endereco, logradouro, numero, complemento, bairro, municipio, uf, cep, codigo_municipio, inscricao_estadual) VALUES ("
        f"{esc(c['id'])}, {esc(c['nome'])}, {esc(c['nome_fantasia'])}, {esc(c['cpf_cnpj'])}, "
        f"{esc(c['telefone'])}, {esc(c['email'])}, {esc(c['endereco'])}, {esc(c['logradouro'])}, "
        f"{esc(c['numero'])}, {esc(c['complemento'])}, {esc(c['bairro'])}, {esc(c['municipio'])}, "
        f"{esc(c['uf'])}, {esc(c['cep'])}, {esc(c['codigo_municipio'])}, {esc(c['inscricao_estadual'])}"
        f") ON CONFLICT DO NOTHING;"
    )

files = write_chunks('clientes', rows_sql, chunk_size=200)
print(f"  {len(clients)} clientes -> {len(files)} chunks")

# ============================================================
# 2. CONTAS A PAGAR
# ============================================================
print("Parsing ContasPag PDF...")
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
                    'descricao': desc.strip()[:200],
                    'valor': parse_money(valor_str),
                    'status': status,
                    'tipo': 'saida',
                    'categoria': 'Contas a Pagar',
                })

rows_sql = []
for p in pagamentos:
    rows_sql.append(
        f"INSERT INTO pagamentos (id, data, descricao, valor, status, tipo, categoria) VALUES ("
        f"{esc(p['id'])}, {esc(p['data'])}, {esc(p['descricao'])}, {p['valor']:.2f}, "
        f"{esc(p['status'])}, {esc(p['tipo'])}, {esc(p['categoria'])}"
        f") ON CONFLICT DO NOTHING;"
    )

files = write_chunks('pagamentos', rows_sql, chunk_size=300)
print(f"  {len(pagamentos)} pagamentos -> {len(files)} chunks")

# ============================================================
# 3. CONTAS A RECEBER
# ============================================================
print("Parsing ContasRec PDF...")
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

rows_sql = []
for r in recebimentos:
    rows_sql.append(
        f"INSERT INTO recebimentos (id, data, cliente_nome, descricao, valor, status, tipo, categoria) VALUES ("
        f"{esc(r['id'])}, {esc(r['data'])}, {esc(r['cliente_nome'])}, {esc(r['descricao'])}, "
        f"{r['valor']:.2f}, {esc(r['status'])}, {esc(r['tipo'])}, {esc(r['categoria'])}"
        f") ON CONFLICT DO NOTHING;"
    )

files = write_chunks('recebimentos', rows_sql, chunk_size=300)
print(f"  {len(recebimentos)} recebimentos -> {len(files)} chunks")

# ============================================================
# 4. ORDENS DE SERVIÇO + ITENS
# ============================================================
print("Parsing OS PDFs (pode demorar)...")

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

print(f"  {len(os_records)} OS, {len(os_items)} itens")

# Generate OS SQL
rows_sql = []
for num, o in os_records.items():
    rows_sql.append(
        f"INSERT INTO ordens_servico (id, numero_os, cliente_nome, data_abertura, valor_total, valor_final, status) VALUES ("
        f"{esc(o['id'])}, {esc(o['numero_os'])}, {esc(o['cliente_nome'])}, {esc(o['data_abertura'])}, "
        f"{o['valor_total']:.2f}, {o['valor_final']:.2f}, {esc(o['status'])}"
        f") ON CONFLICT DO NOTHING;"
    )

os_files = write_chunks('os', rows_sql, chunk_size=200)
print(f"  OS -> {len(os_files)} chunks")

# Generate itens_os SQL
rows_sql = []
for it in os_items:
    rows_sql.append(
        f"INSERT INTO itens_os (id, os_id, descricao, quantidade, valor_unitario, valor_total) VALUES ("
        f"{esc(it['id'])}, {esc(it['os_id'])}, {esc(it['descricao'])}, {it['quantidade']}, "
        f"{it['valor_unitario']:.2f}, {it['valor_total']:.2f}"
        f") ON CONFLICT DO NOTHING;"
    )

itens_files = write_chunks('itens_os', rows_sql, chunk_size=300)
print(f"  itens_os -> {len(itens_files)} chunks")

# Save manifest
manifest = {
    'clientes': sorted([f for f in os.listdir(OUT_DIR) if f.startswith('clientes_')]),
    'pagamentos': sorted([f for f in os.listdir(OUT_DIR) if f.startswith('pagamentos_')]),
    'recebimentos': sorted([f for f in os.listdir(OUT_DIR) if f.startswith('recebimentos_')]),
    'os': sorted([f for f in os.listdir(OUT_DIR) if f.startswith('os_')]),
    'itens_os': sorted([f for f in os.listdir(OUT_DIR) if f.startswith('itens_os_')]),
}
with open(os.path.join(OUT_DIR, 'manifest.json'), 'w') as f:
    json.dump(manifest, f, indent=2)

print("\nTodos os chunks gerados!")
for k, v in manifest.items():
    print(f"  {k}: {len(v)} arquivos")
