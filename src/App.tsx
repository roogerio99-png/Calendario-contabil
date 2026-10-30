import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  where,
  getDocFromServer
} from 'firebase/firestore';
import {
  Play,
  Pause,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRightLeft,
  AtSign,
  Plus,
  Search,
  Filter,
  LayoutDashboard,
  ListTodo,
  Columns,
  History,
  Building2,
  CheckSquare,
  Bell,
  Users,
  Zap,
  RotateCcw,
  Send,
  X,
  ShieldCheck,
  Timer,
  Briefcase,
  Layers,
  Check,
  LogIn,
  LogOut
} from 'lucide-react';
import firebaseAppletConfig from '../firebase-applet-config.json';

// ==========================================
// CONFIGURAÇÃO DO FIREBASE & PERSISTÊNCIA
// ==========================================
const app = initializeApp(firebaseAppletConfig);
export const db = getFirestore(app, firebaseAppletConfig.firestoreDatabaseId);
export const auth = getAuth(app);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

const LOCAL_STORAGE_TASKS_KEY = 'agriconnection_tasks_10_2026_v1';
const LOCAL_STORAGE_LOGS_KEY = 'agriconnection_logs_10_2026_v1';

// ==========================================
// DADOS REAIS DO DEPARTAMENTO CONTÁBIL (10/2026)
// ==========================================
const TEAM_MEMBERS = [
  { id: 'Jhennifer', name: 'Jhennifer', role: 'Analista Contábil Sênior', avatar: 'JH', color: 'bg-indigo-600', lightBg: 'bg-indigo-50', textColor: 'text-indigo-700', borderColor: 'border-indigo-200' },
  { id: 'Leia', name: 'Leia', role: 'Especialista Fiscal & Impostos', avatar: 'LE', color: 'bg-emerald-600', lightBg: 'bg-emerald-50', textColor: 'text-emerald-700', borderColor: 'border-emerald-200' },
  { id: 'Renato', name: 'Renato', role: 'Analista Patrimonial & Conciliações', avatar: 'RE', color: 'bg-amber-600', lightBg: 'bg-amber-50', textColor: 'text-amber-700', borderColor: 'border-amber-200' },
  { id: 'Rogério', name: 'Rogério', role: 'Coordenador Contábil & Revisão (RACI)', avatar: 'RO', color: 'bg-sky-600', lightBg: 'bg-sky-50', textColor: 'text-sky-700', borderColor: 'border-sky-200' }
];

// Lista oficial das 40 Empresas/Filiais conforme planilha FECHAMENTO 10 2026
const BRANCH_CODES = [
  '010101', '010102', '010103', '010104', '010105', '010106', '010107', '010108', '010109', '010110',
  '010111', '010112', '010113', '010114', '010115', '010116', '010117', '010118', '010119', '010120',
  '010121', '010122', '010123', '010124', '010125', '010180', '020101', '030101', '040101', '050101',
  '070101', '080101', '090101', '100101', '110101', '120101', '130101', '140101', '150101', '160101'
];

const BRANCH_LABELS: Record<string, string> = {
  '010101': '010101 • Matriz Insumos',
  '010102': '010102 • Filial Insumos 02',
  '010103': '010103 • Filial Insumos 03',
  '010104': '010104 • Filial Insumos 04',
  '010105': '010105 • Filial Insumos 05',
  '010109': '010109 • Filial Insumos 09',
  '010180': '010180 • Centro Distribuição',
  '020101': '020101 • Sementes Matriz',
  '030101': '030101 • Grãos & Barter',
  '040101': '040101 • Agri Participações (Holding)',
  '050101': '050101 • Agropecuária MT',
  '070101': '070101 • Logística & Frota',
  '080101': '080101 • Armazéns Gerais',
  '090101': '090101 • Aviação Agrícola',
  '100101': '100101 • Imobiliária Rural',
  '110101': '110101 • Beneficiamento Sementes',
  '120101': '120101 • Trading Exportação',
  '130101': '130101 • Corretora Seguros',
  '140101': '140101 • Energia Solar Agro',
  '150101': '150101 • Pesquisa & Genética',
  '160101': '160101 • Serviços Compartilhados CSC'
};

const getBranchDisplayName = (code: string) => BRANCH_LABELS[code] || `${code} • Filial Operacional`;

const CHECKLISTS_P1: Record<string, string[]> = {
  DESPESAS_FISCAIS: [
    'Conferir lançamentos de multas e juros fiscais no centro de custo corporativo',
    'Validar recolhimento de taxas estaduais e municipais nas 40 filiais',
    'Cruzar guias pagas no banco x provisão contábil no TOTVS'
  ],
  VARIACAO_CAMBIAL: [
    'Retirar relatórios de Contas a Pagar e Contas a Receber ME (Moeda Estrangeira) no TOTVS',
    'Buscar cotação oficial da taxa PTAX de fechamento no site do BACEN',
    'Executar planilha de memória de cálculo de ajuste de variação cambial ativa/passiva',
    'Contabilizar lotes de ajuste e conferir razão contábil por filial'
  ],
  AVP: [
    'Extrair base de Faturamento a prazo e Compras a prazo do mês 10/2026',
    'Extrair posição aberta de Contas a Receber (CAR) e Contas a Pagar (CAP)',
    'Validar saldo de Estoques para expurgo de AVP',
    'Aplicar taxa de desconto definida pela tesouraria e gerar lote no TOTVS',
    'Conferir reversão do AVP do mês anterior contra constituição atual'
  ],
  CONCILIACAO_RECEITA: [
    'Executar consulta das Views Fiscais x Razão Contábil no banco de dados',
    'Validar CFOPs de faturamento, remessa para entrega futura e devoluções',
    'Cruzar notas emitidas no último dia do mês com corte de receita (Cut-off)',
    'Validar deduções de vendas (ICMS, PIS, COFINS) por filial'
  ],
  CONTAS_PAGAR_RECEBER: [
    'Emitir Posição de Títulos em Aberto (FINR150 / FINR130) no TOTVS',
    'Conferir adiantamentos a fornecedores e adiantamentos de clientes',
    'Analisar saldos virados ou títulos antigos sem baixa bancária',
    'Conciliar saldo contábil (Grupo 1102 e 2101) com relatório financeiro'
  ]
};

const createInitialBranches = (defaultStatus = 'p', okCount = 0, naIndices: number[] = []) => {
  const map: Record<string, string> = {};
  BRANCH_CODES.forEach((code, idx) => {
    if (naIndices.includes(idx)) {
      map[code] = 'n/a';
    } else if (idx < okCount) {
      map[code] = 'ok';
    } else {
      map[code] = defaultStatus;
    }
  });
  return map;
};

const getBranchDetail = (task: any, code: string) => {
  const rawVal = task?.branches?.[code] || 'p';
  const meta = task?.branchDetails?.[code] || {};
  const isRunningHere =
    task?.status === 'EM_ANDAMENTO' &&
    task?.timerStartedAt &&
    (task?.activeTimerScope === 'ALL' ||
      (Array.isArray(task?.activeTimerBranches) && task.activeTimerBranches.includes(code)));

  return {
    code,
    status: isRunningHere ? 'andamento' : rawVal,
    owner: meta.owner || task.assignee,
    elapsedSeconds: meta.elapsedSeconds || 0,
    dependencyTo: meta.dependencyTo || null,
    dependencyFrom: meta.dependencyFrom || null,
    dependencyReason: meta.dependencyReason || null,
    pauseReason: meta.pauseReason || null,
    isRunningHere
  };
};

const INITIAL_TASKS_SEED: any[] = [
  {
    id: 'CTB-01',
    code: 'CTB-01',
    title: 'Amortização - SEGUROS (Imóveis e Veículos)',
    topic: 'Fechamento de resultado',
    accountingType: 'Societário',
    category: 'FECHAMENTO',
    dueDate: '2026-10-30',
    assignee: 'Renato',
    originalAssignee: 'Renato',
    reviewer: 'Rogério',
    status: 'CONCLUIDA',
    isCritical: false,
    totalSeconds: 5120,
    timerStartedAt: null,
    activeTimerUser: null,
    pauseReason: null,
    dependencyInfo: null,
    branches: createInitialBranches('ok', 40),
    checklistKey: null,
    checklistState: [],
    timeByUser: { Renato: 5120 },
    evidenceUrl: 'G:\\Contabilidade\\2026\\10_Outubro\\01_Seguros_Amortizacao.xlsx',
    comments: [
      { id: 'c1', author: 'Renato', text: 'Planilha de apropriação de prêmios de seguros lançada no TOTVS para todas as filiais aplicáveis.', createdAt: '2026-10-29T16:40:00' }
    ]
  },
  {
    id: 'CTB-02',
    code: 'CTB-02',
    title: 'Análise de contas a pagar (Fornecedores & Adiantamentos)',
    topic: 'Fechamento de resultado',
    accountingType: 'Societário',
    category: 'FECHAMENTO',
    dueDate: '2026-11-09',
    assignee: 'Renato',
    originalAssignee: 'Renato',
    reviewer: 'Rogério',
    status: 'EM_ANDAMENTO',
    isCritical: true,
    totalSeconds: 4380,
    timerStartedAt: Date.now() - 1250000,
    activeTimerUser: 'Renato',
    pauseReason: null,
    dependencyInfo: null,
    branches: createInitialBranches('p', 22),
    checklistKey: 'CONTAS_PAGAR_RECEBER',
    checklistState: [true, true, false, false],
    timeByUser: { Renato: 4380 },
    evidenceUrl: 'G:\\Contabilidade\\2026\\10_Outubro\\02_Conciliacao_CAP',
    comments: [
      { id: 'c2', author: 'Renato', text: 'Iniciando batimento do relatório FINR150 contra razão contábil nas filiais 010101 a 010120.', createdAt: '2026-10-30T08:15:00' }
    ]
  },
  {
    id: 'CTB-03',
    code: 'CTB-03',
    title: 'Análise de contas a receber (Clientes & Adiantamentos)',
    topic: 'Fechamento de resultado',
    accountingType: 'Societário',
    category: 'FECHAMENTO',
    dueDate: '2026-11-09',
    assignee: 'Jhennifer',
    originalAssignee: 'Jhennifer',
    reviewer: 'Rogério',
    status: 'PAUSADA',
    isCritical: true,
    totalSeconds: 3420,
    timerStartedAt: null,
    activeTimerUser: null,
    pauseReason: 'Aguardando Tesouraria finalizar baixas de cobrança bancária do dia 30/10.',
    dependencyInfo: null,
    branches: createInitialBranches('p', 15),
    checklistKey: 'CONTAS_PAGAR_RECEBER',
    checklistState: [true, false, false, false],
    timeByUser: { Jhennifer: 3420 },
    evidenceUrl: '',
    comments: []
  },
  {
    id: 'CTB-10',
    code: 'CTB-10',
    title: 'AVP faturamento/compras/car/cap/estoque (Ajuste a Valor Presente)',
    topic: 'Fechamento de resultado',
    accountingType: 'IFRS',
    category: 'FECHAMENTO',
    dueDate: '2026-11-10',
    assignee: 'Leia',
    originalAssignee: 'Jhennifer',
    reviewer: 'Rogério',
    status: 'AGUARDANDO_DEPENDENCIA',
    isCritical: true,
    totalSeconds: 6120,
    timerStartedAt: null,
    activeTimerUser: null,
    pauseReason: null,
    dependencyInfo: {
      fromUser: 'Jhennifer',
      toUser: 'Leia',
      reason: '@Leia preciso que você valide a base de notas de devolução e CFOPs de entrega futura na filial 010101 e 030101 antes de eu fechar o cálculo do AVP sobre faturamento.',
      transferredAt: '2026-10-30T08:10:00'
    },
    branches: createInitialBranches('p', 18),
    checklistKey: 'AVP',
    checklistState: [true, true, true, false, false],
    timeByUser: { Jhennifer: 6120 },
    evidenceUrl: 'G:\\Contabilidade\\2026\\10_Outubro\\10_Calculo_AVP_IFRS.xlsx',
    comments: [
      { id: 'c10', author: 'Jhennifer', text: '@Leia transferi a tarefa para você validar as devoluções fiscais no bloco de faturamento.', createdAt: '2026-10-30T08:10:00' }
    ]
  },
  {
    id: 'AVU-01',
    code: 'AVU-01',
    title: 'Atendimento Auditoria Externa: Amostra de 25 NFs de Insumos (Filial 010101)',
    topic: 'Demanda Avulsa / Auditoria',
    accountingType: 'Societário',
    category: 'AVULSA',
    dueDate: '2026-10-30',
    assignee: 'Rogério',
    originalAssignee: 'Jhennifer',
    reviewer: 'Rogério',
    status: 'AGUARDANDO_DEPENDENCIA',
    isCritical: true,
    totalSeconds: 2650,
    timerStartedAt: null,
    activeTimerUser: null,
    pauseReason: null,
    dependencyInfo: {
      fromUser: 'Jhennifer',
      toUser: 'Rogério',
      reason: '@Rogério já separei os XMLs e razões contábeis dos 25 itens solicitados pela auditoria BDO/KPMG. Preciso da sua validação técnica na carta de resposta antes de enviar.',
      transferredAt: '2026-10-30T08:30:00'
    },
    branches: createInitialBranches('n/a', 1, [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39]),
    checklistKey: null,
    checklistState: [],
    timeByUser: { Jhennifer: 2650 },
    evidenceUrl: 'G:\\Contabilidade\\2026\\Auditoria_Outubro\\Amostra_25_NFs',
    comments: []
  }
];

const INITIAL_LOGS_SEED: any[] = [
  {
    id: 'log-1',
    timestamp: '2026-10-30T08:30:00',
    user: 'Jhennifer',
    targetUser: 'Rogério',
    taskCode: 'AVU-01',
    taskTitle: 'Atendimento Auditoria Externa: Amostra de 25 NFs de Insumos (Filial 010101)',
    type: 'TRANSFERENCIA',
    details: 'Transferiu a tarefa para @Rogério por dependência de aprovação: "@Rogério já separei os XMLs e razões contábeis..."',
    durationSeconds: 2650
  }
];

const formatDuration = (totalSecs = 0) => {
  const s = Math.max(0, Math.floor(totalSecs || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return [hrs, mins, secs].map((v) => String(v).padStart(2, '0')).join(':');
};

const sanitizeForFirestore = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForFirestore(item));
  }
  const cleaned: Record<string, any> = {};
  Object.entries(obj).forEach(([key, val]) => {
    cleaned[key] = val === undefined ? null : sanitizeForFirestore(val);
  });
  return cleaned;
};

const calculateBranchStats = (branchesMap: Record<string, string> = {}, filterBranches: string[] | null = null) => {
  const targetCodes =
    Array.isArray(filterBranches) && filterBranches.length > 0 ? filterBranches : BRANCH_CODES;
  const total = targetCodes.length || 1;
  let ok = 0;
  let na = 0;
  let p = 0;
  let andamento = 0;
  let pausada = 0;
  let transferida = 0;

  targetCodes.forEach((code) => {
    const v = branchesMap[code] || 'p';
    if (v === 'ok') ok++;
    else if (v === 'n/a') na++;
    else if (v === 'andamento') andamento++;
    else if (v === 'pausada') pausada++;
    else if (v === 'transferida') transferida++;
    else p++;
  });

  const percent = Math.round(((ok + na) / total) * 100);
  return { ok, na, p, andamento, pausada, transferida, total, percent };
};

const deriveTaskStatusFromBranches = (branchesMap: Record<string, string> = {}, currentStatus = 'PENDENTE') => {
  const stats = calculateBranchStats(branchesMap);
  if (stats.ok + stats.na === stats.total) return 'CONCLUIDA';
  if (stats.transferida > 0 && currentStatus === 'AGUARDANDO_DEPENDENCIA') return 'AGUARDANDO_DEPENDENCIA';
  if (stats.andamento > 0 || currentStatus === 'EM_ANDAMENTO') return 'EM_ANDAMENTO';
  if (stats.pausada > 0 || currentStatus === 'PAUSADA') return 'PAUSADA';
  if (stats.ok > 0) return 'EM_ANDAMENTO';
  return 'PENDENTE';
};

const BRANCH_STATUS_CHIP: Record<string, { short: string; label: string; cls: string }> = {
  p: { short: 'P', label: 'Pendente', cls: 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100' },
  andamento: { short: '▶', label: 'Em Andamento', cls: 'bg-blue-600 text-white border-blue-700 animate-pulse font-extrabold' },
  pausada: { short: '⏸', label: 'Pausada', cls: 'bg-orange-100 text-orange-900 border-orange-400 font-bold' },
  transferida: { short: '@', label: 'Transferida (@)', cls: 'bg-purple-600 text-white border-purple-700 font-extrabold' },
  ok: { short: 'OK', label: 'Concluída', cls: 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold' },
  'n/a': { short: 'N/A', label: 'Não Aplicável', cls: 'bg-slate-100 text-slate-400 border-slate-200' }
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  PENDENTE: { label: 'Pendente (Não Iniciada)', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-400' },
  EM_ANDAMENTO: { label: 'Iniciada / Em Andamento', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300', dot: 'bg-blue-600 animate-pulse' },
  PAUSADA: { label: 'Tarefa Pausada', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300', dot: 'bg-amber-500' },
  AGUARDANDO_DEPENDENCIA: { label: 'Transferida / Dependência (@)', bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-300', dot: 'bg-purple-600' },
  CONCLUIDA: { label: 'Concluída & Entregue', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300', dot: 'bg-emerald-600' }
};

const renderFormattedText = (text: string | null | undefined) => {
  if (!text) return null;
  const parts = text.split(/(@Jhennifer|@Leia|@Renato|@Rogério|@Rogerio)/gi);
  return parts.map((part, idx) => {
    if (part.startsWith('@')) {
      return (
        <span key={idx} className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">
          {part}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
};

export default function App() {
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [cloudSynced, setCloudSynced] = useState(false);
  const [currentUser, setCurrentUser] = useState('Jhennifer');
  const [tasks, setTasks] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_TASKS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore localStorage read errors
    }
    return INITIAL_TASKS_SEED;
  });
  const [auditLogs, setAuditLogs] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_LOGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore localStorage read errors
    }
    return INITIAL_LOGS_SEED;
  });
  const [nowTick, setNowTick] = useState(Date.now());

  // Escopo de Empresa
  const [companyScopeMode, setCompanyScopeMode] = useState('ALL');
  const [selectedSingleCompany, setSelectedSingleCompany] = useState('010101');
  const [selectedCustomCompanies, setSelectedCustomCompanies] = useState<string[]>(['010101', '040101']);
  const [isCompanySelectorModalOpen, setIsCompanySelectorModalOpen] = useState(false);

  const [taskActionScope, setTaskActionScope] = useState<Record<string, { mode: string; branches: string[] }>>({});
  const [expandedTaskBranches, setExpandedTaskBranches] = useState<Record<string, boolean>>({ 'CTB-02': true });
  const [activeMatrixCell, setActiveMatrixCell] = useState<{ taskId: string; branchCode: string } | null>(null);

  // Filtros
  const [activeTab, setActiveTab] = useState('LISTA');
  const [quickFilter, setQuickFilter] = useState('TODAS');
  const [userFilter, setUserFilter] = useState('TODOS');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [topicFilter, setTopicFilter] = useState('TODOS');
  const [activeOperatorFilter, setActiveOperatorFilter] = useState('TODOS'); // 'TODOS' ou ID do operador
  const [searchQuery, setSearchQuery] = useState('');

  // Modais (z-[100] garantido)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [pauseModalTask, setPauseModalTask] = useState<any | null>(null);
  const [pauseReasonInput, setPauseReasonInput] = useState('');
  const [pauseTargetBranches, setPauseTargetBranches] = useState<string | string[]>('ALL');

  const [transferModalTask, setTransferModalTask] = useState<any | null>(null);
  const [transferTargetUser, setTransferTargetUser] = useState('Leia');
  const [transferReasonInput, setTransferReasonInput] = useState('');
  const [transferScopeMode, setTransferScopeMode] = useState('ALL');
  const [transferSelectedBranches, setTransferSelectedBranches] = useState<string[]>(['010101']);

  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState({
    title: '',
    category: 'AVULSA',
    topic: 'Demanda Avulsa / Dia a Dia',
    accountingType: 'Societário',
    assignee: 'Jhennifer',
    dueDate: '2026-10-30',
    isCritical: false,
    startImmediately: true,
    initialNote: '',
    companyScope: 'ALL',
    customBranches: ['010101']
  });

  const [showNotifications, setShowNotifications] = useState(false);
  const [isHeaderTimerExpanded, setIsHeaderTimerExpanded] = useState(false);

  // Persist locally on change
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_TASKS_KEY, JSON.stringify(tasks));
    } catch {
      // ignore
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(auditLogs));
    } catch {
      // ignore
    }
  }, [auditLogs]);

  const activeScopedBranches = useMemo(() => {
    if (companyScopeMode === 'SINGLE') return [selectedSingleCompany];
    if (companyScopeMode === 'CUSTOM') {
      return selectedCustomCompanies.length > 0 ? selectedCustomCompanies : BRANCH_CODES;
    }
    return BRANCH_CODES;
  }, [companyScopeMode, selectedSingleCompany, selectedCustomCompanies]);

  const getTaskTargetBranches = (task: any, overrideBranches: string | string[] | null = null): string[] => {
    if (overrideBranches) {
      return overrideBranches === 'ALL' ? BRANCH_CODES : (overrideBranches as string[]);
    }
    const localCfg = taskActionScope[task.id];
    if (localCfg) {
      if (localCfg.mode === 'ALL') return BRANCH_CODES;
      if (localCfg.mode === 'PENDING') {
        const pend = BRANCH_CODES.filter((c) => {
          const st = task.branches?.[c] || 'p';
          return st !== 'ok' && st !== 'n/a';
        });
        return pend.length > 0 ? pend : BRANCH_CODES;
      }
      if (localCfg.mode === 'SELECTED' && localCfg.branches?.length > 0) {
        return localCfg.branches;
      }
    }
    if (companyScopeMode === 'SINGLE') return [selectedSingleCompany];
    if (companyScopeMode === 'CUSTOM' && selectedCustomCompanies.length > 0) return selectedCustomCompanies;
    return BRANCH_CODES;
  };

  const setTaskScopeConfig = (taskId: string, mode: string, branches: string[] = []) => {
    setTaskActionScope((prev) => ({
      ...prev,
      [taskId]: { mode, branches }
    }));
  };

  const toggleBranchInTaskSelection = (task: any, branchCode: string) => {
    setTaskActionScope((prev) => {
      const current = prev[task.id] || { mode: 'SELECTED', branches: [] };
      const list = current.mode === 'SELECTED' ? [...(current.branches || [])] : [];
      const exists = list.includes(branchCode);
      const nextList = exists ? list.filter((c) => c !== branchCode) : [...list, branchCode];
      return {
        ...prev,
        [task.id]: {
          mode: nextList.length > 0 ? 'SELECTED' : 'ALL',
          branches: nextList
        }
      };
    });
  };

  useEffect(() => {
    let unsubTasks: (() => void) | null = null;
    let unsubLogs: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setFbUser(u);
      if (unsubTasks) {
        unsubTasks();
        unsubTasks = null;
      }
      if (unsubLogs) {
        unsubLogs();
        unsubLogs = null;
      }

      if (u && u.emailVerified) {
        const tasksPath = 'tasks_10_2026';
        const tasksQuery = query(collection(db, tasksPath), where('ownerUid', '==', u.uid));
        unsubTasks = onSnapshot(
          tasksQuery,
          async (snap) => {
            if (!snap.empty) {
              const loaded = snap.docs.map((d) => ({ ...d.data(), id: d.id })) as any[];
              loaded.sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')));
              setTasks(loaded);
              setCloudSynced(true);
            } else {
              // Seed initial tasks to Firestore for this authenticated user
              try {
                for (const seedTask of INITIAL_TASKS_SEED) {
                  const payload = sanitizeForFirestore({
                    ...seedTask,
                    ownerUid: u.uid
                  });
                  await setDoc(doc(db, tasksPath, seedTask.id), payload);
                }
                setCloudSynced(true);
              } catch (err) {
                handleFirestoreError(err, OperationType.WRITE, tasksPath);
              }
            }
          },
          (err) => handleFirestoreError(err, OperationType.LIST, tasksPath)
        );

        const logsPath = 'logs_10_2026';
        const logsQuery = query(collection(db, logsPath), where('ownerUid', '==', u.uid));
        unsubLogs = onSnapshot(
          logsQuery,
          async (snap) => {
            if (!snap.empty) {
              const loadedLogs = snap.docs.map((d) => ({ ...d.data(), id: d.id })) as any[];
              loadedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              setAuditLogs(loadedLogs);
            } else {
              try {
                for (const seedLog of INITIAL_LOGS_SEED) {
                  const payload = sanitizeForFirestore({
                    ...seedLog,
                    ownerUid: u.uid
                  });
                  await setDoc(doc(db, logsPath, seedLog.id), payload);
                }
              } catch (err) {
                handleFirestoreError(err, OperationType.WRITE, logsPath);
              }
            }
          },
          (err) => handleFirestoreError(err, OperationType.LIST, logsPath)
        );
      } else {
        setCloudSynced(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubTasks) unsubTasks();
      if (unsubLogs) unsubLogs();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Erro no login Google:', err);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await signOut(auth);
      setCloudSynced(false);
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
  };

  const persistTaskAndLog = async (updatedTask: any, logEntry: any = null) => {
    const cleanTask = sanitizeForFirestore({
      ...updatedTask,
      title: String(updatedTask.title || '').slice(0, 500),
      code: String(updatedTask.code || '').slice(0, 32),
      assignee: String(updatedTask.assignee || 'Jhennifer').slice(0, 64),
      ...(fbUser ? { ownerUid: fbUser.uid } : {})
    });
    const cleanLog = logEntry
      ? sanitizeForFirestore({
          ...logEntry,
          details: String(logEntry.details || '').slice(0, 2000),
          taskCode: String(logEntry.taskCode || '').slice(0, 32),
          user: String(logEntry.user || currentUser).slice(0, 64),
          ...(fbUser ? { ownerUid: fbUser.uid } : {})
        })
      : null;

    setTasks((prev) => prev.map((t) => (t.id === cleanTask.id ? cleanTask : t)));
    if (cleanLog) {
      setAuditLogs((prev) => [cleanLog, ...prev]);
    }
    if (fbUser && fbUser.emailVerified) {
      try {
        await setDoc(doc(db, 'tasks_10_2026', cleanTask.id), cleanTask);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `tasks_10_2026/${cleanTask.id}`);
      }
      if (cleanLog) {
        try {
          await setDoc(doc(db, 'logs_10_2026', cleanLog.id), cleanLog);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `logs_10_2026/${cleanLog.id}`);
        }
      }
    }
  };

  const getLiveTaskSeconds = (task: any, branchFilterCode: string | null = null) => {
    if (branchFilterCode) {
      const baseBranch = task?.branchDetails?.[branchFilterCode]?.elapsedSeconds || 0;
      const isRunningOnBranch =
        task.status === 'EM_ANDAMENTO' &&
        task.timerStartedAt &&
        (task?.activeTimerScope === 'ALL' ||
          (Array.isArray(task?.activeTimerBranches) && task.activeTimerBranches.includes(branchFilterCode)));
      if (isRunningOnBranch) {
        const elapsed = Math.max(0, Math.floor((nowTick - task.timerStartedAt) / 1000));
        return baseBranch + elapsed;
      }
      return baseBranch;
    }

    let base = task.totalSeconds || 0;
    if (task.status === 'EM_ANDAMENTO' && task.timerStartedAt) {
      const elapsed = Math.max(0, Math.floor((nowTick - task.timerStartedAt) / 1000));
      base += elapsed;
    }
    return base;
  };

  const handleStartTask = (task: any, explicitBranches: string | string[] | null = null) => {
    const now = Date.now();
    const targetBranches = getTaskTargetBranches(task, explicitBranches);
    const isAll = targetBranches.length === BRANCH_CODES.length;

    const updatedBranches = { ...(task.branches || {}) };
    const updatedDetails = { ...(task.branchDetails || {}) };

    targetBranches.forEach((code) => {
      if (updatedBranches[code] !== 'n/a') {
        updatedBranches[code] = 'andamento';
        updatedDetails[code] = {
          ...(updatedDetails[code] || {}),
          owner: currentUser
        };
      }
    });

    const scopeLabel = isAll
      ? 'Todas as 40 Empresas'
      : targetBranches.length === 1
      ? `Empresa ${targetBranches[0]}`
      : `${targetBranches.length} Empresas`;

    const updatedTask = {
      ...task,
      status: 'EM_ANDAMENTO',
      timerStartedAt: now,
      activeTimerUser: currentUser,
      activeTimerScope: isAll ? 'ALL' : 'INDIVIDUAL',
      activeTimerBranches: targetBranches,
      pauseReason: null,
      branches: updatedBranches,
      branchDetails: updatedDetails
    };

    const logEntry = {
      id: `log-${now}`,
      timestamp: new Date(now).toISOString(),
      user: currentUser,
      targetUser: null,
      taskCode: task.code,
      taskTitle: task.title,
      companyScope: scopeLabel,
      type: 'INICIO',
      details: `Iniciou o cronômetro para [${scopeLabel}].`,
      durationSeconds: null
    };

    persistTaskAndLog(updatedTask, logEntry);
  };

  const handleReopenTask = (task: any) => {
    const now = Date.now();
    const targetBranches = getTaskTargetBranches(task);
    const updatedBranches = { ...(task.branches || {}) };
    targetBranches.forEach((c) => {
      if (updatedBranches[c] === 'ok' || updatedBranches[c] === 'andamento' || updatedBranches[c] === 'pausada') {
        updatedBranches[c] = 'p';
      }
    });

    const updatedTask = {
      ...task,
      status: 'PENDENTE',
      timerStartedAt: null,
      activeTimerUser: null,
      activeTimerScope: null,
      activeTimerBranches: [],
      pauseReason: null,
      branches: updatedBranches
    };

    const logEntry = {
      id: `log-${now}`,
      timestamp: new Date(now).toISOString(),
      user: currentUser,
      targetUser: null,
      taskCode: task.code,
      taskTitle: task.title,
      companyScope:
        targetBranches.length === BRANCH_CODES.length
          ? 'Todas as 40 Empresas'
          : `Empresa(s) ${targetBranches.join(', ')}`,
      type: 'REABERTURA_PENDENTE',
      details: `Retornou a tarefa para PENDENTE (Iniciada por engano / Reabertura para revisão). Registrado para auditoria.`,
      durationSeconds: null
    };

    persistTaskAndLog(updatedTask, logEntry);
  };

  const openPauseModal = (task: any, explicitBranches: string | string[] | null = null) => {
    setPauseModalTask(task);
    setPauseTargetBranches(
      explicitBranches ||
        (task.activeTimerBranches && task.activeTimerBranches.length > 0
          ? task.activeTimerBranches
          : getTaskTargetBranches(task))
    );
    setPauseReasonInput('');
  };

  const confirmPauseTask = (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pauseModalTask) return;

    const now = Date.now();
    const sessionSecs = pauseModalTask.timerStartedAt
      ? Math.max(0, Math.floor((now - pauseModalTask.timerStartedAt) / 1000))
      : 0;

    const activeUser = pauseModalTask.activeTimerUser || currentUser;
    const prevUserSecs = (pauseModalTask.timeByUser && pauseModalTask.timeByUser[activeUser]) || 0;
    const reasonText = pauseReasonInput.trim() || 'Pausa operacional / alternância de prioridade.';

    const targetList =
      pauseTargetBranches === 'ALL'
        ? BRANCH_CODES
        : Array.isArray(pauseTargetBranches) && pauseTargetBranches.length > 0
        ? pauseTargetBranches
        : BRANCH_CODES;

    const isAll = targetList.length === BRANCH_CODES.length;
    const updatedBranches = { ...(pauseModalTask.branches || {}) };
    const updatedDetails = { ...(pauseModalTask.branchDetails || {}) };

    targetList.forEach((code) => {
      if (updatedBranches[code] !== 'ok' && updatedBranches[code] !== 'n/a') {
        updatedBranches[code] = 'pausada';
      }
      const prevBranchSecs = updatedDetails[code]?.elapsedSeconds || 0;
      updatedDetails[code] = {
        ...(updatedDetails[code] || {}),
        elapsedSeconds: prevBranchSecs + sessionSecs,
        pauseReason: reasonText
      };
    });

    const scopeLabel = isAll ? 'Todas as 40 Empresas' : `${targetList.length} Empresas`;

    const updatedTask = {
      ...pauseModalTask,
      status: 'PAUSADA',
      totalSeconds: (pauseModalTask.totalSeconds || 0) + sessionSecs,
      timerStartedAt: null,
      activeTimerUser: null,
      activeTimerScope: null,
      activeTimerBranches: [],
      pauseReason: `[${scopeLabel}] ${reasonText}`,
      branches: updatedBranches,
      branchDetails: updatedDetails,
      timeByUser: {
        ...(pauseModalTask.timeByUser || {}),
        [activeUser]: prevUserSecs + sessionSecs
      }
    };

    const logEntry = {
      id: `log-${now}`,
      timestamp: new Date(now).toISOString(),
      user: currentUser,
      targetUser: null,
      taskCode: pauseModalTask.code,
      taskTitle: pauseModalTask.title,
      companyScope: scopeLabel,
      type: 'PAUSA',
      details: `Pausou [${scopeLabel}] após ${formatDuration(sessionSecs)}. Motivo: "${reasonText}"`,
      durationSeconds: sessionSecs
    };

    persistTaskAndLog(updatedTask, logEntry);
    setPauseModalTask(null);
    setPauseReasonInput('');
  };

  const openTransferModal = (task: any, explicitBranches: string | string[] | null = null) => {
    const defaultTarget = TEAM_MEMBERS.find((m) => m.id !== currentUser)?.id || 'Leia';
    const initialBranches = explicitBranches
      ? explicitBranches === 'ALL'
        ? BRANCH_CODES
        : (explicitBranches as string[])
      : getTaskTargetBranches(task);
    const isAll = initialBranches.length === BRANCH_CODES.length;

    setTransferModalTask(task);
    setTransferTargetUser(defaultTarget);
    setTransferScopeMode(isAll ? 'ALL' : 'SPECIFIC');
    setTransferSelectedBranches(isAll ? ['010101'] : initialBranches);
    setTransferReasonInput(
      `@${defaultTarget} preciso do seu apoio/validação ${
        !isAll ? `na(s) empresa(s) ${initialBranches.join(', ')} ` : ''
      }para: `
    );
  };

  const handleSelectTransferUser = (userId: string) => {
    setTransferTargetUser(userId);
    if (!transferReasonInput.includes(`@${userId}`)) {
      setTransferReasonInput((prev) => {
        const cleaned = prev.replace(/^@(Jhennifer|Leia|Renato|Rogério)\s*/i, '');
        return `@${userId} ${cleaned}`;
      });
    }
  };

  const confirmTransferTask = (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!transferModalTask || !transferReasonInput.trim()) return;

    const now = Date.now();
    const sessionSecs =
      transferModalTask.status === 'EM_ANDAMENTO' && transferModalTask.timerStartedAt
        ? Math.max(0, Math.floor((now - transferModalTask.timerStartedAt) / 1000))
        : 0;

    const activeUser = transferModalTask.activeTimerUser || currentUser;
    const prevUserSecs = (transferModalTask.timeByUser && transferModalTask.timeByUser[activeUser]) || 0;

    const targetBranches =
      transferScopeMode === 'ALL'
        ? BRANCH_CODES
        : transferSelectedBranches.length > 0
        ? transferSelectedBranches
        : ['010101'];
    const isAll = targetBranches.length === BRANCH_CODES.length;

    const scopeLabel = isAll ? 'Todas as 40 Empresas' : `${targetBranches.length} Empresas`;
    const finalMessage = transferReasonInput.includes(`@${transferTargetUser}`)
      ? transferReasonInput.trim()
      : `@${transferTargetUser} ${transferReasonInput.trim()}`;

    const updatedBranches = { ...(transferModalTask.branches || {}) };
    const updatedDetails = { ...(transferModalTask.branchDetails || {}) };

    targetBranches.forEach((code) => {
      if (updatedBranches[code] !== 'ok' && updatedBranches[code] !== 'n/a') {
        updatedBranches[code] = 'transferida';
      }
      updatedDetails[code] = {
        ...(updatedDetails[code] || {}),
        owner: transferTargetUser,
        dependencyFrom: currentUser,
        dependencyTo: transferTargetUser,
        dependencyReason: finalMessage,
        elapsedSeconds: (updatedDetails[code]?.elapsedSeconds || 0) + sessionSecs
      };
    });

    const newComment = {
      id: `comm-${now}`,
      author: currentUser,
      text: `[Transferência • ${scopeLabel}] ${finalMessage}`,
      createdAt: new Date(now).toISOString()
    };

    const updatedTask = {
      ...transferModalTask,
      status: 'AGUARDANDO_DEPENDENCIA',
      assignee: isAll ? transferTargetUser : transferModalTask.assignee,
      totalSeconds: (transferModalTask.totalSeconds || 0) + sessionSecs,
      timerStartedAt: null,
      activeTimerUser: null,
      activeTimerScope: null,
      activeTimerBranches: [],
      pauseReason: null,
      branches: updatedBranches,
      branchDetails: updatedDetails,
      dependencyInfo: {
        fromUser: currentUser,
        toUser: transferTargetUser,
        scope: scopeLabel,
        branches: targetBranches,
        reason: finalMessage,
        transferredAt: new Date(now).toISOString()
      },
      timeByUser: {
        ...(transferModalTask.timeByUser || {}),
        ...(sessionSecs > 0 ? { [activeUser]: prevUserSecs + sessionSecs } : {})
      },
      comments: [...(transferModalTask.comments || []), newComment]
    };

    const logEntry = {
      id: `log-${now}`,
      timestamp: new Date(now).toISOString(),
      user: currentUser,
      targetUser: transferTargetUser,
      taskCode: transferModalTask.code,
      taskTitle: transferModalTask.title,
      companyScope: scopeLabel,
      type: 'TRANSFERENCIA',
      details: `Transferiu [${scopeLabel}] para @${transferTargetUser}: "${finalMessage}"`,
      durationSeconds: sessionSecs > 0 ? sessionSecs : null
    };

    persistTaskAndLog(updatedTask, logEntry);
    setTransferModalTask(null);
    setTransferReasonInput('');
  };

  const handleCompleteTask = (task: any, explicitBranches: string | string[] | null = null) => {
    const now = Date.now();
    const targetBranches = getTaskTargetBranches(task, explicitBranches);
    const isAll = targetBranches.length === BRANCH_CODES.length;

    const sessionSecs =
      task.status === 'EM_ANDAMENTO' && task.timerStartedAt
        ? Math.max(0, Math.floor((now - task.timerStartedAt) / 1000))
        : 0;

    const activeUser = task.activeTimerUser || currentUser;
    const prevUserSecs = (task.timeByUser && task.timeByUser[activeUser]) || 0;
    const newTotalSeconds = (task.totalSeconds || 0) + sessionSecs;

    const updatedBranches = { ...(task.branches || {}) };
    const updatedDetails = { ...(task.branchDetails || {}) };

    targetBranches.forEach((code) => {
      if (updatedBranches[code] !== 'n/a') {
        updatedBranches[code] = 'ok';
      }
      updatedDetails[code] = {
        ...(updatedDetails[code] || {}),
        owner: currentUser,
        completedAt: new Date(now).toISOString(),
        elapsedSeconds: (updatedDetails[code]?.elapsedSeconds || 0) + sessionSecs
      };
    });

    const statsAfter = calculateBranchStats(updatedBranches);
    const allFinishedNow = statsAfter.ok + statsAfter.na === statsAfter.total;
    const scopeLabel = isAll ? 'Todas as 40 Empresas' : `${targetBranches.length} Empresas`;

    const updatedTask = {
      ...task,
      status: allFinishedNow ? 'CONCLUIDA' : deriveTaskStatusFromBranches(updatedBranches, 'EM_ANDAMENTO'),
      totalSeconds: newTotalSeconds,
      timerStartedAt: null,
      activeTimerUser: null,
      activeTimerScope: null,
      activeTimerBranches: [],
      pauseReason: null,
      dependencyInfo: allFinishedNow ? null : task.dependencyInfo || null,
      completedAt: allFinishedNow ? new Date(now).toISOString() : task.completedAt || null,
      completedBy: allFinishedNow ? currentUser : task.completedBy || null,
      branches: updatedBranches,
      branchDetails: updatedDetails,
      timeByUser: {
        ...(task.timeByUser || {}),
        ...(sessionSecs > 0 ? { [activeUser]: prevUserSecs + sessionSecs } : {})
      }
    };

    const logEntry = {
      id: `log-${now}`,
      timestamp: new Date(now).toISOString(),
      user: currentUser,
      targetUser: null,
      taskCode: task.code,
      taskTitle: task.title,
      companyScope: scopeLabel,
      type: 'CONCLUSAO',
      details: `Concluiu [${scopeLabel}] (${statsAfter.percent}%). Tempo: ${formatDuration(newTotalSeconds)}.`,
      durationSeconds: newTotalSeconds
    };

    persistTaskAndLog(updatedTask, logEntry);
  };

  const handleSetBranchStatusDirect = (task: any, branchCodesArray: string[], newStatusVal: string) => {
    if (newStatusVal === 'andamento') {
      handleStartTask(task, branchCodesArray);
      return;
    }
    if (newStatusVal === 'pausada') {
      openPauseModal(task, branchCodesArray);
      return;
    }
    if (newStatusVal === 'transferida') {
      openTransferModal(task, branchCodesArray);
      return;
    }
    if (newStatusVal === 'ok') {
      handleCompleteTask(task, branchCodesArray);
      return;
    }

    const now = Date.now();
    const updatedBranches = { ...(task.branches || {}) };
    branchCodesArray.forEach((c) => {
      updatedBranches[c] = newStatusVal;
    });

    const nextStatus = deriveTaskStatusFromBranches(updatedBranches, task.status);
    const updatedTask = {
      ...task,
      status: nextStatus,
      branches: updatedBranches
    };

    const scopeLabel =
      branchCodesArray.length === BRANCH_CODES.length
        ? 'Todas as 40 Empresas'
        : `Empresa(s) ${branchCodesArray.join(', ')}`;

    const logEntry = {
      id: `log-${now}`,
      timestamp: new Date(now).toISOString(),
      user: currentUser,
      targetUser: null,
      taskCode: task.code,
      taskTitle: task.title,
      companyScope: scopeLabel,
      type: 'FILIAIS',
      details: `Alterou status de [${scopeLabel}] para "${newStatusVal.toUpperCase()}".`,
      durationSeconds: null
    };

    persistTaskAndLog(updatedTask, logEntry);
  };

  const handleCreateNewTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskForm.title.trim()) return;

    const now = Date.now();
    const isAvulsa = newTaskForm.category === 'AVULSA';
    const prefix = isAvulsa ? 'AVU' : 'CTB';
    const countSameType = tasks.filter((t) => t.code.startsWith(prefix)).length + 1;
    const code = `${prefix}-${String(countSameType).padStart(2, '0')}`;

    let applicableBranches = BRANCH_CODES;
    if (newTaskForm.companyScope === 'MATRIZ_010101') applicableBranches = ['010101'];
    else if (newTaskForm.companyScope === 'HOLDING_040101') applicableBranches = ['040101'];
    else if (newTaskForm.companyScope === 'CUSTOM') {
      applicableBranches =
        newTaskForm.customBranches.length > 0 ? newTaskForm.customBranches : ['010101'];
    }

    const initialBranchMap: Record<string, string> = {};
    BRANCH_CODES.forEach((bCode) => {
      if (applicableBranches.includes(bCode)) {
        initialBranchMap[bCode] = newTaskForm.startImmediately ? 'andamento' : 'p';
      } else {
        initialBranchMap[bCode] = 'n/a';
      }
    });

    const isAll = applicableBranches.length === BRANCH_CODES.length;
    const scopeDesc = isAll ? 'Todas as 40 Empresas' : `Empresa(s): ${applicableBranches.join(', ')}`;

    const newTask = {
      id: `${code}-${now}`,
      code,
      title: newTaskForm.title.trim().slice(0, 500),
      topic: newTaskForm.topic,
      accountingType: newTaskForm.accountingType,
      category: newTaskForm.category,
      dueDate: newTaskForm.dueDate,
      assignee: newTaskForm.assignee,
      originalAssignee: currentUser,
      reviewer: 'Rogério',
      status: newTaskForm.startImmediately ? 'EM_ANDAMENTO' : 'PENDENTE',
      isCritical: newTaskForm.isCritical,
      totalSeconds: 0,
      timerStartedAt: newTaskForm.startImmediately ? now : null,
      activeTimerUser: newTaskForm.startImmediately ? newTaskForm.assignee : null,
      activeTimerScope: isAll ? 'ALL' : 'INDIVIDUAL',
      activeTimerBranches: applicableBranches,
      pauseReason: null,
      dependencyInfo: null,
      branches: initialBranchMap,
      branchDetails: {},
      checklistKey: null,
      checklistState: [],
      timeByUser: {},
      evidenceUrl: '',
      comments: newTaskForm.initialNote.trim()
        ? [
            {
              id: `c-${now}`,
              author: currentUser,
              text: `[Escopo: ${scopeDesc}] ${newTaskForm.initialNote.trim()}`,
              createdAt: new Date(now).toISOString()
            }
          ]
        : [],
      ...(fbUser ? { ownerUid: fbUser.uid } : {})
    };

    const logEntry = {
      id: `log-${now}`,
      timestamp: new Date(now).toISOString(),
      user: currentUser,
      targetUser: newTaskForm.assignee !== currentUser ? newTaskForm.assignee : null,
      taskCode: code,
      taskTitle: newTask.title,
      companyScope: scopeDesc,
      type: 'CRIACAO',
      details: `Criou ${isAvulsa ? 'Tarefa Avulsa' : 'Obrigação'} para [${scopeDesc}] atribuída a @${newTask.assignee}.`,
      durationSeconds: null,
      ...(fbUser ? { ownerUid: fbUser.uid } : {})
    };

    setTasks((prev) => [newTask, ...prev]);
    setAuditLogs((prev) => [logEntry, ...prev]);

    if (fbUser && fbUser.emailVerified) {
      try {
        await setDoc(doc(db, 'tasks_10_2026', newTask.id), sanitizeForFirestore(newTask));
        await setDoc(doc(db, 'logs_10_2026', logEntry.id), sanitizeForFirestore(logEntry));
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `tasks_10_2026/${newTask.id}`);
      }
    }

    setIsNewTaskModalOpen(false);
    setNewTaskForm({
      title: '',
      category: 'AVULSA',
      topic: 'Demanda Avulsa / Dia a Dia',
      accountingType: 'Societário',
      assignee: currentUser,
      dueDate: '2026-10-30',
      isCritical: false,
      startImmediately: true,
      initialNote: '',
      companyScope: 'ALL',
      customBranches: ['010101']
    });
  };

  const kpis = useMemo(() => {
    const total = tasks.length;
    const fechamentoCount = tasks.filter((t) => t.category === 'FECHAMENTO').length;
    const avulsasCount = tasks.filter((t) => t.category === 'AVULSA').length;

    const isSingleCompanyView = companyScopeMode === 'SINGLE';
    const singleCode = selectedSingleCompany;

    let pendentes = 0;
    let emAndamento = 0;
    let pausadas = 0;
    let aguardandoDep = 0;
    let concluidas = 0;

    tasks.forEach((t) => {
      if (isSingleCompanyView) {
        const bSt = getBranchDetail(t, singleCode).status;
        if (bSt === 'ok' || bSt === 'n/a') concluidas++;
        else if (bSt === 'andamento') emAndamento++;
        else if (bSt === 'pausada') pausadas++;
        else if (bSt === 'transferida') aguardandoDep++;
        else pendentes++;
      } else {
        if (t.status === 'PENDENTE') pendentes++;
        else if (t.status === 'EM_ANDAMENTO') emAndamento++;
        else if (t.status === 'PAUSADA') pausadas++;
        else if (t.status === 'AGUARDANDO_DEPENDENCIA') aguardandoDep++;
        else if (t.status === 'CONCLUIDA') concluidas++;
      }
    });

    const dependenciaComigo = tasks.filter(
      (t) =>
        (t.status === 'AGUARDANDO_DEPENDENCIA' && t.assignee === currentUser) ||
        t.dependencyInfo?.toUser === currentUser
    ).length;

    let totalTeamSeconds = 0;
    const userMetrics: Record<string, any> = {};
    TEAM_MEMBERS.forEach((m) => {
      userMetrics[m.id] = {
        ...m,
        totalAssigned: 0,
        concluidas: 0,
        emAndamento: 0,
        pausadas: 0,
        aguardandoDep: 0,
        pendentes: 0,
        secondsSpent: 0
      };
    });

    tasks.forEach((t) => {
      const liveSecs = getLiveTaskSeconds(t);
      totalTeamSeconds += liveSecs;

      if (userMetrics[t.assignee]) {
        userMetrics[t.assignee].totalAssigned += 1;
        if (t.status === 'CONCLUIDA') userMetrics[t.assignee].concluidas += 1;
        if (t.status === 'EM_ANDAMENTO') userMetrics[t.assignee].emAndamento += 1;
        if (t.status === 'PAUSADA') userMetrics[t.assignee].pausadas += 1;
        if (t.status === 'AGUARDANDO_DEPENDENCIA') userMetrics[t.assignee].aguardandoDep += 1;
        if (t.status === 'PENDENTE') userMetrics[t.assignee].pendentes += 1;
      }

      if (t.timeByUser) {
        Object.entries(t.timeByUser).forEach(([uName, secs]) => {
          if (userMetrics[uName]) {
            userMetrics[uName].secondsSpent += Number(secs) || 0;
          }
        });
      }
      if (t.status === 'EM_ANDAMENTO' && t.timerStartedAt && t.activeTimerUser) {
        const runningSecs = Math.max(0, Math.floor((nowTick - t.timerStartedAt) / 1000));
        if (userMetrics[t.activeTimerUser]) {
          userMetrics[t.activeTimerUser].secondsSpent += runningSecs;
        }
      }
    });

    const branchRanking = BRANCH_CODES.map((code) => {
      let okCount = 0;
      let naCount = 0;
      let pendCount = 0;
      let runningCount = 0;
      let depCount = 0;

      tasks.forEach((t) => {
        const st = getBranchDetail(t, code).status;
        if (st === 'ok') okCount++;
        else if (st === 'n/a') naCount++;
        else if (st === 'andamento') runningCount++;
        else if (st === 'transferida') depCount++;
        else pendCount++;
      });

      const pct = total > 0 ? Math.round(((okCount + naCount) / total) * 100) : 0;
      return { code, name: getBranchDisplayName(code), okCount, naCount, pendCount, runningCount, depCount, pct };
    });

    const runningTasks = tasks.filter((t) => t.status === 'EM_ANDAMENTO');

    return {
      total,
      fechamentoCount,
      avulsasCount,
      pendentes,
      emAndamento,
      pausadas,
      aguardandoDep,
      concluidas,
      dependenciaComigo,
      totalTeamSeconds,
      percentConcluido: total > 0 ? Math.round((concluidas / total) * 100) : 0,
      userMetrics: Object.values(userMetrics),
      branchRanking,
      runningTasks
    };
  }, [tasks, nowTick, currentUser, companyScopeMode, selectedSingleCompany]);

  const myNotifications = useMemo(() => {
    return auditLogs.filter(
      (log) =>
        log.targetUser === currentUser ||
        (log.details && log.details.toLowerCase().includes(`@${currentUser.toLowerCase()}`))
    );
  }, [auditLogs, currentUser]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (activeTab === 'AVULSAS' && t.category !== 'AVULSA') return false;

      // Filtro de Operador Ativo na Barra Superior (TODOS vs Operadores específicos)
      if (activeOperatorFilter !== 'TODOS' && t.assignee !== activeOperatorFilter) {
        return false;
      }

      if (quickFilter === 'MINHAS' && t.assignee !== currentUser) return false;
      if (
        quickFilter === 'DEPENDENCIA_COMIGO' &&
        !(t.status === 'AGUARDANDO_DEPENDENCIA' && t.assignee === currentUser)
      )
        return false;
      if (quickFilter === 'EM_EXECUCAO' && t.status !== 'EM_ANDAMENTO') return false;
      if (quickFilter === 'FECHAMENTO' && t.category !== 'FECHAMENTO') return false;
      if (quickFilter === 'AVULSAS' && t.category !== 'AVULSA') return false;

      if (userFilter !== 'TODOS' && t.assignee !== userFilter) return false;
      if (statusFilter !== 'TODOS' && t.status !== statusFilter) return false;
      if (topicFilter !== 'TODOS' && t.topic !== topicFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = t.code.toLowerCase().includes(q);
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchTopic = t.topic.toLowerCase().includes(q);
        const matchAssignee = t.assignee.toLowerCase().includes(q);
        const matchDep = t.dependencyInfo?.reason?.toLowerCase().includes(q);
        if (!matchCode && !matchTitle && !matchTopic && !matchAssignee && !matchDep) return false;
      }

      return true;
    });
  }, [tasks, activeTab, activeOperatorFilter, quickFilter, userFilter, statusFilter, topicFilter, searchQuery, currentUser]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

  const activeMemberObj = TEAM_MEMBERS.find((m) => m.id === currentUser) || TEAM_MEMBERS[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* ==========================================
          HEADER CORPORATIVO & OPERADOR ATIVO (COM OPÇÃO "TODOS")
      ========================================== */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-950/50">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  Agriconnection • Gestão & Time Tracking Contábil
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Competência 10/2026
                </span>
                {cloudSynced ? (
                  <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    <ShieldCheck className="w-3 h-3" /> Nuvem Sincronizada
                  </span>
                ) : (
                  <button
                    onClick={handleGoogleSignIn}
                    className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition-colors"
                    title="Conectar conta Google para sincronizar no Firebase Firestore"
                  >
                    <LogIn className="w-3 h-3 text-emerald-400" /> Sincronizar Nuvem
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400">
                40 Filiais (010101 a 160101) • Controle de Execução, Pausas, Dependências (@) e Tarefas Avulsas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setNewTaskForm((prev) => ({ ...prev, assignee: currentUser }));
                setIsNewTaskModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nova Tarefa Avulsa / Obrigação</span>
            </button>

            {/* Sininho de Notificações */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications((prev) => !prev)}
                className="relative p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                title="Notificações e Menções (@)"
              >
                <Bell className="w-5 h-5" />
                {myNotifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {myNotifications.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
                  <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-bold">Menções & Transferências para @{currentUser}</span>
                    <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-white cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {myNotifications.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        Nenhuma menção ou pendência transferida para você.
                      </div>
                    ) : (
                      myNotifications.map((n) => (
                        <div key={n.id} className="p-3 hover:bg-slate-50 text-xs space-y-1">
                          <div className="flex items-center justify-between font-bold text-purple-800">
                            <span>[{n.taskCode}] de @{n.user}</span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(n.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-slate-700">{renderFormattedText(n.details)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* SELETOR DE OPERADOR ATIVO COM OPÇÃO "TODOS" */}
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5">
              <div className={`w-7 h-7 rounded-lg ${activeOperatorFilter === 'TODOS' ? 'bg-indigo-600' : activeMemberObj.color} text-white font-bold text-xs flex items-center justify-center`}>
                {activeOperatorFilter === 'TODOS' ? '🌐' : activeMemberObj.avatar}
              </div>
              <div className="text-left">
                <div className="text-[10px] text-slate-400 leading-none">Operador Ativo (Filtro)</div>
                <select
                  value={activeOperatorFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setActiveOperatorFilter(val);
                    if (val !== 'TODOS') {
                      setCurrentUser(val);
                    }
                  }}
                  className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
                >
                  <option value="TODOS" className="bg-slate-900 text-white font-bold">
                    👥 Todos os Operadores (Geral)
                  </option>
                  {TEAM_MEMBERS.map((m) => (
                    <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                      @{m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {fbUser && (
              <button
                onClick={handleGoogleSignOut}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                title={`Conectado como ${fbUser.email} • Clique para sair`}
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ==========================================
            CRONÔMETRO ATIVO: QUADRO ÚNICO COMPACTO COM EXPANSÃO AO CLICAR
        ========================================== */}
        {kpis.runningTasks.length > 0 && (
          <div className="bg-blue-950/95 border-t border-blue-800/60 px-4 sm:px-6 py-2">
            <div className="max-w-[1600px] mx-auto">
              {!isHeaderTimerExpanded ? (
                <div
                  onClick={() => setIsHeaderTimerExpanded(true)}
                  className="flex items-center justify-between gap-3 cursor-pointer hover:bg-blue-900/50 px-3 py-1.5 rounded-lg transition-colors"
                  title="Clique para expandir todos os cronômetros ativos da equipe"
                >
                  <div className="flex items-center gap-2.5 text-xs font-bold text-blue-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>CRONÔMETROS ATIVOS DA EQUIPE ({kpis.runningTasks.length} rodando)</span>
                    <span className="text-[11px] text-blue-300 font-normal underline">
                      Clique para expandir detalhes ▼
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400">
                    <span>
                      {kpis.runningTasks[0]?.code} • {formatDuration(getLiveTaskSeconds(kpis.runningTasks[0]))}
                    </span>
                    {kpis.runningTasks.length > 1 && (
                      <span className="bg-blue-900 px-2 py-0.5 rounded text-[10px] text-blue-200">
                        +{kpis.runningTasks.length - 1} ativos
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 py-1">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-300 pb-1 border-b border-blue-800">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                      CRONÔMETROS ATIVOS EM TEMPO REAL ({kpis.runningTasks.length}):
                    </span>
                    <button
                      onClick={() => setIsHeaderTimerExpanded(false)}
                      className="text-blue-300 hover:text-white text-xs underline cursor-pointer"
                    >
                      Recolher quadro ▲
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {kpis.runningTasks.map((rt) => {
                      const scopeBadge =
                        rt.activeTimerScope === 'INDIVIDUAL' && rt.activeTimerBranches?.length > 0
                          ? rt.activeTimerBranches.length === 1
                            ? `Filial ${rt.activeTimerBranches[0]}`
                            : `${rt.activeTimerBranches.length} Filiais`
                          : 'Todas as 40 Filiais';
                      return (
                        <div
                          key={rt.id}
                          className="flex items-center gap-2 bg-slate-900/90 border border-blue-500/40 rounded-lg px-2.5 py-1.5 text-xs"
                        >
                          <span className="font-bold text-emerald-400 font-mono">
                            {formatDuration(getLiveTaskSeconds(rt))}
                          </span>
                          <span className="text-slate-300 font-medium truncate max-w-[180px]">
                            [{rt.code}] {rt.title}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
                            🏢 {scopeBadge}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold">
                            @{rt.activeTimerUser || rt.assignee}
                          </span>
                          <button
                            onClick={() => openPauseModal(rt)}
                            className="p-1 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 cursor-pointer"
                            title="Pausar Cronômetro"
                          >
                            <Pause className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleCompleteTask(rt)}
                            className="p-1 rounded bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 cursor-pointer"
                            title="Concluir Tarefa"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ==========================================
          BARRA DE ESCOPO DE EMPRESA (TODAS vs INDIVIDUAL)
      ========================================== */}
      <div className="bg-slate-900/95 text-white border-b border-slate-800 px-4 sm:px-6 py-2.5">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Building2 className="w-4 h-4" />
              Escopo Tarefa vs. Empresa:
            </span>

            <button
              onClick={() => setCompanyScopeMode('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                companyScopeMode === 'ALL'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Todas as 40 Empresas (Consolidado)</span>
            </button>

            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                onClick={() => setCompanyScopeMode('SINGLE')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  companyScopeMode === 'SINGLE' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Empresa Individual:
              </button>
              <select
                value={selectedSingleCompany}
                onChange={(e) => {
                  setSelectedSingleCompany(e.target.value);
                  setCompanyScopeMode('SINGLE');
                }}
                className="bg-transparent text-white text-xs font-mono font-bold px-2 py-1 focus:outline-none cursor-pointer"
              >
                {BRANCH_CODES.map((code) => (
                  <option key={code} value={code} className="bg-slate-900 text-white">
                    {getBranchDisplayName(code)}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setIsCompanySelectorModalOpen(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                companyScopeMode === 'CUSTOM'
                  ? 'bg-indigo-600 text-white border-indigo-400'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>
                {companyScopeMode === 'CUSTOM'
                  ? `Subconjunto (${selectedCustomCompanies.length} Empresas)`
                  : 'Selecionar Múltiplas Filiais...'}
              </span>
            </button>
          </div>

          <div className="hidden xl:flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 text-[11px]">Acesso Rápido Filial:</span>
            {['010101', '010109', '010180', '020101', '030101', '040101'].map((quickCode) => {
              const isCurr = companyScopeMode === 'SINGLE' && selectedSingleCompany === quickCode;
              return (
                <button
                  key={quickCode}
                  onClick={() => {
                    setSelectedSingleCompany(quickCode);
                    setCompanyScopeMode('SINGLE');
                  }}
                  className={`px-2 py-1 rounded font-mono text-[11px] font-bold transition-all cursor-pointer ${
                    isCurr
                      ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {quickCode}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ==========================================
          NAVEGAÇÃO DE ABAS
      ========================================== */}
      <div className="bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4">
          <nav className="flex items-center gap-1 overflow-x-auto py-2">
            {[
              { id: 'LISTA', label: 'Cards Tarefa vs. Empresa', icon: ListTodo, badge: kpis.total },
              { id: 'MATRIZ', label: 'Matriz Tarefa x 40 Empresas (Planilha)', icon: Building2, badge: `${activeScopedBranches.length} Emp.`, highlightMatrix: true },
              { id: 'KANBAN', label: 'Quadro Kanban', icon: Columns, badge: null },
              { id: 'AVULSAS', label: 'Tarefas Avulsas (Dia a Dia)', icon: Zap, badge: kpis.avulsasCount, highlight: true },
              { id: 'DASHBOARD', label: 'Painel por Empresa & Analista', icon: LayoutDashboard, badge: null },
              { id: 'HISTORICO', label: 'Histórico & Auditoria', icon: History, badge: auditLogs.length }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : tab.highlightMatrix
                      ? 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${tab.highlight && !isActive ? 'text-amber-500' : ''}`} />
                  <span>{tab.label}</span>
                  {tab.badge !== null && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-700'}`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="hidden lg:flex items-center gap-4 py-2 text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span className="text-slate-600">Tempo Total Equipe:</span>
              <span className="font-mono font-bold text-slate-900">{formatDuration(kpis.totalTeamSeconds)}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200">
              <ArrowRightLeft className="w-4 h-4 text-purple-600" />
              <span className="text-purple-800">Transferidas c/ Dependência (@):</span>
              <span className="font-bold text-purple-900">{kpis.aguardandoDep}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-emerald-800">Progresso Geral:</span>
              <span className="font-bold text-emerald-900">{kpis.concluidas}/{kpis.total} ({kpis.percentConcluido}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ==========================================
          CONTEÚDO PRINCIPAL
      ========================================== */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* CARDS DE STATUS RÁPIDOS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div
            onClick={() => { setStatusFilter('TODOS'); setQuickFilter('TODAS'); }}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer bg-white hover:shadow-md ${statusFilter === 'TODOS' && quickFilter === 'TODAS' ? 'ring-2 ring-slate-900 border-slate-900' : 'border-slate-200'}`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>TOTAL OBRIGAÇÕES</span>
              <Layers className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-slate-900">{kpis.total}</span>
              <span className="text-[11px] text-slate-500">{kpis.fechamentoCount} Fech. + {kpis.avulsasCount} Avulsas</span>
            </div>
          </div>

          <div
            onClick={() => { setStatusFilter('EM_ANDAMENTO'); setQuickFilter('TODAS'); }}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer bg-white hover:shadow-md ${statusFilter === 'EM_ANDAMENTO' ? 'ring-2 ring-blue-600 border-blue-600' : 'border-blue-200'}`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-blue-700">
              <span>INICIADAS / ATIVAS</span>
              <Play className="w-4 h-4 text-blue-600 fill-blue-600" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-blue-700">{kpis.emAndamento}</span>
              <span className="text-[11px] font-semibold text-blue-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" /> Cronômetro ON
              </span>
            </div>
          </div>

          <div
            onClick={() => { setStatusFilter('PAUSADA'); setQuickFilter('TODAS'); }}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer bg-white hover:shadow-md ${statusFilter === 'PAUSADA' ? 'ring-2 ring-amber-500 border-amber-500' : 'border-amber-200'}`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-amber-800">
              <span>PAUSADAS</span>
              <Pause className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-amber-700">{kpis.pausadas}</span>
              <span className="text-[11px] text-amber-700">Tempo salvo</span>
            </div>
          </div>

          <div
            onClick={() => { setStatusFilter('AGUARDANDO_DEPENDENCIA'); setQuickFilter('TODAS'); }}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer bg-white hover:shadow-md ${statusFilter === 'AGUARDANDO_DEPENDENCIA' ? 'ring-2 ring-purple-600 border-purple-600' : 'border-purple-200'}`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-purple-800">
              <span>DEPENDÊNCIA (@)</span>
              <ArrowRightLeft className="w-4 h-4 text-purple-600" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-purple-700">{kpis.aguardandoDep}</span>
              <span className="text-[11px] font-bold text-purple-700">{kpis.dependenciaComigo} p/ @{currentUser}</span>
            </div>
          </div>

          <div
            onClick={() => { setStatusFilter('PENDENTE'); setQuickFilter('TODAS'); }}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer bg-white hover:shadow-md ${statusFilter === 'PENDENTE' ? 'ring-2 ring-slate-500 border-slate-500' : 'border-slate-200'}`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>NÃO INICIADAS</span>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-slate-700">{kpis.pendentes}</span>
              <span className="text-[11px] text-slate-500">Na fila</span>
            </div>
          </div>

          <div
            onClick={() => { setStatusFilter('CONCLUIDA'); setQuickFilter('TODAS'); }}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer bg-white hover:shadow-md ${statusFilter === 'CONCLUIDA' ? 'ring-2 ring-emerald-600 border-emerald-600' : 'border-emerald-200'}`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
              <span>CONCLUÍDAS</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-emerald-700">{kpis.concluidas}</span>
              <span className="text-[11px] font-bold text-emerald-700">{kpis.percentConcluido}% entregue</span>
            </div>
          </div>
        </div>

        {/* ==========================================
            BARRA DE FILTROS & BUSCA
        ========================================== */}
        {(activeTab === 'LISTA' || activeTab === 'MATRIZ' || activeTab === 'KANBAN' || activeTab === 'AVULSAS') && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'TODAS', label: 'Todas as Tarefas' },
                  { id: 'MINHAS', label: `Minhas Tarefas (@${currentUser})` },
                  { id: 'DEPENDENCIA_COMIGO', label: `Transferidas p/ Mim (@${currentUser})`, count: kpis.dependenciaComigo, purple: true },
                  { id: 'EM_EXECUCAO', label: 'Em Execução Agora (Timer ON)' },
                  { id: 'FECHAMENTO', label: 'Rotina Fechamento Mensal' },
                  { id: 'AVULSAS', label: 'Tarefas Avulsas (Dia a Dia)' }
                ].map((pill) => {
                  const active = quickFilter === pill.id;
                  return (
                    <button
                      key={pill.id}
                      onClick={() => setQuickFilter(pill.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                        active
                          ? pill.purple ? 'bg-purple-700 text-white shadow-xs' : 'bg-slate-900 text-white shadow-xs'
                          : pill.purple ? 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>{pill.label}</span>
                      {pill.count !== undefined && pill.count > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white text-purple-800 font-extrabold">
                          {pill.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Botão Limpar Filtros */}
              <div className="flex items-center gap-3">
                {(quickFilter !== 'TODAS' || userFilter !== 'TODOS' || statusFilter !== 'TODOS' || topicFilter !== 'TODOS' || activeOperatorFilter !== 'TODOS' || searchQuery.trim() !== '') && (
                  <button
                    onClick={() => {
                      setQuickFilter('TODAS');
                      setUserFilter('TODOS');
                      setStatusFilter('TODOS');
                      setTopicFilter('TODOS');
                      setActiveOperatorFilter('TODOS');
                      setSearchQuery('');
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer"
                    title="Limpar todos os filtros e mostrar todas as tarefas"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Limpar Filtros</span>
                  </button>
                )}

                <span className="text-xs font-medium text-slate-500">
                  Exibindo <strong>{filteredTasks.length}</strong> de {tasks.length} obrigações
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100">
              <div className="sm:col-span-2 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por código (CTB-10, AVU-01), nome da conciliação, @usuario..."
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                />
              </div>

              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="TODOS">👤 Todos os Responsáveis (Atribuição)</option>
                {TEAM_MEMBERS.map((m) => (
                  <option key={m.id} value={m.id}>
                    Responsável: {m.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="TODOS">📌 Todos os Status</option>
                <option value="PENDENTE">Pendente (Não Iniciada)</option>
                <option value="EM_ANDAMENTO">Iniciada / Em Andamento</option>
                <option value="PAUSADA">Tarefa Pausada</option>
                <option value="AGUARDANDO_DEPENDENCIA">Transferida / Dependência (@)</option>
                <option value="CONCLUIDA">Concluída</option>
              </select>

              <select
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="TODOS">📂 Todos os Tópicos Contábeis</option>
                <option value="Fechamento de resultado">Fechamento de resultado</option>
                <option value="Conciliações contabeis">Conciliações contábeis</option>
                <option value="Coneasy">Coneasy</option>
                <option value="Demonstrativos">Demonstrativos</option>
                <option value="Demanda Avulsa / Auditoria">Demanda Avulsa / Auditoria</option>
                <option value="Demanda Avulsa / Dia a Dia">Demanda Avulsa / Dia a Dia</option>
              </select>
            </div>
          </div>
        )}

        {/* ==========================================
            ABA 1 E 3: LISTA DE TAREFAS (COM ACORDEÃO NA MESMA TELA)
        ========================================== */}
        {(activeTab === 'LISTA' || activeTab === 'AVULSAS') && (
          <div className="space-y-3">
            {activeTab === 'AVULSAS' && (
              <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-300 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500 text-white">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900">
                      Gestão de Tarefas Avulsas do Dia a Dia (Fora do Cronograma Fixo)
                    </h2>
                    <p className="text-xs text-slate-600">
                      Registre chamados urgentes, atendimentos à auditoria, parametrizações no TOTVS e demandas extras.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setNewTaskForm((prev) => ({ ...prev, category: 'AVULSA', assignee: currentUser }));
                    setIsNewTaskModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  + Registrar Demanda Avulsa Agora
                </button>
              </div>
            )}

            {filteredTasks.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
                <ListTodo className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">
                  Nenhuma tarefa encontrada para os filtros e operador selecionados.
                </p>
                <button
                  onClick={() => {
                    setQuickFilter('TODAS');
                    setUserFilter('TODOS');
                    setStatusFilter('TODOS');
                    setTopicFilter('TODOS');
                    setActiveOperatorFilter('TODOS');
                    setSearchQuery('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                >
                  Limpar todos os filtros
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredTasks.map((task) => {
                  const st = STATUS_CONFIG[task.status] || STATUS_CONFIG.PENDENTE;
                  const liveSeconds = getLiveTaskSeconds(
                    task,
                    companyScopeMode === 'SINGLE' ? selectedSingleCompany : null
                  );
                  const allBranchStats = calculateBranchStats(task.branches, BRANCH_CODES);
                  const member = TEAM_MEMBERS.find((m) => m.id === task.assignee) || TEAM_MEMBERS[0];
                  const isRunning = task.status === 'EM_ANDAMENTO';
                  const isDep = task.status === 'AGUARDANDO_DEPENDENCIA';
                  const isPaused = task.status === 'PAUSADA';
                  const isDone = task.status === 'CONCLUIDA';

                  const localScope = taskActionScope[task.id] || {
                    mode: companyScopeMode === 'SINGLE' ? 'SELECTED' : 'ALL',
                    branches: companyScopeMode === 'SINGLE' ? [selectedSingleCompany] : []
                  };
                  const targetBranchesForAction = getTaskTargetBranches(task);
                  const isGridExpanded = !!expandedTaskBranches[task.id];
                  const singleBranchInfo =
                    companyScopeMode === 'SINGLE' ? getBranchDetail(task, selectedSingleCompany) : null;

                  return (
                    <div
                      key={task.id}
                      className={`bg-white rounded-xl border transition-all hover:shadow-md ${
                        isRunning
                          ? 'border-blue-400 ring-1 ring-blue-400/50 bg-blue-50/5'
                          : isDep
                          ? 'border-purple-300 bg-purple-50/5'
                          : isPaused
                          ? 'border-amber-300'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="p-4 space-y-3">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                                  task.category === 'AVULSA'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-slate-900 text-white'
                                }`}
                              >
                                {task.code}
                              </span>

                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${st.bg} ${st.text} ${st.border}`}
                              >
                                <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                                {st.label}
                              </span>

                              {singleBranchInfo && (
                                <span
                                  className={`px-2.5 py-0.5 rounded-md text-xs font-mono font-bold border ${
                                    BRANCH_STATUS_CHIP[singleBranchInfo.status]?.cls || ''
                                  }`}
                                >
                                  Filial {selectedSingleCompany}:{' '}
                                  {BRANCH_STATUS_CHIP[singleBranchInfo.status]?.label}
                                </span>
                              )}

                              {task.category === 'AVULSA' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  <Zap className="w-3 h-3" /> Tarefa Avulsa
                                </span>
                              )}

                              {task.isCritical && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                  <AlertTriangle className="w-3 h-3" /> Caminho Crítico
                                </span>
                              )}

                              <span className="text-xs text-slate-500 font-medium">
                                {task.topic} • <strong>{task.accountingType}</strong> • Prazo:{' '}
                                <strong>{task.dueDate.split('-').reverse().join('/')}</strong>
                              </span>
                            </div>

                            {/* TÍTULO CLICÁVEL: Expande empresas na MESMA TELA (Acordeão) sem abrir nova janela */}
                            <div className="flex items-start gap-2">
                              <button
                                onClick={() =>
                                  setExpandedTaskBranches((prev) => ({
                                    ...prev,
                                    [task.id]: !prev[task.id]
                                  }))
                                }
                                className="text-left text-sm sm:text-base font-bold text-slate-900 hover:text-blue-700 transition-colors cursor-pointer flex items-center gap-2"
                              >
                                <span>{task.title}</span>
                                <span className="text-xs font-normal text-blue-600 underline">
                                  {isGridExpanded ? 'Ocultar empresas ▲' : 'Ver empresas ▼'}
                                </span>
                              </button>
                            </div>

                            {/* Banner de Dependência */}
                            {isDep && task.dependencyInfo && (
                              <div className="mt-2 p-2.5 rounded-lg bg-purple-50 border border-purple-200 flex items-start gap-2.5">
                                <ArrowRightLeft className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                                <div className="text-xs text-purple-950 space-y-0.5">
                                  <div className="font-bold flex flex-wrap items-center gap-1">
                                    <span>Transferida por Dependência:</span>
                                    <span className="px-1.5 py-0.2 rounded bg-purple-200 text-purple-900">
                                      De @{task.dependencyInfo.fromUser}
                                    </span>
                                    <span>→</span>
                                    <span className="px-1.5 py-0.2 rounded bg-purple-700 text-white">
                                      Para @{task.dependencyInfo.toUser}
                                    </span>
                                  </div>
                                  <p className="text-purple-900">{renderFormattedText(task.dependencyInfo.reason)}</p>
                                </div>
                              </div>
                            )}

                            {/* Banner de Pausa */}
                            {isPaused && task.pauseReason && (
                              <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs text-amber-900">
                                <Pause className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                <span>
                                  <strong>Motivo da Pausa:</strong> {renderFormattedText(task.pauseReason)}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 lg:gap-4 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                            {/* Responsável */}
                            <div className="flex items-center gap-2 min-w-[115px]">
                              <div className={`w-8 h-8 rounded-full ${member.color} text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0`}>
                                {member.avatar}
                              </div>
                              <div>
                                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                                  Responsável
                                </div>
                                <div className="text-xs font-bold text-slate-800">@{task.assignee}</div>
                              </div>
                            </div>

                            {/* Botão Expansor de Filiais */}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedTaskBranches((prev) => ({
                                  ...prev,
                                  [task.id]: !prev[task.id]
                                }))
                              }
                              className={`px-3 py-1.5 rounded-xl border text-left transition-all cursor-pointer min-w-[145px] ${
                                isGridExpanded
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                                <span className="flex items-center gap-1">
                                  <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                                  {allBranchStats.ok + allBranchStats.na}/40 Emp.
                                </span>
                                <span>{allBranchStats.percent}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-200/60 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 transition-all"
                                  style={{ width: `${allBranchStats.percent}%` }}
                                />
                              </div>
                              <div className="text-[10px] opacity-75 mt-0.5 flex items-center justify-between">
                                <span>{allBranchStats.ok} OK • {allBranchStats.p} P</span>
                                <span className="underline font-semibold">
                                  {isGridExpanded ? 'Ocultar ▲' : 'Selecionar ▼'}
                                </span>
                              </div>
                            </button>

                            {/* Cronômetro */}
                            <div className={`px-3 py-2 rounded-xl border min-w-[125px] text-center ${
                              isRunning
                                ? 'bg-blue-950 text-white border-blue-700 shadow-sm'
                                : 'bg-slate-50 text-slate-800 border-slate-200'
                            }`}>
                              <div className="text-[10px] uppercase tracking-wider font-semibold opacity-75 flex items-center justify-center gap-1">
                                <Timer className="w-3 h-3" />
                                <span>{isRunning ? 'Timer ON' : 'Tempo Gasto'}</span>
                              </div>
                              <div className={`font-mono text-sm sm:text-base font-extrabold ${isRunning ? 'text-emerald-400' : 'text-slate-900'}`}>
                                {formatDuration(liveSeconds)}
                              </div>
                            </div>

                            {/* Botões de Ação */}
                            <div className="flex items-center gap-1.5">
                              {!isRunning && (
                                <button
                                  onClick={() => handleStartTask(task)}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs cursor-pointer"
                                  title="Iniciar Cronômetro"
                                >
                                  <Play className="w-3.5 h-3.5 fill-white" />
                                  <span>Iniciar</span>
                                </button>
                              )}

                              {isRunning && (
                                <button
                                  onClick={() => openPauseModal(task)}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs cursor-pointer"
                                  title="Pausar Tarefa"
                                >
                                  <Pause className="w-3.5 h-3.5 fill-white" />
                                  <span>Pausar</span>
                                </button>
                              )}

                              <button
                                onClick={() => openTransferModal(task)}
                                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-300 text-xs font-bold cursor-pointer"
                                title="Transferir para outro usuário (@)"
                              >
                                <AtSign className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">Transferir</span>
                              </button>

                              {!isDone ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleCompleteTask(task)}
                                    className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer"
                                    title="Concluir"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span className="hidden xl:inline">Concluir</span>
                                  </button>
                                  {(task.status === 'EM_ANDAMENTO' || task.status === 'PAUSADA' || task.status === 'AGUARDANDO_DEPENDENCIA') && (
                                    <button
                                      onClick={() => handleReopenTask(task)}
                                      className="px-2.5 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
                                      title="Retornar para Pendente (Iniciado por engano)"
                                    >
                                      Voltar Pendente
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleReopenTask(task)}
                                  className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                                  title="Reabrir Tarefa"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Reabrir</span>
                                </button>
                              )}

                              <button
                                onClick={() => setSelectedTaskId(task.id)}
                                className="px-2.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                                title="Abrir Detalhes e Checklists"
                              >
                                Detalhes
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* ==============================================================
                            PAINEL EXPANSÍVEL NA MESMA TELA (ACORDEÃO DE EMPRESAS)
                        ============================================================== */}
                        {isGridExpanded && (
                          <div className="pt-3 border-t border-slate-200 bg-slate-50/70 -mx-4 -mb-4 p-4 rounded-b-xl space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                                  Selecione as Empresas / Filiais para esta ação:
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setTaskScopeConfig(task.id, 'ALL', [])}
                                  className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer ${
                                    targetBranchesForAction.length === 40
                                      ? 'bg-slate-900 text-white'
                                      : 'bg-white text-slate-700 border border-slate-300'
                                  }`}
                                >
                                  Todas as 40 Empresas (Lote)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTaskScopeConfig(task.id, 'PENDING', [])}
                                  className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer ${
                                    localScope.mode === 'PENDING'
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-white text-slate-700 border border-slate-300'
                                  }`}
                                >
                                  Apenas Pendentes ({allBranchStats.p})
                                </button>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] font-bold text-indigo-900 bg-indigo-100 px-2 py-1 rounded">
                                  Alvo:{' '}
                                  {targetBranchesForAction.length === 40
                                    ? 'Todas as 40 Filiais'
                                    : `${targetBranchesForAction.length} Filial(is)`}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleStartTask(task, targetBranchesForAction)}
                                  className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  ▶ Iniciar Alvo
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCompleteTask(task, targetBranchesForAction)}
                                  className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  ✓ Marcar OK
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetBranchStatusDirect(task, targetBranchesForAction, 'p')}
                                  className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold cursor-pointer"
                                >
                                  Pendente
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openTransferModal(task, targetBranchesForAction)}
                                  className="px-2 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  @ Transferir
                                </button>
                              </div>
                            </div>

                            {/* Grade dos 40 Chips de Empresas */}
                            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5">
                              {BRANCH_CODES.map((bCode) => {
                                const detail = getBranchDetail(task, bCode);
                                const chipCfg = BRANCH_STATUS_CHIP[detail.status] || BRANCH_STATUS_CHIP.p;
                                const isSelectedIndividual =
                                  localScope.mode === 'SELECTED' && localScope.branches?.includes(bCode);

                                return (
                                  <div
                                    key={bCode}
                                    onClick={() => toggleBranchInTaskSelection(task, bCode)}
                                    onDoubleClick={() => {
                                      const nextSt =
                                        detail.status === 'p' ? 'ok' : detail.status === 'ok' ? 'n/a' : 'p';
                                      handleSetBranchStatusDirect(task, [bCode], nextSt);
                                    }}
                                    title={`${getBranchDisplayName(bCode)}\nStatus: ${chipCfg.label}\n• Clique simples: Selecionar\n• Duplo clique: Alternar OK / P / N/A`}
                                    className={`px-2 py-1.5 rounded-lg border text-center transition-all cursor-pointer select-none flex flex-col items-center justify-center ${chipCfg.cls} ${
                                      isSelectedIndividual ? 'ring-2 ring-slate-950 scale-105 shadow-sm' : ''
                                    }`}
                                  >
                                    <div className="text-[10px] font-mono font-bold leading-tight">{bCode}</div>
                                    <div className="text-[9px] uppercase font-extrabold leading-tight mt-0.5">
                                      {chipCfg.short}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==========================================
            ABA 2: MATRIZ TAREFA x 40 EMPRESAS (PLANILHA)
        ========================================== */}
        {activeTab === 'MATRIZ' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                  Matriz Interativa Tarefa vs. Empresa ({filteredTasks.length} Tarefas × {activeScopedBranches.length} Empresas)
                </h2>
                <p className="text-xs text-slate-600">
                  Clique em qualquer célula `(Tarefa, Empresa)` para abrir ações individuais na filial.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-900 font-bold border border-emerald-300">OK = Concluída</span>
                <span className="px-2 py-1 rounded bg-blue-600 text-white font-bold">▶ = Timer</span>
                <span className="px-2 py-1 rounded bg-purple-600 text-white font-bold">@ = Transferida</span>
                <span className="px-2 py-1 rounded bg-amber-50 text-amber-900 font-bold border border-amber-300">P = Pendente</span>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[72vh]">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-slate-900 text-white sticky top-0 z-20">
                  <tr>
                    <th className="p-2.5 border-r border-slate-700 sticky left-0 bg-slate-900 z-30 min-w-[75px]">ID</th>
                    <th className="p-2.5 border-r border-slate-700 sticky left-[75px] bg-slate-900 z-30 min-w-[260px] max-w-[260px]">Obrigação / Tarefa Contábil</th>
                    <th className="p-2.5 border-r border-slate-700 min-w-[95px]">Resp.</th>
                    <th className="p-2.5 border-r border-slate-700 min-w-[90px] text-center">Tempo</th>
                    <th className="p-2.5 border-r border-slate-700 min-w-[80px] text-center">% Filiais</th>
                    <th className="p-2.5 border-r border-slate-700 min-w-[145px] text-center bg-slate-800">Ação Lote</th>
                    {activeScopedBranches.map((code) => {
                      const bRank = kpis.branchRanking.find((r) => r.code === code);
                      return (
                        <th
                          key={code}
                          onClick={() => {
                            if (companyScopeMode === 'SINGLE' && selectedSingleCompany === code) {
                              setCompanyScopeMode('ALL');
                            } else {
                              setSelectedSingleCompany(code);
                              setCompanyScopeMode('SINGLE');
                            }
                          }}
                          className="p-2 border-r border-slate-800 text-center font-mono min-w-[64px] cursor-pointer hover:bg-slate-800"
                        >
                          <div className="text-[11px] font-bold text-emerald-400">{code}</div>
                          <div className="text-[9px] text-slate-300 font-normal">{bRank?.pct || 0}%</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredTasks.map((task) => {
                    const stStats = calculateBranchStats(task.branches, activeScopedBranches);
                    const liveSecs = getLiveTaskSeconds(task);
                    return (
                      <tr key={task.id} className="hover:bg-slate-50/90">
                        <td className="p-2 border-r border-slate-200 font-mono font-bold sticky left-0 bg-white z-10">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${task.category === 'AVULSA' ? 'bg-amber-100 text-amber-900' : 'bg-slate-900 text-white'}`}>
                            {task.code}
                          </span>
                        </td>
                        <td
                          onClick={() => setSelectedTaskId(task.id)}
                          className="p-2 border-r border-slate-200 font-semibold text-slate-900 sticky left-[75px] bg-white z-10 truncate max-w-[260px] cursor-pointer hover:text-blue-600"
                        >
                          {task.title}
                        </td>
                        <td className="p-2 border-r border-slate-200 font-bold text-slate-700">@{task.assignee}</td>
                        <td className="p-2 border-r border-slate-200 font-mono font-bold text-center">{formatDuration(liveSecs)}</td>
                        <td className="p-2 border-r border-slate-200 text-center font-bold">
                          <span className={`px-1.5 py-0.5 rounded text-[11px] ${stStats.percent === 100 ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-800'}`}>
                            {stStats.percent}%
                          </span>
                        </td>
                        <td className="p-1.5 border-r border-slate-200 text-center bg-slate-50">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => handleStartTask(task, 'ALL')} className="px-1.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold cursor-pointer">▶</button>
                            <button onClick={() => handleCompleteTask(task, 'ALL')} className="px-1.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer">OK</button>
                            <button onClick={() => handleSetBranchStatusDirect(task, BRANCH_CODES, 'p')} className="px-1.5 py-1 rounded bg-amber-100 text-amber-900 text-[10px] font-bold cursor-pointer">P</button>
                            <button onClick={() => openTransferModal(task, 'ALL')} className="px-1.5 py-1 rounded bg-purple-600 text-white text-[10px] font-bold cursor-pointer">@</button>
                          </div>
                        </td>

                        {activeScopedBranches.map((code) => {
                          const detail = getBranchDetail(task, code);
                          const cfg = BRANCH_STATUS_CHIP[detail.status] || BRANCH_STATUS_CHIP.p;
                          const isPopoverOpen = activeMatrixCell?.taskId === task.id && activeMatrixCell?.branchCode === code;

                          return (
                            <td key={code} className="p-1 border-r border-slate-100 text-center relative">
                              <button
                                type="button"
                                onClick={() => setActiveMatrixCell(isPopoverOpen ? null : { taskId: task.id, branchCode: code })}
                                className={`w-full py-1.5 rounded text-[10px] font-mono border transition-all cursor-pointer ${cfg.cls}`}
                              >
                                {cfg.short}
                              </button>

                              {isPopoverOpen && (
                                <div className="absolute right-0 top-8 z-40 w-52 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 p-2.5 text-left space-y-2">
                                  <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
                                    <div>
                                      <div className="text-[10px] text-emerald-400 font-mono font-bold">{task.code} • Filial {code}</div>
                                      <div className="text-[10px] text-slate-300">Resp: @{detail.owner}</div>
                                    </div>
                                    <button onClick={() => setActiveMatrixCell(null)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1">
                                    <button onClick={() => { handleStartTask(task, [code]); setActiveMatrixCell(null); }} className="px-2 py-1 rounded bg-blue-600 text-white text-[10px] font-bold cursor-pointer">▶ Iniciar</button>
                                    <button onClick={() => { handleCompleteTask(task, [code]); setActiveMatrixCell(null); }} className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-bold cursor-pointer">✓ OK</button>
                                    <button onClick={() => { openPauseModal(task, [code]); setActiveMatrixCell(null); }} className="px-2 py-1 rounded bg-amber-500 text-white text-[10px] font-bold cursor-pointer">⏸ Pausar</button>
                                    <button onClick={() => { openTransferModal(task, [code]); setActiveMatrixCell(null); }} className="px-2 py-1 rounded bg-purple-600 text-white text-[10px] font-bold cursor-pointer">@ Transferir</button>
                                  </div>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==========================================
            ABA 3: KANBAN
        ========================================== */}
        {activeTab === 'KANBAN' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 items-start">
            {[
              { key: 'PENDENTE', title: 'Pendente', headerBg: 'bg-slate-800' },
              { key: 'EM_ANDAMENTO', title: 'Em Andamento', headerBg: 'bg-blue-700' },
              { key: 'PAUSADA', title: 'Pausada', headerBg: 'bg-amber-600' },
              { key: 'AGUARDANDO_DEPENDENCIA', title: 'Dependência (@)', headerBg: 'bg-purple-700' },
              { key: 'CONCLUIDA', title: 'Concluída', headerBg: 'bg-emerald-700' }
            ].map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.key);
              return (
                <div key={col.key} className="bg-slate-100/90 rounded-xl border border-slate-200 overflow-hidden flex flex-col max-h-[75vh]">
                  <div className={`${col.headerBg} text-white px-3.5 py-2.5 flex items-center justify-between`}>
                    <span className="text-xs font-bold uppercase tracking-wider">{col.title}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-black/25">{colTasks.length}</span>
                  </div>
                  <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
                    {colTasks.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-lg">
                        Nenhuma tarefa nesta etapa
                      </div>
                    ) : (
                      colTasks.map((task) => {
                        const liveSecs = getLiveTaskSeconds(task);
                        const branchStats = calculateBranchStats(task.branches);
                        return (
                          <div key={task.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs hover:shadow-md transition-all space-y-2.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${task.category === 'AVULSA' ? 'bg-amber-100 text-amber-900' : 'bg-slate-900 text-white'}`}>{task.code}</span>
                              <span className="font-mono text-xs font-bold text-slate-700 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-blue-600" /> {formatDuration(liveSecs)}
                              </span>
                            </div>
                            <button onClick={() => setSelectedTaskId(task.id)} className="text-left text-xs font-bold text-slate-900 hover:text-blue-700 line-clamp-2 cursor-pointer">
                              {task.title}
                            </button>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                              <span className="font-bold text-slate-800">@{task.assignee}</span>
                              <span>Filiais: {branchStats.percent}%</span>
                            </div>
                            <div className="flex items-center gap-1 pt-1">
                              {task.status !== 'EM_ANDAMENTO' && task.status !== 'CONCLUIDA' && (
                                <button onClick={() => handleStartTask(task)} className="flex-1 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer">
                                  <Play className="w-3 h-3 fill-white" /> Iniciar
                                </button>
                              )}
                              {task.status === 'EM_ANDAMENTO' && (
                                <button onClick={() => openPauseModal(task)} className="flex-1 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer">
                                  <Pause className="w-3 h-3 fill-white" /> Pausar
                                </button>
                              )}
                              {task.status !== 'CONCLUIDA' && (
                                <>
                                  <button onClick={() => openTransferModal(task)} className="px-2 py-1.5 rounded bg-purple-100 hover:bg-purple-200 text-purple-800 text-[11px] font-bold cursor-pointer">@</button>
                                  <button onClick={() => handleCompleteTask(task)} className="px-2 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"><Check className="w-3 h-3" /></button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ==========================================
            ABA 4: DASHBOARD
        ========================================== */}
        {activeTab === 'DASHBOARD' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    Matriz de Tempo Investido, Carga e Entregas por Analista Contábil
                  </h2>
                </div>
                <div className="text-xs font-mono font-bold bg-slate-900 text-white px-3 py-1.5 rounded-lg">
                  Tempo Total Departamento: {formatDuration(kpis.totalTeamSeconds)}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {kpis.userMetrics.map((um) => {
                  const pct = um.totalAssigned > 0 ? Math.round((um.concluidas / um.totalAssigned) * 100) : 0;
                  return (
                    <div key={um.id} className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-10 h-10 rounded-xl ${um.color} text-white font-bold text-sm flex items-center justify-center shadow-xs`}>
                            {um.avatar}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">@{um.name}</h3>
                            <p className="text-[11px] text-slate-500">{um.role}</p>
                          </div>
                        </div>
                        <span className="text-sm font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          {pct}%
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                        <span className="text-xs text-slate-600 flex items-center gap-1.5">
                          <Timer className="w-4 h-4 text-blue-600" /> Tempo Cronometrado:
                        </span>
                        <span className="font-mono text-sm font-extrabold text-slate-900">{formatDuration(um.secondsSpent)}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                        <div className="bg-white p-1.5 rounded border border-slate-200">
                          <div className="text-slate-400">Total</div>
                          <div className="font-bold text-slate-800">{um.totalAssigned}</div>
                        </div>
                        <div className="bg-emerald-50 p-1.5 rounded border border-emerald-200">
                          <div className="text-emerald-700">Concl.</div>
                          <div className="font-bold text-emerald-900">{um.concluidas}</div>
                        </div>
                        <div className="bg-purple-50 p-1.5 rounded border border-purple-200">
                          <div className="text-purple-700">Dep. (@)</div>
                          <div className="font-bold text-purple-900">{um.aguardandoDep}</div>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-600" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ranking de Progresso por Filial */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                  Status de Fechamento por Empresa / Filial (40 Unidades)
                </h2>
                <span className="text-xs text-slate-500">Clique em uma filial para filtrar o escopo individual</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 gap-2.5">
                {kpis.branchRanking.map((b) => (
                  <button
                    key={b.code}
                    onClick={() => {
                      setSelectedSingleCompany(b.code);
                      setCompanyScopeMode('SINGLE');
                      setActiveTab('LISTA');
                    }}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 bg-slate-50/70 hover:bg-white text-left transition-all cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-extrabold text-slate-900">{b.code}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${b.pct === 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                        {b.pct}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${b.pct}%` }} />
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">{b.name.split('•')[1]?.trim() || 'Filial'}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            ABA 5: HISTÓRICO
        ========================================== */}
        {activeTab === 'HISTORICO' && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              Trilha de Auditoria Completa
            </h2>
            <div className="space-y-2.5">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-bold text-[11px]">{log.taskCode}</span>
                      <span className="font-bold text-slate-900">{log.taskTitle}</span>
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 font-bold text-[10px]">{log.type}</span>
                    </div>
                    <p className="text-slate-700">{renderFormattedText(log.details)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-slate-900">@{log.user}</div>
                    <div className="text-[11px] font-mono text-slate-400">{new Date(log.timestamp).toLocaleString('pt-BR')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ==========================================
          MODAL DE PAUSA (z-[100])
      ========================================== */}
      {pauseModalTask && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-amber-500 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Pause className="w-4 h-4 fill-white" />
                <span>Pausar Cronômetro e Salvar Tempo</span>
              </div>
              <button onClick={() => setPauseModalTask(null)} className="text-white/80 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={confirmPauseTask} className="p-5 space-y-4">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <div className="font-mono font-bold text-amber-700">{pauseModalTask.code}</div>
                <div className="font-bold text-slate-900">{pauseModalTask.title}</div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Motivo da Pausa *</label>
                <textarea
                  rows={3}
                  value={pauseReasonInput}
                  onChange={(e) => setPauseReasonInput(e.target.value)}
                  placeholder="Descreva o motivo da pausa..."
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setPauseModalTask(null)} className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold cursor-pointer">Confirmar Pausa</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL DE SELEÇÃO DE EMPRESAS (z-[100])
      ========================================== */}
      {isCompanySelectorModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span>Selecionar Empresas / Filiais</span>
              </div>
              <button onClick={() => setIsCompanySelectorModalOpen(false)} className="text-white/80 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 max-h-72 overflow-y-auto p-1">
                {BRANCH_CODES.map((code) => {
                  const isSel = selectedCustomCompanies.includes(code);
                  return (
                    <button
                      type="button"
                      key={code}
                      onClick={() =>
                        setSelectedCustomCompanies((prev) =>
                          prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
                        )
                      }
                      className={`p-2 rounded-lg border font-mono text-xs font-bold transition-all cursor-pointer ${
                        isSel ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {code}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => { setCompanyScopeMode('ALL'); setIsCompanySelectorModalOpen(false); }} className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">Usar Todas (40)</button>
                <button type="button" onClick={() => { setCompanyScopeMode('CUSTOM'); setIsCompanySelectorModalOpen(false); }} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer">Aplicar Seleção</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL DE TRANSFERÊNCIA / DEPENDÊNCIA (@) (z-[100])
      ========================================== */}
      {transferModalTask && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-purple-700 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <ArrowRightLeft className="w-4 h-4" />
                <span>Transferir Tarefa / Mencionar Dependência (@Usuario)</span>
              </div>
              <button onClick={() => setTransferModalTask(null)} className="text-white/80 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={confirmTransferTask} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">1. De quem você depende?</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TEAM_MEMBERS.map((m) => {
                    const selected = transferTargetUser === m.id;
                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => handleSelectTransferUser(m.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
                          selected ? 'bg-purple-50 border-purple-600 ring-2 ring-purple-600' : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-full ${m.color} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
                          {m.avatar}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">@{m.name}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  2. Descreva a pendência com menção @{transferTargetUser} *:
                </label>
                <textarea
                  rows={3}
                  value={transferReasonInput}
                  onChange={(e) => setTransferReasonInput(e.target.value)}
                  placeholder="Descreva o motivo..."
                  className="w-full p-2.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setTransferModalTask(null)} className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer">
                  <Send className="w-3.5 h-3.5" />
                  <span>Transferir para @{transferTargetUser}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL DE NOVA TAREFA AVULSA (z-[100])
      ========================================== */}
      {isNewTaskModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Cadastrar Nova Tarefa Avulsa / Obrigação</span>
              </div>
              <button onClick={() => setIsNewTaskModalOpen(false)} className="text-white/80 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleCreateNewTask} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Título da Tarefa ou Conciliação *</label>
                <input
                  type="text"
                  value={newTaskForm.title}
                  onChange={(e) => setNewTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: Conciliação ICMS ST Filial 010105..."
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Categoria</label>
                  <select
                    value={newTaskForm.category}
                    onChange={(e) => setNewTaskForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                  >
                    <option value="AVULSA">⚡ Tarefa Avulsa (Dia a Dia)</option>
                    <option value="FECHAMENTO">📅 Rotina de Fechamento</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Responsável</label>
                  <select
                    value={newTaskForm.assignee}
                    onChange={(e) => setNewTaskForm((prev) => ({ ...prev, assignee: e.target.value }))}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                  >
                    {TEAM_MEMBERS.map((m) => (
                      <option key={m.id} value={m.id}>@{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Padrão Contábil</label>
                  <select
                    value={newTaskForm.accountingType}
                    onChange={(e) => setNewTaskForm((prev) => ({ ...prev, accountingType: e.target.value }))}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                  >
                    <option value="Societário">Societário</option>
                    <option value="IFRS">IFRS</option>
                    <option value="Fiscal">Fiscal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prazo de Entrega</label>
                  <input
                    type="date"
                    value={newTaskForm.dueDate}
                    onChange={(e) => setNewTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Escopo de Empresas</label>
                <select
                  value={newTaskForm.companyScope}
                  onChange={(e) => setNewTaskForm((prev) => ({ ...prev, companyScope: e.target.value }))}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                >
                  <option value="ALL">Todas as 40 Empresas</option>
                  <option value="MATRIZ_010101">Apenas Matriz (010101)</option>
                  <option value="HOLDING_040101">Apenas Holding (040101)</option>
                </select>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newTaskForm.startImmediately}
                    onChange={(e) => setNewTaskForm((prev) => ({ ...prev, startImmediately: e.target.checked }))}
                    className="rounded text-emerald-600"
                  />
                  <span>Iniciar cronômetro imediatamente</span>
                </label>

                <label className="inline-flex items-center gap-2 text-xs font-semibold text-rose-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newTaskForm.isCritical}
                    onChange={(e) => setNewTaskForm((prev) => ({ ...prev, isCritical: e.target.checked }))}
                    className="rounded text-rose-600"
                  />
                  <span>Caminho Crítico</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsNewTaskModalOpen(false)} className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer">Criar Tarefa</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          DRAWER DE DETALHES DA TAREFA
      ========================================== */}
      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          currentUser={currentUser}
          liveSeconds={getLiveTaskSeconds(selectedTask)}
          auditLogs={auditLogs.filter((l) => l.taskCode === selectedTask.code)}
          onClose={() => setSelectedTaskId(null)}
          onStart={(branches: string[]) => handleStartTask(selectedTask, branches)}
          onPause={(branches: string[]) => openPauseModal(selectedTask, branches)}
          onTransfer={(branches: string[]) => openTransferModal(selectedTask, branches)}
          onComplete={(branches: string[]) => handleCompleteTask(selectedTask, branches)}
          onSetBranchStatus={(branches: string[], stVal: string) => handleSetBranchStatusDirect(selectedTask, branches, stVal)}
          onUpdateTask={(updated: any, log: any) => persistTaskAndLog(updated, log)}
        />
      )}
    </div>
  );
}

function TaskDetailDrawer({
  task,
  currentUser,
  liveSeconds,
  auditLogs,
  onClose,
  onStart,
  onPause,
  onTransfer,
  onComplete,
  onSetBranchStatus,
  onUpdateTask
}: {
  task: any;
  currentUser: string;
  liveSeconds: number;
  auditLogs: any[];
  onClose: () => void;
  onStart: (branches: string[]) => void;
  onPause: (branches: string[]) => void;
  onTransfer: (branches: string[]) => void;
  onComplete: (branches: string[]) => void;
  onSetBranchStatus: (branches: string[], stVal: string) => void;
  onUpdateTask: (updated: any, log: any) => void;
}) {
  const [commentInput, setCommentInput] = useState('');
  const [evidenceInput, setEvidenceInput] = useState(task.evidenceUrl || '');
  const [innerTab, setInnerTab] = useState('FILIAIS');
  const [drawerSelectedBranches, setDrawerSelectedBranches] = useState<string[]>([]);

  const st = STATUS_CONFIG[task.status] || STATUS_CONFIG.PENDENTE;
  const checklistItems = task.checklistKey ? CHECKLISTS_P1[task.checklistKey] || [] : [];
  const targetList = drawerSelectedBranches.length > 0 ? drawerSelectedBranches : BRANCH_CODES;

  const toggleChecklistStep = (idx: number) => {
    const currentArr = [...(task.checklistState || [])];
    currentArr[idx] = !currentArr[idx];
    onUpdateTask({ ...task, checklistState: currentArr }, null);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;

    const now = Date.now();
    const newComment = { id: `c-${now}`, author: currentUser, text: commentInput.trim(), createdAt: new Date(now).toISOString() };
    const mentionMatch = commentInput.match(/@(Jhennifer|Leia|Renato|Rogério)/i);
    const mentionedUser = mentionMatch ? mentionMatch[1] : null;

    const updated = { ...task, comments: [...(task.comments || []), newComment] };
    const log = { id: `log-${now}`, timestamp: new Date(now).toISOString(), user: currentUser, targetUser: mentionedUser, taskCode: task.code, taskTitle: task.title, type: 'COMENTARIO', details: `Comentou: "${commentInput.trim()}"`, durationSeconds: null };

    onUpdateTask(updated, log);
    setCommentInput('');
  };

  const handleSaveEvidence = () => {
    onUpdateTask({ ...task, evidenceUrl: evidenceInput.trim() }, null);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex justify-end">
      <div className="bg-white w-full max-w-3xl h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden">
        <div className="bg-slate-900 text-white p-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-mono text-xs font-extrabold">{task.code}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${st.bg} ${st.text}`}>{st.label}</span>
              <span className="text-xs text-slate-400">Responsável: <strong className="text-white">@{task.assignee}</strong></span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white">{task.title}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="bg-slate-100 border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-slate-900 text-white flex items-center gap-2">
              <Timer className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-slate-300">Tempo Gasto:</span>
              <span className="font-mono text-sm font-extrabold text-emerald-400">{formatDuration(liveSeconds)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onStart(targetList)} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer">▶ Iniciar</button>
            <button onClick={() => onPause(targetList)} className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold cursor-pointer">⏸ Pausar</button>
            <button onClick={() => onTransfer(targetList)} className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer">@ Transferir</button>
            <button onClick={() => onComplete(targetList)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer">✓ Concluir</button>
          </div>
        </div>

        <div className="border-b border-slate-200 px-5 flex items-center gap-2 bg-white">
          {['FILIAIS', 'CHECKLIST', 'COMENTARIOS', 'HISTORICO'].map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setInnerTab(tabKey)}
              className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                innerTab === tabKey ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500'
              }`}
            >
              {tabKey}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {innerTab === 'FILIAIS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Clique em uma filial para selecionar ou duplo clique para alternar status (OK / P / N/A)</span>
                {drawerSelectedBranches.length > 0 && (
                  <button
                    onClick={() => setDrawerSelectedBranches([])}
                    className="text-indigo-600 font-bold underline cursor-pointer"
                  >
                    Limpar seleção ({drawerSelectedBranches.length})
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {BRANCH_CODES.map((code) => {
                  const detail = getBranchDetail(task, code);
                  const chipCfg = BRANCH_STATUS_CHIP[detail.status] || BRANCH_STATUS_CHIP.p;
                  const isSel = drawerSelectedBranches.includes(code);
                  return (
                    <div
                      key={code}
                      onClick={() =>
                        setDrawerSelectedBranches((prev) =>
                          prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
                        )
                      }
                      onDoubleClick={() => {
                        const nextSt = detail.status === 'p' ? 'ok' : detail.status === 'ok' ? 'n/a' : 'p';
                        onSetBranchStatus([code], nextSt);
                      }}
                      className={`p-2.5 rounded-xl border flex flex-col justify-between cursor-pointer select-none transition-all ${chipCfg.cls} ${
                        isSel ? 'ring-2 ring-slate-900 scale-105' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-extrabold">{code}</span>
                        <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.2 rounded bg-black/10">{chipCfg.short}</span>
                      </div>
                      <div className="text-[10px] truncate opacity-85 mt-1">{BRANCH_LABELS[code]?.split('•')[1] || 'Filial'}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {innerTab === 'CHECKLIST' && (
            <div className="space-y-5">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-800">Caminho da Pasta / Arquivo de Evidência:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={evidenceInput}
                    onChange={(e) => setEvidenceInput(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                  />
                  <button onClick={handleSaveEvidence} className="px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer">Salvar</button>
                </div>
              </div>
              <div className="space-y-2">
                {checklistItems.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    Nenhum item de checklist específico configurado para esta obrigação.
                  </div>
                ) : (
                  checklistItems.map((itemText, idx) => {
                    const checked = !!(task.checklistState && task.checklistState[idx]);
                    return (
                      <label key={idx} onClick={() => toggleChecklistStep(idx)} className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer ${checked ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-white border-slate-200'}`}>
                        <input type="checkbox" checked={checked} onChange={() => {}} className="w-4 h-4 rounded text-emerald-600" />
                        <span className={`text-xs font-medium ${checked ? 'line-through opacity-75' : ''}`}>{itemText}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {innerTab === 'COMENTARIOS' && (
            <div className="space-y-4">
              <form onSubmit={handleAddComment} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="Escreva uma observação ou mencione @usuario..."
                    className="flex-1 px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg"
                  />
                  <button type="submit" className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer">Enviar</button>
                </div>
              </form>
              <div className="space-y-2.5">
                {(task.comments || []).map((c: any) => (
                  <div key={c.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                      <span>@{c.author}</span>
                      <span className="text-[11px] text-slate-400">{new Date(c.createdAt).toLocaleTimeString('pt-BR')}</span>
                    </div>
                    <p className="text-xs text-slate-700">{renderFormattedText(c.text)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {innerTab === 'HISTORICO' && (
            <div className="space-y-2.5">
              {auditLogs.map((l) => (
                <div key={l.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span>@{l.user} ({l.type})</span>
                    <span className="text-[11px] font-mono text-slate-400">{new Date(l.timestamp).toLocaleTimeString('pt-BR')}</span>
                  </div>
                  <p className="text-slate-600">{renderFormattedText(l.details)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
