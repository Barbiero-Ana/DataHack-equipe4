import type {AnnualRecord, EstimateStatus} from '../api/types';

const reasons: Record<EstimateStatus, string> = {
  calculada: 'Calculada', sem_base_ano_anterior: 'Sem base do ano anterior',
  sem_base_ano_atual: 'Sem base do ano atual', denominador_nao_positivo: 'Denominador não positivo',
  revisar_estimativa_fora_0_100: 'Revisar: fora de 0–100%',
};
export const count = (value: number | null) => value === null ? '—' : value.toLocaleString('pt-BR');
export function AnnualTable({rows}: {rows: AnnualRecord[]}) {
  if (!rows.length) return <p className="notice">Nenhum resultado para os filtros selecionados.</p>;
  return <div className="table-scroll"><table className="table"><caption className="sr-only">Resultados anuais de Mato Grosso</caption>
    <thead><tr>{['Ano', 'Rede', 'Modalidade', 'Matrículas', 'Desvinculações', 'Estimativa anual', 'Disponibilidade'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={`${row.year}-${row.network}-${row.modality}`}>
      <td>{row.year}</td><td>{row.network === '1' ? 'Pública' : 'Privada'}</td>
      <td>{row.modality === '1' ? 'Presencial' : 'EAD'}</td><td>{count(row.qt_mat)}</td>
      <td>{count(row.qt_desvinculado)}</td><td className="rate">{row.evasao_estimada_pct === null ? 'Indisponível' : `${row.evasao_estimada_pct.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%`}</td>
      <td><span className={`badge ${row.status_estimativa === 'calculada' ? 'ok' : 'pending'}`}>{reasons[row.status_estimativa]}</span>
        <details><summary>Conferir cálculo</summary><dl>
          <dt>Ingressantes</dt><dd>{count(row.qt_ing)}</dd><dt>Concluintes</dt><dd>{count(row.qt_conc)}</dd>
          <dt>Matrículas do ano anterior</dt><dd>{count(row.qt_mat_anterior)}</dd>
          <dt>Concluintes do ano anterior</dt><dd>{count(row.qt_conc_anterior)}</dd>
          <dt>Numerador</dt><dd>{count(row.numerador_permanencia)}</dd>
          <dt>Denominador</dt><dd>{count(row.denominador_permanencia)}</dd>
          <dt>Registros de oferta</dt><dd>{count(row.qt_registros_oferta)}</dd>
        </dl></details></td></tr>)}</tbody></table></div>;
}
