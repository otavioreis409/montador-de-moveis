(function () {
  const cfg = window.REIS_CONFIG;
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  const telaLogin = document.getElementById('tela-login');
  const telaPainel = document.getElementById('tela-painel');
  const formLogin = document.getElementById('form-login');
  const erroLogin = document.getElementById('erro-login');
  const listaPedidos = document.getElementById('lista-pedidos');
  const filtro = document.getElementById('filtro');
  const formBloqueio = document.getElementById('form-bloqueio');
  const listaBloqueios = document.getElementById('lista-bloqueios');
  const erroBloqueio = document.getElementById('erro-bloqueio');

  const STATUS = [
    ['novo', 'Novo'],
    ['orcado', 'Orçado'],
    ['confirmado', 'Confirmado'],
    ['concluido', 'Concluído'],
    ['cancelado', 'Cancelado']
  ];
  const ATIVOS = ['novo', 'orcado', 'confirmado'];

  // Evita injeção de HTML vindo dos clientes: sempre usar textContent
  function el(tag, texto, classe) {
    const e = document.createElement(tag);
    if (texto !== undefined && texto !== null) e.textContent = texto;
    if (classe) e.className = classe;
    return e;
  }

  const fmtDataHora = (iso) => new Date(iso).toLocaleString('pt-BR', {
    weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  });

  function mostrarPainel(logado) {
    telaLogin.hidden = logado;
    telaPainel.hidden = !logado;
    if (logado) {
      carregarPedidos();
      carregarBloqueios();
    }
  }

  // ---------- Login ----------
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    erroLogin.hidden = true;
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) {
      erroLogin.textContent = 'E-mail ou senha não conferem.';
      erroLogin.hidden = false;
      return;
    }
    mostrarPainel(true);
  });

  document.getElementById('sair').addEventListener('click', async () => {
    await sb.auth.signOut();
    mostrarPainel(false);
  });

  // ---------- Pedidos ----------
  async function carregarPedidos() {
    listaPedidos.innerHTML = '';
    listaPedidos.appendChild(el('p', 'Carregando pedidos...', 'ajuda'));

    const { data, error } = await sb
      .from('pedidos')
      .select('*')
      .order('data_hora', { ascending: true });

    listaPedidos.innerHTML = '';
    if (error) {
      listaPedidos.appendChild(el('p', 'Não foi possível carregar os pedidos.', 'erro'));
      return;
    }

    const modo = filtro.value;
    const visiveis = (data || []).filter((p) => {
      if (modo === 'ativos') return ATIVOS.includes(p.status);
      if (modo === 'todos') return true;
      return p.status === modo;
    });

    if (visiveis.length === 0) {
      listaPedidos.appendChild(el('div', 'Nenhum pedido nesse filtro.', 'vazio'));
      return;
    }

    for (const p of visiveis) {
      listaPedidos.appendChild(await montarPedido(p));
    }
  }

  async function montarPedido(p) {
    const card = el('article', null, 'pedido');

    const cab = el('header');
    cab.appendChild(el('h3', p.nome));
    const tag = el('span', p.status === 'cancelado' ? 'Cancelado' : fmtDataHora(p.data_hora));
    if (p.status === 'cancelado') tag.className = 'tag-cancelado';
    cab.appendChild(tag);
    card.appendChild(cab);

    const lista = el('dl');
    const itens = [
      ['Quando', `${fmtDataHora(p.data_hora)} (${p.duracao_horas}h)`],
      ['Porte', p.porte],
      ['Modelo', p.modelo],
      ['Endereço', p.endereco],
      ['WhatsApp', p.whatsapp]
    ];
    for (const [rotulo, valor] of itens) {
      lista.appendChild(el('dt', rotulo));
      lista.appendChild(el('dd', valor));
    }
    if (p.valor !== null) {
      lista.appendChild(el('dt', 'Valor'));
      lista.appendChild(el('dd', Number(p.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })));
    }
    card.appendChild(lista);

    if (p.foto_path) {
      const { data: link } = await sb.storage.from('fotos').createSignedUrl(p.foto_path, 3600);
      if (link && link.signedUrl) {
        const img = el('img', null, 'foto');
        img.src = link.signedUrl;
        img.alt = `Foto do móvel de ${p.nome}`;
        card.appendChild(img);
      }
    }

    // Ações
    const acoes = el('div', null, 'acoes');

    const campoStatus = el('div', null, 'campo');
    const rotStatus = el('label', 'Status');
    const selStatus = el('select');
    selStatus.id = `status-${p.id}`;
    rotStatus.htmlFor = selStatus.id;
    for (const [valor, texto] of STATUS) {
      const op = el('option', texto);
      op.value = valor;
      if (valor === p.status) op.selected = true;
      selStatus.appendChild(op);
    }
    campoStatus.append(rotStatus, selStatus);

    const campoValor = el('div', null, 'campo');
    const rotValor = el('label', 'Valor (R$)');
    const inpValor = el('input');
    inpValor.type = 'number';
    inpValor.step = '0.01';
    inpValor.min = '0';
    inpValor.id = `valor-${p.id}`;
    rotValor.htmlFor = inpValor.id;
    if (p.valor !== null) inpValor.value = p.valor;
    campoValor.append(rotValor, inpValor);

    const btnSalvar = el('button', 'Salvar', 'botao');
    btnSalvar.type = 'button';

    const aviso = el('p', null, 'ajuda');

    btnSalvar.addEventListener('click', async () => {
      const novoStatus = selStatus.value;
      const novoValor = inpValor.value === '' ? null : Number(inpValor.value);
      const dados = { status: novoStatus, valor: novoValor };

      // Cancelamento no dia da montagem gera cobrança de 50%
      if (novoStatus === 'cancelado') {
        const hoje = new Date();
        const dataMontagem = new Date(p.data_hora);
        const mesmoDia =
          hoje.getFullYear() === dataMontagem.getFullYear() &&
          hoje.getMonth() === dataMontagem.getMonth() &&
          hoje.getDate() === dataMontagem.getDate();
        dados.cobranca_cancelamento = mesmoDia;
        if (mesmoDia && novoValor) {
          const cobranca = (novoValor * 0.5).toFixed(2).replace('.', ',');
          aviso.textContent = `Cancelamento no dia da montagem: cobrança de 50% (R$ ${cobranca}).`;
        }
      }

      const { error } = await sb.from('pedidos').update(dados).eq('id', p.id);
      if (error) {
        const msg = String(error.message).includes('horario_indisponivel')
          ? 'Esse horário conflita com outro pedido ou bloqueio.'
          : 'Não foi possível salvar. Tente de novo.';
        aviso.textContent = msg;
        aviso.className = 'erro';
        return;
      }
      aviso.className = 'ajuda';
      if (!aviso.textContent) aviso.textContent = 'Salvo.';
      setTimeout(carregarPedidos, 600);
    });

    acoes.append(campoStatus, campoValor, btnSalvar);
    card.appendChild(acoes);
    card.appendChild(aviso);
    return card;
  }

  filtro.addEventListener('change', carregarPedidos);

  // ---------- Bloqueios ----------
  async function carregarBloqueios() {
    const { data, error } = await sb
      .from('bloqueios')
      .select('*')
      .order('inicio', { ascending: true });

    listaBloqueios.innerHTML = '';
    if (error) {
      listaBloqueios.appendChild(el('li', 'Não foi possível carregar os bloqueios.'));
      return;
    }
    if (!data || data.length === 0) {
      listaBloqueios.appendChild(el('li', 'Nenhum bloqueio cadastrado.'));
      return;
    }
    for (const b of data) {
      const li = el('li');
      const texto = `${fmtDataHora(b.inicio)} até ${fmtDataHora(b.fim)}${b.motivo ? ' · ' + b.motivo : ''}`;
      li.appendChild(el('span', texto));
      const btn = el('button', 'Remover', 'botao');
      btn.type = 'button';
      btn.addEventListener('click', async () => {
        await sb.from('bloqueios').delete().eq('id', b.id);
        carregarBloqueios();
      });
      li.appendChild(btn);
      listaBloqueios.appendChild(li);
    }
  }

  formBloqueio.addEventListener('submit', async (e) => {
    e.preventDefault();
    erroBloqueio.hidden = true;
    const inicio = document.getElementById('bloq-inicio').value;
    const fim = document.getElementById('bloq-fim').value;
    const motivo = document.getElementById('bloq-motivo').value.trim();

    if (!inicio || !fim) {
      erroBloqueio.textContent = 'Informe o início e o fim do bloqueio.';
      erroBloqueio.hidden = false;
      return;
    }
    if (new Date(fim) <= new Date(inicio)) {
      erroBloqueio.textContent = 'O fim precisa ser depois do início.';
      erroBloqueio.hidden = false;
      return;
    }

    const { error } = await sb.from('bloqueios').insert({
      inicio: new Date(inicio).toISOString(),
      fim: new Date(fim).toISOString(),
      motivo: motivo || null
    });
    if (error) {
      erroBloqueio.textContent = 'Não foi possível bloquear. Verifique se há pedido nesse horário.';
      erroBloqueio.hidden = false;
      return;
    }
    formBloqueio.reset();
    carregarBloqueios();
  });

  // Entrada: se já houver sessão, abre o painel direto
  sb.auth.getSession().then(({ data }) => mostrarPainel(!!data.session));
})();
