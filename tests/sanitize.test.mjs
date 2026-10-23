import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { sanitizeComments, SENSITIVE_MARKER } from "../lib/sanitize.ts";
import { parseXlsxFile } from "../lib/xlsxParser.ts";

const raw = (text, id = 2) => ({ id, text, rowIndex: id, sheetName: "Avaliações" });
const mask = (text, names = [], options) => sanitizeComments([raw(text)], names, options)[0].text;
const marker = SENSITIVE_MARKER;

test("mascara todos os e-mails comuns sem consumir a pontuação ao redor", () => {
  assert.equal(
    mask("Contatos: (ANA.SILVA+turma@aluno.ufc.br), o'connor@example.test; <outro@sub.example.com>."),
    `Contatos: (${marker}), ${marker}; <${marker}>.`,
  );
  assert.equal(mask("a@example.test e a@example.test"), `${marker} e ${marker}`);
});

test("mascara blocos completos de 6 e 7 dígitos, incluindo zero inicial", () => {
  assert.equal(mask("Matrículas: 123456, 0123456 e (7654321)."), `Matrículas: ${marker}, ${marker} e (${marker}).`);
});

test("preserva notas, contagens, datas e sequências fora do padrão", () => {
  const text = "Nota 10, tirou 4, faltou 2 vezes. Ano 2026; 14/10/2026; 9,5. 12345 12345678 91234567890 ABC123456X código_123456.";
  assert.equal(mask(text), text);
});

test("permite configurar os comprimentos sem modificar as opções", () => {
  const options = Object.freeze({ registrationDigits: Object.freeze({ min: 8, max: 8 }) });
  assert.equal(mask("123456 1234567 12345678 123456789", [], options), `123456 1234567 ${marker} 123456789`);
  assert.equal(mask("123456 1234567", [], { registrationDigits: { min: 6, max: 6 } }), `${marker} 1234567`);
  assert.deepEqual(options, { registrationDigits: { min: 8, max: 8 } });
});

test("rejeita configurações numéricas inválidas", () => {
  for (const [min, max] of [[0, 7], [-1, 7], [8, 6], [6.5, 7], [6, 33], [NaN, 7], [6, Infinity]]) {
    assert.throws(() => mask("123456", [], { registrationDigits: { min, max } }), RangeError);
  }
});

test("reconhece nomes sem diferenciar maiúsculas e respeita limites Unicode", () => {
  assert.equal(
    mask("ANA, ana e Ana. Banana, Mariana, Anabela e ÁAna. JOSÉ e D'ÁVILA.", ["Ana", "José", "D'Ávila"]),
    `${marker}, ${marker} e ${marker}. Banana, Mariana, Anabela e ÁAna. ${marker} e ${marker}.`,
  );
});

test("mascara nomes canonicamente equivalentes em NFC e NFD nos dois sentidos", () => {
  for (const name of ["José Silva", "José Silva".normalize("NFD")]) {
    for (const text of ["JOSÉ Silva", "JOSÉ Silva".normalize("NFD")]) {
      assert.equal(mask(`Olá, ${text}! Nota 10.`, [name]), `Olá, ${marker}! Nota 10.`);
    }
  }
  assert.equal(mask("Jose e José, Josefina.", ["José"]), `Jose e ${marker}, Josefina.`);
});

test("normalização para comparação preserva trechos não mascarados, RAW e offsets Unicode", () => {
  const prefix = "👩🏽‍💻 Cafe\u0301: ";
  const suffix = " — opinia\u0303o 10!";
  const text = prefix + "Jose\u0301" + suffix;
  const input = Object.freeze([Object.freeze(raw(text, 6))]);
  assert.deepEqual(sanitizeComments(input, ["José"]), [{ id: 6, text: prefix + marker + suffix }]);
  assert.equal(input[0].text, text);
  assert.equal(mask(prefix + suffix, ["José"]), prefix + suffix);
  assert.equal(mask("A\u0301\u0323 e Á\u0323", ["A\u0323\u0301"]), `${marker} e ${marker}`);
});

test("mantém limites e idempotência ao mascarar nomes decompostos", () => {
  const input = "Jose\u0301 e Jose\u0301zinho; " + marker;
  const expected = `${marker} e Jose\u0301zinho; ${marker}`;
  assert.equal(mask(input, ["José", "Sensível"]), expected);
  assert.equal(mask(expected, ["Jose\u0301", "Sensível"]), expected);
});

test("prioriza nomes completos e tolera espaços entre seus termos", () => {
  const text = "Ana Silva; ANA   SILVA; Ana\nSilva; Ana.";
  const expected = `${marker}; ${marker}; ${marker}; ${marker}.`;
  assert.equal(mask(text, ["Ana", "Ana Silva"]), expected);
  assert.equal(mask(text, ["Ana Silva", "Ana"]), expected);
});

test("nomes são literais, inclusive quando contêm metacaracteres de Regex", () => {
  assert.equal(
    mask("A+B, AAB; Ana (Teste); Dr. João; Drx João.", ["A+B", "Ana (Teste)", "Dr. João"]),
    `${marker}, AAB; ${marker}; ${marker}; Drx João.`,
  );
});

test("ignora entradas vazias e preserva nomes não cadastrados", () => {
  const names = Object.freeze(["  ", "", "Ana Silva", " Ana Silva "]);
  assert.equal(mask("Marina e Ana Silva", names), `Marina e ${marker}`);
  assert.deepEqual(names, ["  ", "", "Ana Silva", " Ana Silva "]);
  assert.equal(mask("Marina e Ana Silva"), "Marina e Ana Silva");
});

test("mantém RAW byte a byte e não compartilha seus objetos ou metadados", () => {
  const original = "  Ana: ana@example.test\nMatrícula 123456. Nota 10.  ";
  const input = Object.freeze([Object.freeze(raw(original, 2)), Object.freeze(raw("Sem dados pessoais.", 6))]);
  const before = structuredClone(input);
  const names = Object.freeze(["Ana"]);
  const sanitized = sanitizeComments(input, names);
  assert.deepEqual(input, before);
  assert.notStrictEqual(sanitized, input);
  assert.deepEqual(sanitized, [
    { id: 2, text: `  ${marker}: ${marker}\nMatrícula ${marker}. Nota 10.  ` },
    { id: 6, text: "Sem dados pessoais." },
  ]);
  for (let i = 0; i < sanitized.length; i += 1) {
    assert.notStrictEqual(sanitized[i], input[i]);
    assert.deepEqual(Object.keys(sanitized[i]).sort(), ["id", "text"]);
  }
});

test("protege SANITIZED e seus IDs também em tempo de execução", () => {
  const input = [raw("ana@example.test", 4)];
  const sanitized = sanitizeComments(input);
  assert.ok(Object.isFrozen(sanitized));
  assert.ok(Object.isFrozen(sanitized[0]));
  assert.throws(() => { sanitized[0].id = 99; }, TypeError);
  assert.throws(() => { sanitized[0].text = "Outra versão"; }, TypeError);
  assert.throws(() => sanitized.pop(), TypeError);
  input[0].text = "Alteração posterior no objeto do chamador";
  assert.equal(sanitized[0].text, marker);
});

test("é determinística, idempotente e não corrompe a própria marca", () => {
  const names = ["Dado", "Sensível", "Ana", "example"];
  const input = [raw(`${marker} Dado Sensível Ana ana@example.test 123456`)];
  const first = sanitizeComments(input, names);
  assert.equal(first[0].text, Array(6).fill(marker).join(" "));
  assert.deepEqual(sanitizeComments(input, names), first);
  assert.deepEqual(sanitizeComments(first.map((comment) => raw(comment.text, comment.id)), names), first);
});

test("preserva espaços, linhas, HTML literal e IDs não consecutivos", () => {
  const input = [raw("  Nota 10\n\t<script>texto literal</script>  ", 2), raw("tirou 4", 4), raw("faltou 2 vezes", 6)];
  assert.deepEqual(sanitizeComments(input), input.map(({ id, text }) => ({ id, text })));
  assert.deepEqual(sanitizeComments([]), []);
});

test("a planilha real mantém RAW e produz a versão mascarada com o mesmo ID", async () => {
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  try {
    const bytes = await readFile(new URL("./fixtures/comentarios.xlsx", import.meta.url));
    const comments = await parseXlsxFile(new File([bytes], "comentarios.xlsx"));
    const before = structuredClone(comments);
    const sanitized = sanitizeComments(comments, ["Ana Silva"]);
    assert.deepEqual(sanitized.map(({ id }) => id), [2, 4, 6]);
    assert.equal(sanitized[0].text, `  A didática foi clara. ${marker}: ${marker}; matrícula ${marker}. Nota 10, tirou 4 e faltou 2 vezes.  `);
    assert.deepEqual(comments, before);
    assert.match(comments[0].text, /Ana Silva: ana\.teste@example\.test; matrícula 123456/);
    assert.equal(sanitized[1].text, comments[1].text);
    assert.equal(sanitized[2].text, comments[2].text);
  } finally {
    delete globalThis.window;
  }
});
