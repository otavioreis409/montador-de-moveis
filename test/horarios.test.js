const test = require('node:test');
const assert = require('node:assert');
const H = require('../js/horarios.js');

// Datas de referência (novembro de 2026)
const segunda = new Date(2026, 10, 23); // segunda-feira
const sabado = new Date(2026, 10, 21);  // sábado
const domingo = new Date(2026, 10, 22); // domingo

const horas = (lista) => lista.map((d) => d.getHours());
const dia = (d, h) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h);

test('duração por porte', () => {
  assert.strictEqual(H.duracaoPorPorte('pequeno'), 1);
  assert.strictEqual(H.duracaoPorPorte('medio'), 2);
  assert.strictEqual(H.duracaoPorPorte('grande'), 4);
  assert.throws(() => H.duracaoPorPorte('gigante'));
});

test('expediente: segunda a sexta 8h-18h, sábado 8h-12h, domingo fechado', () => {
  assert.deepStrictEqual(H.expedienteDoDia(segunda), { abre: 8, fecha: 18 });
  assert.deepStrictEqual(H.expedienteDoDia(sabado), { abre: 8, fecha: 12 });
  assert.strictEqual(H.expedienteDoDia(domingo), null);
});

test('segunda, porte pequeno, sem ocupados: 8h até 17h', () => {
  const livres = H.horariosLivres(segunda, 'pequeno', []);
  assert.deepStrictEqual(horas(livres), [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
});

test('segunda, porte grande: último início às 14h', () => {
  const livres = H.horariosLivres(segunda, 'grande', []);
  assert.deepStrictEqual(horas(livres), [8, 9, 10, 11, 12, 13, 14]);
});

test('sábado, porte grande: só 8h', () => {
  assert.deepStrictEqual(horas(H.horariosLivres(sabado, 'grande', [])), [8]);
});

test('sábado, porte médio: último início às 10h', () => {
  assert.deepStrictEqual(horas(H.horariosLivres(sabado, 'medio', [])), [8, 9, 10]);
});

test('domingo: nenhum horário', () => {
  assert.deepStrictEqual(H.horariosLivres(domingo, 'pequeno', []), []);
});

test('ocupado das 9h às 11h, porte médio: nada entre 8h e 10h, próximo é 11h', () => {
  const ocupados = [{ inicio: dia(segunda, 9), fim: dia(segunda, 11) }];
  const livres = H.horariosLivres(segunda, 'medio', ocupados);
  assert.deepStrictEqual(horas(livres), [11, 12, 13, 14, 15, 16]);
});

test('ocupado das 9h às 11h, porte pequeno: 8h e 11h aparecem', () => {
  const ocupados = [{ inicio: dia(segunda, 9), fim: dia(segunda, 11) }];
  const livres = H.horariosLivres(segunda, 'pequeno', ocupados);
  assert.deepStrictEqual(horas(livres).slice(0, 2), [8, 11]);
  assert.ok(!horas(livres).includes(9));
  assert.ok(!horas(livres).includes(10));
});

test('bloqueio de folga remove os horários que colidem', () => {
  const ocupados = [{ inicio: dia(segunda, 12), fim: dia(segunda, 18) }];
  const livres = H.horariosLivres(segunda, 'pequeno', ocupados);
  assert.deepStrictEqual(horas(livres), [8, 9, 10, 11]);
});

test('horários já passados são descartados quando "agora" é informado', () => {
  const agora = dia(segunda, 10);
  const livres = H.horariosLivres(segunda, 'pequeno', [], agora);
  assert.deepStrictEqual(horas(livres), [11, 12, 13, 14, 15, 16, 17]);
});
