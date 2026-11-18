/* API da loja: catálogo público, pedidos e administração (produtos e relatório). */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const PORT = Number(process.env.PORT || 4000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'alex2025';
const STORE_NAME = process.env.STORE_NAME || 'Bella Moda';
const STORE_WHATSAPP = String(process.env.STORE_WHATSAPP || '5521968015350').replace(/\D/g, '');
const MAX_BODY = 8 * 1024 * 1024;
const TOKEN_TTL = 12 * 60 * 60 * 1000;

const tokens = new Map();

/* ---------- helpers ---------- */
function responder(res, status, corpo) {
  const texto = JSON.stringify(corpo);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(texto)
  });
  res.end(texto);
}

function falhar(res, status, mensagem) {
  responder(res, status, { erro: mensagem });
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let tamanho = 0;
    const partes = [];
    req.on('data', (parte) => {
      tamanho += parte.length;
      if (tamanho > MAX_BODY) {
        reject(Object.assign(new Error('Arquivo muito grande'), { status: 413 }));
        req.destroy();
        return;
      }
      partes.push(parte);
    });
    req.on('end', () => {
      const bruto = Buffer.concat(partes).toString('utf8');
      if (!bruto) return resolve({});
      try {
        resolve(JSON.parse(bruto));
      } catch (erro) {
        reject(Object.assign(new Error('Dados inválidos'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function autenticado(req) {
  const token = req.headers['x-admin-token'];
  if (!token) return false;
  const expira = tokens.get(token);
  if (!expira) return false;
  if (expira < Date.now()) {
    tokens.delete(token);
    return false;
  }
  return true;
}

function precoValido(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0 || numero > 1000000) return null;
  return Math.round(numero * 100) / 100;
}

function salvarImagem(dataUrl) {
  const casou = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!casou) {
    throw Object.assign(new Error('Envie uma imagem JPG ou PNG'), { status: 400 });
  }
  const extensao = casou[1] === 'png' ? 'png' : 'jpg';
  const bytes = Buffer.from(casou[2], 'base64');
  if (bytes.length > 4 * 1024 * 1024) {
    throw Object.assign(new Error('A imagem deve ter até 4 MB'), { status: 400 });
  }
  const nome = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${extensao}`;
  fs.writeFileSync(path.join(db.pastaUploads(), nome), bytes);
  return `/uploads/${nome}`;
}

function apagarImagem(caminho) {
  if (!caminho || !String(caminho).startsWith('/uploads/')) return;
  const arquivo = path.join(db.pastaUploads(), path.basename(caminho));
  fs.promises.unlink(arquivo).catch(() => {});
}

/* ---------- produtos ---------- */
function produtosPublicos() {
  return db
    .carregar()
    .products.filter((p) => p.ativo)
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      preco: p.preco,
      categoria: p.categoria,
      tamanhos: p.tamanhos,
      descricao: p.descricao,
      imagem: p.imagem
    }));
}

function montarProduto(corpo, atual) {
  const nome = String(corpo.nome || '').trim();
  if (!nome) throw Object.assign(new Error('Informe o nome da peça'), { status: 400 });

  const preco = precoValido(corpo.preco);
  if (preco === null) throw Object.assign(new Error('Informe um preço válido'), { status: 400 });

  const produto = Object.assign({}, atual || {}, {
    nome: nome.slice(0, 80),
    preco,
    categoria: String(corpo.categoria || '').trim().slice(0, 40),
    tamanhos: String(corpo.tamanhos || '').trim().slice(0, 40),
    descricao: String(corpo.descricao || '').trim().slice(0, 220),
    ativo: corpo.ativo === undefined ? true : Boolean(corpo.ativo)
  });

  if (typeof corpo.imagem === 'string') {
    if (corpo.imagem.startsWith('data:image/')) {
      const anterior = atual && atual.imagem;
      produto.imagem = salvarImagem(corpo.imagem);
      if (anterior) apagarImagem(anterior);
    } else if (corpo.imagem.trim() === '') {
      if (atual && atual.imagem) apagarImagem(atual.imagem);
      produto.imagem = '';
    }
  }

  if (!produto.id) {
    produto.id = db.novoId();
    produto.criadoEm = new Date().toISOString();
  }

  return produto;
}

/* ---------- pedidos ---------- */
function montarPedido(corpo) {
  const dados = db.carregar();
  const cliente = corpo.cliente || {};

  const nome = String(cliente.nome || '').trim();
  if (!nome) throw Object.assign(new Error('Informe o nome do cliente'), { status: 400 });

  const telefone = String(cliente.telefone || '').replace(/\D/g, '');
  if (telefone.length < 10) throw Object.assign(new Error('Informe um WhatsApp válido'), { status: 400 });

  const entrega = cliente.entrega === 'Retirada' ? 'Retirada' : 'Entrega';
  const endereco = String(cliente.endereco || '').trim().slice(0, 200);
  if (entrega === 'Entrega' && !endereco) {
    throw Object.assign(new Error('Informe o endereço de entrega'), { status: 400 });
  }

  const pagamento = ['Pix', 'Dinheiro', 'Cartão'].includes(corpo.pagamento) ? corpo.pagamento : 'Pix';

  const brutos = Array.isArray(corpo.itens) ? corpo.itens : [];
  if (brutos.length === 0) throw Object.assign(new Error('Carrinho vazio'), { status: 400 });

  const itens = brutos.map((bruto) => {
    const produto = dados.products.find((p) => p.id === bruto.produtoId);
    if (!produto || !produto.ativo) {
      throw Object.assign(new Error('Um dos produtos não está mais disponível'), { status: 400 });
    }
    const qtd = Math.min(Math.max(parseInt(bruto.qtd, 10) || 1, 1), 50);
    return {
      produtoId: produto.id,
      nome: produto.nome,
      preco: produto.preco,
      tamanho: String(bruto.tamanho || '').slice(0, 20),
      qtd
    };
  });

  const total = Math.round(itens.reduce((soma, item) => soma + item.preco * item.qtd, 0) * 100) / 100;

  dados.counter += 1;

  return {
    id: db.novoId(),
    numero: dados.counter,
    cliente: { nome: nome.slice(0, 80), telefone, entrega, endereco },
    itens,
    total,
    pagamento,
    observacao: String(corpo.observacao || '').trim().slice(0, 300),
    status: 'Novo',
    criadoEm: new Date().toISOString()
  };
}

/* ---------- arquivos enviados ---------- */
function servirUpload(req, res, nomeArquivo) {
  const arquivo = path.join(db.pastaUploads(), path.basename(nomeArquivo));
  fs.readFile(arquivo, (erro, conteudo) => {
    if (erro) return falhar(res, 404, 'Imagem não encontrada');
    const extensao = path.extname(arquivo).toLowerCase();
    const tipo = extensao === '.png' ? 'image/png' : 'image/jpeg';
    res.writeHead(200, {
      'Content-Type': tipo,
      'Cache-Control': 'public, max-age=604800',
      'Content-Length': conteudo.length
    });
    res.end(conteudo);
  });
}

/* ---------- rotas ---------- */
async function rotear(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const caminho = url.pathname.replace(/\/+$/, '') || '/';
  const metodo = req.method;

  if (caminho.startsWith('/uploads/')) {
    if (metodo !== 'GET') return falhar(res, 405, 'Método não permitido');
    return servirUpload(req, res, caminho.replace('/uploads/', ''));
  }

  if (caminho === '/api/health') return responder(res, 200, { ok: true });

  if (caminho === '/api/config' && metodo === 'GET') {
    return responder(res, 200, { nome: STORE_NAME, whatsapp: STORE_WHATSAPP });
  }

  if (caminho === '/api/products' && metodo === 'GET') {
    return responder(res, 200, { produtos: produtosPublicos() });
  }

  if (caminho === '/api/orders' && metodo === 'POST') {
    const corpo = await lerCorpo(req);
    const dados = db.carregar();
    const pedido = montarPedido(corpo);
    dados.orders.unshift(pedido);
    db.salvar();
    return responder(res, 201, { pedido });
  }

  if (caminho === '/api/admin/login' && metodo === 'POST') {
    const corpo = await lerCorpo(req);
    if (String(corpo.senha || '') !== ADMIN_PASSWORD) {
      return falhar(res, 401, 'Senha incorreta');
    }
    const token = crypto.randomBytes(24).toString('hex');
    tokens.set(token, Date.now() + TOKEN_TTL);
    return responder(res, 200, { token });
  }

  if (caminho.startsWith('/api/admin/')) {
    if (!autenticado(req)) return falhar(res, 401, 'Sessão expirada. Entre novamente.');
    const dados = db.carregar();

    if (caminho === '/api/admin/products' && metodo === 'GET') {
      return responder(res, 200, { produtos: dados.products });
    }

    if (caminho === '/api/admin/products' && metodo === 'POST') {
      const corpo = await lerCorpo(req);
      const produto = montarProduto(corpo, null);
      dados.products.unshift(produto);
      db.salvar();
      return responder(res, 201, { produto });
    }

    const produtoId = /^\/api\/admin\/products\/([a-f0-9]+)$/.exec(caminho);
    if (produtoId) {
      const indice = dados.products.findIndex((p) => p.id === produtoId[1]);
      if (indice === -1) return falhar(res, 404, 'Produto não encontrado');

      if (metodo === 'PUT') {
        const corpo = await lerCorpo(req);
        const atualizado = montarProduto(corpo, dados.products[indice]);
        dados.products[indice] = atualizado;
        db.salvar();
        return responder(res, 200, { produto: atualizado });
      }

      if (metodo === 'DELETE') {
        const removido = dados.products.splice(indice, 1)[0];
        apagarImagem(removido.imagem);
        db.salvar();
        return responder(res, 200, { ok: true });
      }
    }

    if (caminho === '/api/admin/orders' && metodo === 'GET') {
      return responder(res, 200, { pedidos: dados.orders });
    }

    const pedidoId = /^\/api\/admin\/orders\/([a-f0-9]+)$/.exec(caminho);
    if (pedidoId) {
      const indice = dados.orders.findIndex((p) => p.id === pedidoId[1]);
      if (indice === -1) return falhar(res, 404, 'Pedido não encontrado');

      if (metodo === 'PATCH') {
        const corpo = await lerCorpo(req);
        const status = String(corpo.status || '');
        if (!['Novo', 'Pago', 'Entregue', 'Cancelado'].includes(status)) {
          return falhar(res, 400, 'Status inválido');
        }
        dados.orders[indice].status = status;
        db.salvar();
        return responder(res, 200, { pedido: dados.orders[indice] });
      }

      if (metodo === 'DELETE') {
        dados.orders.splice(indice, 1);
        db.salvar();
        return responder(res, 200, { ok: true });
      }
    }
  }

  return falhar(res, 404, 'Rota não encontrada');
}

const servidor = http.createServer((req, res) => {
  rotear(req, res).catch((erro) => {
    const status = erro.status || 500;
    if (status >= 500) console.error('[api] erro:', erro);
    falhar(res, status, erro.message || 'Erro interno');
  });
});

db.carregar();

servidor.listen(PORT, '0.0.0.0', () => {
  console.log(`[api] ${STORE_NAME} ouvindo em http://0.0.0.0:${PORT}`);
});
