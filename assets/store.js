/* Loja: catálogo, carrinho e envio do pedido pelo WhatsApp. */
(function () {
  const Loja = window.Loja;
  const esc = (texto) =>
    String(texto == null ? '' : texto).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[c]);

  const estado = {
    produtos: [],
    categoria: 'todas',
    busca: '',
    carrinho: Loja.lerCarrinho(),
    pedido: null
  };

  const el = {
    grade: document.getElementById('grade'),
    vazio: document.getElementById('vazioCatalogo'),
    filtros: document.getElementById('filtros'),
    busca: document.getElementById('busca'),
    badge: document.getElementById('cartBadge'),
    drawer: document.getElementById('drawer'),
    scrim: document.getElementById('scrim'),
    itens: document.getElementById('carrinhoItens'),
    total: document.getElementById('carrinhoTotal'),
    checkout: document.getElementById('checkout'),
    sucesso: document.getElementById('sucesso'),
    recibo: document.getElementById('recibo')
  };

  function tamanhos(produto) {
    return String(produto.tamanhos || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  /* ---------- catálogo ---------- */
  function produtosFiltrados() {
    const termo = estado.busca.trim().toLowerCase();
    return estado.produtos.filter((p) => {
      const daCategoria = estado.categoria === 'todas' || p.categoria === estado.categoria;
      const doTermo =
        !termo ||
        `${p.nome} ${p.descricao || ''} ${p.categoria || ''}`.toLowerCase().includes(termo);
      return daCategoria && doTermo;
    });
  }

  function renderizarFiltros() {
    const categorias = Array.from(
      new Set(estado.produtos.map((p) => p.categoria).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const botoes = [{ nome: 'todas', rotulo: 'Todas' }].concat(
      categorias.map((c) => ({ nome: c, rotulo: c }))
    );

    el.filtros.innerHTML = botoes
      .map(
        (c) =>
          `<button class="chip${estado.categoria === c.nome ? ' active' : ''}" type="button" data-categoria="${esc(c.nome)}">${esc(c.rotulo)}</button>`
      )
      .join('');
  }

  function renderizarCatalogo() {
    const lista = produtosFiltrados();

    if (estado.produtos.length === 0) {
      el.grade.innerHTML = '';
      el.vazio.hidden = false;
      el.vazio.innerHTML =
        '<strong>A loja ainda não tem peças cadastradas</strong>Cadastre os produtos na <a href="/admin.html">área de administração</a>.';
      return;
    }

    el.vazio.hidden = lista.length > 0;
    if (lista.length === 0) {
      el.vazio.innerHTML =
        '<strong>Nenhuma peça encontrada</strong>Tente outra busca ou outra categoria.';
    }

    el.grade.innerHTML = lista
      .map((p) => {
        const opcoes = tamanhos(p);
        const foto = p.imagem
          ? `<img src="${esc(p.imagem)}" alt="${esc(p.nome)}" loading="lazy">`
          : '<div class="sem-foto">👗</div>';

        const seletor = opcoes.length
          ? `<select data-tamanho="${esc(p.id)}" aria-label="Tamanho de ${esc(p.nome)}">${opcoes
              .map((t) => `<option value="${esc(t)}">${esc(t)}</option>`)
              .join('')}</select>`
          : '';

        return `
          <article class="card-produto">
            <div class="foto">${foto}</div>
            <div class="info">
              ${p.categoria ? `<span class="cat">${esc(p.categoria)}</span>` : ''}
              <span class="nome">${esc(p.nome)}</span>
              ${p.descricao ? `<span class="desc">${esc(p.descricao)}</span>` : ''}
              <span class="preco">${Loja.money(p.preco)}</span>
              <div class="acoes">
                ${seletor}
                <button class="btn btn-primary" type="button" data-adicionar="${esc(p.id)}">
                  Adicionar
                </button>
              </div>
            </div>
          </article>`;
      })
      .join('');
  }

  /* ---------- carrinho ---------- */
  function renderizarCarrinho() {
    const itens = estado.carrinho;
    el.badge.textContent = Loja.quantidadeCarrinho(itens);
    el.total.textContent = Loja.money(Loja.totalCarrinho(itens));

    if (itens.length === 0) {
      el.itens.innerHTML =
        '<div class="vazio" style="border:none;background:none;padding:34px 8px;"><strong>Seu carrinho está vazio</strong>Escolha uma peça do catálogo para começar.</div>';
      return;
    }

    el.itens.innerHTML = itens
      .map(
        (item, indice) => `
        <div class="item-carrinho">
          <div class="thumb">${
            item.imagem ? `<img src="${esc(item.imagem)}" alt="${esc(item.nome)}">` : '👗'
          }</div>
          <div>
            <div class="titulo">${esc(item.nome)}</div>
            ${item.tamanho ? `<div class="variante">Tamanho ${esc(item.tamanho)}</div>` : ''}
            <div class="preco">${Loja.money(item.preco * item.qtd)}</div>
            <div class="qtd">
              <button type="button" data-menos="${indice}" aria-label="Diminuir">−</button>
              <span>${item.qtd}</span>
              <button type="button" data-mais="${indice}" aria-label="Aumentar">+</button>
            </div>
          </div>
          <button class="remover" type="button" data-remover="${indice}">remover</button>
        </div>`
      )
      .join('');
  }

  function salvarCarrinho() {
    Loja.salvarCarrinho(estado.carrinho);
    renderizarCarrinho();
  }

  function adicionarAoCarrinho(produtoId, tamanho) {
    const produto = estado.produtos.find((p) => p.id === produtoId);
    if (!produto) return;

    const existente = estado.carrinho.find(
      (i) => i.produtoId === produtoId && (i.tamanho || '') === (tamanho || '')
    );
    if (existente) {
      existente.qtd += 1;
    } else {
      estado.carrinho.push({
        produtoId: produto.id,
        nome: produto.nome,
        preco: Number(produto.preco),
        imagem: produto.imagem || '',
        tamanho: tamanho || '',
        qtd: 1
      });
    }
    salvarCarrinho();
    Loja.avisar(`${produto.nome} adicionado ao carrinho`);
  }

  function abrirCarrinho() {
    el.drawer.classList.add('aberto');
    el.drawer.setAttribute('aria-hidden', 'false');
    el.scrim.hidden = false;
  }

  function fecharCarrinho() {
    el.drawer.classList.remove('aberto');
    el.drawer.setAttribute('aria-hidden', 'true');
    el.scrim.hidden = true;
  }

  /* ---------- checkout ---------- */
  function resumoHtml() {
    const itens = estado.carrinho
      .map(
        (i) =>
          `<div class="linha"><span>${i.qtd}x ${esc(i.nome)}${
            i.tamanho ? ` (${esc(i.tamanho)})` : ''
          }</span><span>${Loja.money(i.preco * i.qtd)}</span></div>`
      )
      .join('');
    return `${itens}<div class="linha total"><span>Total</span><span>${Loja.money(
      Loja.totalCarrinho(estado.carrinho)
    )}</span></div>`;
  }

  function abrirCheckout() {
    if (estado.carrinho.length === 0) {
      Loja.avisar('Seu carrinho está vazio');
      return;
    }
    document.getElementById('resumoCheckout').innerHTML = resumoHtml();
    fecharCarrinho();
    el.checkout.hidden = false;
    document.getElementById('cliNome').focus();
  }

  function fecharCheckout() {
    el.checkout.hidden = true;
  }

  function entregaSelecionada() {
    const marcado = document.querySelector('input[name="entrega"]:checked');
    return marcado ? marcado.value : 'Entrega';
  }

  function atualizarCampoEndereco() {
    const entrega = entregaSelecionada();
    const campo = document.getElementById('campoEndereco');
    const input = document.getElementById('cliEndereco');
    const retirada = entrega === 'Retirada';
    campo.style.display = retirada ? 'none' : 'flex';
    input.required = !retirada;
    document.querySelectorAll('#segEntrega .seg-opt').forEach((opt) => {
      const radio = opt.querySelector('input');
      opt.classList.toggle('active', radio.checked);
    });
  }

  async function enviarPedido(evento) {
    evento.preventDefault();
    const botao = document.getElementById('btnEnviarPedido');

    const nome = document.getElementById('cliNome').value.trim();
    const telefone = document.getElementById('cliTelefone').value.trim();
    const entrega = entregaSelecionada();
    const endereco = document.getElementById('cliEndereco').value.trim();
    const pagamento = document.getElementById('cliPagamento').value;
    const observacao = document.getElementById('cliObs').value.trim();

    if (!nome) {
      Loja.avisar('Informe seu nome');
      return;
    }
    if (Loja.somenteDigitos(telefone).length < 10) {
      Loja.avisar('Informe um WhatsApp com DDD');
      return;
    }
    if (entrega === 'Entrega' && !endereco) {
      Loja.avisar('Informe o endereço para entrega');
      return;
    }

    botao.disabled = true;
    botao.textContent = 'Enviando...';

    try {
      const dados = await Loja.api('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          cliente: { nome, telefone, endereco: entrega === 'Entrega' ? endereco : '', entrega },
          itens: estado.carrinho.map((i) => ({
            produtoId: i.produtoId,
            qtd: i.qtd,
            tamanho: i.tamanho || ''
          })),
          pagamento,
          observacao
        })
      });

      estado.pedido = dados.pedido;
      estado.carrinho = [];
      salvarCarrinho();
      fecharCheckout();
      mostrarSucesso(dados.pedido);
      document.getElementById('formCheckout').reset();
      atualizarCampoEndereco();
    } catch (erro) {
      Loja.avisar(erro.message || 'Não foi possível registrar o pedido');
    } finally {
      botao.disabled = false;
      botao.textContent = 'Enviar pedido pelo WhatsApp';
    }
  }

  function mostrarSucesso(pedido) {
    document.getElementById('sucessoNumero').textContent = pedido.numero;
    const linkLoja = document.getElementById('linkLoja');
    linkLoja.href = Loja.linkPedidoLoja(pedido);
    const linkCliente = document.getElementById('linkCliente');
    linkCliente.href = Loja.linkNotaCliente(pedido);
    el.sucesso.hidden = false;
  }

  /* ---------- nota de compra ---------- */
  function renderizarRecibo(pedido) {
    const linhas = (pedido.itens || [])
      .map(
        (item) =>
          `<div class="linha"><span>${item.qtd}x ${esc(item.nome)}${
            item.tamanho ? ` (${esc(item.tamanho)})` : ''
          }</span><span>${Loja.money(item.preco * item.qtd)}</span></div>`
      )
      .join('');

    document.getElementById('reciboConteudo').innerHTML = `
      <h3>NOTA DE COMPRA</h3>
      <div class="loja-sub">${esc(Loja.config.nome)}</div>
      <div class="linha"><span>Pedido</span><strong>#${esc(pedido.numero)}</strong></div>
      <div class="linha"><span>Data</span><span>${esc(Loja.dataHora(pedido.criadoEm))}</span></div>
      <div class="linha"><span>Cliente</span><span>${esc(pedido.cliente.nome)}</span></div>
      <div class="linha"><span>WhatsApp</span><span>${esc(
        Loja.formatarTelefone(pedido.cliente.telefone)
      )}</span></div>
      <div class="linha"><span>${
        pedido.cliente.entrega === 'Retirada' ? 'Retirada' : 'Entrega'
      }</span><span>${esc(pedido.cliente.endereco || 'na loja')}</span></div>
      <hr class="sep">
      ${linhas}
      <hr class="sep">
      <div class="linha total"><span>Total</span><span>${Loja.money(pedido.total)}</span></div>
      <div class="linha"><span>Pagamento</span><span>${esc(pedido.pagamento)}</span></div>
      ${pedido.observacao ? `<div class="linha"><span>Obs.</span><span>${esc(pedido.observacao)}</span></div>` : ''}
      <div class="rodape-recibo">Obrigado pela sua compra! 💛</div>
    `;

    document.getElementById('reciboLinkCliente').href = Loja.linkNotaCliente(pedido);
  }

  function abrirRecibo() {
    if (!estado.pedido) return;
    renderizarRecibo(estado.pedido);
    el.recibo.hidden = false;
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', (evento) => {
    const alvo = evento.target.closest('button, a');
    if (!alvo) return;

    if (alvo.dataset.categoria) {
      estado.categoria = alvo.dataset.categoria;
      renderizarFiltros();
      renderizarCatalogo();
      return;
    }

    if (alvo.dataset.adicionar) {
      const seletor = document.querySelector(`select[data-tamanho="${alvo.dataset.adicionar}"]`);
      adicionarAoCarrinho(alvo.dataset.adicionar, seletor ? seletor.value : '');
      return;
    }

    if (alvo.dataset.mais !== undefined && alvo.dataset.mais !== '') {
      estado.carrinho[Number(alvo.dataset.mais)].qtd += 1;
      salvarCarrinho();
      return;
    }

    if (alvo.dataset.menos !== undefined && alvo.dataset.menos !== '') {
      const indice = Number(alvo.dataset.menos);
      estado.carrinho[indice].qtd -= 1;
      if (estado.carrinho[indice].qtd <= 0) estado.carrinho.splice(indice, 1);
      salvarCarrinho();
      return;
    }

    if (alvo.dataset.remover !== undefined && alvo.dataset.remover !== '') {
      estado.carrinho.splice(Number(alvo.dataset.remover), 1);
      salvarCarrinho();
      return;
    }

    if (alvo.dataset.fecharCarrinho !== undefined) {
      fecharCarrinho();
      return;
    }

    if (alvo.dataset.fecharCheckout !== undefined) {
      fecharCheckout();
      return;
    }

    if (alvo.dataset.abrirRecibo !== undefined) {
      abrirRecibo();
      return;
    }

    if (alvo.dataset.fecharRecibo !== undefined) {
      el.recibo.hidden = true;
      return;
    }

    if (alvo.dataset.imprimirRecibo !== undefined) {
      document.body.classList.add('printing-recibo');
      window.print();
      setTimeout(() => document.body.classList.remove('printing-recibo'), 300);
    }
  });

  document.getElementById('abrirCarrinho').addEventListener('click', abrirCarrinho);
  document.getElementById('irCheckout').addEventListener('click', abrirCheckout);
  document.getElementById('formCheckout').addEventListener('submit', enviarPedido);
  el.scrim.addEventListener('click', fecharCarrinho);

  document.querySelectorAll('input[name="entrega"]').forEach((radio) => {
    radio.addEventListener('change', atualizarCampoEndereco);
  });

  el.busca.addEventListener('input', (evento) => {
    estado.busca = evento.target.value;
    renderizarCatalogo();
  });

  document.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Escape') return;
    if (!el.recibo.hidden) el.recibo.hidden = true;
    else if (!el.sucesso.hidden) el.sucesso.hidden = true;
    else if (!el.checkout.hidden) fecharCheckout();
    else fecharCarrinho();
  });

  /* ---------- início ---------- */
  async function iniciar() {
    renderizarCarrinho();
    atualizarCampoEndereco();

    try {
      const dados = await Loja.api('/api/products');
      estado.produtos = (dados && dados.produtos) || [];
    } catch (erro) {
      estado.produtos = [];
      Loja.avisar('Não foi possível carregar o catálogo agora');
    }

    renderizarFiltros();
    renderizarCatalogo();
  }

  (async function () {
    await Loja.carregarConfig();
    await iniciar();
  })();
})();
