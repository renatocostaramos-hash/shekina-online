/* Utilitários compartilhados entre a loja (index.html) e a administração (admin.html). */
(function () {
  const CART_KEY = 'bellamoda.carrinho.v1';
  const TOKEN_KEY = 'bellamoda.admin.token';

  const config = { nome: 'AlexMultMarcas', whatsapp: '5521968015350' };

  function money(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function arredondar(valor) {
    return Math.round(Number(valor || 0) * 100) / 100;
  }

  async function api(caminho, opcoes) {
    const opts = Object.assign({}, opcoes || {});
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token) headers['x-admin-token'] = token;
    opts.headers = headers;

    let resposta;
    try {
      resposta = await fetch(caminho, opts);
    } catch (e) {
      throw new Error('Não foi possível falar com a loja. Verifique sua conexão.');
    }

    const texto = await resposta.text();
    let dados = null;
    if (texto) {
      try {
        dados = JSON.parse(texto);
      } catch (e) {
        dados = null;
      }
    }
    if (!resposta.ok) {
      const erro = new Error((dados && dados.erro) || 'Não foi possível concluir a operação.');
      erro.status = resposta.status;
      throw erro;
    }
    return dados;
  }

  async function carregarConfig() {
    try {
      const dados = await api('/api/config');
      if (dados && dados.nome) config.nome = dados.nome;
      if (dados && dados.whatsapp) config.whatsapp = String(dados.whatsapp).replace(/\D/g, '');
    } catch (e) {
      /* segue com os valores padrão */
    }
    return config;
  }

  /* ---------- carrinho ---------- */
  function lerCarrinho() {
    try {
      const itens = JSON.parse(localStorage.getItem(CART_KEY));
      return Array.isArray(itens) ? itens : [];
    } catch (e) {
      return [];
    }
  }

  function salvarCarrinho(itens) {
    localStorage.setItem(CART_KEY, JSON.stringify(itens));
  }

  function totalCarrinho(itens) {
    return arredondar(
      (itens || []).reduce((soma, item) => soma + Number(item.preco) * Number(item.qtd), 0)
    );
  }

  function quantidadeCarrinho(itens) {
    return (itens || []).reduce((soma, item) => soma + Number(item.qtd), 0);
  }

  /* ---------- telefone / datas ---------- */
  function somenteDigitos(valor) {
    return String(valor || '').replace(/\D/g, '');
  }

  function telefoneWhatsapp(valor) {
    const digitos = somenteDigitos(valor);
    if (!digitos) return '';
    if (digitos.length <= 11) return '55' + digitos;
    return digitos;
  }

  function formatarTelefone(valor) {
    const d = somenteDigitos(valor);
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return valor || '';
  }

  function dataHora(iso) {
    const data = new Date(iso);
    if (Number.isNaN(data.getTime())) return '';
    return data.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function dataCurta(iso) {
    const data = new Date(iso);
    if (Number.isNaN(data.getTime())) return '';
    return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  /* ---------- mensagens ---------- */
  function itensEmTexto(pedido) {
    return (pedido.itens || [])
      .map((item) => {
        const tamanho = item.tamanho ? ` (${item.tamanho})` : '';
        return `• ${item.qtd}x ${item.nome}${tamanho} — ${money(item.preco * item.qtd)}`;
      })
      .join('\n');
  }

  function textoPedidoLoja(pedido) {
    const linhas = [
      `*NOVO PEDIDO · ${config.nome}*`,
      `Pedido #${pedido.numero} · ${dataHora(pedido.criadoEm)}`,
      '',
      `👤 Cliente: ${pedido.cliente.nome}`,
      `📱 WhatsApp: ${formatarTelefone(pedido.cliente.telefone)}`,
      pedido.cliente.entrega === 'Retirada'
        ? '🏬 Retirada na loja'
        : `🚚 Entrega: ${pedido.cliente.endereco || 'a combinar'}`,
      `💳 Pagamento: ${pedido.pagamento}`,
      '',
      '*Itens*',
      itensEmTexto(pedido),
      '',
      `*Total: ${money(pedido.total)}*`
    ];
    if (pedido.observacao) linhas.push(`📝 Obs: ${pedido.observacao}`);
    return linhas.join('\n');
  }

  function textoNotaCliente(pedido) {
    const linhas = [
      `*NOTA DE COMPRA · ${config.nome}*`,
      `Pedido #${pedido.numero}`,
      dataHora(pedido.criadoEm),
      '',
      `Olá, ${pedido.cliente.nome}! Obrigado pela sua compra. 💛`,
      '',
      '*Itens*',
      itensEmTexto(pedido),
      '',
      `*Total: ${money(pedido.total)}*`,
      `Pagamento: ${pedido.pagamento}`,
      pedido.cliente.entrega === 'Retirada'
        ? 'Retirada na loja'
        : `Entrega: ${pedido.cliente.endereco || 'a combinar'}`
    ];
    if (pedido.observacao) linhas.push(`Obs: ${pedido.observacao}`);
    linhas.push('', 'Qualquer dúvida é só responder por aqui. 💬');
    return linhas.join('\n');
  }

  function linkWhatsapp(telefone, texto) {
    return `https://wa.me/${telefone}?text=${encodeURIComponent(texto)}`;
  }

  function linkPedidoLoja(pedido) {
    return linkWhatsapp(config.whatsapp, textoPedidoLoja(pedido));
  }

  function linkNotaCliente(pedido) {
    return linkWhatsapp(telefoneWhatsapp(pedido.cliente.telefone), textoNotaCliente(pedido));
  }

  /* ---------- avisos ---------- */
  let toastTimer = null;
  function avisar(mensagem) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = mensagem;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  window.Loja = {
    config,
    carregarConfig,
    api,
    money,
    arredondar,
    lerCarrinho,
    salvarCarrinho,
    totalCarrinho,
    quantidadeCarrinho,
    somenteDigitos,
    telefoneWhatsapp,
    formatarTelefone,
    dataHora,
    dataCurta,
    textoPedidoLoja,
    textoNotaCliente,
    linkWhatsapp,
    linkPedidoLoja,
    linkNotaCliente,
    avisar
  };
})();
