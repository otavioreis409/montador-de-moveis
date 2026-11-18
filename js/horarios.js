/*
 * Regras de horário do Reis montador.
 * Funciona no navegador (window.Horarios) e no Node (require).
 */
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    raiz.Horarios = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const DURACAO_POR_PORTE = { pequeno: 1, medio: 2, grande: 4 };

  function duracaoPorPorte(porte) {
    if (!Object.prototype.hasOwnProperty.call(DURACAO_POR_PORTE, porte)) {
      throw new Error('porte invalido: ' + porte);
    }
    return DURACAO_POR_PORTE[porte];
  }

  // Domingo: fechado. Sábado: 8h às 12h. Demais dias: 8h às 18h.
  function expedienteDoDia(data) {
    const dia = data.getDay();
    if (dia === 0) return null;
    if (dia === 6) return { abre: 8, fecha: 12 };
    return { abre: 8, fecha: 18 };
  }

  /*
   * Retorna os inícios de atendimento livres no dia, a cada hora cheia.
   * ocupados: [{ inicio: Date, fim: Date }]
   * agora (opcional): se informado, descarta horários que já passaram.
   */
  function horariosLivres(data, porte, ocupados, agora) {
    const exp = expedienteDoDia(data);
    if (!exp) return [];

    const duracao = duracaoPorPorte(porte);
    const ano = data.getFullYear();
    const mes = data.getMonth();
    const dia = data.getDate();
    const livres = [];

    for (let hora = exp.abre; hora + duracao <= exp.fecha; hora++) {
      const inicio = new Date(ano, mes, dia, hora);
      const fim = new Date(ano, mes, dia, hora + duracao);

      if (agora && inicio <= agora) continue;

      const colide = ocupados.some(
        (o) => inicio < o.fim && o.inicio < fim
      );
      if (!colide) livres.push(inicio);
    }
    return livres;
  }

  return { duracaoPorPorte, expedienteDoDia, horariosLivres };
});
