import { validateTemplateContract, validateTemplateSnapshot, validateTemplateSnapshotTransition } from '../netlify/lib/template-snapshot.mts';

const fail = message => { throw new Error(message); };
const contract = (version, name = `Custom v${version}`) => ({
  schemaVersion: 1,
  id: 'custom-server-fixture',
  version,
  name,
  description: 'Fixture server',
  page: { size: 'A4', orientation: 'portrait', header: 'top-mobili-v1', footer: 'top-mobili-v1' },
  layout: { columns: 2, rows: 4 },
  card: { orientation: 'horizontal', scale: 'standard', visualScale: 'standard', tableScale: 'standard', contentBudget: { variants: 4, rows: 6, specs: 3, specsWithTable: 1 } },
  defaults: { distribution: 'balanced', typography: 'neutral' },
  capabilities: { blockTypes: ['card','collection','table'], widths: ['simple','wide','full'], contentPresets: ['visual','essential','standard','detailed','technical','commercial','auto'], distributions: ['compact','balanced','editorial'], typography: ['neutral','technical','editorial'] }
});
const record = (versions, updatedAt = '2026-08-31T00:00:00.000Z') => ({
  id: 'custom-server-fixture', createdAt: '2026-08-31T00:00:00.000Z', updatedAt,
  versions: versions.map((item, index) => ({ version: index + 1, createdAt: `2026-08-31T0${index}:00:00.000Z`, contract: item }))
});

if (validateTemplateContract(contract(1))) fail('contrato custom válido rejeitado');
if (!validateTemplateContract({ ...contract(1), id: 'technical' }).includes('reservado')) fail('built-in id precisa ser reservado no servidor');
const current = [record([contract(1)])];
const next = [record([contract(1), contract(2)], '2026-08-31T01:00:00.000Z')];
if (validateTemplateSnapshot(current)) fail('snapshot server válido rejeitado');
if (validateTemplateSnapshotTransition(current, next)) fail('append v2 server válido rejeitado');
const rewrite = structuredClone(next); rewrite[0].versions[0].contract.name = 'Rewrite';
if (!validateTemplateSnapshotTransition(next, rewrite).includes('reescrita')) fail('server deve bloquear rewrite histórico');
if (!validateTemplateSnapshotTransition(next, []).includes('removido')) fail('server deve bloquear remoção');
const skip = [record([contract(1), { ...contract(2), version: 3 }], '2026-08-31T01:00:00.000Z')];
if (!validateTemplateSnapshot(skip).includes('Versão')) fail('server deve bloquear sequência não contígua');
const multiAppend = [record([contract(1), contract(2), contract(3)], '2026-08-31T02:00:00.000Z')];
if (!validateTemplateSnapshotTransition(current, multiAppend).includes('Transição')) fail('server deve permitir no máximo uma versão nova por write');

console.log('PASS server template snapshot fixture: strict bounded contract and append-only transition enforcement');
