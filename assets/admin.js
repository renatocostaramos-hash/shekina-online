/* Administração: login, cadastro de produtos (com foto) e relatório de vendas. */
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
    pedidos: [],
    editando: null,
    imagemNova: null,
    removerImagem: false,
    periodo: '7',
    pedidoRecibo: null
  };

  const el = {
    login: document.getElementById('login'),
    app: document.getElementById('app'),
    loginErro: document.getElementById('loginErro'),
    form: document.getElementById('formProduto'),
    tituloForm: document.getElementById('tituloForm'),
    listaProdutos: document.getElementById('listaProdutos'),
    contagemProdutos: document.getElementById('contagemProdutos'),
    listaPedidos: document.getElementById('listaPedidos'),
    contagemPedidos: document.getElementById('contagemPedidos'),
    stats: document.getElementById('statsVendas'),
    topProdutos: document.getElementById('topProdutos'),
    preview: document.getElementById('pPreview'),
    recibo: document.getElementById('recibo')
  };

  /* ---------- login ---------- */
  async function entrar(senha) {
    const dados = await Loja.api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ senha })
    });
    sessionStorage.setItem('bellamoda.admin.token', dados.token);
  }

  function sair() {
    sessionStorage.removeItem('bellamoda.admin.token');
    el.app.hidden = true;
    el.login.hidden = false;
    document.getElementById('senha').value = '';
  }

  async function abrirPainel() {
    el.login.hidden = true;
    el.app.hidden = false;
    await carregarTudo();
  }

  /* ---------- produtos ---------- */
  function precoNumero(texto) {
    const limpo = String(texto || '')
      .replace(/[^\d,.]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const valor = parseFloat(limpo);
    return Number.isFinite(valor) ? Math.round(valor * 100) / 100 : NaN;
  }

  function renderizarProdutos() {
    el.contagemProdutos.textContent = estado.produtos.length
      ? `${estado.produtos.length} peça(s) cadastrada(s).`
      : 'Nenhuma peça cadastrada ainda.';

    if (estado.produtos.length === 0) {
      el.listaProdutos.innerHTML =
        '<div class="vazio" style="padding:26px 10px"><strong>Sem produtos</strong>Use o formulário acima para cadastrar a primeira peça.</div>';
      return;
    }

    el.listaProdutos.innerHTML = estado.produtos
      .map(
        (p) => `
        <div class="linha-produto">
          <div class="thumb">${p.imagem ? `<img src="${esc(p.imagem)}" alt="">` : '👗'}</div>
          <div>
            <div class="nome">${esc(p.nome)}</div>
            <div class="meta">
              ${Loja.money(p.preco)}
              ${p.categoria ? ` · ${esc(p.categoria)}` : ''}
              ${p.tamanhos ? ` · ${esc(p.tamanhos)}` : ''}
              · <span class="tag ${p.ativo ? 'tag-on' : 'tag-off'}">${p.ativo ? 'à venda' : 'oculto'}</span>
            </div>
          </div>
          <div class="acoes">
            <button class="btn btn-outline" type="button" data-editar="${esc(p.id)}">Editar</button>
            <button class="btn btn-danger" type="button" data-excluir="${esc(p.id)}">Excluir</button>
          </div>
        </div>`
      )
      .join('');
  }

  function limparFormulario() {
    estado.editando = null;
    estado.imagemNova = null;
    estado.removerImagem = false;
    el.form.reset();
    document.getElementById('pAtivo').value = 'sim';
    el.preview.innerHTML = '👗';
    el.tituloForm.textContent = 'Novo produto';
    document.getElementById('btnSalvar').textContent = 'Salvar produto';
    document.getElementById('btnCancelarEdicao').hidden = true;
  }

  function editarProduto(id) {
    const produto = estado.produtos.find((p) => p.id === id);
    if (!produto) return;

    estado.editando = id;
    estado.imagemNova = null;
    estado.removerImagem = false;

    document.getElementById('pNome').value = produto.nome || '';
    document.getElementById('pPreco').value = Number(produto.preco || 0)
      .toFixed(2)
      .replace('.', ',');
    document.getElementById('pCategoria').value = produto.categoria || '';
    document.getElementById('pTamanhos').value = produto.tamanhos || '';
    document.getElementById('pDescricao').value = produto.descricao || '';
    document.getElementById('pAtivo').value = produto.ativo ? 'sim' : 'nao';
    el.preview.innerHTML = produto.imagem
      ? `<img src="${esc(produto.imagem)}" alt="">`
      : '👗';

    el.tituloForm.textContent = 'Editar produto';
    document.getElementById('btnSalvar').textContent = 'Salvar alterações';
    document.getElementById('btnCancelarEdicao').hidden = false;
    el.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function lerImagem(arquivo) {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(leitor.result);
      leitor.onerror = () => reject(new Error('Não foi possível ler a imagem'));
      leitor.readAsDataURL(arquivo);
    });
  }

  async function salvarProduto(evento) {
    evento.preventDefault();

    const nome = document.getElementById('pNome').value.trim();
    const preco = precoNumero(document.getElementById('pPreco').value);
    const categoria = document.getElementById('pCategoria').value.trim();
    const tamanhos = document.getElementById('pTamanhos').value.trim();
    const descricao = document.getElementById('pDescricao').value.trim();
    const ativo = document.getElementById('pAtivo').value === 'sim';

    if (!nome) return Loja.avisar('Informe o nome da peça');
    if (!Number.isFinite(preco) || preco <= 0) return Loja.avisar('Informe um preço válido');

    const corpo = { nome, preco, categoria, tamanhos, descricao, ativo };

    if (estado.imagemNova) corpo.imagem = estado.imagemNova;
    else if (estado.removerImagem) corpo.imagem = '';

    const botao = document.getElementById('btnSalvar');
    botao.disabled = true;

    try {
      if (estado.editando) {
        await Loja.api(`/api/admin/products/${estado.editando}`, {
          method: 'PUT',
          body: JSON.stringify(corpo)
        });
        Loja.avisar('Produto atualizado');
      } else {
        await Loja.api('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(corpo)
        });
        Loja.avisar('Produto cadastrado');
      }
      limparFormulario();
      await carregarProdutos();
    } catch (erro) {
      Loja.avisar(erro.message || 'Não foi possível salvar o produto');
    } finally {
      botao.disabled = false;
    }
  }

  async function excluirProduto(id) {
    const produto = estado.produtos.find((p) => p.id === id);
    if (!produto) return;
    if (!confirm(`Excluir "${produto.nome}" do catálogo?`)) return;

    try {
      await Loja.api(`/api/admin/products/${id}`, { method: 'DELETE' });
      if (estado.editando === id) limparFormulario();
      Loja.avisar('Produto excluído');
      await carregarProdutos();
    } catch (erro) {
      Loja.avisar(erro.message || 'Não foi possível excluir');
    }
  }

  /* ---------- vendas ---------- */
  function pedidosDoPeriodo() {
    if (estado.periodo === 'todos') return estado.pedidos;
    const agora = new Date();
    const limite = new Date(agora);
    if (estado.periodo === 'hoje') limite.setHours(0, 0, 0, 0);
    else limite.setDate(agora.getDate() - Number(estado.periodo));

    return estado.pedidos.filter((p) => new Date(p.criadoEm) >= limite);
  }

  function resumoVendas(lista) {
    const validos = lista.filter((p) => p.status !== 'Cancelado');
    const faturamento = validos.reduce((soma, p) => soma + Number(p.total || 0), 0);
    const itens = validos.reduce(
      (soma, p) => soma + (p.itens || []).reduce((s, i) => s + Number(i.qtd), 0),
      0
    );

    const porProduto = new Map();
    validos.forEach((p) => {
      (p.itens || []).forEach((item) => {
        const atual = porProduto.get(item.nome) || { nome: item.nome, qtd: 0, total: 0 };
        atual.qtd += Number(item.qtd);
        atual.total += Number(item.preco) * Number(item.qtd);
        porProduto.set(item.nome, atual);
      });
    });

    return {
      faturamento: Loja.arredondar(faturamento),
      pedidos: validos.length,
      ticket: validos.length ? Loja.arredondar(faturamento / validos.length) : 0,
      itens,
      top: Array.from(porProduto.values()).sort((a, b) => b.qtd - a.qtd).slice(0, 5)
    };
  }

  function renderizarVendas() {
    const lista = pedidosDoPeriodo();
    const resumo = resumoVendas(lista);

    el.stats.innerHTML = `
      <div class="stat"><div class="rotulo">Faturamento</div><div class="valor">${Loja.money(resumo.faturamento)}</div></div>
      <div class="stat"><div class="rotulo">Pedidos</div><div class="valor">${resumo.pedidos}</div></div>
      <div class="stat"><div class="rotulo">Ticket médio</div><div class="valor">${Loja.money(resumo.ticket)}</div></div>
      <div class="stat"><div class="rotulo">Peças vendidas</div><div class="valor">${resumo.itens}</div></div>
    `;

    el.topProdutos.innerHTML = resumo.top.length
      ? `<h3 style="font-size:15px;margin-bottom:8px">Mais vendidos</h3>${resumo.top
          .map(
            (item) =>
              `<div class="resumo" style="margin-bottom:6px"><div class="linha"><span>${esc(
                item.nome
              )}</span><span>${item.qtd} un · ${Loja.money(item.total)}</span></div></div>`
          )
          .join('')}`
      : '';

    el.contagemPedidos.textContent = lista.length
      ? `${lista.length} pedido(s) no período selecionado.`
      : 'Nenhum pedido no período selecionado.';

    if (lista.length === 0) {
      el.listaPedidos.innerHTML =
        '<div class="vazio" style="padding:26px 10px"><strong>Sem pedidos</strong>Os pedidos enviados pela loja aparecem aqui.</div>';
      return;
    }

    el.listaPedidos.innerHTML = lista
      .map((p) => {
        const statusClasse = {
          Novo: 'status-novo',
          Pago: 'status-pago',
          Entregue: 'status-entregue',
          Cancelado: 'status-cancelado'
        }[p.status] || 'status-novo';

        const itens = (p.itens || [])
          .map(
            (i) =>
              `${i.qtd}x ${esc(i.nome)}${i.tamanho ? ` (${esc(i.tamanho)})` : ''} — ${Loja.money(
                i.preco * i.qtd
              )}`
          )
          .join('<br>');

        return `
          <div class="pedido">
            <div class="topo">
              <span class="num">#${esc(p.numero)} · ${Loja.money(p.total)}</span>
              <span class="status ${statusClasse}">${esc(p.status)}</span>
            </div>
            <div class="quando">${esc(Loja.dataHora(p.criadoEm))}</div>
            <div class="itens">${itens}</div>
            <div class="cliente">
              👤 ${esc(p.cliente.nome)} · ${esc(Loja.formatarTelefone(p.cliente.telefone))}<br>
              ${
                p.cliente.entrega === 'Retirada'
                  ? '🏬 Retirada na loja'
                  : `🚚 ${esc(p.cliente.endereco || 'endereço a combinar')}`
              } · 💳 ${esc(p.pagamento)}
              ${p.observacao ? `<br>📝 ${esc(p.observacao)}` : ''}
            </div>
            <div class="acoes">
              <select data-status="${esc(p.id)}" aria-label="Status do pedido">
                ${['Novo', 'Pago', 'Entregue', 'Cancelado']
                  .map((s) => `<option value="${s}"${p.status === s ? ' selected' : ''}>${s}</option>`)
                  .join('')}
              </select>
              <button class="btn btn-outline" type="button" data-nota="${esc(p.id)}">Nota de compra</button>
              <a class="btn btn-whats" href="${Loja.linkNotaCliente(p)}" target="_blank" rel="noopener">
                Enviar ao cliente
              </a>
              <a class="btn btn-outline" href="${Loja.linkPedidoLoja(p)}" target="_blank" rel="noopener">
                WhatsApp da loja
              </a>
              <button class="btn btn-danger" type="button" data-excluir-pedido="${esc(p.id)}">
                Excluir
              </button>
            </div>
          </div>`;
      })
      .join('');
  }

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
    estado.pedidoRecibo = pedido;
    el.recibo.hidden = false;
  }

  async function alterarStatus(id, status) {
    try {
      await Loja.api(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      const pedido = estado.pedidos.find((p) => p.id === id);
      if (pedido) pedido.status = status;
      renderizarVendas();
      Loja.avisar(`Pedido atualizado: ${status}`);
    } catch (erro) {
      Loja.avisar(erro.message || 'Não foi possível atualizar o pedido');
      renderizarVendas();
    }
  }

  async function excluirPedido(id) {
    if (!confirm('Excluir este pedido do relatório?')) return;
    try {
      await Loja.api(`/api/admin/orders/${id}`, { method: 'DELETE' });
      estado.pedidos = estado.pedidos.filter((p) => p.id !== id);
      renderizarVendas();
      Loja.avisar('Pedido excluído');
    } catch (erro) {
      Loja.avisar(erro.message || 'Não foi possível excluir');
    }
  }

  function exportarCsv() {
    const lista = pedidosDoPeriodo();
    if (lista.length === 0) return Loja.avisar('Nenhum pedido no período');

    const linhas = [
      ['Pedido', 'Data', 'Cliente', 'WhatsApp', 'Entrega', 'Endereco', 'Itens', 'Pagamento', 'Status', 'Total']
    ];

    lista.forEach((p) => {
      linhas.push([
        p.numero,
        Loja.dataHora(p.criadoEm),
        p.cliente.nome,
        p.cliente.telefone,
        p.cliente.entrega,
        p.cliente.endereco || '',
        (p.itens || []).map((i) => `${i.qtd}x ${i.nome}${i.tamanho ? ` (${i.tamanho})` : ''}`).join(' | '),
        p.pagamento,
        p.status,
        Number(p.total).toFixed(2).replace('.', ',')
      ]);
    });

    const csv = linhas
      .map((linha) => linha.map((campo) => `"${String(campo).replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `vendas-bellamoda-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /* ---------- carregamento ---------- */
  async function carregarProdutos() {
    const dados = await Loja.api('/api/admin/products');
    estado.produtos = (dados && dados.produtos) || [];
    renderizarProdutos();
  }

  async function carregarPedidos() {
    const dados = await Loja.api('/api/admin/orders');
    estado.pedidos = (dados && dados.pedidos) || [];
    renderizarVendas();
  }

  async function carregarTudo() {
    try {
      await Promise.all([carregarProdutos(), carregarPedidos()]);
    } catch (erro) {
      if (erro.status === 401) {
        sair();
        el.loginErro.textContent = 'Sessão expirada. Entre novamente.';
      } else {
        Loja.avisar(erro.message || 'Não foi possível carregar os dados');
      }
    }
  }

  /* ---------- eventos ---------- */
  document.getElementById('formLogin').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    el.loginErro.textContent = '';
    const senha = document.getElementById('senha').value;
    try {
      await entrar(senha);
      document.getElementById('senha').value = '';
      await abrirPainel();
    } catch (erro) {
      el.loginErro.textContent = erro.message || 'Senha incorreta';
    }
  });

  el.form.addEventListener('submit', salvarProduto);
  document.getElementById('btnCancelarEdicao').addEventListener('click', limparFormulario);
  document.getElementById('btnExportar').addEventListener('click', exportarCsv);

  document.getElementById('pImagem').addEventListener('change', async (evento) => {
    const arquivo = evento.target.files && evento.target.files[0];
    if (!arquivo) return;

    if (!/^image\/(png|jpeg)$/.test(arquivo.type)) {
      evento.target.value = '';
      return Loja.avisar('Envie uma imagem JPG ou PNG');
    }
    if (arquivo.size > 4 * 1024 * 1024) {
      evento.target.value = '';
      return Loja.avisar('A imagem deve ter até 4 MB');
    }

    try {
      const base64 = await lerImagem(arquivo);
      estado.imagemNova = base64;
      estado.removerImagem = false;
      el.preview.innerHTML = `<img src="${base64}" alt="">`;
    } catch (erro) {
      Loja.avisar('Não foi possível ler a imagem');
    }
  });

  document.getElementById('btnRemoverFoto').addEventListener('click', () => {
    estado.imagemNova = null;
    estado.removerImagem = true;
    document.getElementById('pImagem').value = '';
    el.preview.innerHTML = '👗';
  });

  document.addEventListener('click', (evento) => {
    const alvo = evento.target.closest('button, a');
    if (!alvo) return;

    if (alvo.dataset.aba === 'sair') return sair();
    if (alvo.dataset.aba) {
      document.querySelectorAll('.adm-tab').forEach((t) => {
        t.classList.toggle('active', t === alvo);
      });
      document.getElementById('abaProdutos').hidden = alvo.dataset.aba !== 'produtos';
      document.getElementById('abaVendas').hidden = alvo.dataset.aba !== 'vendas';
      return;
    }

    if (alvo.dataset.editar) return editarProduto(alvo.dataset.editar);
    if (alvo.dataset.excluir) return excluirProduto(alvo.dataset.excluir);

    if (alvo.dataset.periodo) {
      estado.periodo = alvo.dataset.periodo;
      document.querySelectorAll('#filtroPeriodo .chip').forEach((chip) => {
        chip.classList.toggle('active', chip === alvo);
      });
      renderizarVendas();
      return;
    }

    if (alvo.dataset.nota) {
      const pedido = estado.pedidos.find((p) => p.id === alvo.dataset.nota);
      if (pedido) renderizarRecibo(pedido);
      return;
    }

    if (alvo.dataset.excluirPedido) return excluirPedido(alvo.dataset.excluirPedido);

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

  document.addEventListener('change', (evento) => {
    const seletor = evento.target.closest('select[data-status]');
    if (seletor) alterarStatus(seletor.dataset.status, seletor.value);
  });

  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !el.recibo.hidden) el.recibo.hidden = true;
  });

  /* ---------- início ---------- */
  (async function iniciar() {
    await Loja.carregarConfig();
    if (sessionStorage.getItem('bellamoda.admin.token')) {
      await abrirPainel();
    }
  })();
})();
