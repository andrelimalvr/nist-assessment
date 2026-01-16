export const ptBR = {
  common: {
    notAvailable: "-",
    select: "Selecione",
    selectAssessment: "Selecione um assessment",
    applyFilters: "Aplicar filtros",
    assessmentNotFound: "Nenhum assessment encontrado.",
    noData: "Nenhum dado disponivel.",
    yes: "Sim",
    no: "Nao",
    readOnly: "Acesso somente leitura."
  },
  cis: {
    title: "Controles CIS",
    subtitle: "Visao derivada do SSDF com cobertura por controles e salvaguardas.",
    manualOverrideTitle: "Sobrescricao manual (Override)",
    overrideQuestion: "Sobrescrever?",
    manualStatus: "Status manual",
    manualMaturity: "Maturidade manual (0-3)",
    saveOverride: "Salvar sobrescricao",
    coverageLabel: "Cobertura",
    safeguardsLabel: "Salvaguardas",
    summaryTitle: "Resumo por Controle",
    safeguardsTitle: "Salvaguardas",
    relatedSsdf: "SSDF relacionado",
    emptyControls: "Nenhum controle cadastrado.",
    emptySafeguards: "Nenhuma salvaguarda cadastrada."
  },
  compare: {
    title: "Comparativo SSDF x CIS",
    subtitle: "Cobertura derivada, lacunas e mapa de calor por grupos SSDF.",
    filtersTitle: "Filtros",
    coverageDiffTitle: "Diferenca de Cobertura",
    heatmapTitle: "Mapa de calor CIS x SSDF",
    gapsTitle: "Ranking de lacunas",
    gapReason: "Motivo da lacuna",
    gapScore: "Score de lacuna",
    notMappedReason: "Sem mapeamento SSDF",
    noComparisonData: "Nenhum dado de comparacao disponivel.",
    noGaps: "Nenhuma lacuna calculada."
  },
  columns: {
    control: "Controle",
    safeguard: "Salvaguarda",
    ig: "IG",
    status: "Status",
    maturity: "Maturidade",
    coverage: "Cobertura",
    source: "Origem",
    derived: "Derivados",
    overrides: "Sobrescritos (Override)",
    gaps: "Lacunas",
    avgMaturity: "Maturidade media",
    avgCoverage: "Cobertura media",
    totalSafeguards: "Salvaguardas",
    notMapped: "Nao mapeados"
  },
  filters: {
    control: "Controle",
    ig: "IG",
    group: "Grupo SSDF",
    status: "Status",
    source: "Origem"
  },
  sources: {
    SSDF_MAPPED: "Mapeado pelo SSDF",
    MANUAL: "Manual",
    NOT_MAPPED: "Nao mapeado"
  },
  statuses: {
    NOT_STARTED: "Nao iniciado",
    IN_PROGRESS: "Em andamento",
    IMPLEMENTED: "Implementado",
    NOT_APPLICABLE: "Nao aplicavel"
  },
  controlNames: {
    "1": "Inventario e Controle de Ativos Corporativos",
    "2": "Inventario e Controle de Ativos de Software",
    "3": "Protecao de Dados",
    "4": "Configuracao Segura de Ativos Corporativos e Software",
    "5": "Gerenciamento de Contas",
    "6": "Gerenciamento de Controle de Acesso",
    "7": "Gestao Continua de Vulnerabilidades",
    "8": "Gestao de Logs de Auditoria",
    "9": "Protecoes de Email e Navegador Web",
    "10": "Defesas contra Malware",
    "11": "Recuperacao de Dados",
    "12": "Gestao de Infraestrutura de Rede",
    "13": "Monitoramento e Defesa de Rede",
    "14": "Conscientizacao e Treinamento em Seguranca",
    "15": "Gestao de Provedores de Servico",
    "16": "Seguranca de Software de Aplicacao",
    "17": "Gestao de Resposta a Incidentes",
    "18": "Testes de Penetracao"
  },
  safeguardNames: {
    "1.1": "Estabelecer e manter inventario de ativos corporativos",
    "2.1": "Estabelecer e manter inventario de software",
    "3.1": "Estabelecer e manter processo de gestao de dados",
    "4.1": "Estabelecer e manter processo de configuracao segura",
    "5.1": "Estabelecer e manter inventario de contas",
    "6.1": "Estabelecer processo de concessao de acesso",
    "7.1": "Estabelecer e manter processo de gestao de vulnerabilidades",
    "8.1": "Estabelecer e manter processo de gestao de logs",
    "9.1": "Garantir navegadores e clientes de email suportados",
    "10.1": "Implantar e manter antimalware",
    "11.1": "Estabelecer e manter processo de recuperacao de dados",
    "12.1": "Garantir inventario da infraestrutura de rede",
    "13.1": "Centralizar alertas de eventos de seguranca",
    "14.1": "Estabelecer e manter programa de conscientizacao",
    "15.1": "Estabelecer e manter inventario de provedores",
    "16.1": "Estabelecer e manter processo de desenvolvimento seguro",
    "17.1": "Designar pessoal para resposta a incidentes",
    "18.1": "Estabelecer e manter programa de teste de penetracao"
  }
};

export function getControlDisplay(controlId: string, fallbackName: string) {
  const translated = ptBR.controlNames[controlId] ?? fallbackName;
  return `${controlId} - ${translated}`;
}

export function getSafeguardDisplay(safeguardId: string, fallbackName: string) {
  const translated = ptBR.safeguardNames[safeguardId] ?? fallbackName;
  return `${safeguardId} - ${translated}`;
}

export function getCisStatusLabel(status?: string | null) {
  if (!status) return ptBR.common.notAvailable;
  return ptBR.statuses[status as keyof typeof ptBR.statuses] ?? status;
}
