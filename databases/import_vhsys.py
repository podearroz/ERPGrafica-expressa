"""
Extrai OS do VHSYS (PDFs) e gera SQL para importar no Supabase.
Uso: python import_vhsys.py
"""

import pdfplumber
import re
import sys
from datetime import datetime

BASE = 'C:/Users/User/OneDrive - Grupo Marista/Desktop/DevSamurai/sistema-gestão/databases/'

PDF_FILES = [
    BASE + 'OrdemServico-20260706102849.pdf',
    BASE + 'OrdemServico-20260706103131.pdf',
]

OUTPUT_SQL = BASE + 'import_vhsys_os.sql'

# ── Status mapping ────────────────────────────────────────────────────────────
STATUS_MAP = {
    'Atendido':      'FATURADA_SEM_NF',
    'Atendida':      'FATURADA_SEM_NF',
    'Cancelado':     'CANCELADA',
    'Cancelada':     'CANCELADA',
    'Pendente':      'ABERTA',
    'Em Andamento':  'ABERTA',
    'Em andamento':  'ABERTA',
    'Andamento':     'ABERTA',
    'Aguardando':    'ABERTA',
}

# ── Helpers ───────────────────────────────────────────────────────────────────
def parse_value(s):
    s = re.sub(r'[^\d,]', '', s).replace(',', '.')
    try:
        return float(s)
    except Exception:
        return 0.0

def fmt_date(s):
    try:
        return datetime.strptime(s.strip(), '%d/%m/%Y').strftime('%Y-%m-%d')
    except Exception:
        return None

def map_status(raw):
    raw = raw.strip()
    for k, v in STATUS_MAP.items():
        if raw.lower().startswith(k.lower()):
            return v
    return 'FATURADA_SEM_NF'   # default: histórico = já atendido

def esc(s):
    """Escape single quotes for SQL."""
    if s is None:
        return 'NULL'
    return "'" + str(s).replace("'", "''") + "'"

# ── Patterns ─────────────────────────────────────────────────────────────────
# Formato 1: "5 GRAFICA REGIONAL R$ 464,00 14/05/2020 Atendido"
PAT_FULL = re.compile(
    r'^(\d+)\s+(.+?)\s+R\$\s*([\d.]+,\d{2})\s+(\d{2}/\d{2}/\d{4})\s+(.+)$'
)
# Formato 2: "1926 R$ 3.090,00 24/01/2022 Atendido"  (cliente na linha anterior)
PAT_NUM_ONLY = re.compile(
    r'^(\d+)\s+R\$\s*([\d.]+,\d{2})\s+(\d{2}/\d{2}/\d{4})\s+(.+)$'
)
# Item: "ROTULOS ADESIVOS Serviço 4600 R$ 0,10 R$ 464,00 Não"
PAT_ITEM = re.compile(
    r'^(.+?)\s+(?:Servi[çc][oa]o?|Produto|servi[çc][oa]o?)\s+([\d.,]+)\s+R\$\s*([\d.,]+)\s+R\$\s*([\d.,]+)\s+(N[ãa]o|Sim|N/D)',
    re.IGNORECASE
)
SKIP_LINES = re.compile(
    r'^(Relat[oó]rio|OS\s+Cliente|Tipo\s+Qtde|^\d{2}/\d{2}/\d{4}\s+\d{2}:|Situa[çc][aã]o)',
    re.IGNORECASE
)

# ── Extraction ────────────────────────────────────────────────────────────────
def extract_orders(pdf_path):
    orders = []
    seen = set()

    with pdfplumber.open(pdf_path) as pdf:
        all_lines = []
        for page in pdf.pages:
            txt = page.extract_text()
            if txt:
                all_lines.extend(txt.split('\n'))

    i = 0
    pending_client = None   # client name from line before OS number

    while i < len(all_lines):
        raw = all_lines[i]
        line = raw.strip()

        if not line or SKIP_LINES.match(line):
            i += 1
            pending_client = None
            continue

        # ── Try full format first ──────────────────────────────────────────
        m = PAT_FULL.match(line)
        if m:
            os_num, cliente, valor_s, data_s, status_s = (
                m.group(1), m.group(2).strip(),
                m.group(3), m.group(4), m.group(5)
            )
            data = fmt_date(data_s)
            if data and os_num not in seen:
                seen.add(os_num)
                orders.append({
                    'numero_os': os_num,
                    'cliente_nome': cliente,
                    'valor': parse_value(valor_s),
                    'data': data,
                    'status': map_status(status_s),
                    'itens': [],
                })
            pending_client = None
            i += 1
            continue

        # ── Try "number only" format (client was on previous line) ─────────
        m2 = PAT_NUM_ONLY.match(line)
        if m2:
            os_num, valor_s, data_s, status_s = (
                m2.group(1), m2.group(2), m2.group(3), m2.group(4)
            )
            data = fmt_date(data_s)
            # Build client name: pending_client + possible next-line continuation
            cliente = pending_client or ''
            # Peek next line for short continuation (e.g., "LTDA")
            if i + 1 < len(all_lines):
                nxt = all_lines[i + 1].strip()
                if (nxt and not re.match(r'^\d+', nxt)
                        and not PAT_FULL.match(nxt)
                        and not PAT_NUM_ONLY.match(nxt)
                        and not re.match(r'Tipo\s+Qtde', nxt, re.IGNORECASE)
                        and len(nxt.split()) <= 4):
                    cliente = (cliente + ' ' + nxt).strip()
                    i += 1  # consume continuation line

            if data and os_num not in seen:
                seen.add(os_num)
                orders.append({
                    'numero_os': os_num,
                    'cliente_nome': cliente.strip(),
                    'valor': parse_value(valor_s),
                    'data': data,
                    'status': map_status(status_s),
                    'itens': [],
                })
            pending_client = None
            i += 1
            continue

        # ── Try item line ──────────────────────────────────────────────────
        mi = PAT_ITEM.match(line)
        if mi and orders:
            descricao = mi.group(1).strip()
            qtd        = parse_value(mi.group(2))
            vunit      = parse_value(mi.group(3))
            vtotal     = parse_value(mi.group(4))
            orders[-1]['itens'].append({
                'descricao': descricao,
                'quantidade': qtd,
                'valor_unitario': vunit,
                'valor_total': vtotal,
            })
            pending_client = None
            i += 1
            continue

        # ── Otherwise: might be start of a client name (for next OS) ──────
        # Only save as pending if it looks like a name (letters, no R$, no date)
        if (not re.search(r'R\$', line)
                and not re.search(r'\d{2}/\d{2}/\d{4}', line)
                and len(line) > 2):
            pending_client = line
        else:
            pending_client = None

        i += 1

    return orders

# ── SQL generation ────────────────────────────────────────────────────────────
BATCH_SIZE = 200  # OS por arquivo de batch

def generate_migration_sql():
    """Passo 0: migration das colunas + limpeza."""
    return """\
-- =====================================================
-- PASSO 0: Migration + limpeza (rodar primeiro)
-- =====================================================
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS fonte VARCHAR(20) DEFAULT NULL;
ALTER TABLE itens_os       ADD COLUMN IF NOT EXISTS fonte VARCHAR(20) DEFAULT NULL;

DELETE FROM itens_os       WHERE fonte = 'VHSYS';
DELETE FROM ordens_servico WHERE fonte = 'VHSYS';

SELECT 'Migration OK' AS status;
"""

def generate_batch_sql(orders, batch_num, total_batches):
    """Gera SQL para um lote de OS (sem DO $$, usando subquery para itens)."""
    lines = []
    lines.append(f'-- Batch {batch_num}/{total_batches} — {len(orders)} OS')
    lines.append('')

    # INSERT das OS em VALUES múltiplos
    lines.append('INSERT INTO ordens_servico (')
    lines.append('  numero_os, cliente_nome, data_abertura, status,')
    lines.append('  valor_total, desconto, valor_final, observacoes, fonte')
    lines.append(') VALUES')

    os_rows = []
    for o in orders:
        cliente = esc(o['cliente_nome'][:200] if o['cliente_nome'] else None)
        valor   = o['valor']
        data    = esc(o['data'])
        status  = esc(o['status'])
        num     = esc(o['numero_os'])
        os_rows.append(
            f"  ({num}, {cliente}, {data}, {status}, {valor}, 0, {valor}, 'Importado do VHSYS', 'VHSYS')"
        )
    lines.append(',\n'.join(os_rows) + ';')
    lines.append('')

    # INSERT dos itens usando subquery para achar o os_id
    itens_rows = []
    for o in orders:
        num = esc(o['numero_os'])
        for item in o['itens']:
            desc  = esc(item['descricao'][:300])
            qtd   = item['quantidade']
            vunit = item['valor_unitario']
            vtot  = item['valor_total']
            itens_rows.append(
                f"  (SELECT id FROM ordens_servico WHERE numero_os = {num} AND fonte = 'VHSYS' LIMIT 1),"
                f" {desc}, {qtd}, {vunit}, {vtot}, false, 'VHSYS'"
            )

    if itens_rows:
        lines.append('INSERT INTO itens_os (')
        lines.append('  os_id, descricao, quantidade, valor_unitario, valor_total,')
        lines.append('  estoque_baixado, fonte')
        lines.append(') VALUES')
        lines.append(',\n'.join(f'  ({r})' for r in itens_rows) + ';')
        lines.append('')

    return '\n'.join(lines)

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    all_orders = []
    for pdf in PDF_FILES:
        print(f'Lendo {pdf.split("/")[-1]}...', flush=True)
        orders = extract_orders(pdf)
        print(f'  -> {len(orders)} OS extraidas', flush=True)
        all_orders.extend(orders)

    # Deduplica por numero_os (pode aparecer nos dois PDFs)
    seen = set()
    unique = []
    for o in all_orders:
        if o['numero_os'] not in seen:
            seen.add(o['numero_os'])
            unique.append(o)

    print(f'\nTotal unico: {len(unique)} OS', flush=True)

    total_itens = sum(len(o['itens']) for o in unique)
    print(f'Total itens: {total_itens}', flush=True)

    # Passo 0 — migration
    with open(OUTPUT_SQL, 'w', encoding='utf-8') as f:
        f.write(generate_migration_sql())
    print(f'Passo 0: {OUTPUT_SQL}', flush=True)

    # Batches de dados
    batches = [unique[i:i+BATCH_SIZE] for i in range(0, len(unique), BATCH_SIZE)]
    total = len(batches)
    for idx, batch in enumerate(batches, 1):
        batch_file = BASE + f'import_vhsys_batch_{idx:03d}.sql'
        sql = generate_batch_sql(batch, idx, total)
        with open(batch_file, 'w', encoding='utf-8') as f:
            f.write(sql)
    print(f'{total} arquivos batch gerados (batch_001 a batch_{total:03d})', flush=True)

    # Preview primeiros 5
    print('\n-- Preview primeiros 5 registros --')
    for o in unique[:5]:
        print(f"  OS {o['numero_os']:>6} | {o['data']} | {o['status']:20} | R$ {o['valor']:>10.2f} | {o['cliente_nome'][:50]}")
