(function () {
  const cfg = window.REIS_CONFIG;
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  const form = document.getElementById('form-pedido');
  const campoData = document.getElementById('data');
  const campoPorte = document.getElementById('porte');
  const area = document.getElementById('horarios');
  const campoHorario = document.getElementById('horario');
  const erroBox = document.getElementById('erro-form');
  const botao = document.getElementById('enviar');
  const confirmacao = document.getElementById('confirmacao');
  const resumo = document.getElementById('resumo-pedido');

  // Não deixa escolher dia passado
  const hoje = new Date();
  campoData.min = new Date(hoje.getTime() - hoje.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);

  const formatarHora = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const formatarData = (d) => d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  function mostrarErro(msg) {
    erroBox.textContent = msg;
    erroBox.hidden = !msg;
  }

  // Converte "AAAA-MM-DD" em Date local, sem problema de fuso
  function dataDoCampo() {
    if (!campoData.value) return null;
    const [a, m, d] = campoData.value.split('-').map(Number);
    return new Date(a, m - 1, d);
  }

  async function carregarHorarios() {
    const dia = dataDoCampo();
    const porte = campoPorte.value;
    campoHorario.value = '';
    botao.disabled = false;

    if (!dia || !porte) {
      area.innerHTML = '<p class="vazio">Escolha o dia e o porte para ver os horários livres.</p>';
      return;
    }

    area.innerHTML = '<p class="vazio">Buscando horários...</p>';

    const { data, error } = await sb.rpc('horarios_ocupados');
    if (error) {
      area.innerHTML = '';
      mostrarErro('Não foi possível carregar a agenda. Tente de novo em instantes.');
      return;
    }

    const ocupados = (data || []).map((o) => ({
      inicio: new Date(o.inicio),
      fim: new Date(o.fim)
    }));

    const livres = window.Horarios.horariosLivres(dia, porte, ocupados, new Date());

    area.innerHTML = '';
    if (livres.length === 0) {
      area.innerHTML = '<p class="vazio">Sem horários livres neste dia. Escolha outra data.</p>';
      return;
    }

    livres.forEach((inicio) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = formatarHora(inicio);
      b.setAttribute('aria-pressed', 'false');
      b.dataset.iso = inicio.toISOString();
      b.addEventListener('click', () => selecionarHorario(b));
      area.appendChild(b);
    });
  }

  function selecionarHorario(botaoEscolhido) {
    area.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    botaoEscolhido.setAttribute('aria-pressed', 'true');
    campoHorario.value = botaoEscolhido.dataset.iso;
    mostrarErro('');
  }

  campoData.addEventListener('change', carregarHorarios);
  campoPorte.addEventListener('change', carregarHorarios);

  // Valida o WhatsApp: 10 ou 11 dígitos com DDD
  function whatsappValido(texto) {
    const digitos = texto.replace(/\D/g, '');
    return digitos.length === 10 || digitos.length === 11;
  }

  async function enviarFoto(arquivo) {
    if (!arquivo) return null;
    if (arquivo.size > 8 * 1024 * 1024) {
      throw new Error('A foto passou de 8 MB. Envie uma imagem menor.');
    }
    const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase();
    const caminho = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage.from('fotos').upload(caminho, arquivo, {
      contentType: arquivo.type || 'image/jpeg'
    });
    if (error) throw new Error('Não foi possível enviar a foto. Tente sem foto ou em outro formato.');
    return caminho;
  }

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    mostrarErro('');

    const f = new FormData(form);
    const nome = f.get('nome').trim();
    const whatsapp = f.get('whatsapp').trim();
    const endereco = f.get('endereco').trim();
    const modelo = f.get('modelo').trim();
    const porte = f.get('porte');
    const horario = f.get('horario');
    const arquivo = f.get('foto');

    if (!horario) return mostrarErro('Escolha um horário livre.');
    if (!porte) return mostrarErro('Escolha o porte do móvel.');
    if (!nome) return mostrarErro('Informe seu nome.');
    if (!whatsapp || !whatsappValido(whatsapp)) {
      return mostrarErro('Informe o WhatsApp com DDD. Exemplo: 19 99999-9999.');
    }
    if (!endereco) return mostrarErro('Informe o endereço da montagem.');
    if (!modelo) return mostrarErro('Informe o modelo ou a marca do produto.');

    botao.disabled = true;
    botao.textContent = 'Enviando...';

    try {
      const fotoPath = await enviarFoto(arquivo && arquivo.size ? arquivo : null);

      const duracao = window.Horarios.duracaoPorPorte(porte);
      const { error } = await sb.from('pedidos').insert({
        nome,
        whatsapp,
        endereco,
        porte,
        modelo,
        foto_path: fotoPath,
        data_hora: horario,
        duracao_horas: duracao,
        status: 'novo'
      });

      if (error) {
        if (String(error.message).includes('horario_indisponivel')) {
          await carregarHorarios();
          throw new Error('Esse horário acabou de ser reservado. Escolha outro, por favor.');
        }
        throw new Error('Não foi possível enviar o pedido. Tente novamente.');
      }

      const inicio = new Date(horario);
      resumo.textContent = `${formatarData(inicio)}, das ${formatarHora(inicio)} para ${modelo}, em nome de ${nome}.`;
      form.hidden = true;
      confirmacao.hidden = false;
      confirmacao.focus();
    } catch (err) {
      mostrarErro(err.message);
      botao.disabled = false;
      botao.textContent = 'Enviar pedido';
    }
  });
})();
