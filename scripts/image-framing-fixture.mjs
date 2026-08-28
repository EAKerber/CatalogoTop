import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const context = {
  window: { CatalogoTop: {}, dispatchEvent() {} },
  console,
  Object,
  Array,
  Map,
  Set,
  String,
  Math,
  Number,
  CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } }
};
context.window.window = context.window;
context.window.CustomEvent = context.CustomEvent;

vm.runInNewContext(await readFile('src/composition.js', 'utf8'), context, { filename: 'src/composition.js' });

const originalProduct = {
  id: 'p1',
  code: 'P1',
  description: 'Produto um',
  category: 'Teste',
  image: 'https://example.test/original.webp'
};
const state = {
  products: [{ ...originalProduct }],
  selectedIds: ['p1'],
  catalog: {
    title: 'Frame fixture',
    templateId: 'technical',
    showPrices: true,
    presentation: context.window.CatalogoTop.Composition.normalizePresentation({ order: ['p1'], imageFrames: {} })
  }
};
context.window.CatalogoTop.Core = {
  getState() { return state; },
  mutate(mutator) { mutator(state); return state; }
};

vm.runInNewContext(await readFile('src/presentation-actions.js', 'utf8'), context, { filename: 'src/presentation-actions.js' });

const { ImageFraming, PresentationActions } = context.window.CatalogoTop;
const fail = message => { throw new Error(message); };

const fallback = ImageFraming.normalizeImageFrame({ fit: 'invalid', zoom: 'x', x: null, y: undefined });
if (fallback.fit !== 'contain' || fallback.zoom !== 1 || fallback.x !== 0 || fallback.y !== 50) {
  fail(`normalização fallback inesperada: ${JSON.stringify(fallback)}`);
}

const clamped = ImageFraming.normalizeImageFrame({ fit: 'cover', zoom: 9, x: -20, y: 140 });
if (clamped.fit !== 'cover' || clamped.zoom !== 2.4 || clamped.x !== 0 || clamped.y !== 100) {
  fail(`clamp inesperado: ${JSON.stringify(clamped)}`);
}

PresentationActions.setImageFrame('p1', { fit: 'cover', zoom: 1.65, x: 24, y: 72 });
const stored = state.catalog.presentation.imageFrames.p1;
if (!stored || stored.fit !== 'cover' || stored.zoom !== 1.65 || stored.x !== 24 || stored.y !== 72) {
  fail(`frame não persistiu em presentation.imageFrames: ${JSON.stringify(stored)}`);
}
if (state.products[0].image !== originalProduct.image || state.products[0].description !== originalProduct.description) {
  fail('enquadramento não pode mutar dados do produto');
}

const effective = ImageFraming.imageFrameFor(state.catalog.presentation, 'p1');
if (JSON.stringify(effective) !== JSON.stringify(stored)) fail('frame efetivo divergiu do frame persistido');

PresentationActions.resetImageFrame('p1');
if (Object.prototype.hasOwnProperty.call(state.catalog.presentation.imageFrames, 'p1')) fail('reset deve remover override esparso');
const reset = ImageFraming.imageFrameFor(state.catalog.presentation, 'p1');
if (!ImageFraming.isDefaultImageFrame(reset)) fail('reset deve retornar ao frame padrão');

PresentationActions.setImageFrame('p1', { fit: 'contain', zoom: 1, x: 50, y: 50 });
if (Object.prototype.hasOwnProperty.call(state.catalog.presentation.imageFrames, 'p1')) fail('frame padrão não deve ocupar persistência');

console.log('PASS image framing fixture: estado editorial local, clamp e reset esparso');
