/* Armazenamento simples em arquivo JSON (produtos, pedidos e contador de pedidos). */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

const DEMO = [
  {
    nome: 'Camiseta Básica Off-White',
    preco: 79.9,
    categoria: 'Básicos',
    tamanhos: 'P, M, G',
    descricao: 'Algodão penteado, caimento solto e toque macio.',
    imagem: '/assets/demo/camiseta.svg'
  },
  {
    nome: 'Vestido Midi Terracota',
    preco: 189.9,
    categoria: 'Vestidos',
    tamanhos: 'P, M, G',
    descricao: 'Midi fluido com alças finas e caimento leve.',
    imagem: '/assets/demo/vestido.svg'
  },
  {
    nome: 'Calça Jeans Reta',
    preco: 219.9,
    categoria: 'Calças',
    tamanhos: '36, 38, 40, 42',
    descricao: 'Cintura alta, lavagem média e barra reta.',
    imagem: '/assets/demo/calca.svg'
  },
  {
    nome: 'Jaqueta de Alfaiataria',
    preco: 299.9,
    categoria: 'Casacos',
    tamanhos: 'P, M, G',
    descricao: 'Alfaiataria estruturada, forro leve e ombro marcado.',
    imagem: '/assets/demo/jaqueta.svg'
  },
  {
    nome: 'Saia Plissada Rosé',
    preco: 149.9,
    categoria: 'Saias',
    tamanhos: 'P, M, G',
    descricao: 'Plissado delicado, comprimento midi e elástico na cintura.',
    imagem: '/assets/demo/saia.svg'
  },
  {
    nome: 'Blusa de Seda Verde',
    preco: 139.9,
    categoria: 'Blusas',
    tamanhos: 'P, M, G',
    descricao: 'Manga longa, decote V e tecido com leve brilho.',
    imagem: '/assets/demo/blusa.svg'
  }
];

let cache = null;

function bancoVazio() {
  return { counter: 1000, seeded: false, products: [], orders: [] };
}

function garantirPastas() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function carregar() {
  if (cache) return cache;
  garantirPastas();

  let dados;
  try {
    dados = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (erro) {
    dados = bancoVazio();
  }

  cache = Object.assign(bancoVazio(), dados);

  if (!cache.seeded) {
    const agora = new Date().toISOString();
    DEMO.forEach((item) => {
      cache.products.push(
        Object.assign({ id: novoId(), ativo: true, criadoEm: agora }, item)
      );
    });
    cache.seeded = true;
    salvar();
  }

  return cache;
}

function salvar() {
  if (!cache) return;
  const temporario = `${DB_FILE}.tmp`;
  fs.writeFileSync(temporario, JSON.stringify(cache, null, 2));
  fs.renameSync(temporario, DB_FILE);
}

function novoId() {
  return require('crypto').randomBytes(8).toString('hex');
}

function pastaUploads() {
  garantirPastas();
  return UPLOAD_DIR;
}

module.exports = {
  carregar,
  salvar,
  novoId,
  pastaUploads,
  DATA_DIR
};
