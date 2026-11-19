(() => {
  const titulos = document.querySelectorAll('.spell-slide-up');
  const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!titulos.length || movimentoReduzido || !('IntersectionObserver' in window)) {
    titulos.forEach((titulo) => titulo.classList.add('spell-visible'));
    return;
  }

  document.documentElement.classList.add('spell-ready');
  const observador = new IntersectionObserver((entradas, instancia) => {
    entradas.forEach((entrada) => {
      if (!entrada.isIntersecting) return;
      entrada.target.classList.add('spell-visible');
      instancia.unobserve(entrada.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -24px 0px' });

  titulos.forEach((titulo) => observador.observe(titulo));
})();
