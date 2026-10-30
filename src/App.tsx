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
  deleteDoc,
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
  LogOut,
  BookOpen,
  FileText,
  Edit3,
  Trash2,
  Sparkles,
  CopyPlus,
  Calendar,
  RefreshCw,
  AlarmClock,
  BellRing,
  AlertCircle,
  Hourglass,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  Menu,
  MapPin,
  Building,
  CheckCheck,
  Globe,
  Save,
  ListChecks,
  Bookmark
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

const LOCAL_STORAGE_TASKS_KEY = 'agriconnection_tasks_10_2026_v2';
const LOCAL_STORAGE_LOGS_KEY = 'agriconnection_logs_10_2026_v2';
const LOCAL_STORAGE_TEMPLATES_KEY = 'agriconnection_task_templates_v3';
const LOCAL_STORAGE_USERS_KEY = 'agriconnection_users_team_v1';
const LOCAL_STORAGE_COMPANIES_KEY = 'agriconnection_companies_registry_v1';

// ==========================================
// TAXONOMIA OFICIAL: DEPARTAMENTO, GRUPO, SUB-GRUPO, COMPETÊNCIA E RECORRÊNCIA
// ==========================================
const DEPARTMENTS = ['Contábil', 'Fiscal'];

const GROUPS_OPTIONS = [
  'Fechamento de resultado',
  'Conciliações contábeis',
  'Apuração de Impostos e Obrigações',
  'Coneasy',
  'Demonstrativos',
  'Obrigações Acessórias Anuais',
  'Demanda Avulsa / Auditoria',
  'Demanda Avulsa / Dia a Dia'
];

const SUBGROUPS_OPTIONS = [
  'IFRS',
  'Societário',
  'ICMS / IPI',
  'PIS / COFINS',
  'IRPJ / CSLL',
  'Retidos (CSRF / INSS / ISS)',
  'SPED / EFD / ECD / ECF',
  'Patrimonial & Seguros',
  'Auditoria Externa'
];

const RECURRENCE_CONFIG: Record<string, { label: string; badgeCls: string; badge?: string }> = {
  ESPORADICA: {
    label: 'Esporádica',
    badgeCls: 'bg-amber-50 text-amber-800 border-amber-300',
    badge: 'bg-amber-50 text-amber-800 border-amber-300'
  },
  MENSAL: {
    label: 'Mensal',
    badgeCls: 'bg-sky-50 text-sky-800 border-sky-300',
    badge: 'bg-sky-50 text-sky-800 border-sky-300'
  },
  TRIMESTRAL: {
    label: 'Trimestral',
    badgeCls: 'bg-purple-50 text-purple-800 border-purple-300',
    badge: 'bg-purple-50 text-purple-800 border-purple-300'
  },
  ANUAL: {
    label: 'Anual',
    badgeCls: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-300'
  }
};

// ==========================================
// CATEGORIAS DE USUÁRIOS (ADMINISTRADOR, COORDENADOR E ANALISTA)
// ==========================================
const USER_CATEGORIES_CONFIG: Record<
  string,
  {
    key: string;
    label: string;
    shortLabel: string;
    badgeCls: string;
    headerBg: string;
    description: string;
    permissions: string[];
  }
> = {
  ADMINISTRADOR: {
    key: 'ADMINISTRADOR',
    label: 'Administrador',
    shortLabel: 'Admin',
    badgeCls: 'bg-rose-100 text-rose-900 border-rose-300',
    headerBg: 'from-rose-950 to-slate-900',
    description: 'Controle total da plataforma, gestão de acessos e usuários, parametrização de geração automática mensal e auditoria geral.',
    permissions: [
      'Cadastrar, editar, alterar categoria e ativar/inativar usuários',
      'Parametrizar e disparar geração automática de tarefas por mês/período',
      'Gerenciar integralmente o Cadastro Mestre de Tarefas Padrão (criar, editar, excluir)',
      'Acesso completo às 40 filiais, revisão RACI, reabertura e trilha de auditoria'
    ]
  },
  COORDENADOR: {
    key: 'COORDENADOR',
    label: 'Coordenador',
    shortLabel: 'Coord.',
    badgeCls: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    headerBg: 'from-indigo-950 to-slate-900',
    description: 'Coordenação contábil e fiscal, revisão técnica (RACI), acompanhamento de produtividade por filial/analista e catálogo padrão.',
    permissions: [
      'Gerar obrigações recorrentes para o próximo mês e distribuir responsáveis',
      'Cadastrar e atualizar tarefas no Cadastro Padrão de Fechamento',
      'Revisar entregas técnicas (RACI), aprovar fechamentos e reabrir pendências',
      'Monitorar cronômetros em tempo real e KPIs do painel gerencial'
    ]
  },
  ANALISTA: {
    key: 'ANALISTA',
    label: 'Analista',
    shortLabel: 'Analista',
    badgeCls: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    headerBg: 'from-emerald-950 to-slate-900',
    description: 'Execução operacional das tarefas contábeis e fiscais nas 40 filiais, controle de cronômetro, checklists e evidências.',
    permissions: [
      'Iniciar, pausar e concluir cronômetros por filial individual ou consolidado',
      'Transferir pendências com menção (@) e registrar justificativas técnicas',
      'Executar etapas do checklist e salvar caminhos de pastas/evidências',
      'Lançar tarefas avulsas do dia a dia e consultar o catálogo padrão'
    ]
  }
};

const AVATAR_COLOR_PRESETS = [
  { key: 'indigo', label: 'Índigo', color: 'bg-indigo-600', lightBg: 'bg-indigo-50', textColor: 'text-indigo-700', borderColor: 'border-indigo-200' },
  { key: 'emerald', label: 'Esmeralda', color: 'bg-emerald-600', lightBg: 'bg-emerald-50', textColor: 'text-emerald-700', borderColor: 'border-emerald-200' },
  { key: 'amber', label: 'Âmbar', color: 'bg-amber-600', lightBg: 'bg-amber-50', textColor: 'text-amber-700', borderColor: 'border-amber-200' },
  { key: 'sky', label: 'Azul', color: 'bg-sky-600', lightBg: 'bg-sky-50', textColor: 'text-sky-700', borderColor: 'border-sky-200' },
  { key: 'purple', label: 'Roxo', color: 'bg-purple-600', lightBg: 'bg-purple-50', textColor: 'text-purple-700', borderColor: 'border-purple-200' },
  { key: 'rose', label: 'Rubi', color: 'bg-rose-600', lightBg: 'bg-rose-50', textColor: 'text-rose-700', borderColor: 'border-rose-200' },
  { key: 'teal', label: 'Turquesa', color: 'bg-teal-600', lightBg: 'bg-teal-50', textColor: 'text-teal-700', borderColor: 'border-teal-200' }
];

const INITIAL_TEAM_MEMBERS = [
  {
    id: 'Rogério',
    name: 'Rogério',
    email: 'rogerio@agriconnection.com.br',
    category: 'ADMINISTRADOR',
    role: 'Administrador & Coordenador Contábil (RACI)',
    department: 'Ambos',
    status: 'ATIVO',
    avatar: 'RO',
    color: 'bg-sky-600',
    lightBg: 'bg-sky-50',
    textColor: 'text-sky-700',
    borderColor: 'border-sky-200'
  },
  {
    id: 'Leia',
    name: 'Leia',
    email: 'leia@agriconnection.com.br',
    category: 'COORDENADOR',
    role: 'Coordenadora Fiscal & Tributária',
    department: 'Fiscal',
    status: 'ATIVO',
    avatar: 'LE',
    color: 'bg-emerald-600',
    lightBg: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200'
  },
  {
    id: 'Jhennifer',
    name: 'Jhennifer',
    email: 'jhennifer@agriconnection.com.br',
    category: 'ANALISTA',
    role: 'Analista Contábil Sênior',
    department: 'Contábil',
    status: 'ATIVO',
    avatar: 'JH',
    color: 'bg-indigo-600',
    lightBg: 'bg-indigo-50',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-200'
  },
  {
    id: 'Renato',
    name: 'Renato',
    email: 'renato@agriconnection.com.br',
    category: 'ANALISTA',
    role: 'Analista Patrimonial & Conciliações',
    department: 'Contábil',
    status: 'ATIVO',
    avatar: 'RE',
    color: 'bg-amber-600',
    lightBg: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200'
  }
];

const normalizeUserRecord = (u: any) => {
  const name = String(u?.name || u?.id || 'Usuário').trim();
  const id = String(u?.id || name.replace(/\s+/g, '_')).trim();
  const rawCat = String(u?.category || '').toUpperCase();
  const category = ['ADMINISTRADOR', 'COORDENADOR', 'ANALISTA'].includes(rawCat)
    ? rawCat
    : id === 'Rogério'
    ? 'ADMINISTRADOR'
    : id === 'Leia'
    ? 'COORDENADOR'
    : 'ANALISTA';
  const department = u?.department || (id === 'Leia' ? 'Fiscal' : id === 'Rogério' ? 'Ambos' : 'Contábil');
  const status = u?.status === 'INATIVO' ? 'INATIVO' : 'ATIVO';
  const avatar =
    String(u?.avatar || '')
      .trim()
      .toUpperCase()
      .slice(0, 2) ||
    name
      .split(' ')
      .map((p: string) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) ||
    'US';
  const preset =
    AVATAR_COLOR_PRESETS.find((p) => p.color === u?.color) ||
    AVATAR_COLOR_PRESETS[0];

  return {
    ...u,
    id,
    name,
    email: u?.email || `${id.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}@agriconnection.com.br`,
    category,
    role: u?.role || USER_CATEGORIES_CONFIG[category]?.label || 'Analista Contábil',
    department,
    status,
    avatar,
    color: u?.color || preset.color,
    lightBg: u?.lightBg || preset.lightBg,
    textColor: u?.textColor || preset.textColor,
    borderColor: u?.borderColor || preset.borderColor
  };
};

// Lista oficial das 40 Empresas/Filiais conforme planilha FECHAMENTO 10 2026
const BRANCH_CODES = [
  '010101', '010102', '010103', '010104', '010105', '010106', '010107', '010108', '010109', '010110',
  '010111', '010112', '010113', '010114', '010115', '010116', '010117', '010118', '010119', '010120',
  '010121', '010122', '010123', '010124', '010125', '010180', '020101', '030101', '040101', '050101',
  '070101', '080101', '090101', '100101', '110101', '120101', '130101', '140101', '150101', '160101'
];

export interface CompanyRecord {
  code: string;
  name: string;
  tradingName: string;
  cnpj: string;
  city: string;
  uf: string;
  taxRegime: 'Lucro Real' | 'Lucro Presumido' | 'Simples Nacional';
  manager: string;
  branchType: string;
  status: 'ATIVA' | 'INATIVA';
  phone?: string;
  email?: string;
  notes?: string;
}

const INITIAL_COMPANIES_SEED: CompanyRecord[] = [
  { code: '010101', name: 'Agriconnection Insumos Agrícolas S/A (Matriz)', tradingName: 'Matriz Insumos Cuiabá', cnpj: '14.821.902/0001-34', city: 'Cuiabá', uf: 'MT', taxRegime: 'Lucro Real', manager: 'Rogério', branchType: 'Matriz', status: 'ATIVA', phone: '(65) 3644-8000', email: 'contabil.matriz@agriconnection.com.br', notes: 'Sede administrativa corporativa e matriz de insumos agrícolas.' },
  { code: '010102', name: 'Agriconnection Insumos - Filial Rondonópolis', tradingName: 'Filial Rondonópolis', cnpj: '14.821.902/0002-15', city: 'Rondonópolis', uf: 'MT', taxRegime: 'Lucro Real', manager: 'Renato', branchType: 'Filial Insumos', status: 'ATIVA', phone: '(66) 3411-9200', email: 'filial.roo@agriconnection.com.br', notes: 'Polo logístico e comercial do Sul de MT.' },
  { code: '010103', name: 'Agriconnection Insumos - Filial Primavera do Leste', tradingName: 'Filial Primavera', cnpj: '14.821.902/0003-04', city: 'Primavera do Leste', uf: 'MT', taxRegime: 'Lucro Real', manager: 'Renato', branchType: 'Filial Insumos', status: 'ATIVA', phone: '(66) 3498-7100', email: 'filial.pva@agriconnection.com.br', notes: 'Atendimento direto aos produtores de algodão e soja.' },
  { code: '010104', name: 'Agriconnection Insumos - Filial Campo Verde', tradingName: 'Filial Campo Verde', cnpj: '14.821.902/0004-87', city: 'Campo Verde', uf: 'MT', taxRegime: 'Lucro Real', manager: 'Renato', branchType: 'Filial Insumos', status: 'ATIVA', phone: '(66) 3419-1500', email: 'filial.cpv@agriconnection.com.br', notes: 'Unidade de distribuição de defensivos e fertilizantes.' },
  { code: '010105', name: 'Agriconnection Insumos - Filial Sorriso Central', tradingName: 'Filial Sorriso', cnpj: '14.821.902/0005-68', city: 'Sorriso', uf: 'MT', taxRegime: 'Lucro Real', manager: 'Jhennifer', branchType: 'Filial Insumos', status: 'ATIVA', phone: '(66) 3545-8800', email: 'filial.sorriso@agriconnection.com.br', notes: 'Maior volume de insumos do Médio-Norte de MT.' },
  { code: '010106', name: 'Agriconnection Insumos - Filial Lucas do Rio Verde', tradingName: 'Filial Lucas', cnpj: '14.821.902/0006-49', city: 'Lucas do Rio Verde', uf: 'MT', taxRegime: 'Lucro Real', manager: 'Jhennifer', branchType: 'Filial Insumos', status: 'ATIVA', phone: '(65) 3549-3300', email: 'filial.lrv@agriconnection.com.br', notes: 'Distribuição integrada à BR-163.' },
  { code: '010107', name: 'Agriconnection Insumos - Filial Nova Mutum', tradingName: 'Filial Nova Mutum', cnpj: '14.821.902/0007-20', city: 'Nova Mutum', uf: 'MT', taxRegime: 'Lucro Real', manager: 'Jhennifer', branchType: 'Filial Insumos', status: 'ATIVA', phone: '(65) 3308-4100', email: 'filial.mutum@agriconnection.com.br', notes: 'Atendimento a cooperativas e grandes grupos agrícolas.' },
  { code: '010108', name: 'Agriconnection Insumos - Filial Sinop', tradingName: 'Filial Sinop', cnpj: '14.821.902/0008-00', city: 'Sinop', uf: 'MT', taxRegime: 'Lucro Real', manager: 'Jhennifer', branchType: 'Filial Insumos', status: 'ATIVA', phone: '(66) 3511-9000', email: 'filial.sinop@agriconnection.com.br', notes: 'Hub regional de suprimentos agropecuários.' },
  { code: '010109', name: 'Agriconnection Insumos - Filial Sapezal', tradingName: 'Filial Sapezal', cnpj: '14.821.902/0009-91', city: 'Sapezal', uf: 'MT', taxRegime: 'Lucro Real', manager: 'Renato', branchType: 'Filial Insumos', status: 'ATIVA', phone: '(65) 3383-2200', email: 'filial.sapezal@agriconnection.com.br', notes: 'Região da Chapada dos Parecis e grandes produtores.' },
  { code: '010110', name: 'Agriconnection Insumos - Filial Campo Novo do Parecis', tradingName: 'Filial Campo Novo', cnpj: '14.821.902/0010-25', city: 'Campo Novo do Parecis', uf: 'MT', taxRegime: 'Lucro Real', manager: 'Renato', branchType: 'Filial Insumos', status: 'ATIVA', phone: '(65) 3382-1900', email: 'filial.cnp@agriconnection.com.br', notes: 'Comercialização de sementes certificadas e químicos.' },
  { code: '010111', name: 'Agriconnection Insumos - Filial Tangará da Serra', tradingName: 'Filial Tangará', cnpj: '14.821.902/0011-06', city: 'Tangará da Serra', uf: 'MT', taxRegime: 'Lucro Real', manager: 'Renato', branchType: 'Filial Insumos', status: 'ATIVA', phone: '(65) 3326-8000', email: 'filial.tangara@agriconnection.com.br', notes: 'Vendas consultivas e suporte técnico agrônomo.' },
  { code: '010112', name: 'Agriconnection Insumos - Filial Querência', tradingName: 'Filial Querência', cnpj: '14.821.902/0012-97', city: 'Querência', uf: 'MT', taxRegime: 'Lucro Real', manager: 'Leia', branchType: 'Filial Insumos', status: 'ATIVA', phone: '(66) 3529-1400', email: 'filial.querencia@agriconnection.com.br', notes: 'Fronteira agrícola do Vale do Araguaia.' },
  { code: '010113', name: 'Agriconnection Insumos - Filial Canarana', tradingName: 'Filial Canarana', cnpj: '14.821.902/0013-78', city: 'Canarana', uf: 'MT', taxRegime: 'Lucro Real', manager: 'Leia', branchType: 'Filial Insumos', status: 'ATIVA', phone: '(66) 3537-2500', email: 'filial.canarana@agriconnection.com.br', notes: 'Suporte a lavouras de gergelim, milho e soja.' },
  { code: '010114', name: 'Agriconnection Insumos - Filial Água Boa', tradingName: 'Filial Água Boa', cnpj: '14.821.902/0014-59', city: 'Água Boa', uf: 'MT', taxRegime: 'Lucro Real', manager: 'Leia', branchType: 'Filial Insumos', status: 'ATIVA', phone: '(66) 3468-1200', email: 'filial.aguaboa@agriconnection.com.br', notes: 'Unidade estratégica na rota da ferrovia FICO.' },
  { code: '010115', name: 'Agriconnection Insumos - Filial Barra do Garças', tradingName: 'Filial Barra do Garças', cnpj: '14.821.902/0015-30', city: 'Barra do Garças', uf: 'MT', taxRegime: 'Lucro Real', manager: 'Leia', branchType: 'Filial Insumos', status: 'ATIVA', phone: '(66) 3401-4400', email: 'filial.barradogarcas@agriconnection.com.br', notes: 'Conexão interestadual entre MT e Goiás.' },
  { code: '010116', name: 'Agriconnection Insumos - Filial Confresa', tradingName: 'Filial Confresa', cnpj: '14.821.902/0016-10', city: 'Confresa', uf: 'MT', taxRegime: 'Lucro Real', manager: 'Leia', branchType: 'Filial Insumos', status: 'ATIVA', phone: '(66) 3564-1800', email: 'filial.confresa@agriconnection.com.br', notes: 'Norte Araguaia em forte expansão agrícola.' },
  { code: '010117', name: 'Agriconnection Insumos - Filial Rio Verde', tradingName: 'Filial Rio Verde', cnpj: '14.821.902/0017-00', city: 'Rio Verde', uf: 'GO', taxRegime: 'Lucro Real', manager: 'Jhennifer', branchType: 'Filial Insumos', status: 'ATIVA', phone: '(64) 3620-7700', email: 'filial.rioverde@agriconnection.com.br', notes: 'Sudoeste Goiano de alta produtividade de grãos.' },
  { code: '010118', name: 'Agriconnection Insumos - Filial Jataí', tradingName: 'Filial Jataí', cnpj: '14.821.902/0018-82', city: 'Jataí', uf: 'GO', taxRegime: 'Lucro Real', manager: 'Jhennifer', branchType: 'Filial Insumos', status: 'ATIVA', phone: '(64) 3636-5100', email: 'filial.jatai@agriconnection.com.br', notes: 'Depósito regulador de fertilizantes e micronutrientes.' },
  { code: '010119', name: 'Agriconnection Insumos - Filial Cristalina', tradingName: 'Filial Cristalina', cnpj: '14.821.902/0019-63', city: 'Cristalina', uf: 'GO', taxRegime: 'Lucro Real', manager: 'Jhennifer', branchType: 'Filial Insumos', status: 'ATIVA', phone: '(61) 3612-4000', email: 'filial.cristalina@agriconnection.com.br', notes: 'Maior área de pivôs centrais irrigados da América Latina.' },
  { code: '010120', name: 'Agriconnection Insumos - Filial Dourados', tradingName: 'Filial Dourados', cnpj: '14.821.902/0020-05', city: 'Dourados', uf: 'MS', taxRegime: 'Lucro Real', manager: 'Renato', branchType: 'Filial Insumos', status: 'ATIVA', phone: '(67) 3416-8900', email: 'filial.dourados@agriconnection.com.br', notes: 'Atendimento integrado à região sul de Mato Grosso do Sul.' },
  { code: '010121', name: 'Agriconnection Insumos - Filial Maracaju', tradingName: 'Filial Maracaju', cnpj: '14.821.902/0021-88', city: 'Maracaju', uf: 'MS', taxRegime: 'Lucro Real', manager: 'Renato', branchType: 'Filial Insumos', status: 'ATIVA', phone: '(67) 3454-1300', email: 'filial.maracaju@agriconnection.com.br', notes: 'Capital da agricultura sul-mato-grossense.' },
  { code: '010122', name: 'Agriconnection Insumos - Filial Chapadão do Sul', tradingName: 'Filial Chapadão', cnpj: '14.821.902/0022-69', city: 'Chapadão do Sul', uf: 'MS', taxRegime: 'Lucro Real', manager: 'Renato', branchType: 'Filial Insumos', status: 'ATIVA', phone: '(67) 3562-4400', email: 'filial.chapadao@agriconnection.com.br', notes: 'Integração de fronteira com GO e MT.' },
  { code: '010123', name: 'Agriconnection Insumos - Filial Luís Eduardo Magalhães', tradingName: 'Filial LEM', cnpj: '14.821.902/0023-40', city: 'Luís Eduardo Magalhães', uf: 'BA', taxRegime: 'Lucro Real', manager: 'Leia', branchType: 'Filial Insumos', status: 'ATIVA', phone: '(77) 3628-9500', email: 'filial.lem@agriconnection.com.br', notes: 'Coração do Matopiba e agronegócio do Oeste Baiano.' },
  { code: '010124', name: 'Agriconnection Insumos - Filial Balsas', tradingName: 'Filial Balsas', cnpj: '14.821.902/0024-20', city: 'Balsas', uf: 'MA', taxRegime: 'Lucro Real', manager: 'Leia', branchType: 'Filial Insumos', status: 'ATIVA', phone: '(99) 3541-2800', email: 'filial.balsas@agriconnection.com.br', notes: 'Atendimento aos platôs do sul do Maranhão.' },
  { code: '010125', name: 'Agriconnection Insumos - Filial Porto Nacional', tradingName: 'Filial Porto Nacional', cnpj: '14.821.902/0025-01', city: 'Porto Nacional', uf: 'TO', taxRegime: 'Lucro Real', manager: 'Leia', branchType: 'Filial Insumos', status: 'ATIVA', phone: '(63) 3363-8200', email: 'filial.portonacional@agriconnection.com.br', notes: 'Operação ferroviária na Ferrovia Norte-Sul.' },
  { code: '010180', name: 'Agriconnection Centro de Distribuição Central', tradingName: 'CD Logístico Cuiabá', cnpj: '14.821.902/0080-38', city: 'Cuiabá', uf: 'MT', taxRegime: 'Lucro Real', manager: 'Rogério', branchType: 'Centro Distribuição', status: 'ATIVA', phone: '(65) 3644-8800', email: 'cd.central@agriconnection.com.br', notes: 'Centro de armazenagem climatizada para químicos e sementes.' },
  { code: '020101', name: 'Agriconnection Sementes do Cerrado S/A', tradingName: 'Sementes Matriz', cnpj: '22.418.730/0001-44', city: 'Rondonópolis', uf: 'MT', taxRegime: 'Lucro Real', manager: 'Rogério', branchType: 'Sementes Matriz', status: 'ATIVA', phone: '(66) 3411-5000', email: 'sementes.cerrado@agriconnection.com.br', notes: 'Multiplicação e comercialização de cultivares geneticamente modificadas.' },
  { code: '030101', name: 'Agriconnection Grãos, Originação & Barter Ltda', tradingName: 'Grãos & Barter', cnpj: '28.940.112/0001-88', city: 'Sorriso', uf: 'MT', taxRegime: 'Lucro Real', manager: 'Leia', branchType: 'Grãos & Barter', status: 'ATIVA', phone: '(66) 3545-3100', email: 'barter.graos@agriconnection.com.br', notes: 'Operações estruturadas de troca (Barter) soja e milho.' },
  { code: '040101', name: 'Agri Participações Societárias S/A (Holding)', tradingName: 'Holding Corporativa', cnpj: '30.125.774/0001-09', city: 'São Paulo', uf: 'SP', taxRegime: 'Lucro Real', manager: 'Rogério', branchType: 'Holding', status: 'ATIVA', phone: '(11) 3045-9000', email: 'holding@agriconnection.com.br', notes: 'Gestão patrimonial, governança, consolidação societária e M&A.' },
  { code: '050101', name: 'Agropecuária Vale do Araguaia S/A', tradingName: 'Agropecuária MT', cnpj: '33.450.912/0001-52', city: 'Barra do Garças', uf: 'MT', taxRegime: 'Lucro Real', manager: 'Renato', branchType: 'Agropecuária MT', status: 'ATIVA', phone: '(66) 3401-8800', email: 'agropecuaria.araguaia@agriconnection.com.br', notes: 'Pecuária intensiva e integração lavoura-pecuária (ILP).' },
  { code: '070101', name: 'AgriLog Transportes & Logística Integrada Ltda', tradingName: 'Logística & Frota', cnpj: '35.812.340/0001-71', city: 'Rondonópolis', uf: 'MT', taxRegime: 'Lucro Presumido', manager: 'Leia', branchType: 'Logística & Frota', status: 'ATIVA', phone: '(66) 3411-9900', email: 'agrilog@agriconnection.com.br', notes: 'Frota própria de caminhões e transbordo ferroviário Rumo.' },
  { code: '080101', name: 'Armazéns Gerais Cerrado Sul Ltda', tradingName: 'Armazéns Gerais', cnpj: '37.104.992/0001-19', city: 'Rio Verde', uf: 'GO', taxRegime: 'Lucro Presumido', manager: 'Jhennifer', branchType: 'Armazéns Gerais', status: 'ATIVA', phone: '(64) 3620-3300', email: 'armazens.cerrado@agriconnection.com.br', notes: 'Silos de estocagem de grãos e emissão de CDA/WA.' },
  { code: '090101', name: 'AeroAgri Aviação Agrícola & Pulverização Ltda', tradingName: 'Aviação Agrícola', cnpj: '41.205.670/0001-93', city: 'Primavera do Leste', uf: 'MT', taxRegime: 'Lucro Presumido', manager: 'Renato', branchType: 'Aviação Agrícola', status: 'ATIVA', phone: '(66) 3498-5000', email: 'aeroagri@agriconnection.com.br', notes: 'Aeroaplicação de defensivos, adubação aérea e combate a incêndios.' },
  { code: '100101', name: 'Terra Forte Imobiliária e Gestão de Terras Ltda', tradingName: 'Imobiliária Rural', cnpj: '44.890.123/0001-65', city: 'Cuiabá', uf: 'MT', taxRegime: 'Lucro Presumido', manager: 'Rogério', branchType: 'Imobiliária Rural', status: 'ATIVA', phone: '(65) 3644-2000', email: 'terraforte@agriconnection.com.br', notes: 'Gestão de fazendas arrendadas e contratos imobiliários agrários.' },
  { code: '110101', name: 'Usina de Beneficiamento de Sementes UBS Ltda', tradingName: 'Beneficiamento Sementes', cnpj: '46.120.304/0001-20', city: 'Lucas do Rio Verde', uf: 'MT', taxRegime: 'Lucro Real', manager: 'Jhennifer', branchType: 'Beneficiamento Sementes', status: 'ATIVA', phone: '(65) 3549-7000', email: 'ubs.lucas@agriconnection.com.br', notes: 'Tratamento industrial de sementes (TSI) e classificação.' },
  { code: '120101', name: 'AgriTrading Internacional & Exportadora S/A', tradingName: 'Trading Exportação', cnpj: '49.340.550/0001-14', city: 'Santos', uf: 'SP', taxRegime: 'Lucro Real', manager: 'Rogério', branchType: 'Trading Exportação', status: 'ATIVA', phone: '(13) 3219-6000', email: 'trading@agriconnection.com.br', notes: 'Mesa de operações internacionais, hedge na CBOT e despacho portuário.' },
  { code: '130101', name: 'AgriSeg Corretora de Seguros Rurais e Patrimoniais', tradingName: 'Corretora Seguros', cnpj: '52.890.412/0001-02', city: 'Cuiabá', uf: 'MT', taxRegime: 'Lucro Presumido', manager: 'Renato', branchType: 'Corretora Seguros', status: 'ATIVA', phone: '(65) 3644-9100', email: 'agriseg@agriconnection.com.br', notes: 'Seguro agrícola multirrisco, máquinas, frotas e silos.' },
  { code: '140101', name: 'SunAgro Energia Solar Fotovoltaica Ltda', tradingName: 'Energia Solar Agro', cnpj: '55.678.901/0001-45', city: 'Nova Mutum', uf: 'MT', taxRegime: 'Lucro Presumido', manager: 'Jhennifer', branchType: 'Energia Solar Agro', status: 'ATIVA', phone: '(65) 3308-9000', email: 'sunagro@agriconnection.com.br', notes: 'Usinas solares de geração distribuída para filiais e armazéns.' },
  { code: '150101', name: 'Biogen Pesquisa, Genética & Biotecnologia Agro', tradingName: 'Pesquisa & Genética', cnpj: '58.123.456/0001-77', city: 'Cascavel', uf: 'PR', taxRegime: 'Lucro Real', manager: 'Leia', branchType: 'Pesquisa & Genética', status: 'ATIVA', phone: '(45) 3220-4500', email: 'biogen@agriconnection.com.br', notes: 'Centro de P&D em biológicos, inoculantes e bioinsumos.' },
  { code: '160101', name: 'AgriCSC Centro de Serviços Compartilhados Ltda', tradingName: 'Serviços Compartilhados CSC', cnpj: '61.987.654/0001-89', city: 'Cuiabá', uf: 'MT', taxRegime: 'Lucro Real', manager: 'Rogério', branchType: 'Serviços Compartilhados CSC', status: 'ATIVA', phone: '(65) 3644-9900', email: 'csc@agriconnection.com.br', notes: 'CSC central de contabilidade, fiscal, DP, TI e tesouraria.' }
];

const normalizeCompanyRecord = (c: any): CompanyRecord => {
  const code = String(c?.code || '').trim();
  const name = String(c?.name || `Filial ${code}`).trim();
  const tradingName = String(c?.tradingName || name).trim();
  const cnpj = String(c?.cnpj || '14.821.902/0001-00').trim();
  const city = String(c?.city || 'Cuiabá').trim();
  const uf = String(c?.uf || 'MT').trim().toUpperCase().slice(0, 2);
  const taxRegime = ['Lucro Real', 'Lucro Presumido', 'Simples Nacional'].includes(c?.taxRegime)
    ? c.taxRegime
    : 'Lucro Real';
  const manager = String(c?.manager || 'Rogério').trim();
  const branchType = String(c?.branchType || 'Filial Insumos').trim();
  const status = c?.status === 'INATIVA' ? 'INATIVA' : 'ATIVA';
  return {
    code,
    name,
    tradingName,
    cnpj,
    city,
    uf,
    taxRegime,
    manager,
    branchType,
    status,
    phone: c?.phone || '',
    email: c?.email || '',
    notes: c?.notes || ''
  };
};

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

const getBranchDisplayName = (code: string) => {
  const found = INITIAL_COMPANIES_SEED.find((c) => c.code === code);
  if (found) return `${found.code} • ${found.tradingName}`;
  return BRANCH_LABELS[code] || `${code} • Filial Operacional`;
};

// ==========================================
// MODELOS DE CHECKLIST CUSTOMIZADOS & REUTILIZÁVEIS
// ==========================================
export const LOCAL_STORAGE_CHECKLIST_TEMPLATES_KEY = 'agriconnection_checklist_templates_v1';

export interface ChecklistTemplate {
  id: string;
  name: string;
  department: 'Contábil' | 'Fiscal' | 'Geral';
  description?: string;
  items: string[];
  createdBy: string;
  createdAt: string;
  isBuiltin?: boolean;
}

export const INITIAL_CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  {
    id: 'CONTAS_PAGAR_RECEBER',
    name: 'Conciliação CAP / CAR (FINR150 / FINR130)',
    department: 'Contábil',
    description: 'Batimento de fornecedores, clientes, adiantamentos e relatórios financeiros contra o razão contábil das 40 filiais.',
    items: [
      'Emitir Posição de Títulos em Aberto (FINR150 / FINR130) no TOTVS',
      'Conferir adiantamentos a fornecedores e adiantamentos de clientes',
      'Analisar saldos virados ou títulos antigos sem baixa bancária',
      'Conciliar saldo contábil (Grupo 1102 e 2101) com relatório financeiro'
    ],
    createdBy: 'Rogério',
    createdAt: '2026-10-01T08:00:00Z',
    isBuiltin: true
  },
  {
    id: 'AVP',
    name: 'Cálculo e Contabilização de AVP (IFRS)',
    department: 'Contábil',
    description: 'Ajuste a Valor Presente sobre vendas a prazo, compras de insumos e contas patrimoniais com segregação de curto e longo prazo.',
    items: [
      'Extrair base de Faturamento a prazo e Compras a prazo do mês 10/2026',
      'Extrair posição aberta de Contas a Receber (CAR) e Contas a Pagar (CAP)',
      'Validar saldo de Estoques para expurgo de AVP',
      'Aplicar taxa de desconto definida pela tesouraria e gerar lote no TOTVS',
      'Conferir reversão do AVP do mês anterior contra constituição atual'
    ],
    createdBy: 'Rogério',
    createdAt: '2026-10-01T08:00:00Z',
    isBuiltin: true
  },
  {
    id: 'VARIACAO_CAMBIAL',
    name: 'Fechamento de Variação Cambial (PTAX BACEN)',
    department: 'Contábil',
    description: 'Fechamento cambial de operações em moeda estrangeira, barter e contratos de fornecedores internacionais.',
    items: [
      'Retirar relatórios de Contas a Pagar e Contas a Receber ME (Moeda Estrangeira) no TOTVS',
      'Buscar cotação oficial da taxa PTAX de fechamento no site do BACEN',
      'Executar planilha de memória de cálculo de ajuste de variação cambial ativa/passiva',
      'Contabilizar lotes de ajuste e conferir razão contábil por filial'
    ],
    createdBy: 'Rogério',
    createdAt: '2026-10-01T08:00:00Z',
    isBuiltin: true
  },
  {
    id: 'CONCILIACAO_RECEITA',
    name: 'Batimento Receita Views Fiscais x Razão Contábil',
    department: 'Fiscal',
    description: 'Batimento de receita bruta faturada, devoluções, transferências e cut-off contábil no encerramento mensal.',
    items: [
      'Executar consulta das Views Fiscais x Razão Contábil no banco de dados',
      'Validar CFOPs de faturamento, remessa para entrega futura e devoluções',
      'Cruzar notas emitidas no último dia do mês com corte de receita (Cut-off)',
      'Validar deduções de vendas (ICMS, PIS, COFINS) por filial'
    ],
    createdBy: 'Leia',
    createdAt: '2026-10-01T08:00:00Z',
    isBuiltin: true
  },
  {
    id: 'DESPESAS_FISCAIS',
    name: 'Validação de Despesas Fiscais, Multas e Taxas',
    department: 'Fiscal',
    description: 'Conferência de despesas tributárias, taxas municipais/estaduais e multas fiscais nas filiais do agronegócio.',
    items: [
      'Conferir lançamentos de multas e juros fiscais no centro de custo corporativo',
      'Validar recolhimento de taxas estaduais e municipais nas 40 filiais',
      'Cruzar guias pagas no banco x provisão contábil no TOTVS'
    ],
    createdBy: 'Leia',
    createdAt: '2026-10-01T08:00:00Z',
    isBuiltin: true
  },
  {
    id: 'SEGUROS_AMORTIZACAO',
    name: 'Amortização de Prêmios de Seguros (Frota e Imóveis)',
    department: 'Contábil',
    description: 'Apropriação pro-rata die mensal de apólices ativas de seguro de frotas e silos e conciliação do Ativo Circulante.',
    items: [
      'Atualizar planilha de controle de apólices vigentes por filial',
      'Gerar lote de apropriação mensal de prêmios de seguros no TOTVS',
      'Conciliar saldo das contas de Despesas Antecipadas (Ativo Circulante)'
    ],
    createdBy: 'Rogério',
    createdAt: '2026-10-05T09:00:00Z',
    isBuiltin: false
  },
  {
    id: 'IMOBILIZADO_DEPREC',
    name: 'Ativo Imobilizado, Depreciação e Baixas Físicas',
    department: 'Contábil',
    description: 'Depreciação mensal de máquinas agrícolas, caminhões, silos e conciliação com o módulo de Ativo Fixo.',
    items: [
      'Extrair mapa de depreciação mensal do módulo Ativo Fixo (ATFA012)',
      'Validar aquisições, baixas e transferências entre filiais no período',
      'Conferir cálculo de depreciação e contabilização contra despesas operacionais',
      'Conciliar saldo do Ativo Imobilizado e Depreciação Acumulada no Razão'
    ],
    createdBy: 'Rogério',
    createdAt: '2026-10-05T09:00:00Z',
    isBuiltin: false
  },
  {
    id: 'FOLHA_PAGTO',
    name: 'Provisão de Folha, Encargos (INSS/FGTS) e Férias/13º',
    department: 'Contábil',
    description: 'Integração contábil do fechamento de pessoal, conferência de encargos sociais e provisões trabalhistas.',
    items: [
      'Importar arquivo de integração da Folha de Pagamento gerado pelo RH',
      'Conferir batimento de Salários a Pagar x Conta Transitória Bancária',
      'Conciliar guias pagas de FGTS e DCTFWeb (INSS) com passivo circulante',
      'Validar provisão mensal de férias e 13º salário proporcional'
    ],
    createdBy: 'Rogério',
    createdAt: '2026-10-05T09:00:00Z',
    isBuiltin: false
  },
  {
    id: 'ESTOQUES_INVENTARIO',
    name: 'Conciliação de Estoques, Custos e Inventário Físico',
    department: 'Fiscal',
    description: 'Apuração de saldo de insumos, sementes e defensivos nos armazéns e conferência de CMV.',
    items: [
      'Extrair relatório de Kardex e Posição Físico-Financeira de Estoques (MATR260)',
      'Cruzar saldo do relatório de estoque com conta 1.1.03 (Estoques de Insumos)',
      'Ajustar perdas, quebras operacionais e sobras devidamente autorizadas',
      'Conferir custo das mercadorias vendidas (CMV) apurado no fechamento'
    ],
    createdBy: 'Leia',
    createdAt: '2026-10-05T09:00:00Z',
    isBuiltin: false
  },
  {
    id: 'TRIBUTOS_RETIDOS',
    name: 'Apuração de Impostos Retidos na Fonte (IRRF, CSRF, ISSQN)',
    department: 'Fiscal',
    description: 'Conferência de retenções sobre notas fiscais de tomadores e prestadores de serviços das 40 filiais.',
    items: [
      'Emitir relatório de notas fiscais de serviços tomados com retenção de impostos',
      'Validar códigos de receita (IRRF 1708/5952, CSRF 5952, ISSQN municipal)',
      'Cruzar contas de Impostos Retidos a Recolher no Passivo x DCTFWeb/Reinf',
      'Liberar guias para pagamento pela tesouraria'
    ],
    createdBy: 'Leia',
    createdAt: '2026-10-05T09:00:00Z',
    isBuiltin: false
  }
];

// Compatibilidade retroativa para mapas estáticos existentes
const CHECKLISTS_P1: Record<string, string[]> = INITIAL_CHECKLIST_TEMPLATES.reduce(
  (acc, item) => ({ ...acc, [item.id]: item.items }),
  {}
);

const CHECKLIST_LABELS: Record<string, string> = INITIAL_CHECKLIST_TEMPLATES.reduce(
  (acc, item) => ({ ...acc, [item.id]: item.name }),
  {}
);

// ==========================================
// CADASTRO PADRÃO DE TAREFAS RECORRENTES DE FECHAMENTO (CATÁLOGO MESTRE)
// ==========================================
const INITIAL_TEMPLATES_SEED: any[] = [
  {
    id: 'TPL-01',
    standardCode: 'CTB-01',
    department: 'Contábil',
    group: 'Fechamento de resultado',
    subGroup: 'IFRS',
    title: 'Amortização - SEGUROS (Imóveis e Veículos)',
    topic: 'Fechamento de resultado',
    accountingType: 'IFRS',
    defaultCompetenceType: 'MENSAL',
    defaultCompetence: '10/2026',
    defaultDueDate: '2026-10-30',
    recurrence: 'MENSAL',
    defaultAssignee: 'Renato',
    defaultReviewer: 'Rogério',
    defaultCompanyScope: 'ALL',
    customBranches: [],
    isCritical: false,
    checklistKey: '',
    customChecklistItems: [
      'Atualizar planilha de controle de apólices vigentes por filial',
      'Gerar lote de apropriação mensal de prêmios de seguros no TOTVS',
      'Conciliar saldo das contas de Despesas Antecipadas (Ativo Circulante)'
    ],
    defaultEvidencePath: 'G:\\Contabilidade\\2026\\10_Outubro\\01_Seguros_Amortizacao.xlsx',
    standardNotes: 'Apropriação mensal obrigatória conforme vigência das apólices de frota e imóveis.'
  },
  {
    id: 'TPL-02',
    standardCode: 'CTB-02',
    department: 'Contábil',
    group: 'Fechamento de resultado',
    subGroup: 'Societário',
    title: 'Análise de contas a pagar (Fornecedores & Adiantamentos)',
    topic: 'Fechamento de resultado',
    accountingType: 'Societário',
    defaultCompetenceType: 'MENSAL',
    defaultCompetence: '10/2026',
    defaultDueDate: '2026-11-09',
    recurrence: 'MENSAL',
    defaultAssignee: 'Renato',
    defaultReviewer: 'Rogério',
    defaultCompanyScope: 'ALL',
    customBranches: [],
    isCritical: true,
    checklistKey: 'CONTAS_PAGAR_RECEBER',
    customChecklistItems: [],
    defaultEvidencePath: 'G:\\Contabilidade\\2026\\10_Outubro\\02_Conciliacao_CAP',
    standardNotes: 'Batimento obrigatório do relatório FINR150 contra o razão contábil nas 40 filiais.'
  },
  {
    id: 'TPL-03',
    standardCode: 'CTB-03',
    department: 'Contábil',
    group: 'Fechamento de resultado',
    subGroup: 'Societário',
    title: 'Análise de contas a receber (Clientes & Adiantamentos)',
    topic: 'Fechamento de resultado',
    accountingType: 'Societário',
    defaultCompetenceType: 'MENSAL',
    defaultCompetence: '10/2026',
    defaultDueDate: '2026-11-09',
    recurrence: 'MENSAL',
    defaultAssignee: 'Jhennifer',
    defaultReviewer: 'Rogério',
    defaultCompanyScope: 'ALL',
    customBranches: [],
    isCritical: true,
    checklistKey: 'CONTAS_PAGAR_RECEBER',
    customChecklistItems: [],
    defaultEvidencePath: 'G:\\Contabilidade\\2026\\10_Outubro\\03_Conciliacao_CAR',
    standardNotes: 'Batimento do relatório FINR130 x Razão Contábil após fechamento das baixas bancárias da Tesouraria.'
  },
  {
    id: 'TPL-04',
    standardCode: 'FIS-01',
    department: 'Fiscal',
    group: 'Apuração de Impostos e Obrigações',
    subGroup: 'ICMS / IPI',
    title: 'Conciliação de Despesas Fiscais, ICMS e Taxas Estaduais/Municipais',
    topic: 'Conciliações contábeis',
    accountingType: 'ICMS / IPI',
    defaultCompetenceType: 'MENSAL',
    defaultCompetence: '10/2026',
    defaultDueDate: '2026-11-06',
    recurrence: 'MENSAL',
    defaultAssignee: 'Leia',
    defaultReviewer: 'Rogério',
    defaultCompanyScope: 'ALL',
    customBranches: [],
    isCritical: false,
    checklistKey: 'DESPESAS_FISCAIS',
    customChecklistItems: [],
    defaultEvidencePath: 'G:\\Fiscal\\2026\\10_Outubro\\04_Despesas_Fiscais',
    standardNotes: 'Conferir guias recolhidas, EFD ICMS/IPI e classificação correta de multas indedutíveis.'
  },
  {
    id: 'TPL-05',
    standardCode: 'CTB-05',
    department: 'Contábil',
    group: 'Fechamento de resultado',
    subGroup: 'Societário',
    title: 'Variação Cambial Ativa e Passiva (Fechamento Taxa PTAX BACEN)',
    topic: 'Fechamento de resultado',
    accountingType: 'Societário',
    defaultCompetenceType: 'MENSAL',
    defaultCompetence: '10/2026',
    defaultDueDate: '2026-11-07',
    recurrence: 'MENSAL',
    defaultAssignee: 'Renato',
    defaultReviewer: 'Rogério',
    defaultCompanyScope: 'ALL',
    customBranches: [],
    isCritical: true,
    checklistKey: 'VARIACAO_CAMBIAL',
    customChecklistItems: [],
    defaultEvidencePath: 'G:\\Contabilidade\\2026\\10_Outubro\\05_Variacao_Cambial_PTAX.xlsx',
    standardNotes: 'Atualizar contratos e títulos em moeda estrangeira pela PTAX oficial do último dia do mês.'
  },
  {
    id: 'TPL-06',
    standardCode: 'FIS-02',
    department: 'Fiscal',
    group: 'Conciliações contábeis',
    subGroup: 'PIS / COFINS',
    title: 'Conciliação de Receita Bruta e Deduções (Views Fiscais x Razão Contábil)',
    topic: 'Conciliações contábeis',
    accountingType: 'PIS / COFINS',
    defaultCompetenceType: 'MENSAL',
    defaultCompetence: '10/2026',
    defaultDueDate: '2026-11-08',
    recurrence: 'MENSAL',
    defaultAssignee: 'Leia',
    defaultReviewer: 'Rogério',
    defaultCompanyScope: 'ALL',
    customBranches: [],
    isCritical: true,
    checklistKey: 'CONCILIACAO_RECEITA',
    customChecklistItems: [],
    defaultEvidencePath: 'G:\\Fiscal\\2026\\10_Outubro\\06_Conciliacao_Receita_CutOff.xlsx',
    standardNotes: 'Validar faturamento, devoluções, remessas para entrega futura e corte de receita (Cut-off).'
  },
  {
    id: 'TPL-07',
    standardCode: 'CTB-07',
    department: 'Contábil',
    group: 'Coneasy',
    subGroup: 'Societário',
    title: 'Integração e Consistência de Lotes Contábeis Coneasy',
    topic: 'Coneasy',
    accountingType: 'Societário',
    defaultCompetenceType: 'MENSAL',
    defaultCompetence: '10/2026',
    defaultDueDate: '2026-11-08',
    recurrence: 'MENSAL',
    defaultAssignee: 'Jhennifer',
    defaultReviewer: 'Rogério',
    defaultCompanyScope: 'ALL',
    customBranches: [],
    isCritical: false,
    checklistKey: '',
    customChecklistItems: [
      'Processar fila de integração Coneasy x TOTVS Protheus',
      'Auditar eventuais partidas dobradas pendentes ou rejeitadas por centro de custo',
      'Validar protocolo de fechamento de lote automático'
    ],
    defaultEvidencePath: 'G:\\Contabilidade\\2026\\10_Outubro\\07_Integracao_Coneasy',
    standardNotes: 'Garantir que 100% dos lotes integrados não possuam diferenças ou contas transitórias abertas.'
  },
  {
    id: 'TPL-08',
    standardCode: 'FIS-03',
    department: 'Fiscal',
    group: 'Apuração de Impostos e Obrigações',
    subGroup: 'IRPJ / CSLL',
    title: 'Fechamento Trimestral do Lucro Real e Estimativa IRPJ/CSLL (LALUR)',
    topic: 'Apuração de Impostos e Obrigações',
    accountingType: 'IRPJ / CSLL',
    defaultCompetenceType: 'MENSAL',
    defaultCompetence: '10/2026',
    defaultDueDate: '2026-11-12',
    recurrence: 'TRIMESTRAL',
    defaultAssignee: 'Leia',
    defaultReviewer: 'Rogério',
    defaultCompanyScope: 'ALL',
    customBranches: [],
    isCritical: true,
    checklistKey: '',
    customChecklistItems: [
      'Validar adições e exclusões no e-LALUR / e-LACS',
      'Conferir compensação de prejuízos fiscais e retenções na fonte',
      'Emitir DARFs e conciliar provisão contábil de IRPJ e CSLL'
    ],
    defaultEvidencePath: 'G:\\Fiscal\\2026\\Trimestral\\LALUR_IRPJ_CSLL',
    standardNotes: 'Revisão trimestral de adições, exclusões e incentivos fiscais agropecuários.'
  },
  {
    id: 'TPL-09',
    standardCode: 'CTB-09',
    department: 'Contábil',
    group: 'Obrigações Acessórias Anuais',
    subGroup: 'SPED / EFD / ECD / ECF',
    title: 'Revisão de Saldos Anuais e Cruzamento ECD x ECF (Ano-Calendário 2025)',
    topic: 'Obrigações Acessórias Anuais',
    accountingType: 'SPED / EFD / ECD / ECF',
    defaultCompetenceType: 'ANUAL',
    defaultCompetence: '2025',
    defaultDueDate: '2026-11-15',
    recurrence: 'ANUAL',
    defaultAssignee: 'Rogério',
    defaultReviewer: 'Rogério',
    defaultCompanyScope: 'ALL',
    customBranches: [],
    isCritical: true,
    checklistKey: '',
    customChecklistItems: [
      'Validar plano de contas referencial RFB nas 40 filiais',
      'Cruzar saldos finais da ECD 2025 com bloco K e M da ECF',
      'Arquivar recibos de transmissão e termos de autenticação'
    ],
    defaultEvidencePath: 'G:\\Contabilidade\\Anual_2025\\ECD_ECF_Consolidado',
    standardNotes: 'Obrigação anual referente à competência 2025 com validação cruzada entre Contábil e Fiscal.'
  },
  {
    id: 'TPL-10',
    standardCode: 'CTB-10',
    department: 'Contábil',
    group: 'Fechamento de resultado',
    subGroup: 'IFRS',
    title: 'AVP faturamento/compras/car/cap/estoque (Ajuste a Valor Presente)',
    topic: 'Fechamento de resultado',
    accountingType: 'IFRS',
    defaultCompetenceType: 'MENSAL',
    defaultCompetence: '10/2026',
    defaultDueDate: '2026-11-10',
    recurrence: 'MENSAL',
    defaultAssignee: 'Jhennifer',
    defaultReviewer: 'Rogério',
    defaultCompanyScope: 'ALL',
    customBranches: [],
    isCritical: true,
    checklistKey: 'AVP',
    customChecklistItems: [],
    defaultEvidencePath: 'G:\\Contabilidade\\2026\\10_Outubro\\10_Calculo_AVP_IFRS.xlsx',
    standardNotes: 'Cálculo IFRS de Ajuste a Valor Presente sobre carteiras a prazo e reversão da competência anterior.'
  }
];

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
    templateId: 'TPL-01',
    code: 'CTB-01',
    department: 'Contábil',
    group: 'Fechamento de resultado',
    subGroup: 'IFRS',
    title: 'Amortização - SEGUROS (Imóveis e Veículos)',
    topic: 'Fechamento de resultado',
    accountingType: 'IFRS',
    category: 'FECHAMENTO',
    competenceType: 'MENSAL',
    competence: '10/2026',
    dueDate: '2026-10-30',
    recurrence: 'MENSAL',
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
    customChecklistItems: [
      'Atualizar planilha de controle de apólices vigentes por filial',
      'Gerar lote de apropriação mensal de prêmios de seguros no TOTVS',
      'Conciliar saldo das contas de Despesas Antecipadas (Ativo Circulante)'
    ],
    checklistState: [true, true, true],
    timeByUser: { Renato: 5120 },
    evidenceUrl: 'G:\\Contabilidade\\2026\\10_Outubro\\01_Seguros_Amortizacao.xlsx',
    comments: [
      { id: 'c1', author: 'Renato', text: 'Planilha de apropriação de prêmios de seguros lançada no TOTVS para todas as filiais aplicáveis.', createdAt: '2026-10-29T16:40:00' }
    ]
  },
  {
    id: 'CTB-02',
    templateId: 'TPL-02',
    code: 'CTB-02',
    department: 'Contábil',
    group: 'Fechamento de resultado',
    subGroup: 'Societário',
    title: 'Análise de contas a pagar (Fornecedores & Adiantamentos)',
    topic: 'Fechamento de resultado',
    accountingType: 'Societário',
    category: 'FECHAMENTO',
    competenceType: 'MENSAL',
    competence: '10/2026',
    dueDate: '2026-10-31',
    recurrence: 'MENSAL',
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
    customChecklistItems: [],
    checklistState: [true, true, false, false],
    timeByUser: { Renato: 4380 },
    evidenceUrl: 'G:\\Contabilidade\\2026\\10_Outubro\\02_Conciliacao_CAP',
    comments: [
      { id: 'c2', author: 'Renato', text: 'Iniciando batimento do relatório FINR150 contra razão contábil nas filiais 010101 a 010120.', createdAt: '2026-10-30T08:15:00' }
    ]
  },
  {
    id: 'CTB-03',
    templateId: 'TPL-03',
    code: 'CTB-03',
    department: 'Contábil',
    group: 'Fechamento de resultado',
    subGroup: 'Societário',
    title: 'Análise de contas a receber (Clientes & Adiantamentos)',
    topic: 'Fechamento de resultado',
    accountingType: 'Societário',
    category: 'FECHAMENTO',
    competenceType: 'MENSAL',
    competence: '10/2026',
    dueDate: '2026-10-30',
    recurrence: 'MENSAL',
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
    customChecklistItems: [],
    checklistState: [true, false, false, false],
    timeByUser: { Jhennifer: 3420 },
    evidenceUrl: '',
    comments: []
  },
  {
    id: 'FIS-01',
    templateId: 'TPL-04',
    code: 'FIS-01',
    department: 'Fiscal',
    group: 'Apuração de Impostos e Obrigações',
    subGroup: 'ICMS / IPI',
    title: 'Conciliação de Despesas Fiscais, ICMS e Taxas Estaduais/Municipais',
    topic: 'Conciliações contábeis',
    accountingType: 'ICMS / IPI',
    category: 'FECHAMENTO',
    competenceType: 'MENSAL',
    competence: '10/2026',
    dueDate: '2026-11-06',
    recurrence: 'MENSAL',
    assignee: 'Leia',
    originalAssignee: 'Leia',
    reviewer: 'Rogério',
    status: 'PENDENTE',
    isCritical: false,
    totalSeconds: 0,
    timerStartedAt: null,
    activeTimerUser: null,
    pauseReason: null,
    dependencyInfo: null,
    branches: createInitialBranches('p', 0),
    checklistKey: 'DESPESAS_FISCAIS',
    customChecklistItems: [],
    checklistState: [false, false, false],
    timeByUser: {},
    evidenceUrl: 'G:\\Fiscal\\2026\\10_Outubro\\04_Despesas_Fiscais',
    comments: []
  },
  {
    id: 'CTB-09',
    templateId: 'TPL-09',
    code: 'CTB-09',
    department: 'Contábil',
    group: 'Obrigações Acessórias Anuais',
    subGroup: 'SPED / EFD / ECD / ECF',
    title: 'Revisão de Saldos Anuais e Cruzamento ECD x ECF (Ano-Calendário 2025)',
    topic: 'Obrigações Acessórias Anuais',
    accountingType: 'SPED / EFD / ECD / ECF',
    category: 'FECHAMENTO',
    competenceType: 'ANUAL',
    competence: '2025',
    dueDate: '2026-11-15',
    recurrence: 'ANUAL',
    assignee: 'Rogério',
    originalAssignee: 'Rogério',
    reviewer: 'Rogério',
    status: 'PENDENTE',
    isCritical: true,
    totalSeconds: 1800,
    timerStartedAt: null,
    activeTimerUser: null,
    pauseReason: null,
    dependencyInfo: null,
    branches: createInitialBranches('p', 12),
    checklistKey: null,
    customChecklistItems: [
      'Validar plano de contas referencial RFB nas 40 filiais',
      'Cruzar saldos finais da ECD 2025 com bloco K e M da ECF',
      'Arquivar recibos de transmissão e termos de autenticação'
    ],
    checklistState: [true, false, false],
    timeByUser: { Rogério: 1800 },
    evidenceUrl: 'G:\\Contabilidade\\Anual_2025\\ECD_ECF_Consolidado',
    comments: []
  },
  {
    id: 'CTB-10',
    templateId: 'TPL-10',
    code: 'CTB-10',
    department: 'Contábil',
    group: 'Fechamento de resultado',
    subGroup: 'IFRS',
    title: 'AVP faturamento/compras/car/cap/estoque (Ajuste a Valor Presente)',
    topic: 'Fechamento de resultado',
    accountingType: 'IFRS',
    category: 'FECHAMENTO',
    competenceType: 'MENSAL',
    competence: '10/2026',
    dueDate: '2026-11-10',
    recurrence: 'MENSAL',
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
    customChecklistItems: [],
    checklistState: [true, true, true, false, false],
    timeByUser: { Jhennifer: 6120 },
    evidenceUrl: 'G:\\Contabilidade\\2026\\10_Outubro\\10_Calculo_AVP_IFRS.xlsx',
    comments: [
      { id: 'c10', author: 'Jhennifer', text: '@Leia transferi a tarefa para você validar as devoluções fiscais no bloco de faturamento.', createdAt: '2026-10-30T08:10:00' }
    ]
  },
  {
    id: 'AVU-01',
    templateId: null,
    code: 'AVU-01',
    department: 'Contábil',
    group: 'Demanda Avulsa / Auditoria',
    subGroup: 'Auditoria Externa',
    title: 'Atendimento Auditoria Externa: Amostra de 25 NFs de Insumos (Filial 010101)',
    topic: 'Demanda Avulsa / Auditoria',
    accountingType: 'Auditoria Externa',
    category: 'AVULSA',
    competenceType: 'MENSAL',
    competence: '10/2026',
    dueDate: '2026-10-30',
    recurrence: 'ESPORADICA',
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
    customChecklistItems: [],
    checklistState: [],
    timeByUser: { Jhennifer: 2650 },
    evidenceUrl: 'G:\\Contabilidade\\2026\\Auditoria_Outubro\\Amostra_25_NFs',
    comments: []
  }
];

const extractTemplateDueDay = (rawDue: any): string => {
  const s = String(rawDue || '').trim();
  if (/^\d{4}-\d{2}-(\d{2})$/.test(s)) {
    return s.slice(8, 10);
  }
  const m = s.match(/(\d{1,2})/);
  if (m) {
    const num = Math.min(31, Math.max(1, parseInt(m[1], 10)));
    return String(num).padStart(2, '0');
  }
  return '10';
};

const formatTemplateDueRule = (recurrence: string, rawDueDay: any): string => {
  const dayStr = extractTemplateDueDay(rawDueDay);
  const rec = (recurrence || 'MENSAL').toUpperCase();
  if (rec === 'TRIMESTRAL') {
    return `Todo dia ${dayStr} de cada trimestre ela se repete`;
  }
  if (rec === 'ANUAL') {
    return `Todo dia ${dayStr} de cada ano ela se repete`;
  }
  if (rec === 'ESPORADICA') {
    return `Todo dia ${dayStr} (Esporádica / conforme demanda)`;
  }
  return `Todo dia ${dayStr} de cada mês ela se repete`;
};

const computeNextDueDateFromTemplate = (rawDueDay: any): string => {
  const dayNum = parseInt(extractTemplateDueDay(rawDueDay), 10) || 10;
  const dayStr = String(dayNum).padStart(2, '0');
  if (dayNum >= 25) {
    return `2026-10-${dayStr}`;
  }
  return `2026-11-${dayStr}`;
};

const MONTH_OPTIONS = [
  { value: '01', label: '01 - Janeiro', short: 'Jan' },
  { value: '02', label: '02 - Fevereiro', short: 'Fev' },
  { value: '03', label: '03 - Março (Fechamento 1º Trim.)', short: 'Mar' },
  { value: '04', label: '04 - Abril', short: 'Abr' },
  { value: '05', label: '05 - Maio', short: 'Mai' },
  { value: '06', label: '06 - Junho (Fechamento 2º Trim.)', short: 'Jun' },
  { value: '07', label: '07 - Julho', short: 'Jul' },
  { value: '08', label: '08 - Agosto', short: 'Ago' },
  { value: '09', label: '09 - Setembro (Fechamento 3º Trim.)', short: 'Set' },
  { value: '10', label: '10 - Outubro', short: 'Out' },
  { value: '11', label: '11 - Novembro (Próximo Mês)', short: 'Nov' },
  { value: '12', label: '12 - Dezembro (4º Trim. & Anual)', short: 'Dez' }
];

const computeDueDateForCompetenceMonth = (
  rawDueDay: any,
  monthStr: string,
  yearStr: string,
  dueMonthRule: 'SAME_MONTH' | 'NEXT_MONTH' = 'SAME_MONTH'
): string => {
  const desiredDay = parseInt(extractTemplateDueDay(rawDueDay), 10) || 10;
  let monthNum = parseInt(monthStr, 10) || 11;
  let yearNum = parseInt(yearStr, 10) || 2026;
  if (dueMonthRule === 'NEXT_MONTH') {
    monthNum += 1;
    if (monthNum > 12) {
      monthNum = 1;
      yearNum += 1;
    }
  }
  const maxDaysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const clampedDay = Math.min(desiredDay, maxDaysInMonth);
  return `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
};

const normalizeTemplateRecord = (tpl: any) => {
  const isFiscal =
    tpl.department === 'Fiscal' ||
    tpl.accountingType === 'Fiscal' ||
    String(tpl.standardCode || '').startsWith('FIS');
  const department = tpl.department || (isFiscal ? 'Fiscal' : 'Contábil');
  const group = tpl.group || tpl.topic || 'Fechamento de resultado';
  const subGroup =
    tpl.subGroup ||
    (tpl.id === 'TPL-01' ? 'IFRS' : tpl.accountingType || 'Societário');
  const recurrence =
    tpl.recurrence ||
    (tpl.defaultCompetenceType === 'ANUAL' ? 'ANUAL' : 'MENSAL');
  const defaultCompetenceType = recurrence === 'ANUAL' ? 'ANUAL' : 'MENSAL';
  const defaultCompetence =
    RECURRENCE_CONFIG[recurrence]?.label || 'Mensal';
  const dueDay = extractTemplateDueDay(tpl.defaultDueDate || '10');
  return {
    ...tpl,
    department,
    group,
    subGroup,
    topic: group,
    accountingType: subGroup,
    defaultCompetenceType,
    defaultCompetence,
    defaultDueDate: formatTemplateDueRule(recurrence, dueDay),
    recurrence
  };
};

const normalizeTaskRecord = (task: any) => {
  const isFiscal =
    task.department === 'Fiscal' ||
    task.accountingType === 'Fiscal' ||
    String(task.code || '').startsWith('FIS');
  const department = task.department || (isFiscal ? 'Fiscal' : 'Contábil');
  const group = task.group || task.topic || 'Fechamento de resultado';
  const subGroup =
    task.subGroup ||
    (task.code === 'CTB-01' ? 'IFRS' : task.accountingType || 'Societário');
  const competenceType = task.competenceType || 'MENSAL';
  const competence =
    task.competence || (competenceType === 'ANUAL' ? '2025' : '10/2026');
  const recurrence =
    task.recurrence ||
    (task.category === 'AVULSA'
      ? 'ESPORADICA'
      : competenceType === 'ANUAL'
      ? 'ANUAL'
      : 'MENSAL');
  return {
    ...task,
    department,
    group,
    subGroup,
    topic: group,
    accountingType: subGroup,
    competenceType,
    competence,
    dueDate: task.dueDate || '2026-11-10',
    recurrence
  };
};

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
  const parts = text.split(/(@[a-zA-ZÀ-ÿ0-9_\-]+)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('@') && part.length > 1) {
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
  const [currentUser, setCurrentUser] = useState('Rogério');

  // Cadastro e Gestão de Usuários (Administrador, Coordenador, Analista)
  const [TEAM_MEMBERS, setTeamMembers] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(normalizeUserRecord);
      }
    } catch {
      // ignore
    }
    return INITIAL_TEAM_MEMBERS.map(normalizeUserRecord);
  });

  // Cadastro Padrão de Tarefas de Fechamento (Templates)
  const [taskTemplates, setTaskTemplates] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_TEMPLATES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(normalizeTemplateRecord);
      }
    } catch {
      // ignore
    }
    return INITIAL_TEMPLATES_SEED;
  });

  const [tasks, setTasks] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_TASKS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(normalizeTaskRecord);
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

  // Estado do Menu Lateral (Sidebar)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Cadastro e Gestão de Empresas / 40 Filiais
  const [companies, setCompanies] = useState<CompanyRecord[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_COMPANIES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(normalizeCompanyRecord);
      }
    } catch {
      // ignore
    }
    return INITIAL_COMPANIES_SEED.map(normalizeCompanyRecord);
  });
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [companyStatusFilter, setCompanyStatusFilter] = useState('TODAS');
  const [companyUfFilter, setCompanyUfFilter] = useState('TODAS');
  const [companyTaxRegimeFilter, setCompanyTaxRegimeFilter] = useState('TODOS');
  const [companyTypeFilter, setCompanyTypeFilter] = useState('TODOS');
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [editingCompanyCode, setEditingCompanyCode] = useState<string | null>(null);
  const [companyForm, setCompanyForm] = useState({
    code: '',
    name: '',
    tradingName: '',
    cnpj: '',
    city: '',
    uf: 'MT',
    taxRegime: 'Lucro Real' as 'Lucro Real' | 'Lucro Presumido' | 'Simples Nacional',
    manager: 'Rogério',
    branchType: 'Filial Insumos',
    status: 'ATIVA' as 'ATIVA' | 'INATIVA',
    phone: '',
    email: '',
    notes: ''
  });

  // Modelos de Checklist Customizados & Reutilizáveis
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_CHECKLIST_TEMPLATES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_CHECKLIST_TEMPLATES;
  });
  const [checklistSearchQuery, setChecklistSearchQuery] = useState('');
  const [checklistDeptFilter, setChecklistDeptFilter] = useState('TODOS');
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [checklistForm, setChecklistForm] = useState({
    name: '',
    department: 'Contábil' as 'Contábil' | 'Fiscal' | 'Geral',
    description: '',
    itemsText: ''
  });
  const [isSaveCurrentStepsModalOpen, setIsSaveCurrentStepsModalOpen] = useState(false);
  const [saveCurrentStepsTarget, setSaveCurrentStepsTarget] = useState<'TEMPLATE_FORM' | 'NEW_TASK_FORM'>('TEMPLATE_FORM');
  const [saveCurrentStepsForm, setSaveCurrentStepsForm] = useState({
    name: '',
    department: 'Contábil' as 'Contábil' | 'Fiscal' | 'Geral',
    description: ''
  });
  const [checklistToastFeedback, setChecklistToastFeedback] = useState<string | null>(null);

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
  const [activeRoleView, setActiveRoleView] = useState<'ADMINISTRADOR' | 'COORDENADOR' | 'ANALISTA'>('ADMINISTRADOR');
  const [quickFilter, setQuickFilter] = useState('TODAS');
  const [userFilter, setUserFilter] = useState('TODOS');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [departmentFilter, setDepartmentFilter] = useState('TODOS');
  const [topicFilter, setTopicFilter] = useState('TODOS'); // Grupo
  const [subGroupFilter, setSubGroupFilter] = useState('TODOS');
  const [recurrenceFilter, setRecurrenceFilter] = useState('TODAS');
  const [competenceFilter, setCompetenceFilter] = useState('TODAS');
  const [activeOperatorFilter, setActiveOperatorFilter] = useState('TODOS'); // 'TODOS' ou ID do operador
  const [searchQuery, setSearchQuery] = useState('');
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');
  const [templateDepartmentFilter, setTemplateDepartmentFilter] = useState('TODOS');

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

  // Modal de Nova Tarefa (busca do Cadastro Padrão quando category === 'FECHAMENTO')
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [templatePickerFilter, setTemplatePickerFilter] = useState('');
  const [newTaskForm, setNewTaskForm] = useState({
    templateId: 'TPL-01',
    standardCode: 'CTB-01',
    department: 'Contábil',
    group: 'Fechamento de resultado',
    subGroup: 'IFRS',
    title: 'Amortização - SEGUROS (Imóveis e Veículos)',
    category: 'FECHAMENTO',
    topic: 'Fechamento de resultado',
    accountingType: 'IFRS',
    competenceType: 'MENSAL',
    competence: '10/2026',
    dueDate: '2026-10-30',
    recurrence: 'MENSAL',
    assignee: 'Renato',
    isCritical: false,
    startImmediately: false,
    initialNote: '',
    companyScope: 'ALL',
    customBranches: ['010101'],
    checklistKey: '',
    customChecklistItems: [] as string[],
    evidenceUrl: 'G:\\Contabilidade\\2026\\10_Outubro\\01_Seguros_Amortizacao.xlsx'
  });

  // Modal de Cadastro/Edição de Tarefa Padrão (Catálogo de Fechamento)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({
    standardCode: '',
    department: 'Contábil',
    group: 'Fechamento de resultado',
    subGroup: 'IFRS',
    title: '',
    topic: 'Fechamento de resultado',
    accountingType: 'IFRS',
    defaultCompetenceType: 'MENSAL',
    defaultCompetence: '10/2026',
    defaultDueDate: '2026-11-10',
    recurrence: 'MENSAL',
    defaultAssignee: 'Jhennifer',
    defaultReviewer: 'Rogério',
    defaultCompanyScope: 'ALL',
    customBranches: ['010101'],
    isCritical: false,
    checklistKey: '',
    customChecklistText: '',
    defaultEvidencePath: '',
    standardNotes: ''
  });

  const [showNotifications, setShowNotifications] = useState(false);
  const [isHeaderTimerExpanded, setIsHeaderTimerExpanded] = useState(false);

  // Modal e Parâmetros de Geração Automática de Tarefas por Mês/Período
  const [isAutoGenerateModalOpen, setIsAutoGenerateModalOpen] = useState(false);
  const [autoGenParams, setAutoGenParams] = useState({
    targetMonth: '11',
    targetYear: '2026',
    includeMensal: true,
    includeTrimestral: false,
    includeAnual: false,
    includeEsporadica: false,
    departmentScope: 'TODOS',
    dueMonthRule: 'SAME_MONTH' as 'SAME_MONTH' | 'NEXT_MONTH',
    skipExisting: true,
    excludedTemplateIds: [] as string[]
  });
  const [autoGenFeedback, setAutoGenFeedback] = useState<{
    competence: string;
    count: number;
    dueRuleLabel: string;
  } | null>(null);

  // Estados do Painel de Cadastro e Gestão de Usuários (Administrador, Coordenador, Analista)
  const [userCategoryFilter, setUserCategoryFilter] = useState('TODOS');
  const [userDepartmentFilter, setUserDepartmentFilter] = useState('TODOS');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    id: '',
    name: '',
    email: '',
    category: 'ANALISTA',
    role: 'Analista Contábil Pleno',
    department: 'Contábil',
    status: 'ATIVO',
    avatar: '',
    colorKey: 'indigo'
  });

  // Estados do Painel Separado de Análise Executiva (Entregas, Vencimentos, Atrasos & Distribuição)
  const [analysisRefDate, setAnalysisRefDate] = useState('2026-10-30');
  const [analysisDeptFilter, setAnalysisDeptFilter] = useState('TODOS');
  const [analysisCompetenceFilter, setAnalysisCompetenceFilter] = useState('TODAS');
  const [analysisAssigneeFilter, setAnalysisAssigneeFilter] = useState('TODOS');
  const [analysisSlaFilter, setAnalysisSlaFilter] = useState('TODAS');
  const [analysisSearchQuery, setAnalysisSearchQuery] = useState('');

  // Estados do Sistema de Lembretes & Alertas de Vencimento (< 24 Horas)
  const [notificationTab, setNotificationTab] = useState<'LEMBRETES' | 'MENCOES'>('LEMBRETES');
  const [isReminderBannerDismissed, setIsReminderBannerDismissed] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [dismissedReminderIds, setDismissedReminderIds] = useState<string[]>([]);
  const [reminderFilterScope, setReminderFilterScope] = useState<'TODAS' | 'MINHAS'>('TODAS');

  // Estados de Usabilidade Dinâmica e Densidade de Tela
  const [isRoleOverviewExpanded, setIsRoleOverviewExpanded] = useState(false);
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const [taskListDensity, setTaskListDensity] = useState<'CARDS' | 'TABELA'>('CARDS');


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

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_TEMPLATES_KEY, JSON.stringify(taskTemplates));
    } catch {
      // ignore
    }
  }, [taskTemplates]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(TEAM_MEMBERS));
    } catch {
      // ignore
    }
  }, [TEAM_MEMBERS]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_COMPANIES_KEY, JSON.stringify(companies));
    } catch {
      // ignore
    }
  }, [companies]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_CHECKLIST_TEMPLATES_KEY, JSON.stringify(checklistTemplates));
    } catch {
      // ignore
    }
  }, [checklistTemplates]);

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
    let unsubTemplates: (() => void) | null = null;
    let unsubUsers: (() => void) | null = null;

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
      if (unsubTemplates) {
        unsubTemplates();
        unsubTemplates = null;
      }
      if (unsubUsers) {
        unsubUsers();
        unsubUsers = null;
      }

      if (u && u.emailVerified) {
        const usersPath = 'users_team';
        const usersQuery = query(collection(db, usersPath), where('ownerUid', '==', u.uid));
        unsubUsers = onSnapshot(
          usersQuery,
          async (snap) => {
            if (!snap.empty) {
              const loadedUsers = snap.docs.map((d) => normalizeUserRecord({ ...d.data(), id: d.id })) as any[];
              setTeamMembers(loadedUsers);
            } else {
              try {
                for (const seedUser of INITIAL_TEAM_MEMBERS) {
                  const normalized = normalizeUserRecord(seedUser);
                  const safeDocId = normalized.id.replace(/[^a-zA-Z0-9_\-]/g, '_');
                  const payload = sanitizeForFirestore({
                    ...normalized,
                    id: safeDocId,
                    ownerUid: u.uid
                  });
                  await setDoc(doc(db, usersPath, safeDocId), payload);
                }
              } catch (err) {
                handleFirestoreError(err, OperationType.WRITE, usersPath);
              }
            }
          },
          (err) => handleFirestoreError(err, OperationType.LIST, usersPath)
        );

        const templatesPath = 'task_templates';
        const templatesQuery = query(collection(db, templatesPath), where('ownerUid', '==', u.uid));
        unsubTemplates = onSnapshot(
          templatesQuery,
          async (snap) => {
            if (!snap.empty) {
              const loaded = snap.docs.map((d) => normalizeTemplateRecord({ ...d.data(), id: d.id })) as any[];
              loaded.sort((a, b) => String(a.standardCode || '').localeCompare(String(b.standardCode || '')));
              setTaskTemplates(loaded);
            } else {
              try {
                for (const seedTpl of INITIAL_TEMPLATES_SEED) {
                  const payload = sanitizeForFirestore({
                    ...seedTpl,
                    ownerUid: u.uid
                  });
                  await setDoc(doc(db, templatesPath, seedTpl.id), payload);
                }
              } catch (err) {
                handleFirestoreError(err, OperationType.WRITE, templatesPath);
              }
            }
          },
          (err) => handleFirestoreError(err, OperationType.LIST, templatesPath)
        );

        const tasksPath = 'tasks_10_2026';
        const tasksQuery = query(collection(db, tasksPath), where('ownerUid', '==', u.uid));
        unsubTasks = onSnapshot(
          tasksQuery,
          async (snap) => {
            if (!snap.empty) {
              const loaded = snap.docs.map((d) => normalizeTaskRecord({ ...d.data(), id: d.id })) as any[];
              loaded.sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')));
              setTasks(loaded);
              setCloudSynced(true);
            } else {
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
      if (unsubTemplates) unsubTemplates();
      if (unsubUsers) unsubUsers();
    };
  }, []);

  const openCreateUserModal = () => {
    setEditingUserId(null);
    setUserForm({
      id: '',
      name: '',
      email: '',
      category: 'ANALISTA',
      role: 'Analista Contábil Pleno',
      department: 'Contábil',
      status: 'ATIVO',
      avatar: '',
      colorKey: 'indigo'
    });
    setIsUserModalOpen(true);
  };

  const openEditUserModal = (member: any) => {
    const preset =
      AVATAR_COLOR_PRESETS.find((p) => p.color === member.color) || AVATAR_COLOR_PRESETS[0];
    setEditingUserId(member.id);
    setUserForm({
      id: member.id,
      name: member.name || member.id,
      email: member.email || '',
      category: member.category || 'ANALISTA',
      role: member.role || 'Analista Contábil',
      department: member.department || 'Contábil',
      status: member.status || 'ATIVO',
      avatar: member.avatar || '',
      colorKey: preset.key
    });
    setIsUserModalOpen(true);
  };

  const persistTeamUserToFirestore = async (userObj: any) => {
    if (!fbUser || !fbUser.emailVerified) return;
    const safeDocId = String(userObj.id).replace(/[^a-zA-Z0-9_\-]/g, '_');
    const payload = sanitizeForFirestore({
      id: safeDocId,
      name: String(userObj.name || userObj.id).slice(0, 120),
      email: String(userObj.email || '').slice(0, 160),
      category: ['ADMINISTRADOR', 'COORDENADOR', 'ANALISTA'].includes(userObj.category)
        ? userObj.category
        : 'ANALISTA',
      role: String(userObj.role || 'Analista').slice(0, 120),
      department: String(userObj.department || 'Contábil').slice(0, 64),
      status: userObj.status === 'INATIVO' ? 'INATIVO' : 'ATIVO',
      avatar: String(userObj.avatar || 'US').slice(0, 8),
      color: String(userObj.color || 'bg-indigo-600').slice(0, 64),
      lightBg: String(userObj.lightBg || 'bg-indigo-50').slice(0, 64),
      textColor: String(userObj.textColor || 'text-indigo-700').slice(0, 64),
      borderColor: String(userObj.borderColor || 'border-indigo-200').slice(0, 64),
      ownerUid: fbUser.uid
    });
    try {
      await setDoc(doc(db, 'users_team', safeDocId), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users_team/${safeDocId}`);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = userForm.name.trim();
    if (!cleanName) return;

    const cleanId = editingUserId || (userForm.id.trim() || cleanName.split(' ')[0]);
    const preset =
      AVATAR_COLOR_PRESETS.find((p) => p.key === userForm.colorKey) || AVATAR_COLOR_PRESETS[0];
    const computedAvatar =
      userForm.avatar.trim().toUpperCase().slice(0, 2) ||
      cleanName
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) ||
      'US';

    const savedUser = normalizeUserRecord({
      id: cleanId,
      name: cleanName,
      email:
        userForm.email.trim() ||
        `${cleanId.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}@agriconnection.com.br`,
      category: userForm.category,
      role: userForm.role.trim() || USER_CATEGORIES_CONFIG[userForm.category]?.label || 'Analista',
      department: userForm.department,
      status: userForm.status,
      avatar: computedAvatar,
      color: preset.color,
      lightBg: preset.lightBg,
      textColor: preset.textColor,
      borderColor: preset.borderColor
    });

    setTeamMembers((prev) => {
      const exists = prev.some((m) => m.id === cleanId);
      return exists ? prev.map((m) => (m.id === cleanId ? savedUser : m)) : [...prev, savedUser];
    });

    await persistTeamUserToFirestore(savedUser);
    setIsUserModalOpen(false);
  };

  const handleChangeUserCategoryDirect = async (member: any, newCategory: string) => {
    const updated = normalizeUserRecord({
      ...member,
      category: newCategory
    });
    setTeamMembers((prev) => prev.map((m) => (m.id === member.id ? updated : m)));
    await persistTeamUserToFirestore(updated);
  };

  const handleToggleUserStatus = async (member: any) => {
    const nextStatus = member.status === 'INATIVO' ? 'ATIVO' : 'INATIVO';
    const updated = normalizeUserRecord({
      ...member,
      status: nextStatus
    });
    setTeamMembers((prev) => prev.map((m) => (m.id === member.id ? updated : m)));
    await persistTeamUserToFirestore(updated);
  };

  const handleDeleteUser = async (memberId: string) => {
    if (TEAM_MEMBERS.length <= 1) return;
    setTeamMembers((prev) => prev.filter((m) => m.id !== memberId));
    if (currentUser === memberId) {
      const fallback = TEAM_MEMBERS.find((m) => m.id !== memberId);
      if (fallback) setCurrentUser(fallback.id);
    }
    if (fbUser && fbUser.emailVerified) {
      const safeDocId = String(memberId).replace(/[^a-zA-Z0-9_\-]/g, '_');
      try {
        await deleteDoc(doc(db, 'users_team', safeDocId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users_team/${safeDocId}`);
      }
    }
  };

  const filteredUsersList = useMemo(() => {
    return TEAM_MEMBERS.filter((m) => {
      if (userCategoryFilter !== 'TODOS' && (m.category || 'ANALISTA') !== userCategoryFilter) {
        return false;
      }
      if (userDepartmentFilter !== 'TODOS' && (m.department || 'Contábil') !== userDepartmentFilter) {
        return false;
      }
      if (userSearchQuery.trim()) {
        const q = userSearchQuery.toLowerCase();
        const matchName = (m.name || '').toLowerCase().includes(q);
        const matchId = (m.id || '').toLowerCase().includes(q);
        const matchEmail = (m.email || '').toLowerCase().includes(q);
        const matchRole = (m.role || '').toLowerCase().includes(q);
        if (!matchName && !matchId && !matchEmail && !matchRole) return false;
      }
      return true;
    });
  }, [TEAM_MEMBERS, userCategoryFilter, userDepartmentFilter, userSearchQuery]);

  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      if (companyStatusFilter !== 'TODAS' && c.status !== companyStatusFilter) return false;
      if (companyUfFilter !== 'TODAS' && c.uf !== companyUfFilter) return false;
      if (companyTaxRegimeFilter !== 'TODOS' && c.taxRegime !== companyTaxRegimeFilter) return false;
      if (companyTypeFilter !== 'TODOS' && c.branchType !== companyTypeFilter) return false;
      if (companySearchQuery.trim()) {
        const q = companySearchQuery.toLowerCase().trim();
        const inCode = c.code.toLowerCase().includes(q);
        const inName = c.name.toLowerCase().includes(q);
        const inTrading = c.tradingName.toLowerCase().includes(q);
        const inCnpj = c.cnpj.replace(/\D/g, '').includes(q.replace(/\D/g, '')) || c.cnpj.toLowerCase().includes(q);
        const inCity = c.city.toLowerCase().includes(q);
        const inUf = c.uf.toLowerCase().includes(q);
        const inManager = c.manager.toLowerCase().includes(q);
        if (!inCode && !inName && !inTrading && !inCnpj && !inCity && !inUf && !inManager) return false;
      }
      return true;
    });
  }, [companies, companyStatusFilter, companyUfFilter, companyTaxRegimeFilter, companyTypeFilter, companySearchQuery]);

  const companyKpis = useMemo(() => {
    const total = companies.length;
    const ativas = companies.filter((c) => c.status === 'ATIVA').length;
    const inativas = total - ativas;
    const lucroReal = companies.filter((c) => c.taxRegime === 'Lucro Real').length;
    const lucroPresumido = companies.filter((c) => c.taxRegime === 'Lucro Presumido').length;
    const ufs = Array.from(new Set(companies.map((c) => c.uf))).filter(Boolean);
    return { total, ativas, inativas, lucroReal, lucroPresumido, ufsCount: ufs.length, ufs };
  }, [companies]);

  const openCreateCompanyModal = () => {
    setEditingCompanyCode(null);
    setCompanyForm({
      code: '',
      name: '',
      tradingName: '',
      cnpj: '',
      city: '',
      uf: 'MT',
      taxRegime: 'Lucro Real',
      manager: currentUser,
      branchType: 'Filial Insumos',
      status: 'ATIVA',
      phone: '',
      email: '',
      notes: ''
    });
    setIsCompanyModalOpen(true);
  };

  const openEditCompanyModal = (comp: CompanyRecord) => {
    setEditingCompanyCode(comp.code);
    setCompanyForm({
      code: comp.code,
      name: comp.name,
      tradingName: comp.tradingName,
      cnpj: comp.cnpj,
      city: comp.city,
      uf: comp.uf,
      taxRegime: comp.taxRegime,
      manager: comp.manager,
      branchType: comp.branchType,
      status: comp.status,
      phone: comp.phone || '',
      email: comp.email || '',
      notes: comp.notes || ''
    });
    setIsCompanyModalOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCode = (editingCompanyCode || companyForm.code).trim();
    if (!rawCode) return;
    const code = rawCode.padStart(6, '0');
    const cleanName = companyForm.name.trim() || `Filial ${code}`;
    const cleanTrading = companyForm.tradingName.trim() || cleanName;

    const newRecord: CompanyRecord = normalizeCompanyRecord({
      code,
      name: cleanName,
      tradingName: cleanTrading,
      cnpj: companyForm.cnpj.trim() || '14.821.902/0001-00',
      city: companyForm.city.trim() || 'Cuiabá',
      uf: companyForm.uf.trim().toUpperCase().slice(0, 2) || 'MT',
      taxRegime: companyForm.taxRegime,
      manager: companyForm.manager,
      branchType: companyForm.branchType,
      status: companyForm.status,
      phone: companyForm.phone.trim(),
      email: companyForm.email.trim(),
      notes: companyForm.notes.trim()
    });

    setCompanies((prev) => {
      const exists = prev.some((c) => c.code === code);
      return exists ? prev.map((c) => (c.code === code ? newRecord : c)) : [...prev, newRecord];
    });

    const newLog = {
      id: `log-company-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: currentUser,
      taskCode: code,
      taskTitle: newRecord.name,
      type: editingCompanyCode ? 'EDICAO_EMPRESA' : 'CADASTRO_EMPRESA',
      details: `${editingCompanyCode ? 'Atualizou' : 'Cadastrou'} a empresa/filial [${code}] ${newRecord.name} (${newRecord.city}/${newRecord.uf} - ${newRecord.taxRegime}).`,
      durationSeconds: 0
    };
    setAuditLogs((prev) => [newLog, ...prev]);

    setIsCompanyModalOpen(false);
  };

  const handleToggleCompanyStatus = (comp: CompanyRecord) => {
    const nextStatus = comp.status === 'INATIVA' ? 'ATIVA' : 'INATIVA';
    const updated: CompanyRecord = { ...comp, status: nextStatus };
    setCompanies((prev) => prev.map((c) => (c.code === comp.code ? updated : c)));
    const newLog = {
      id: `log-company-status-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: currentUser,
      taskCode: comp.code,
      taskTitle: comp.name,
      type: 'STATUS_EMPRESA',
      details: `Alterou status da filial [${comp.code}] ${comp.name} para ${nextStatus}.`,
      durationSeconds: 0
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

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
    const normalized = normalizeTaskRecord(updatedTask);
    const cleanTask = sanitizeForFirestore({
      ...normalized,
      title: String(normalized.title || '').slice(0, 500),
      code: String(normalized.code || '').slice(0, 32),
      assignee: String(normalized.assignee || 'Jhennifer').slice(0, 64),
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

  // ==========================================
  // FUNÇÕES DO CADASTRO DE TAREFAS PADRÃO (TEMPLATES)
  // ==========================================
  const applyTemplateToNewTaskForm = (tpl: any) => {
    if (!tpl) return;
    const norm = normalizeTemplateRecord(tpl);
    const isAnual = norm.recurrence === 'ANUAL';
    setNewTaskForm((prev) => ({
      ...prev,
      category: 'FECHAMENTO',
      templateId: norm.id,
      standardCode: norm.standardCode,
      department: norm.department,
      group: norm.group,
      subGroup: norm.subGroup,
      title: norm.title,
      topic: norm.group,
      accountingType: norm.subGroup,
      competenceType: isAnual ? 'ANUAL' : 'MENSAL',
      competence: isAnual ? '2025' : '10/2026',
      dueDate: computeNextDueDateFromTemplate(norm.defaultDueDate),
      recurrence: norm.recurrence || 'MENSAL',
      assignee: norm.defaultAssignee || currentUser,
      isCritical: !!norm.isCritical,
      companyScope: norm.defaultCompanyScope || 'ALL',
      customBranches: Array.isArray(norm.customBranches) && norm.customBranches.length > 0 ? norm.customBranches : ['010101'],
      checklistKey: norm.checklistKey || '',
      customChecklistItems: Array.isArray(norm.customChecklistItems) ? norm.customChecklistItems : [],
      evidenceUrl: norm.defaultEvidencePath || '',
      initialNote: norm.standardNotes || ''
    }));
  };

  const openNewTaskModal = (defaultCategory: 'FECHAMENTO' | 'AVULSA' = 'FECHAMENTO', preselectedTemplate: any = null) => {
    if (defaultCategory === 'FECHAMENTO') {
      const unlaunchedTpl =
        preselectedTemplate ||
        taskTemplates.find((tpl) => !tasks.some((t) => t.templateId === tpl.id || t.code === tpl.standardCode)) ||
        taskTemplates[0];
      if (unlaunchedTpl) {
        applyTemplateToNewTaskForm(unlaunchedTpl);
      }
    } else {
      setNewTaskForm({
        templateId: '',
        standardCode: '',
        department: 'Contábil',
        group: 'Demanda Avulsa / Dia a Dia',
        subGroup: 'Societário',
        title: '',
        category: 'AVULSA',
        topic: 'Demanda Avulsa / Dia a Dia',
        accountingType: 'Societário',
        competenceType: 'MENSAL',
        competence: '10/2026',
        dueDate: '2026-10-30',
        recurrence: 'ESPORADICA',
        assignee: currentUser,
        isCritical: false,
        startImmediately: true,
        initialNote: '',
        companyScope: 'ALL',
        customBranches: ['010101'],
        checklistKey: '',
        customChecklistItems: [],
        evidenceUrl: ''
      });
    }
    setTemplatePickerFilter('');
    setIsNewTaskModalOpen(true);
  };

  // ==========================================
  // FUNÇÕES DE MODELOS DE CHECKLIST REUTILIZÁVEIS
  // ==========================================
  const openCreateChecklistModal = (defaultDept: 'Contábil' | 'Fiscal' | 'Geral' = 'Contábil') => {
    setEditingChecklistId(null);
    setChecklistForm({
      name: '',
      department: defaultDept,
      description: '',
      itemsText: ''
    });
    setIsChecklistModalOpen(true);
  };

  const openEditChecklistModal = (tpl: ChecklistTemplate) => {
    setEditingChecklistId(tpl.id);
    setChecklistForm({
      name: tpl.name,
      department: tpl.department,
      description: tpl.description || '',
      itemsText: tpl.items.join('\n')
    });
    setIsChecklistModalOpen(true);
  };

  const handleSaveChecklistTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = checklistForm.name.trim();
    if (!cleanName) return;

    const items = checklistForm.itemsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (items.length === 0) {
      alert('Informe ao menos 1 etapa para o modelo de checklist.');
      return;
    }

    const now = Date.now();
    const id = editingChecklistId || `CHK-${now}`;

    const newTemplate: ChecklistTemplate = {
      id,
      name: cleanName,
      department: checklistForm.department,
      description: checklistForm.description.trim(),
      items,
      createdBy: currentUser,
      createdAt: new Date().toISOString(),
      isBuiltin: editingChecklistId ? checklistTemplates.find((c) => c.id === editingChecklistId)?.isBuiltin : false
    };

    setChecklistTemplates((prev) => {
      const exists = prev.some((c) => c.id === id);
      return exists ? prev.map((c) => (c.id === id ? newTemplate : c)) : [newTemplate, ...prev];
    });

    const newLog = {
      id: `log-chk-${now}`,
      timestamp: new Date().toISOString(),
      user: currentUser,
      taskCode: id,
      taskTitle: cleanName,
      type: editingChecklistId ? 'EDICAO_CHECKLIST' : 'CADASTRO_CHECKLIST',
      details: `${editingChecklistId ? 'Atualizou' : 'Criou'} o modelo de checklist reutilizável [${cleanName}] (${checklistForm.department}) com ${items.length} etapas de conferência.`,
      durationSeconds: 0
    };
    setAuditLogs((prev) => [newLog, ...prev]);

    setIsChecklistModalOpen(false);
    setChecklistToastFeedback(`Modelo "${cleanName}" salvo com sucesso na biblioteca!`);
    setTimeout(() => setChecklistToastFeedback(null), 4000);
  };

  const handleDeleteChecklistTemplate = (tplId: string) => {
    const target = checklistTemplates.find((c) => c.id === tplId);
    if (!target) return;
    if (target.isBuiltin) {
      if (!confirm(`"${target.name}" é um modelo padrão do sistema. Tem certeza que deseja excluí-lo da sua biblioteca?`)) {
        return;
      }
    } else {
      if (!confirm(`Deseja realmente excluir o modelo de checklist "${target.name}"?`)) {
        return;
      }
    }

    setChecklistTemplates((prev) => prev.filter((c) => c.id !== tplId));
    const newLog = {
      id: `log-chk-del-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: currentUser,
      taskCode: tplId,
      taskTitle: target.name,
      type: 'EXCLUSAO_CHECKLIST',
      details: `Excluiu o modelo de checklist [${target.name}] da biblioteca.`,
      durationSeconds: 0
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const handleDuplicateChecklistTemplate = (tpl: ChecklistTemplate) => {
    const clonedName = `${tpl.name} (Cópia)`;
    setEditingChecklistId(null);
    setChecklistForm({
      name: clonedName,
      department: tpl.department,
      description: tpl.description ? `${tpl.description} (Cópia)` : '',
      itemsText: tpl.items.join('\n')
    });
    setIsChecklistModalOpen(true);
  };

  const openSaveCurrentStepsModal = (target: 'TEMPLATE_FORM' | 'NEW_TASK_FORM') => {
    let suggestedName = '';
    let suggestedDept: 'Contábil' | 'Fiscal' | 'Geral' = 'Contábil';
    let suggestedDesc = '';

    if (target === 'TEMPLATE_FORM') {
      suggestedName = templateForm.title ? `Checklist - ${templateForm.title}` : 'Checklist Personalizado';
      suggestedDept = templateForm.department === 'Fiscal' ? 'Fiscal' : 'Contábil';
      suggestedDesc = templateForm.standardNotes || '';
    } else {
      suggestedName = newTaskForm.title ? `Checklist - ${newTaskForm.title}` : 'Checklist Personalizado';
      suggestedDept = newTaskForm.department === 'Fiscal' ? 'Fiscal' : 'Contábil';
      suggestedDesc = newTaskForm.initialNote || '';
    }

    setSaveCurrentStepsTarget(target);
    setSaveCurrentStepsForm({
      name: suggestedName,
      department: suggestedDept,
      description: suggestedDesc
    });
    setIsSaveCurrentStepsModalOpen(true);
  };

  const handleSaveCurrentStepsAsTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = saveCurrentStepsForm.name.trim();
    if (!cleanName) return;

    let steps: string[] = [];
    if (saveCurrentStepsTarget === 'TEMPLATE_FORM') {
      steps = templateForm.customChecklistText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      steps = Array.isArray(newTaskForm.customChecklistItems) && newTaskForm.customChecklistItems.length > 0
        ? newTaskForm.customChecklistItems
        : [];
    }

    if (steps.length === 0) {
      alert('Não há etapas escritas no checklist para salvar como modelo.');
      return;
    }

    const now = Date.now();
    const id = `CHK-${now}`;

    const newTemplate: ChecklistTemplate = {
      id,
      name: cleanName,
      department: saveCurrentStepsForm.department,
      description: saveCurrentStepsForm.description.trim(),
      items: steps,
      createdBy: currentUser,
      createdAt: new Date().toISOString(),
      isBuiltin: false
    };

    setChecklistTemplates((prev) => [newTemplate, ...prev]);

    // Vincula automaticamente no formulário ativo
    if (saveCurrentStepsTarget === 'TEMPLATE_FORM') {
      setTemplateForm((prev) => ({
        ...prev,
        checklistKey: id
      }));
    } else {
      setNewTaskForm((prev) => ({
        ...prev,
        checklistKey: id,
        customChecklistItems: []
      }));
    }

    const newLog = {
      id: `log-chk-save-${now}`,
      timestamp: new Date().toISOString(),
      user: currentUser,
      taskCode: id,
      taskTitle: cleanName,
      type: 'CADASTRO_CHECKLIST',
      details: `Salvou as etapas da tarefa como novo modelo de checklist reutilizável [${cleanName}] com ${steps.length} etapas.`,
      durationSeconds: 0
    };
    setAuditLogs((prev) => [newLog, ...prev]);

    setIsSaveCurrentStepsModalOpen(false);
    setChecklistToastFeedback(`Novo modelo "${cleanName}" salvo e vinculado com sucesso!`);
    setTimeout(() => setChecklistToastFeedback(null), 4000);
  };

  const filteredChecklistTemplates = useMemo(() => {
    return checklistTemplates.filter((tpl) => {
      if (checklistDeptFilter !== 'TODOS' && tpl.department !== checklistDeptFilter) {
        return false;
      }
      if (checklistSearchQuery.trim()) {
        const q = checklistSearchQuery.toLowerCase();
        const inName = tpl.name.toLowerCase().includes(q);
        const inDesc = (tpl.description || '').toLowerCase().includes(q);
        const inItems = tpl.items.some((item) => item.toLowerCase().includes(q));
        const inDept = tpl.department.toLowerCase().includes(q);
        if (!inName && !inDesc && !inItems && !inDept) return false;
      }
      return true;
    });
  }, [checklistTemplates, checklistDeptFilter, checklistSearchQuery]);

  const checklistKpis = useMemo(() => {
    const total = checklistTemplates.length;
    const contabeis = checklistTemplates.filter((c) => c.department === 'Contábil').length;
    const fiscais = checklistTemplates.filter((c) => c.department === 'Fiscal').length;
    const gerais = checklistTemplates.filter((c) => c.department === 'Geral').length;
    const totalSteps = checklistTemplates.reduce((acc, c) => acc + c.items.length, 0);
    const avgSteps = total > 0 ? (totalSteps / total).toFixed(1) : '0';
    return { total, contabeis, fiscais, gerais, totalSteps, avgSteps };
  }, [checklistTemplates]);

  const openCreateTemplateModal = () => {
    const nextNum = taskTemplates.length + 1;
    const suggestedCode = `CTB-${String(nextNum).padStart(2, '0')}`;
    setEditingTemplateId(null);
    setTemplateForm({
      standardCode: suggestedCode,
      department: 'Contábil',
      group: 'Fechamento de resultado',
      subGroup: 'IFRS',
      title: '',
      topic: 'Fechamento de resultado',
      accountingType: 'IFRS',
      defaultCompetenceType: 'MENSAL',
      defaultCompetence: 'Mensal',
      defaultDueDate: '10',
      recurrence: 'MENSAL',
      defaultAssignee: currentUser,
      defaultReviewer: 'Rogério',
      defaultCompanyScope: 'ALL',
      customBranches: ['010101'],
      isCritical: false,
      checklistKey: '',
      customChecklistText: '',
      defaultEvidencePath: `G:\\Contabilidade\\2026\\10_Outubro\\${suggestedCode}_Conciliacao`,
      standardNotes: ''
    });
    setIsTemplateModalOpen(true);
  };

  const openEditTemplateModal = (tpl: any) => {
    const norm = normalizeTemplateRecord(tpl);
    setEditingTemplateId(norm.id);
    setTemplateForm({
      standardCode: norm.standardCode || '',
      department: norm.department || 'Contábil',
      group: norm.group || 'Fechamento de resultado',
      subGroup: norm.subGroup || 'IFRS',
      title: norm.title || '',
      topic: norm.group || 'Fechamento de resultado',
      accountingType: norm.subGroup || 'IFRS',
      defaultCompetenceType: norm.recurrence || 'MENSAL',
      defaultCompetence: RECURRENCE_CONFIG[norm.recurrence || 'MENSAL']?.label || 'Mensal',
      defaultDueDate: extractTemplateDueDay(norm.defaultDueDate),
      recurrence: norm.recurrence || 'MENSAL',
      defaultAssignee: norm.defaultAssignee || 'Jhennifer',
      defaultReviewer: norm.defaultReviewer || 'Rogério',
      defaultCompanyScope: norm.defaultCompanyScope || 'ALL',
      customBranches: Array.isArray(norm.customBranches) && norm.customBranches.length > 0 ? norm.customBranches : ['010101'],
      isCritical: !!norm.isCritical,
      checklistKey: norm.checklistKey || '',
      customChecklistText: Array.isArray(norm.customChecklistItems) ? norm.customChecklistItems.join('\n') : '',
      defaultEvidencePath: norm.defaultEvidencePath || '',
      standardNotes: norm.standardNotes || ''
    });
    setIsTemplateModalOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.title.trim() || !templateForm.standardCode.trim()) return;

    const now = Date.now();
    const id = editingTemplateId || `TPL-${now}`;
    const customItems = templateForm.customChecklistText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const rec = templateForm.recurrence || 'MENSAL';
    const competenceLabel = RECURRENCE_CONFIG[rec]?.label || 'Mensal';
    const dueRuleText = formatTemplateDueRule(rec, templateForm.defaultDueDate);

    const savedTemplate = sanitizeForFirestore({
      id,
      standardCode: templateForm.standardCode.trim().toUpperCase().slice(0, 32),
      department: (templateForm.department || 'Contábil').slice(0, 64),
      group: (templateForm.group || 'Fechamento de resultado').slice(0, 120),
      subGroup: (templateForm.subGroup || 'IFRS').slice(0, 120),
      title: templateForm.title.trim().slice(0, 500),
      topic: (templateForm.group || 'Fechamento de resultado').slice(0, 120),
      accountingType: (templateForm.subGroup || 'IFRS').slice(0, 64),
      defaultCompetenceType: rec === 'ANUAL' ? 'ANUAL' : 'MENSAL',
      defaultCompetence: competenceLabel.slice(0, 32),
      defaultDueDate: dueRuleText.slice(0, 120),
      recurrence: rec,
      defaultAssignee: templateForm.defaultAssignee.slice(0, 64),
      defaultReviewer: (templateForm.defaultReviewer || 'Rogério').slice(0, 64),
      defaultCompanyScope: templateForm.defaultCompanyScope,
      customBranches: templateForm.customBranches,
      isCritical: !!templateForm.isCritical,
      checklistKey: templateForm.checklistKey || '',
      customChecklistItems: customItems,
      defaultEvidencePath: templateForm.defaultEvidencePath.trim().slice(0, 500),
      standardNotes: templateForm.standardNotes.trim().slice(0, 1000),
      ...(fbUser ? { ownerUid: fbUser.uid } : {})
    });

    setTaskTemplates((prev) => {
      const exists = prev.some((t) => t.id === id);
      const next = exists ? prev.map((t) => (t.id === id ? savedTemplate : t)) : [...prev, savedTemplate];
      next.sort((a, b) => String(a.standardCode || '').localeCompare(String(b.standardCode || '')));
      return next;
    });

    if (isNewTaskModalOpen) {
      applyTemplateToNewTaskForm(savedTemplate);
    }

    if (fbUser && fbUser.emailVerified) {
      try {
        await setDoc(doc(db, 'task_templates', id), savedTemplate);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `task_templates/${id}`);
      }
    }

    setIsTemplateModalOpen(false);
  };

  const handleDeleteTemplate = async (tplId: string) => {
    setTaskTemplates((prev) => prev.filter((t) => t.id !== tplId));
    if (fbUser && fbUser.emailVerified) {
      try {
        await deleteDoc(doc(db, 'task_templates', tplId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `task_templates/${tplId}`);
      }
    }
  };

  const instantiateTaskFromTemplate = async (
    tplRaw: any,
    startNow = false,
    customPeriod?: { competence: string; competenceType: string; dueDate: string }
  ) => {
    const tpl = normalizeTemplateRecord(tplRaw);
    const now = Date.now() + Math.floor(Math.random() * 999);
    let applicableBranches = BRANCH_CODES;
    if (tpl.defaultCompanyScope === 'MATRIZ_010101') applicableBranches = ['010101'];
    else if (tpl.defaultCompanyScope === 'HOLDING_040101') applicableBranches = ['040101'];
    else if (tpl.defaultCompanyScope === 'CUSTOM' && Array.isArray(tpl.customBranches) && tpl.customBranches.length > 0) {
      applicableBranches = tpl.customBranches;
    }

    const initialBranchMap: Record<string, string> = {};
    BRANCH_CODES.forEach((bCode) => {
      if (applicableBranches.includes(bCode)) {
        initialBranchMap[bCode] = startNow ? 'andamento' : 'p';
      } else {
        initialBranchMap[bCode] = 'n/a';
      }
    });

    const isAll = applicableBranches.length === BRANCH_CODES.length;
    const scopeDesc = isAll ? 'Todas as 40 Empresas' : `Empresa(s): ${applicableBranches.join(', ')}`;

    const baseChecklist = tpl.checklistKey
      ? CHECKLISTS_P1[tpl.checklistKey] || []
      : Array.isArray(tpl.customChecklistItems)
      ? tpl.customChecklistItems
      : [];

    const isAnual = tpl.recurrence === 'ANUAL';
    const finalCompetence = customPeriod?.competence || (isAnual ? '2025' : '10/2026');
    const finalCompetenceType = customPeriod?.competenceType || (isAnual ? 'ANUAL' : 'MENSAL');
    const finalDueDate = customPeriod?.dueDate || computeNextDueDateFromTemplate(tpl.defaultDueDate);

    const newTask = sanitizeForFirestore({
      id: `${tpl.standardCode}-${finalCompetence.replace('/', '')}-${now}`,
      templateId: tpl.id,
      code: tpl.standardCode,
      department: tpl.department || 'Contábil',
      group: tpl.group || 'Fechamento de resultado',
      subGroup: tpl.subGroup || 'IFRS',
      title: tpl.title.slice(0, 500),
      topic: tpl.group || 'Fechamento de resultado',
      accountingType: tpl.subGroup || 'IFRS',
      category: 'FECHAMENTO',
      competenceType: finalCompetenceType,
      competence: finalCompetence,
      dueDate: finalDueDate,
      recurrence: tpl.recurrence || 'MENSAL',
      assignee: tpl.defaultAssignee || currentUser,
      originalAssignee: currentUser,
      reviewer: tpl.defaultReviewer || 'Rogério',
      status: startNow ? 'EM_ANDAMENTO' : 'PENDENTE',
      isCritical: !!tpl.isCritical,
      totalSeconds: 0,
      timerStartedAt: startNow ? now : null,
      activeTimerUser: startNow ? tpl.defaultAssignee || currentUser : null,
      activeTimerScope: isAll ? 'ALL' : 'INDIVIDUAL',
      activeTimerBranches: applicableBranches,
      pauseReason: null,
      dependencyInfo: null,
      branches: initialBranchMap,
      branchDetails: {},
      checklistKey: tpl.checklistKey || null,
      customChecklistItems: Array.isArray(tpl.customChecklistItems) ? tpl.customChecklistItems : [],
      checklistState: baseChecklist.map(() => false),
      timeByUser: {},
      evidenceUrl: tpl.defaultEvidencePath || '',
      comments: tpl.standardNotes
        ? [
            {
              id: `c-${now}`,
              author: currentUser,
              text: `[Padrão do Catálogo • ${tpl.standardCode} • Comp: ${finalCompetence}] ${tpl.standardNotes}`,
              createdAt: new Date(now).toISOString()
            }
          ]
        : [],
      ...(fbUser ? { ownerUid: fbUser.uid } : {})
    });

    const logEntry = sanitizeForFirestore({
      id: `log-${now}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date(now).toISOString(),
      user: currentUser,
      targetUser: newTask.assignee !== currentUser ? newTask.assignee : null,
      taskCode: newTask.code,
      taskTitle: newTask.title,
      companyScope: scopeDesc,
      type: 'CRIACAO_PADRAO',
      details: `Gerou obrigação padronizada [${newTask.code}] (${newTask.department} • ${newTask.group} > ${newTask.subGroup} • Comp: ${newTask.competence} • Venc: ${newTask.dueDate.split('-').reverse().join('/')} • Recorrência: ${RECURRENCE_CONFIG[newTask.recurrence]?.label || newTask.recurrence}) para [${scopeDesc}] (@${newTask.assignee}).`,
      durationSeconds: null,
      ...(fbUser ? { ownerUid: fbUser.uid } : {})
    });

    setTasks((prev) => [newTask, ...prev]);
    setAuditLogs((prev) => [logEntry, ...prev]);

    if (fbUser && fbUser.emailVerified) {
      try {
        await setDoc(doc(db, 'tasks_10_2026', newTask.id), newTask);
        await setDoc(doc(db, 'logs_10_2026', logEntry.id), logEntry);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `tasks_10_2026/${newTask.id}`);
      }
    }
  };

  const handleGenerateMissingClosingTasks = async () => {
    const refComp = competenceFilter !== 'TODOS' ? competenceFilter : '10/2026';
    const [mPart, yPart] = refComp.includes('/') ? refComp.split('/') : ['10', refComp];
    const missingTemplates = taskTemplates.filter(
      (tpl) =>
        !tasks.some(
          (t) =>
            (t.templateId === tpl.id || t.code === tpl.standardCode) &&
            (t.competence || '10/2026') === refComp
        )
    );
    for (const tpl of missingTemplates) {
      await instantiateTaskFromTemplate(tpl, false, {
        competence: refComp,
        competenceType: tpl.recurrence === 'ANUAL' ? 'ANUAL' : 'MENSAL',
        dueDate: computeDueDateForCompetenceMonth(tpl.defaultDueDate, mPart || '10', yPart || '2026', 'SAME_MONTH')
      });
    }
    setActiveTab('LISTA');
  };

  const openAutoGenerateModal = (presetMonth = '11', presetYear = '2026') => {
    const isQuarterEnd = ['03', '06', '09', '12'].includes(presetMonth);
    const isYearEnd = presetMonth === '12';
    setAutoGenParams((prev) => ({
      ...prev,
      targetMonth: presetMonth,
      targetYear: presetYear,
      includeMensal: true,
      includeTrimestral: isQuarterEnd,
      includeAnual: isYearEnd,
      includeEsporadica: false,
      excludedTemplateIds: []
    }));
    setIsAutoGenerateModalOpen(true);
  };

  const handleSelectAutoGenMonthYear = (newMonth: string, newYear: string) => {
    const isQuarterEnd = ['03', '06', '09', '12'].includes(newMonth);
    const isYearEnd = newMonth === '12';
    setAutoGenParams((prev) => ({
      ...prev,
      targetMonth: newMonth,
      targetYear: newYear,
      includeTrimestral: isQuarterEnd,
      includeAnual: isYearEnd,
      excludedTemplateIds: []
    }));
  };

  const autoGenTargetCompetence = `${autoGenParams.targetMonth}/${autoGenParams.targetYear}`;

  const autoGenPreviewList = useMemo(() => {
    return taskTemplates
      .filter((tpl) => {
        const dept = tpl.department || 'Contábil';
        if (autoGenParams.departmentScope !== 'TODOS' && dept !== autoGenParams.departmentScope) {
          return false;
        }
        const rec = (tpl.recurrence || 'MENSAL').toUpperCase();
        if (rec === 'MENSAL' && !autoGenParams.includeMensal) return false;
        if (rec === 'TRIMESTRAL' && !autoGenParams.includeTrimestral) return false;
        if (rec === 'ANUAL' && !autoGenParams.includeAnual) return false;
        if (rec === 'ESPORADICA' && !autoGenParams.includeEsporadica) return false;
        return true;
      })
      .map((tpl) => {
        const alreadyExists = tasks.some(
          (t) =>
            (t.templateId === tpl.id || t.code === tpl.standardCode) &&
            (t.competence || '10/2026') === autoGenTargetCompetence
        );
        const calculatedDueDate = computeDueDateForCompetenceMonth(
          tpl.defaultDueDate,
          autoGenParams.targetMonth,
          autoGenParams.targetYear,
          autoGenParams.dueMonthRule
        );
        const dueDayStr = extractTemplateDueDay(tpl.defaultDueDate);
        const isManuallyExcluded = autoGenParams.excludedTemplateIds.includes(tpl.id);
        const isSkippedByDuplicate = autoGenParams.skipExisting && alreadyExists;
        const willGenerate = !isManuallyExcluded && !isSkippedByDuplicate;

        return {
          tpl,
          alreadyExists,
          calculatedCompetence: autoGenTargetCompetence,
          calculatedDueDate,
          dueDayStr,
          isManuallyExcluded,
          willGenerate
        };
      });
  }, [taskTemplates, tasks, autoGenParams, autoGenTargetCompetence]);

  const handleExecuteAutoGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    const itemsToCreate = autoGenPreviewList.filter((item) => item.willGenerate);
    if (itemsToCreate.length === 0) return;

    for (const item of itemsToCreate) {
      await instantiateTaskFromTemplate(item.tpl, false, {
        competence: item.calculatedCompetence,
        competenceType: item.tpl.recurrence === 'ANUAL' ? 'ANUAL' : 'MENSAL',
        dueDate: item.calculatedDueDate
      });
    }

    setCompetenceFilter(autoGenTargetCompetence);
    setAutoGenFeedback({
      competence: autoGenTargetCompetence,
      count: itemsToCreate.length,
      dueRuleLabel:
        autoGenParams.dueMonthRule === 'NEXT_MONTH'
          ? 'Vencimento no mês subsequente à competência'
          : 'Vencimento dentro do próprio mês da competência'
    });
    setIsAutoGenerateModalOpen(false);
    setActiveTab('LISTA');
  };

  const availableCompetences = useMemo(() => {
    const set = new Set<string>(['10/2026', '11/2026', '12/2026', '01/2027', '2025']);
    tasks.forEach((t) => {
      if (t.competence) set.add(String(t.competence));
    });
    return Array.from(set).sort((a, b) => {
      const parseComp = (c: string) => {
        if (c.includes('/')) {
          const [m, y] = c.split('/');
          return parseInt(y, 10) * 100 + parseInt(m, 10);
        }
        return parseInt(c, 10) * 100;
      };
      return parseComp(a) - parseComp(b);
    });
  }, [tasks]);

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
    const prefix = isAvulsa ? 'AVU' : newTaskForm.department === 'Fiscal' ? 'FIS' : 'CTB';
    const countSameType = tasks.filter((t) => t.code.startsWith(prefix)).length + 1;
    const code =
      !isAvulsa && newTaskForm.standardCode
        ? newTaskForm.standardCode
        : `${prefix}-${String(countSameType).padStart(2, '0')}`;

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

    const baseChecklist = newTaskForm.checklistKey
      ? CHECKLISTS_P1[newTaskForm.checklistKey] || []
      : Array.isArray(newTaskForm.customChecklistItems)
      ? newTaskForm.customChecklistItems
      : [];

    const department = newTaskForm.department || 'Contábil';
    const group = newTaskForm.group || newTaskForm.topic || 'Fechamento de resultado';
    const subGroup = newTaskForm.subGroup || newTaskForm.accountingType || 'Societário';
    const competenceType = newTaskForm.competenceType || 'MENSAL';
    const competence = (newTaskForm.competence || (competenceType === 'ANUAL' ? '2025' : '10/2026')).trim();
    const recurrence = newTaskForm.recurrence || (isAvulsa ? 'ESPORADICA' : 'MENSAL');

    const newTask = {
      id: `${code}-${now}`,
      templateId: !isAvulsa ? newTaskForm.templateId || null : null,
      code,
      title: newTaskForm.title.trim().slice(0, 500),
      department,
      group,
      subGroup,
      topic: group,
      accountingType: subGroup,
      category: newTaskForm.category,
      competenceType,
      competence,
      dueDate: newTaskForm.dueDate || '2026-10-30',
      recurrence,
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
      checklistKey: newTaskForm.checklistKey || null,
      customChecklistItems: Array.isArray(newTaskForm.customChecklistItems) ? newTaskForm.customChecklistItems : [],
      checklistState: baseChecklist.map(() => false),
      timeByUser: {},
      evidenceUrl: newTaskForm.evidenceUrl || '',
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
      type: isAvulsa ? 'CRIACAO' : 'CRIACAO_PADRAO',
      details: `Criou ${isAvulsa ? 'Tarefa Avulsa' : 'Obrigação Padronizada'} [${code}] (${department} • ${group} > ${subGroup} | Comp: ${competence} | Recorrência: ${RECURRENCE_CONFIG[recurrence]?.label || recurrence} | Venc: ${newTask.dueDate.split('-').reverse().join('/')}) atribuída a @${newTask.assignee}.`,
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

  const reminders24hData = useMemo(() => {
    const refDateStr = analysisRefDate || '2026-10-30';
    const refParts = refDateStr.split('-').map(Number);
    const now = new Date();
    const refTimestamp = new Date(
      refParts[0] || 2026,
      (refParts[1] || 10) - 1,
      refParts[2] || 30,
      now.getHours(),
      now.getMinutes(),
      now.getSeconds()
    ).getTime();

    const activeTasks = tasks.filter((t) => t.status !== 'CONCLUIDA');

    const mapped = activeTasks.map((t) => {
      let dueTimestamp: number;
      const dueStr = t.dueDate || '2026-10-30';
      if (dueStr.includes('T')) {
        dueTimestamp = new Date(dueStr).getTime();
      } else {
        const parts = dueStr.split('-').map(Number);
        dueTimestamp = new Date(parts[0], (parts[1] || 10) - 1, parts[2] || 30, 23, 59, 59).getTime();
      }

      const diffMs = dueTimestamp - refTimestamp;
      const diffHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
      const isOverdue = diffHours < 0;
      const isDueToday = dueStr === refDateStr;
      const isWithin24h = (diffHours >= 0 && diffHours <= 24) || isDueToday;
      const isMine = t.assignee === currentUser;
      const isDismissed = dismissedReminderIds.includes(t.id);

      let urgencyLevel: 'CRITICA_24H' | 'HOJE' | 'AMANHA_24H' | 'ATRASADA' | 'FUTURA' = 'FUTURA';
      let urgencyBadge = '';
      let countdownLabel = '';
      let relativeDueLabel = '';

      if (isOverdue) {
        urgencyLevel = 'ATRASADA';
        const absH = Math.abs(Math.round(diffHours));
        countdownLabel = `Atrasada há ${absH}h`;
        relativeDueLabel = `Venceu em ${dueStr.split('-').reverse().join('/')}`;
        urgencyBadge = 'bg-rose-600 text-white animate-pulse';
      } else if (isDueToday || diffHours <= 12) {
        urgencyLevel = 'CRITICA_24H';
        countdownLabel = diffHours <= 0 ? 'Vence agora!' : `Vence em ~${Math.ceil(diffHours)}h (Hoje)`;
        relativeDueLabel = 'Vence Hoje às 23:59';
        urgencyBadge = 'bg-amber-500 text-slate-950 font-black animate-pulse';
      } else if (diffHours <= 24) {
        urgencyLevel = 'AMANHA_24H';
        countdownLabel = `Vence em ~${Math.ceil(diffHours)}h (Próx. 24h)`;
        relativeDueLabel = 'Vence em menos de 24h';
        urgencyBadge = 'bg-orange-500 text-white font-bold animate-pulse';
      } else {
        urgencyLevel = 'FUTURA';
        countdownLabel = `Vence em ${Math.round(diffHours / 24)} dias`;
        relativeDueLabel = `Vence em ${dueStr.split('-').reverse().join('/')}`;
        urgencyBadge = 'bg-slate-200 text-slate-700';
      }

      const branchStats = calculateBranchStats(t.branches);
      const liveSeconds = getLiveTaskSeconds(t);

      return {
        task: t,
        dueTimestamp,
        diffHours,
        isOverdue,
        isDueToday,
        isWithin24h,
        isMine,
        isDismissed,
        urgencyLevel,
        urgencyBadge,
        countdownLabel,
        relativeDueLabel,
        branchStats,
        liveSeconds
      };
    });

    const urgentItems = mapped
      .filter((item) => (item.isWithin24h || item.isOverdue) && !item.isDismissed)
      .sort((a, b) => a.diffHours - b.diffHours);

    const strictlyNext24h = urgentItems.filter((i) => i.isWithin24h && !i.isOverdue);
    const overdueItems = urgentItems.filter((i) => i.isOverdue);
    const myUrgentItems = urgentItems.filter((i) => i.isMine);
    const criticalItems = urgentItems.filter((i) => i.task.isCritical);

    const remindersMap: Record<string, any> = {};
    mapped.forEach((item) => {
      if (item.isWithin24h || item.isOverdue) {
        remindersMap[item.task.id] = item;
      }
    });

    return {
      allMapped: mapped,
      urgentItems,
      strictlyNext24h,
      overdueItems,
      myUrgentItems,
      criticalItems,
      totalCount: urgentItems.length,
      myCount: myUrgentItems.length,
      overdueCount: overdueItems.length,
      strictly24hCount: strictlyNext24h.length,
      expiring24hCount: strictlyNext24h.length,
      remindersMap
    };
  }, [tasks, analysisRefDate, currentUser, dismissedReminderIds, nowTick]);

  const handleDismissReminder = (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDismissedReminderIds((prev) => [...new Set([...prev, taskId])]);
  };

  const handleResetDismissedReminders = () => {
    setDismissedReminderIds([]);
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (activeTab === 'AVULSAS' && t.category !== 'AVULSA') return false;

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
      if (departmentFilter !== 'TODOS' && (t.department || 'Contábil') !== departmentFilter) return false;
      if (topicFilter !== 'TODOS' && (t.group || t.topic) !== topicFilter) return false;
      if (subGroupFilter !== 'TODOS' && (t.subGroup || t.accountingType) !== subGroupFilter) return false;
      if (recurrenceFilter !== 'TODOS' && (t.recurrence || 'MENSAL') !== recurrenceFilter) return false;
      if (competenceFilter !== 'TODOS' && (t.competence || '10/2026') !== competenceFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = t.code.toLowerCase().includes(q);
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchGroup = (t.group || t.topic || '').toLowerCase().includes(q);
        const matchSubGroup = (t.subGroup || t.accountingType || '').toLowerCase().includes(q);
        const matchDepartment = (t.department || '').toLowerCase().includes(q);
        const matchCompetence = (t.competence || '').toLowerCase().includes(q);
        const matchAssignee = t.assignee.toLowerCase().includes(q);
        const matchDep = t.dependencyInfo?.reason?.toLowerCase().includes(q);
        if (!matchCode && !matchTitle && !matchGroup && !matchSubGroup && !matchDepartment && !matchCompetence && !matchAssignee && !matchDep) return false;
      }

      return true;
    });
  }, [tasks, activeTab, activeOperatorFilter, quickFilter, userFilter, statusFilter, departmentFilter, topicFilter, subGroupFilter, recurrenceFilter, competenceFilter, searchQuery, currentUser]);

  const filteredTemplates = useMemo(() => {
    return taskTemplates.filter((tpl) => {
      if (templateDepartmentFilter !== 'TODOS' && (tpl.department || 'Contábil') !== templateDepartmentFilter) {
        return false;
      }
      if (!templateSearchQuery.trim()) return true;
      const q = templateSearchQuery.toLowerCase();
      return (
        tpl.standardCode?.toLowerCase().includes(q) ||
        tpl.title?.toLowerCase().includes(q) ||
        tpl.department?.toLowerCase().includes(q) ||
        (tpl.group || tpl.topic || '').toLowerCase().includes(q) ||
        (tpl.subGroup || tpl.accountingType || '').toLowerCase().includes(q) ||
        tpl.defaultCompetence?.toLowerCase().includes(q) ||
        tpl.defaultAssignee?.toLowerCase().includes(q)
      );
    });
  }, [taskTemplates, templateSearchQuery, templateDepartmentFilter]);

  const unlaunchedTemplatesCount = useMemo(() => {
    return taskTemplates.filter(
      (tpl) => !tasks.some((t) => t.templateId === tpl.id || t.code === tpl.standardCode)
    ).length;
  }, [taskTemplates, tasks]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

  const activeMemberObj = TEAM_MEMBERS.find((m) => m.id === currentUser) || TEAM_MEMBERS[0];

  const handleSelectRoleView = (
    role: 'ADMINISTRADOR' | 'COORDENADOR' | 'ANALISTA',
    targetUserId?: string
  ) => {
    setActiveRoleView(role);

    if (targetUserId) {
      setCurrentUser(targetUserId);
    } else {
      const currentMember = TEAM_MEMBERS.find((m) => m.id === currentUser);
      if (!currentMember || currentMember.category !== role) {
        const matchingMember = TEAM_MEMBERS.find((m) => m.category === role && m.status !== 'INATIVO');
        if (matchingMember) {
          setCurrentUser(matchingMember.id);
        }
      }
    }

    if (role === 'ANALISTA') {
      const targetAnalyst =
        targetUserId ||
        (TEAM_MEMBERS.find((m) => m.id === currentUser)?.category === 'ANALISTA'
          ? currentUser
          : TEAM_MEMBERS.find((m) => m.category === 'ANALISTA')?.id || currentUser);
      setActiveOperatorFilter(targetAnalyst);
      setQuickFilter('MINHAS');
      if (activeTab === 'USUARIOS' || activeTab === 'CADASTRO_PADRAO' || activeTab === 'HISTORICO') {
        setActiveTab('LISTA');
      }
    } else if (role === 'COORDENADOR') {
      setActiveOperatorFilter('TODOS');
      setQuickFilter('TODAS');
      if (activeTab === 'USUARIOS') {
        setActiveTab('DASHBOARD');
      }
    } else {
      setActiveOperatorFilter('TODOS');
      setQuickFilter('TODAS');
    }
  };

  const myPersonalMetrics = useMemo(() => {
    const found = (kpis.userMetrics as any[]).find((u) => u.id === currentUser);
    if (found) return found;
    return {
      id: currentUser,
      name: currentUser,
      totalAssigned: 0,
      concluidas: 0,
      emAndamento: 0,
      pausadas: 0,
      aguardandoDep: 0,
      pendentes: 0,
      secondsSpent: 0
    };
  }, [kpis.userMetrics, currentUser]);

  const slaAnalysisData = useMemo(() => {
    const refParts = (analysisRefDate || '2026-10-30').split('-').map(Number);
    const refTime = new Date(refParts[0] || 2026, (refParts[1] || 10) - 1, refParts[2] || 30, 12, 0, 0).getTime();

    const baseFiltered = tasks.filter((t) => {
      if (analysisDeptFilter !== 'TODOS' && (t.department || 'Contábil') !== analysisDeptFilter) return false;
      if (analysisCompetenceFilter !== 'TODAS' && (t.competence || '10/2026') !== analysisCompetenceFilter) return false;
      if (analysisAssigneeFilter !== 'TODOS' && t.assignee !== analysisAssigneeFilter) return false;
      if (analysisSearchQuery.trim()) {
        const q = analysisSearchQuery.toLowerCase();
        const match =
          (t.code || '').toLowerCase().includes(q) ||
          (t.title || '').toLowerCase().includes(q) ||
          (t.group || t.topic || '').toLowerCase().includes(q) ||
          (t.subGroup || t.accountingType || '').toLowerCase().includes(q) ||
          (t.assignee || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    const enrichedTasks = baseFiltered.map((t) => {
      const dueStr = t.dueDate || '2026-10-30';
      const dueParts = dueStr.split('-').map(Number);
      const dueTime = new Date(dueParts[0] || 2026, (dueParts[1] || 10) - 1, dueParts[2] || 30, 12, 0, 0).getTime();
      const diffDays = Math.round((dueTime - refTime) / (1000 * 60 * 60 * 24));

      let slaBucket: 'ENTREGUE' | 'ATRASADA' | 'VENCE_HOJE' | 'PROXIMAS_3_DIAS' | 'NO_PRAZO' = 'NO_PRAZO';
      let slaLabel = '';
      let slaBadgeCls = '';

      if (t.status === 'CONCLUIDA') {
        slaBucket = 'ENTREGUE';
        slaLabel = 'Entregue / Concluída';
        slaBadgeCls = 'bg-emerald-100 text-emerald-900 border-emerald-300';
      } else if (diffDays < 0) {
        slaBucket = 'ATRASADA';
        const daysLate = Math.abs(diffDays);
        slaLabel = `Atrasada há ${daysLate} ${daysLate === 1 ? 'dia' : 'dias'}`;
        slaBadgeCls = 'bg-rose-100 text-rose-900 border-rose-300';
      } else if (diffDays === 0) {
        slaBucket = 'VENCE_HOJE';
        slaLabel = 'Vence Hoje';
        slaBadgeCls = 'bg-amber-100 text-amber-900 border-amber-300';
      } else if (diffDays <= 3) {
        slaBucket = 'PROXIMAS_3_DIAS';
        slaLabel = `Vence em ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
        slaBadgeCls = 'bg-orange-100 text-orange-900 border-orange-300';
      } else {
        slaBucket = 'NO_PRAZO';
        slaLabel = `No prazo (${diffDays} dias)`;
        slaBadgeCls = 'bg-sky-100 text-sky-900 border-sky-300';
      }

      const branchStats = calculateBranchStats(t.branches);
      const liveSeconds = getLiveTaskSeconds(t);

      return {
        ...t,
        diffDays,
        slaBucket,
        slaLabel,
        slaBadgeCls,
        branchStats,
        liveSeconds
      };
    });

    const total = enrichedTasks.length;
    const entregues = enrichedTasks.filter((t) => t.slaBucket === 'ENTREGUE').length;
    const atrasadas = enrichedTasks.filter((t) => t.slaBucket === 'ATRASADA').length;
    const venceHoje = enrichedTasks.filter((t) => t.slaBucket === 'VENCE_HOJE').length;
    const proximas3Dias = enrichedTasks.filter((t) => t.slaBucket === 'PROXIMAS_3_DIAS').length;
    const noPrazo = enrichedTasks.filter((t) => t.slaBucket === 'NO_PRAZO').length;
    const emAndamento = enrichedTasks.filter((t) => t.status === 'EM_ANDAMENTO').length;
    const bloqueadas = enrichedTasks.filter(
      (t) => t.status === 'AGUARDANDO_DEPENDENCIA' || t.status === 'PAUSADA'
    ).length;
    const criticasAbertas = enrichedTasks.filter((t) => t.isCritical && t.status !== 'CONCLUIDA').length;
    const totalSeconds = enrichedTasks.reduce((acc, t) => acc + t.liveSeconds, 0);
    const avgSecondsPerTask = total > 0 ? Math.round(totalSeconds / total) : 0;
    const pctEntregue = total > 0 ? Math.round((entregues / total) * 100) : 0;

    // Distribuição por Analista
    const byAnalyst = TEAM_MEMBERS.map((m) => {
      const mTasks = enrichedTasks.filter((t) => t.assignee === m.id);
      const mTotal = mTasks.length;
      const mEntregues = mTasks.filter((t) => t.slaBucket === 'ENTREGUE').length;
      const mAtrasadas = mTasks.filter((t) => t.slaBucket === 'ATRASADA').length;
      const mVenceHoje = mTasks.filter((t) => t.slaBucket === 'VENCE_HOJE').length;
      const mProximas = mTasks.filter((t) => t.slaBucket === 'PROXIMAS_3_DIAS').length;
      const mAndamento = mTasks.filter((t) => t.status === 'EM_ANDAMENTO').length;
      const mDep = mTasks.filter((t) => t.status === 'AGUARDANDO_DEPENDENCIA').length;
      const mPausadas = mTasks.filter((t) => t.status === 'PAUSADA').length;
      const mSeconds = mTasks.reduce((acc, t) => acc + t.liveSeconds, 0);
      const mPct = mTotal > 0 ? Math.round((mEntregues / mTotal) * 100) : 0;
      const shareOfTeam = total > 0 ? Math.round((mTotal / total) * 100) : 0;

      return {
        ...m,
        total: mTotal,
        entregues: mEntregues,
        atrasadas: mAtrasadas,
        venceHoje: mVenceHoje,
        proximas: mProximas,
        emAndamento: mAndamento,
        aguardandoDep: mDep,
        pausadas: mPausadas,
        secondsSpent: mSeconds,
        pctEntregue: mPct,
        shareOfTeam
      };
    });

    // Distribuição por Departamento e Grupo
    const groupMap: Record<string, any> = {};
    enrichedTasks.forEach((t) => {
      const dept = t.department || 'Contábil';
      const grp = t.group || t.topic || 'Geral';
      const key = `${dept}:::${grp}`;
      if (!groupMap[key]) {
        groupMap[key] = {
          key,
          department: dept,
          group: grp,
          total: 0,
          entregues: 0,
          atrasadas: 0,
          venceHoje: 0,
          pendentes: 0,
          seconds: 0
        };
      }
      groupMap[key].total += 1;
      if (t.slaBucket === 'ENTREGUE') groupMap[key].entregues += 1;
      else groupMap[key].pendentes += 1;
      if (t.slaBucket === 'ATRASADA') groupMap[key].atrasadas += 1;
      if (t.slaBucket === 'VENCE_HOJE') groupMap[key].venceHoje += 1;
      groupMap[key].seconds += t.liveSeconds;
    });

    const byGroup = Object.values(groupMap).map((g: any) => ({
      ...g,
      pct: g.total > 0 ? Math.round((g.entregues / g.total) * 100) : 0
    }));

    // Lista final filtrada pela faixa de SLA selecionada e ordenada por urgência (atrasadas primeiro, depois vencimento mais próximo)
    const tableTasks = enrichedTasks
      .filter((t) => {
        if (analysisSlaFilter === 'TODAS') return true;
        if (analysisSlaFilter === 'ATRASADAS') return t.slaBucket === 'ATRASADA';
        if (analysisSlaFilter === 'VENCE_HOJE') return t.slaBucket === 'VENCE_HOJE';
        if (analysisSlaFilter === 'PROXIMAS_3_DIAS') return t.slaBucket === 'PROXIMAS_3_DIAS';
        if (analysisSlaFilter === 'NO_PRAZO') return t.slaBucket === 'NO_PRAZO';
        if (analysisSlaFilter === 'ENTREGUES') return t.slaBucket === 'ENTREGUE';
        if (analysisSlaFilter === 'BLOQUEADAS')
          return t.status === 'AGUARDANDO_DEPENDENCIA' || t.status === 'PAUSADA';
        if (analysisSlaFilter === 'CRITICAS') return Boolean(t.isCritical);
        return true;
      })
      .sort((a, b) => {
        if (a.status === 'CONCLUIDA' && b.status !== 'CONCLUIDA') return 1;
        if (a.status !== 'CONCLUIDA' && b.status === 'CONCLUIDA') return -1;
        return a.diffDays - b.diffDays;
      });

    const distinctCompetences = Array.from(new Set(tasks.map((t) => t.competence || '10/2026'))).sort();

    return {
      total,
      entregues,
      atrasadas,
      venceHoje,
      proximas3Dias,
      noPrazo,
      emAndamento,
      bloqueadas,
      criticasAbertas,
      totalSeconds,
      avgSecondsPerTask,
      pctEntregue,
      byAnalyst,
      byGroup,
      tableTasks,
      distinctCompetences
    };
  }, [
    tasks,
    TEAM_MEMBERS,
    analysisRefDate,
    analysisDeptFilter,
    analysisCompetenceFilter,
    analysisAssigneeFilter,
    analysisSlaFilter,
    analysisSearchQuery,
    nowTick
  ]);

  const sidebarNavSections = useMemo(() => {
    const rawSections = [
      {
        id: 'DASHBOARDS_SECTION',
        title: 'PAINEL RESUMO & DASHBOARDS',
        shortTitle: 'Dashboards',
        items: [
          {
            id: 'ANALISE_SLA',
            label: 'Painel de Análise & SLA',
            subLabel: 'Entregas, Prazos & Lembretes 24h',
            icon: Calendar,
            badge:
              slaAnalysisData.atrasadas + slaAnalysisData.venceHoje > 0
                ? `${slaAnalysisData.atrasadas + slaAnalysisData.venceHoje} alerta(s)`
                : `${slaAnalysisData.pctEntregue}%`,
            badgeCls:
              slaAnalysisData.atrasadas > 0
                ? 'bg-rose-500 text-white animate-pulse'
                : slaAnalysisData.venceHoje > 0
                ? 'bg-amber-400 text-slate-950 font-black'
                : 'bg-emerald-600 text-white font-bold',
            roles: ['ADMINISTRADOR', 'COORDENADOR', 'ANALISTA']
          },
          {
            id: 'DASHBOARD',
            label: activeRoleView === 'COORDENADOR' ? 'Supervisão: Filiais & Equipe' : 'Painel por Empresa & Analista',
            subLabel: 'Supervisão de Desempenho',
            icon: LayoutDashboard,
            badge: null,
            badgeCls: '',
            roles: ['ADMINISTRADOR', 'COORDENADOR', 'ANALISTA']
          }
        ]
      },
      {
        id: 'ACOMPANHAMENTO_SECTION',
        title: 'ACOMPANHAMENTO DE TAREFAS',
        shortTitle: 'Operação',
        items: [
          {
            id: 'LISTA',
            label: activeRoleView === 'ANALISTA' ? 'Minha Bancada (Cards)' : 'Bancada de Tarefas (Cards)',
            subLabel: 'Cards operacionais com timer',
            icon: ListTodo,
            badge: activeRoleView === 'ANALISTA' ? myPersonalMetrics.totalAssigned : kpis.total,
            badgeCls: 'bg-slate-700 text-slate-200',
            roles: ['ADMINISTRADOR', 'COORDENADOR', 'ANALISTA']
          },
          {
            id: 'MATRIZ',
            label: activeRoleView === 'ANALISTA' ? 'Minha Planilha 40 Filiais' : 'Matriz 40 Empresas (Planilha)',
            subLabel: 'Visão matricial por filial',
            icon: Building2,
            badge: `${activeScopedBranches.length} filiais`,
            badgeCls: 'bg-emerald-700/80 text-emerald-100',
            roles: ['ADMINISTRADOR', 'COORDENADOR', 'ANALISTA']
          },
          {
            id: 'KANBAN',
            label: 'Quadro Kanban',
            subLabel: 'Fluxo por status e colunas',
            icon: Columns,
            badge: null,
            badgeCls: '',
            roles: ['ADMINISTRADOR', 'COORDENADOR', 'ANALISTA']
          },
          {
            id: 'AVULSAS',
            label: 'Demandas Avulsas',
            subLabel: 'Chamados e auditorias extras',
            icon: Zap,
            badge: kpis.avulsasCount,
            badgeCls: 'bg-amber-500 text-slate-950 font-bold',
            roles: ['ADMINISTRADOR', 'COORDENADOR', 'ANALISTA']
          }
        ]
      },
      {
        id: 'CADASTRO_TAREFAS_SECTION',
        title: 'CADASTRO DE TAREFAS',
        shortTitle: 'Tarefas',
        items: [
          {
            id: 'CADASTRO_PADRAO',
            label: 'Catálogo de Tarefas Padrão',
            subLabel: 'Cadastro mestre & automação mensal',
            icon: BookOpen,
            badge: taskTemplates.length,
            badgeCls: 'bg-indigo-600 text-white font-bold',
            roles: ['ADMINISTRADOR', 'COORDENADOR']
          },
          {
            id: 'CHECKLIST_TEMPLATES',
            label: 'Modelos de Checklist',
            subLabel: 'Templates reutilizáveis por depto',
            icon: CheckSquare,
            badge: checklistTemplates.length,
            badgeCls: 'bg-purple-600 text-white font-bold',
            roles: ['ADMINISTRADOR', 'COORDENADOR', 'ANALISTA']
          }
        ]
      },
      {
        id: 'CADASTRO_EMPRESAS_SECTION',
        title: 'CADASTRO DE EMPRESAS',
        shortTitle: 'Empresas',
        items: [
          {
            id: 'EMPRESAS',
            label: 'Cadastro de Empresas (40 Filiais)',
            subLabel: 'CNPJ, Regime, Responsável e UF',
            icon: Building,
            badge: companies.length,
            badgeCls: 'bg-emerald-600 text-white font-bold',
            roles: ['ADMINISTRADOR', 'COORDENADOR', 'ANALISTA']
          }
        ]
      },
      {
        id: 'CADASTRO_USUARIOS_SECTION',
        title: 'CADASTRO DE USUÁRIOS',
        shortTitle: 'Usuários',
        items: [
          {
            id: 'USUARIOS',
            label: 'Cadastro & Gestão de Usuários',
            subLabel: 'Admin, Coordenador e Analista',
            icon: Users,
            badge: TEAM_MEMBERS.length,
            badgeCls: 'bg-rose-500 text-white font-bold',
            roles: ['ADMINISTRADOR']
          }
        ]
      },
      {
        id: 'AUDITORIA_SECTION',
        title: 'GOVERNANÇA & AUDITORIA',
        shortTitle: 'Auditoria',
        items: [
          {
            id: 'HISTORICO',
            label: 'Auditoria & Logs',
            subLabel: 'Trilha de ações e RACI',
            icon: History,
            badge: auditLogs.length,
            badgeCls: 'bg-slate-700 text-slate-300 font-mono',
            roles: ['ADMINISTRADOR', 'COORDENADOR']
          }
        ]
      }
    ];

    return rawSections
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((item) => item.roles.includes(activeRoleView))
      }))
      .filter((sec) => sec.items.length > 0);
  }, [
    activeRoleView,
    slaAnalysisData.atrasadas,
    slaAnalysisData.venceHoje,
    slaAnalysisData.pctEntregue,
    kpis.total,
    kpis.avulsasCount,
    myPersonalMetrics.totalAssigned,
    activeScopedBranches.length,
    taskTemplates.length,
    companies.length,
    TEAM_MEMBERS.length,
    auditLogs.length
  ]);

  const roleTabs = useMemo(() => {
    return sidebarNavSections.flatMap((s) => s.items);
  }, [sidebarNavSections]);

  const roleHeaderAccent =
    activeRoleView === 'ADMINISTRADOR'
      ? 'border-rose-500/40 from-slate-950 via-slate-900 to-rose-950/70'
      : activeRoleView === 'COORDENADOR'
      ? 'border-amber-500/40 from-slate-950 via-slate-900 to-indigo-950/80'
      : 'border-emerald-500/40 from-slate-950 via-slate-900 to-emerald-950/70';

  return (
    <div className="min-h-screen bg-slate-100/80 text-slate-900 flex flex-col font-sans">
      {/* ==========================================
          HEADER CORPORATIVO COM SEGREGAÇÃO DE VISÃO (ADMIN / COORDENADOR / ANALISTA)
      ========================================== */}
      <header className={`bg-gradient-to-r ${roleHeaderAccent} text-white border-b sticky top-0 z-30 shadow-md`}>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          {/* Toggle do Menu Lateral + Identidade & Status */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                  setIsMobileSidebarOpen((prev) => !prev);
                } else {
                  setIsSidebarCollapsed((prev) => !prev);
                }
              }}
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700/80 cursor-pointer transition-all flex items-center justify-center shrink-0 shadow-xs hover:border-slate-500"
              title="Recolher / Expandir Menu Lateral"
            >
              <Menu className="w-5 h-5 text-white" />
            </button>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
                activeRoleView === 'ADMINISTRADOR'
                  ? 'bg-gradient-to-br from-rose-500 to-indigo-600 shadow-rose-950/50'
                  : activeRoleView === 'COORDENADOR'
                  ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-950/50'
                  : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-950/50'
              }`}
            >
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                  Task Account — Gestão de Tarefas de Controladoria
                </h1>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold border ${
                    activeRoleView === 'ADMINISTRADOR'
                      ? 'bg-rose-500/20 text-rose-200 border-rose-400/40'
                      : activeRoleView === 'COORDENADOR'
                      ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                      : 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                  }`}
                >
                  {activeRoleView === 'ADMINISTRADOR'
                    ? '🛡️ AMBIENTE ADMINISTRADOR'
                    : activeRoleView === 'COORDENADOR'
                    ? '🧭 AMBIENTE COORDENADOR'
                    : '⚙️ AMBIENTE ANALISTA'}
                </span>
                <span className="hidden xl:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  Competência {competenceFilter === 'TODAS' || competenceFilter === 'TODOS' ? 'Geral' : competenceFilter}
                </span>
                {cloudSynced ? (
                  <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    <ShieldCheck className="w-3 h-3" /> Firestore Ativo
                  </span>
                ) : (
                  <button
                    onClick={handleGoogleSignIn}
                    className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition-colors"
                    title="Conectar conta Google para sincronizar no Firebase Firestore"
                  >
                    <LogIn className="w-3 h-3 text-emerald-400" /> Sincronizar Nuvem
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* SELETOR DE VISÃO POR PERFIL (ADMINISTRADOR | COORDENADOR | ANALISTA) */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center bg-slate-950/90 p-1 rounded-xl border border-slate-700/80 shadow-inner">
              <button
                onClick={() => handleSelectRoleView('ADMINISTRADOR')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeRoleView === 'ADMINISTRADOR'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                }`}
                title="Visão de Governança, Usuários, Catálogo Padrão e Parametrização"
              >
                <span>🛡️</span>
                <span>Administrador</span>
              </button>
              <button
                onClick={() => handleSelectRoleView('COORDENADOR')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeRoleView === 'COORDENADOR'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                }`}
                title="Visão de Supervisão da Equipe, Geração de Lote Mensal e Gargalos"
              >
                <span>🧭</span>
                <span>Coordenador</span>
              </button>
              <button
                onClick={() => handleSelectRoleView('ANALISTA')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeRoleView === 'ANALISTA'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                }`}
                title="Visão Focada de Execução Pessoal, Checklist e Cronômetro do Analista"
              >
                <span>⚙️</span>
                <span>Analista</span>
              </button>
            </div>

            {/* Sininho de Notificações com Sistema de Lembretes 24h & Menções */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications((prev) => !prev)}
                className={`relative p-2 rounded-lg transition-all cursor-pointer border ${
                  reminders24hData.totalCount > 0
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/50 hover:bg-amber-500/30 ring-1 ring-amber-400/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
                title={`Notificações: ${reminders24hData.totalCount} lembretes (< 24h) e ${myNotifications.length} menções`}
              >
                {reminders24hData.totalCount > 0 ? (
                  <BellRing className="w-4 h-4 text-amber-300 animate-pulse" />
                ) : (
                  <Bell className="w-4 h-4" />
                )}
                {reminders24hData.totalCount + myNotifications.length > 0 && (
                  <span
                    className={`absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full text-[10px] font-black flex items-center justify-center text-white ${
                      reminders24hData.totalCount > 0
                        ? 'bg-rose-500 ring-2 ring-rose-300 animate-pulse'
                        : 'bg-purple-500'
                    }`}
                  >
                    {reminders24hData.totalCount + myNotifications.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-[460px] bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {/* Cabeçalho do Dropdown com Tabs */}
                  <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
                    <div className="flex items-center gap-1.5 p-0.5 bg-slate-950 rounded-xl border border-slate-800">
                      <button
                        onClick={() => setNotificationTab('LEMBRETES')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                          notificationTab === 'LEMBRETES'
                            ? 'bg-amber-500 text-slate-950 shadow-xs'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <AlarmClock className="w-3.5 h-3.5" />
                        <span>Lembretes 24h</span>
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                            notificationTab === 'LEMBRETES' ? 'bg-slate-900 text-amber-300' : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {reminders24hData.totalCount}
                        </span>
                      </button>

                      <button
                        onClick={() => setNotificationTab('MENCOES')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                          notificationTab === 'MENCOES'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <AtSign className="w-3.5 h-3.5" />
                        <span>Menções (@)</span>
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                            notificationTab === 'MENCOES' ? 'bg-purple-900 text-purple-200' : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {myNotifications.length}
                        </span>
                      </button>
                    </div>

                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-slate-400 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-slate-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* CONTEÚDO DA TAB: LEMBRETES 24H */}
                  {notificationTab === 'LEMBRETES' && (
                    <div>
                      {/* Sub-filtro: Minhas tarefas vs Todas */}
                      <div className="bg-amber-50/70 px-4 py-2 border-b border-amber-200/60 flex items-center justify-between text-xs">
                        <span className="font-extrabold text-amber-950 flex items-center gap-1.5">
                          <Hourglass className="w-3.5 h-3.5 text-amber-600" />
                          Tarefas com prazo nas próximas 24h:
                        </span>
                        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-amber-300 text-[11px] font-bold">
                          <button
                            onClick={() => setReminderFilterScope('TODAS')}
                            className={`px-2 py-0.5 rounded cursor-pointer ${
                              reminderFilterScope === 'TODAS'
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Equipe ({reminders24hData.totalCount})
                          </button>
                          <button
                            onClick={() => setReminderFilterScope('MINHAS')}
                            className={`px-2 py-0.5 rounded cursor-pointer ${
                              reminderFilterScope === 'MINHAS'
                                ? 'bg-amber-500 text-slate-950 font-black'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Minhas ({reminders24hData.myCount})
                          </button>
                        </div>
                      </div>

                      <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                        {reminders24hData.urgentItems.filter((i) =>
                          reminderFilterScope === 'MINHAS' ? i.isMine : true
                        ).length === 0 ? (
                          <div className="p-8 text-center space-y-2">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                            <p className="text-xs font-bold text-slate-700">
                              Nenhuma tarefa com prazo para as próximas 24 horas!
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Todas as obrigações imediatas estão em dia ou concluídas.
                            </p>
                            {dismissedReminderIds.length > 0 && (
                              <button
                                onClick={handleResetDismissedReminders}
                                className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer pt-1"
                              >
                                Reexibir {dismissedReminderIds.length} lembrete(s) dispensado(s)
                              </button>
                            )}
                          </div>
                        ) : (
                          reminders24hData.urgentItems
                            .filter((i) => (reminderFilterScope === 'MINHAS' ? i.isMine : true))
                            .map((item) => {
                              const t = item.task;
                              const member = TEAM_MEMBERS.find((m) => m.id === t.assignee) || TEAM_MEMBERS[0];
                              return (
                                <div
                                  key={t.id}
                                  className="p-3.5 hover:bg-slate-50 transition-colors space-y-2 text-xs"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-bold text-[10px]">
                                        {t.code}
                                      </span>
                                      <span
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-black ${item.urgencyBadge}`}
                                      >
                                        {item.countdownLabel}
                                      </span>
                                      {t.isCritical && (
                                        <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-extrabold border border-rose-200">
                                          Crítica
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      onClick={(e) => handleDismissReminder(t.id, e)}
                                      className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                                      title="Dispensar este alerta"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  <button
                                    onClick={() => {
                                      setSelectedTaskId(t.id);
                                      setShowNotifications(false);
                                    }}
                                    className="text-left font-bold text-slate-900 hover:text-indigo-600 block line-clamp-2 cursor-pointer"
                                  >
                                    {t.title}
                                  </button>

                                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={`w-5 h-5 rounded-full ${member.color} text-white text-[9px] font-extrabold flex items-center justify-center`}
                                      >
                                        {member.avatar}
                                      </span>
                                      <span className="font-bold text-slate-800">@{t.assignee}</span>
                                      <span>• Filiais: {item.branchStats.percent}%</span>
                                    </div>

                                    <div className="flex items-center gap-1">
                                      {t.status !== 'EM_ANDAMENTO' && t.status !== 'CONCLUIDA' && (
                                        <button
                                          onClick={() => handleStartTask(t)}
                                          className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                        >
                                          <Play className="w-2.5 h-2.5 fill-white" /> Iniciar
                                        </button>
                                      )}
                                      {t.status !== 'CONCLUIDA' && (
                                        <button
                                          onClick={() => handleCompleteTask(t)}
                                          className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                          title="Concluir Obrigação"
                                        >
                                          <Check className="w-3 h-3" /> Concluir
                                        </button>
                                      )}
                                      <button
                                        onClick={() => {
                                          setSelectedTaskId(t.id);
                                          setShowNotifications(false);
                                        }}
                                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold cursor-pointer"
                                      >
                                        Abrir
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                        )}
                      </div>

                      {/* Footer com atalho para o Painel de SLA e Central de Lembretes */}
                      <div className="bg-slate-50 p-2.5 border-t border-slate-200 flex items-center justify-between text-xs">
                        <button
                          onClick={() => {
                            setIsReminderModalOpen(true);
                            setShowNotifications(false);
                          }}
                          className="font-extrabold text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <AlarmClock className="w-3.5 h-3.5" />
                          <span>Ver Central de Lembretes Completa</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveTab('ANALISE_SLA');
                            setAnalysisSlaFilter('VENCE_HOJE');
                            setShowNotifications(false);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] cursor-pointer"
                        >
                          Filtrar no Painel →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* CONTEÚDO DA TAB: MENÇÕES (@) */}
                  {notificationTab === 'MENCOES' && (
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {myNotifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400">
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
                  )}
                </div>
              )}
            </div>

            {/* SELETOR DE CARTEIRA EXIBIDA (FILTRO DE TAREFAS POR INTEGRANTE) */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5" title="Filtrar tarefas exibidas pela carteira de um integrante ou ver toda a equipe">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/90 text-white font-bold text-xs flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5 text-indigo-100" />
              </div>
              <div className="text-left">
                <div className="text-[10px] text-slate-400 leading-none">
                  Carteira Exibida:
                </div>
                <select
                  value={activeOperatorFilter}
                  onChange={(e) => setActiveOperatorFilter(e.target.value)}
                  className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
                >
                  <option value="TODOS" className="bg-slate-900 text-white">
                    👥 Toda a Equipe ({TEAM_MEMBERS.length} integrantes)
                  </option>
                  {TEAM_MEMBERS.map((m) => (
                    <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                      Somente @{m.name} ({USER_CATEGORIES_CONFIG[m.category || 'ANALISTA']?.shortLabel || 'Analista'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* SELETOR DE OPERADOR ATIVO SINCRONIZADO COM A CATEGORIA */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5">
              <div className={`w-7 h-7 rounded-lg ${activeOperatorFilter === 'TODOS' ? 'bg-indigo-600' : activeMemberObj.color} text-white font-bold text-xs flex items-center justify-center`}>
                {activeOperatorFilter === 'TODOS' ? activeMemberObj.avatar : activeMemberObj.avatar}
              </div>
              <div className="text-left">
                <div className="text-[10px] text-slate-400 leading-none flex items-center gap-1">
                  <span>Operador:</span>
                  <span className="text-emerald-400 font-bold">
                    {USER_CATEGORIES_CONFIG[activeMemberObj.category || 'ANALISTA']?.shortLabel || 'Analista'}
                  </span>
                </div>
                <select
                  value={currentUser}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCurrentUser(val);
                    const member = TEAM_MEMBERS.find((m) => m.id === val);
                    if (member) {
                      const cat = (member.category || 'ANALISTA') as 'ADMINISTRADOR' | 'COORDENADOR' | 'ANALISTA';
                      handleSelectRoleView(cat, val);
                    }
                  }}
                  className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
                >
                  {TEAM_MEMBERS.map((m) => (
                    <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                      @{m.name} ({USER_CATEGORIES_CONFIG[m.category || 'ANALISTA']?.shortLabel || 'Analista'})
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
      </header>

      {/* ==========================================
          LAYOUT PRINCIPAL: MENU LATERAL (SIDEBAR) & WORKSPACE
      ========================================== */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* DESKTOP SIDEBAR */}
        <aside
          className={`hidden lg:flex flex-col bg-slate-900 border-r border-slate-800 text-slate-300 transition-all duration-300 shrink-0 z-20 shadow-xl select-none ${
            isSidebarCollapsed ? 'w-20' : 'w-72'
          }`}
        >
          {/* Topo do Sidebar */}
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
            {!isSidebarCollapsed ? (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Navegação Principal
                </span>
              </div>
            ) : (
              <div className="w-full flex justify-center">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer transition-colors"
              title={isSidebarCollapsed ? 'Expandir Menu Lateral' : 'Recolher Menu Lateral'}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* AÇÕES RÁPIDAS NO MENU LATERAL: + NOVA TAREFA & GERAR LOTE DO MÊS */}
          <div className="p-2 border-b border-slate-800 bg-slate-950/40 space-y-1.5">
            {!isSidebarCollapsed ? (
              <>
                <button
                  type="button"
                  onClick={() => openNewTaskModal(activeRoleView === 'ANALISTA' ? 'AVULSA' : 'FECHAMENTO')}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold text-xs shadow-md shadow-emerald-950/40 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                  title="Criar uma nova tarefa contábil ou operacional"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>{activeRoleView === 'ANALISTA' ? '+ Lançar Tarefa' : '+ Nova Tarefa'}</span>
                </button>

                {(activeRoleView === 'ADMINISTRADOR' || activeRoleView === 'COORDENADOR') && (
                  <button
                    type="button"
                    onClick={() => openAutoGenerateModal('11', '2026')}
                    className="w-full py-2 px-3 rounded-xl bg-indigo-600/90 hover:bg-indigo-500 text-white border border-indigo-500/40 font-bold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                    title="Gerar automaticamente as tarefas recorrentes para o mês selecionado"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Gerar Lote do Mês</span>
                  </button>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-1.5 py-0.5">
                <button
                  type="button"
                  onClick={() => openNewTaskModal(activeRoleView === 'ANALISTA' ? 'AVULSA' : 'FECHAMENTO')}
                  className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-md cursor-pointer transition-transform hover:scale-105"
                  title={activeRoleView === 'ANALISTA' ? '+ Lançar Tarefa' : '+ Nova Tarefa'}
                >
                  <Plus className="w-5 h-5 stroke-[3]" />
                </button>
                {(activeRoleView === 'ADMINISTRADOR' || activeRoleView === 'COORDENADOR') && (
                  <button
                    type="button"
                    onClick={() => openAutoGenerateModal('11', '2026')}
                    className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-md cursor-pointer transition-transform hover:scale-105 border border-indigo-400/40"
                    title="Gerar Lote do Mês"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Lista de Seções Segregadas */}
          <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
            {sidebarNavSections.map((section) => (
              <div key={section.id} className="space-y-1">
                {/* Cabeçalho da Seção */}
                {!isSidebarCollapsed ? (
                  <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400/90 flex items-center justify-between">
                    <span>{section.title}</span>
                  </div>
                ) : (
                  <div className="h-px bg-slate-800 my-2 mx-2" title={section.title} />
                )}

                {/* Itens da Seção */}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center rounded-xl transition-all cursor-pointer group text-left ${
                          isSidebarCollapsed ? 'p-2.5 justify-center' : 'px-3 py-2.5 gap-3'
                        } ${
                          isActive
                            ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-bold shadow-md shadow-indigo-950/40 ring-1 ring-indigo-400/30'
                            : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                        }`}
                        title={isSidebarCollapsed ? `${item.label} ${item.badge ? `(${item.badge})` : ''}` : undefined}
                      >
                        <div
                          className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-800/80 text-slate-400 group-hover:text-white group-hover:bg-slate-700'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>

                        {!isSidebarCollapsed && (
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-xs font-bold truncate leading-tight">{item.label}</span>
                              {item.badge !== null && (
                                <span
                                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-black shrink-0 ${
                                    isActive
                                      ? 'bg-white text-indigo-900 shadow-2xs'
                                      : item.badgeCls || 'bg-slate-800 text-slate-300'
                                  }`}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            {item.subLabel && (
                              <div
                                className={`text-[10px] truncate ${
                                  isActive ? 'text-indigo-100/90' : 'text-slate-400'
                                }`}
                              >
                                {item.subLabel}
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Rodapé do Sidebar: Operador Ativo */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/50">
            {!isSidebarCollapsed ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl ${activeMemberObj.color} text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-sm`}
                  >
                    {activeMemberObj.avatar}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-white truncate flex items-center gap-1">
                      <span>@{activeMemberObj.name}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {USER_CATEGORIES_CONFIG[activeMemberObj.category || 'ANALISTA']?.label || 'Analista'}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[9px] uppercase font-bold text-slate-400">Entregas</div>
                  <div className="font-mono text-[11px] font-bold text-emerald-400">
                    {myPersonalMetrics.concluidas}/{myPersonalMetrics.totalAssigned} ({myPersonalMetrics.percent}%)
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-center" title={`@${activeMemberObj.name} (${USER_CATEGORIES_CONFIG[activeMemberObj.category || 'ANALISTA']?.label})`}>
                <div
                  className={`w-8 h-8 rounded-xl ${activeMemberObj.color} text-white font-extrabold text-xs flex items-center justify-center shadow-sm`}
                >
                  {activeMemberObj.avatar}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* MOBILE DRAWER OVERLAY */}
        {isMobileSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 text-white shadow-2xl z-10">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-emerald-400" />
                  <span className="font-extrabold text-sm text-white">Menu do Sistema</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Ações Rápidas Mobile */}
              <div className="p-3 border-b border-slate-800 space-y-2 bg-slate-950/40">
                <button
                  type="button"
                  onClick={() => {
                    openNewTaskModal(activeRoleView === 'ANALISTA' ? 'AVULSA' : 'FECHAMENTO');
                    setIsMobileSidebarOpen(false);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>{activeRoleView === 'ANALISTA' ? '+ Lançar Tarefa' : '+ Nova Tarefa'}</span>
                </button>
                {(activeRoleView === 'ADMINISTRADOR' || activeRoleView === 'COORDENADOR') && (
                  <button
                    type="button"
                    onClick={() => {
                      openAutoGenerateModal('11', '2026');
                      setIsMobileSidebarOpen(false);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/40 font-bold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Gerar Lote do Mês</span>
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {sidebarNavSections.map((section) => (
                  <div key={section.id} className="space-y-1">
                    <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {section.title}
                    </div>
                    <div className="space-y-0.5">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setActiveTab(item.id);
                              setIsMobileSidebarOpen(false);
                            }}
                            className={`w-full flex items-center px-3 py-2.5 rounded-xl transition-all gap-3 text-left ${
                              isActive
                                ? 'bg-indigo-600 text-white font-bold shadow-md'
                                : 'text-slate-300 hover:bg-slate-800/80'
                            }`}
                          >
                            <Icon className="w-4 h-4 shrink-0 text-slate-300" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold truncate">{item.label}</span>
                                {item.badge !== null && (
                                  <span
                                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-black shrink-0 ${
                                      isActive
                                        ? 'bg-white text-indigo-900'
                                        : item.badgeCls || 'bg-slate-800 text-slate-300'
                                    }`}
                                  >
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* WORKSPACE PRINCIPAL */}
        <div className="flex-1 min-w-0 overflow-y-auto flex flex-col">
          {/* Sub-header Dinâmico com Troca Rápida de Visão, Radar do Perfil e Métricas */}
          <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2.5 shadow-2xs sticky top-0 z-20">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white font-extrabold flex items-center gap-1.5 shadow-2xs">
                {(() => {
                  const currTab = roleTabs.find((t) => t.id === activeTab);
                  if (currTab) {
                    const Icon = currTab.icon;
                    return (
                      <>
                        <Icon className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{currTab.label}</span>
                      </>
                    );
                  }
                  return <span>Bancada de Tarefas</span>;
                })()}
              </span>

              {/* Seletor Dinâmico de Modo de Operação (Acesso em 1 clique) */}
              <div className="hidden md:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('LISTA');
                    setTaskListDensity('CARDS');
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    (activeTab === 'LISTA' || activeTab === 'AVULSAS') && taskListDensity === 'CARDS'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ListTodo className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Cards</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('LISTA');
                    setTaskListDensity('TABELA');
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    (activeTab === 'LISTA' || activeTab === 'AVULSAS') && taskListDensity === 'TABELA'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>Tabela Rápida</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('MATRIZ')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    activeTab === 'MATRIZ'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Matriz 40 Filiais</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('KANBAN')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    activeTab === 'KANBAN'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5 text-purple-600" />
                  <span>Kanban</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('ANALISE_SLA')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    activeTab === 'ANALISE_SLA'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  <span>SLA & Prazos</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Botão de Expansão do Radar do Perfil (Admin / Coordenador / Analista) */}
              <button
                type="button"
                onClick={() => setIsRoleOverviewExpanded((prev) => !prev)}
                className={`px-2.5 py-1 rounded-lg border font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer ${
                  isRoleOverviewExpanded
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
                title="Expandir ou recolher o painel resumo do perfil e carga da equipe"
              >
                <Users className="w-3.5 h-3.5 text-indigo-500" />
                <span>
                  Radar {activeRoleView === 'ADMINISTRADOR' ? 'Admin' : activeRoleView === 'COORDENADOR' ? 'Coordenador' : 'Analista'}
                </span>
                <span className="text-[10px] opacity-75">{isRoleOverviewExpanded ? '▲' : '▼'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('LISTA');
                  setStatusFilter('EM_ANDAMENTO');
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                title="Filtrar tarefas em andamento"
              >
                <Play className="w-3.5 h-3.5 text-blue-600 fill-blue-600" />
                <span className="text-blue-800 hidden sm:inline">Em Andamento:</span>
                <span className="font-bold text-blue-900 tabular-nums">
                  {kpis.emAndamento}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('LISTA');
                  if (activeRoleView === 'ANALISTA') {
                    setQuickFilter('DEPENDENCIA_COMIGO');
                  } else {
                    setStatusFilter('AGUARDANDO_DEPENDENCIA');
                  }
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors cursor-pointer"
                title="Filtrar tarefas aguardando dependência (@)"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-purple-600" />
                <span className="text-purple-800 hidden sm:inline">Dep. (@):</span>
                <span className="font-bold text-purple-900 tabular-nums">
                  {activeRoleView === 'ANALISTA' ? kpis.dependenciaComigo : kpis.aguardandoDep}
                </span>
              </button>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-bold text-emerald-900 tabular-nums">
                  {activeRoleView === 'ANALISTA'
                    ? `${myPersonalMetrics.concluidas}/${myPersonalMetrics.totalAssigned} (${
                        myPersonalMetrics.totalAssigned > 0
                          ? Math.round((myPersonalMetrics.concluidas / myPersonalMetrics.totalAssigned) * 100)
                          : 0
                      }%)`
                    : `${kpis.concluidas}/${kpis.total} (${kpis.percentConcluido}%)`}
                </span>
              </div>
            </div>
          </div>

          <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-4 space-y-4">
        {/* ========================================================
            BARRA COMPACTA E DINÂMICA DE ALERTA 24 HORAS / VENCIMENTO
        ======================================================== */}
        {reminders24hData.totalCount > 0 && !isReminderBannerDismissed && (
          <div
            className={`transition-all duration-200 rounded-xl border ${
              reminders24hData.overdueCount > 0
                ? 'bg-gradient-to-r from-rose-950 via-slate-900 to-slate-900 border-rose-500/70'
                : 'bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 border-amber-500/70'
            } text-white shadow-sm px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5`}
          >
            <div className="flex flex-wrap items-center gap-2.5 min-w-0">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider shrink-0 ${
                  reminders24hData.overdueCount > 0
                    ? 'bg-rose-500 text-white'
                    : 'bg-amber-400 text-slate-950'
                }`}
              >
                <AlarmClock className="w-3.5 h-3.5 animate-pulse" />
                <span>
                  {reminders24hData.overdueCount > 0
                    ? `${reminders24hData.overdueCount} Vencida(s) + ${reminders24hData.expiring24hCount} em 24h`
                    : `${reminders24hData.totalCount} Prazo(s) em 24h`}
                </span>
              </span>

              {reminders24hData.myCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-200 border border-amber-400/40 text-[11px] font-bold shrink-0">
                  {reminders24hData.myCount} com @{currentUser}
                </span>
              )}

              {/* Chips clicáveis das tarefas urgentes */}
              <div className="hidden xl:flex items-center gap-1.5 overflow-x-auto">
                {reminders24hData.urgentItems.slice(0, 3).map((item) => (
                  <button
                    key={item.task.id}
                    type="button"
                    onClick={() => setSelectedTaskId(item.task.id)}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-[11px] font-bold text-slate-200 transition-all cursor-pointer shrink-0"
                  >
                    <span className="font-mono text-amber-300">{item.task.code}</span>
                    <span className="truncate max-w-[130px] text-slate-100">{item.task.title}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                        item.isOverdue ? 'bg-rose-900 text-rose-200' : 'bg-amber-900 text-amber-200'
                      }`}
                    >
                      {item.countdownLabel}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsReminderModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>Central 24h ({reminders24hData.totalCount})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('ANALISE_SLA');
                  setAnalysisSlaFilter('VENCE_HOJE');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all cursor-pointer hidden sm:inline-flex items-center gap-1"
              >
                <span>Painel SLA</span>
              </button>
              <button
                type="button"
                onClick={() => setIsReminderBannerDismissed(true)}
                className="p-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
                title="Ocultar barra de alerta"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ==========================================
            PORTAL CONTEXTUAL SEGREGADO (EXPANSÍVEL PELO BOTÃO "RADAR" NO SUB-HEADER):
            1) VISÃO ADMINISTRADOR
            2) VISÃO COORDENADOR
            3) VISÃO ANALISTA
        ========================================== */}
        {isRoleOverviewExpanded && activeRoleView === 'ADMINISTRADOR' && (
          <div className="bg-white rounded-2xl border border-rose-200/90 shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-400/40 text-rose-200 text-xs font-extrabold">
                  🛡️ VISÃO DO ADMINISTRADOR
                </span>
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-white">
                    Centro de Governança, Parametrização Contábil/Fiscal & Controle de Acessos
                  </h2>
                  <p className="text-[11px] text-slate-300">
                    Acesso irrestrito ao Cadastro de Usuários (Admin, Coordenador, Analista), Catálogo Mestre de Tarefas Padrão, Geração Automática Mensal e Auditoria.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setActiveTab('USUARIOS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'USUARIOS'
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'bg-slate-800 hover:bg-slate-700 text-rose-200 border border-rose-500/30'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Gerir Usuários ({TEAM_MEMBERS.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab('CADASTRO_PADRAO')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'CADASTRO_PADRAO'
                      ? 'bg-indigo-500 text-white shadow-xs'
                      : 'bg-slate-800 hover:bg-slate-700 text-indigo-200 border border-indigo-500/30'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Catálogo Padrão ({taskTemplates.length})</span>
                </button>
                <button
                  onClick={() => openAutoGenerateModal('11', '2026')}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Parâmetro de Geração Mensal</span>
                </button>
                <button
                  onClick={() => setActiveTab('HISTORICO')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'HISTORICO'
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Trilha de Auditoria ({auditLogs.length})</span>
                </button>
              </div>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/60">
              <div
                onClick={() => setActiveTab('USUARIOS')}
                className="p-3 rounded-xl bg-white border border-slate-200 hover:border-rose-300 transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="text-[11px] font-bold uppercase text-rose-700">Quadro de Usuários & Perfis</div>
                  <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {TEAM_MEMBERS.length} Integrantes Ativos
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {TEAM_MEMBERS.filter((m) => m.category === 'ADMINISTRADOR').length} Admin •{' '}
                    {TEAM_MEMBERS.filter((m) => m.category === 'COORDENADOR').length} Coord •{' '}
                    {TEAM_MEMBERS.filter((m) => (m.category || 'ANALISTA') === 'ANALISTA').length} Analistas
                  </div>
                </div>
                <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
              </div>

              <div
                onClick={() => setActiveTab('CADASTRO_PADRAO')}
                className="p-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="text-[11px] font-bold uppercase text-indigo-700">Catálogo Padrão de Fechamento</div>
                  <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {taskTemplates.length} Obrigações Mapeadas
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {taskTemplates.filter((t) => (t.department || 'Contábil') === 'Contábil').length} Contábil •{' '}
                    {taskTemplates.filter((t) => t.department === 'Fiscal').length} Fiscal
                  </div>
                </div>
                <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold">
                  <BookOpen className="w-4 h-4" />
                </div>
              </div>

              <div
                onClick={() => openAutoGenerateModal('11', '2026')}
                className="p-3 rounded-xl bg-white border border-slate-200 hover:border-amber-300 transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="text-[11px] font-bold uppercase text-amber-800">Automação de Competências</div>
                  <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                    Gerador Recorrente Ativo
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Mensal, Trimestral, Anual e Esporádica
                  </div>
                </div>
                <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>

              <div
                onClick={() => setActiveTab('MATRIZ')}
                className="p-3 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="text-[11px] font-bold uppercase text-emerald-700">Cobertura Corporativa</div>
                  <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                    40 Filiais • {kpis.percentConcluido}% Concluído
                  </div>
                  <div className="text-[11px] text-slate-500">
                    010101 (Matriz) até 160101 (Holding/Filiais)
                  </div>
                </div>
                <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        )}

        {isRoleOverviewExpanded && activeRoleView === 'COORDENADOR' && (
          <div className="bg-white rounded-2xl border border-amber-300/90 shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-extrabold">
                  🧭 VISÃO DO COORDENADOR
                </span>
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-white">
                     Torre de Supervisão do Fechamento • Distribuição de Carga & Gargalos (@)
                  </h2>
                  <p className="text-[11px] text-slate-300">
                    Clique em qualquer analista abaixo para inspecionar sua carteira individual, redistribuir dependências (@) ou acompanhar cronômetros ativos.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setActiveOperatorFilter('TODOS');
                    setStatusFilter('TODOS');
                    setQuickFilter('TODAS');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    activeOperatorFilter === 'TODOS'
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  👥 Ver Equipe Completa
                </button>
                <button
                  onClick={() => {
                    setActiveTab('LISTA');
                    setStatusFilter('AGUARDANDO_DEPENDENCIA');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Gargalos & Dependências ({kpis.aguardandoDep})</span>
                </button>
                <button
                  onClick={() => setActiveTab('DASHBOARD')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Ranking 40 Filiais</span>
                </button>
                <button
                  onClick={() => openAutoGenerateModal('11', '2026')}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Gerar Tarefas do Mês</span>
                </button>
              </div>
            </div>

            {/* Radar de Carga de Trabalho por Integrante da Equipe */}
            <div className="p-4 bg-slate-50/70">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                  Carga Operacional por Integrante (Clique para filtrar a bancada do analista):
                </span>
                {activeOperatorFilter !== 'TODOS' && (
                  <button
                    onClick={() => setActiveOperatorFilter('TODOS')}
                    className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Limpar filtro de operador (@{activeOperatorFilter}) ✕
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(kpis.userMetrics as any[]).map((um) => {
                  const isFiltered = activeOperatorFilter === um.id;
                  const pct = um.totalAssigned > 0 ? Math.round((um.concluidas / um.totalAssigned) * 100) : 0;
                  const catCfg = USER_CATEGORIES_CONFIG[um.category || 'ANALISTA'] || USER_CATEGORIES_CONFIG.ANALISTA;
                  return (
                    <div
                      key={um.id}
                      onClick={() => {
                        setActiveOperatorFilter(isFiltered ? 'TODOS' : um.id);
                        if (activeTab === 'CADASTRO_PADRAO' || activeTab === 'HISTORICO') {
                          setActiveTab('LISTA');
                        }
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer bg-white ${
                        isFiltered
                          ? 'ring-2 ring-amber-500 border-amber-500 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-7 h-7 rounded-lg ${um.color} text-white text-xs font-extrabold flex items-center justify-center`}>
                            {um.avatar}
                          </span>
                          <div>
                            <div className="text-xs font-extrabold text-slate-900">@{um.name}</div>
                            <div className="text-[10px] text-slate-500">{catCfg.shortLabel} • {um.department || 'Contábil'}</div>
                          </div>
                        </div>
                        <span className="font-mono text-xs font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {pct}% Concluído
                        </span>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-700">
                          {um.concluidas}/{um.totalAssigned} concluídas ({pct}%)
                        </span>
                        {um.emAndamento > 0 ? (
                          <span className="inline-flex items-center gap-1 text-blue-700 font-extrabold">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
                            {um.emAndamento} ativa(s)
                          </span>
                        ) : um.aguardandoDep > 0 ? (
                          <span className="text-purple-700 font-bold">{um.aguardandoDep} dep. @</span>
                        ) : (
                          <span className="text-slate-400">{um.pendentes} pend.</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {isRoleOverviewExpanded && activeRoleView === 'ANALISTA' && (
          <div className="bg-white rounded-2xl border border-emerald-300/90 shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${activeMemberObj.color} text-white font-extrabold text-sm flex items-center justify-center shadow-md`}>
                  {activeMemberObj.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-extrabold">
                      ⚙️ BANCADA DO ANALISTA
                    </span>
                    <h2 className="text-sm sm:text-base font-extrabold text-white">
                      Olá, @{activeMemberObj.name} • {activeMemberObj.role} ({activeMemberObj.department || 'Contábil'})
                    </h2>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Ambiente focado na execução das suas obrigações, checklist de conciliação por filial e apontamento de horas em tempo real.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setActiveOperatorFilter(currentUser);
                    setQuickFilter('MINHAS');
                    setStatusFilter('TODOS');
                    setActiveTab('LISTA');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    activeOperatorFilter === currentUser && quickFilter === 'MINHAS'
                      ? 'bg-emerald-400 text-slate-950 shadow-xs'
                      : 'bg-slate-800 text-emerald-300 hover:bg-slate-700 border border-emerald-500/30'
                  }`}
                >
                  🎯 Focar na Minha Carteira ({myPersonalMetrics.totalAssigned})
                </button>
                <button
                  onClick={() => {
                    setActiveOperatorFilter('TODOS');
                    setQuickFilter('DEPENDENCIA_COMIGO');
                    setStatusFilter('TODOS');
                    setActiveTab('LISTA');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    quickFilter === 'DEPENDENCIA_COMIGO'
                      ? 'bg-purple-500 text-white'
                      : 'bg-slate-800 text-purple-300 hover:bg-slate-700 border border-purple-500/30'
                  }`}
                >
                  ⇄ Transferidas p/ Mim ({kpis.dependenciaComigo})
                </button>
                <button
                  onClick={() => {
                    setActiveOperatorFilter('TODOS');
                    setQuickFilter('TODAS');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeOperatorFilter === 'TODOS' && quickFilter === 'TODAS'
                      ? 'bg-white text-slate-900'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  🌐 Ver Todas da Equipe ({kpis.total})
                </button>
              </div>
            </div>

            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-emerald-50/30">
              <div
                onClick={() => {
                  setActiveOperatorFilter(currentUser);
                  setStatusFilter('TODOS');
                  setActiveTab('LISTA');
                }}
                className="p-3 rounded-xl bg-white border border-slate-200 hover:border-emerald-400 cursor-pointer"
              >
                <div className="text-[11px] font-bold text-slate-500 uppercase">Minha Carteira (@{currentUser})</div>
                <div className="text-xl font-extrabold text-slate-900 mt-1">{myPersonalMetrics.totalAssigned} tarefas</div>
                <div className="text-[11px] text-slate-500">{myPersonalMetrics.pendentes} aguardando início</div>
              </div>

              <div
                onClick={() => {
                  setActiveOperatorFilter(currentUser);
                  setStatusFilter('EM_ANDAMENTO');
                  setActiveTab('LISTA');
                }}
                className="p-3 rounded-xl bg-white border border-blue-200 hover:border-blue-400 cursor-pointer"
              >
                <div className="text-[11px] font-bold text-blue-700 uppercase">Em Execução Agora</div>
                <div className="text-xl font-extrabold text-blue-700 mt-1">{myPersonalMetrics.emAndamento} ativa(s)</div>
                <div className="text-[11px] text-blue-600 font-semibold">
                  {myPersonalMetrics.pausadas} pausada(s) c/ histórico
                </div>
              </div>

              <div
                onClick={() => {
                  setActiveOperatorFilter('TODOS');
                  setQuickFilter('DEPENDENCIA_COMIGO');
                  setActiveTab('LISTA');
                }}
                className="p-3 rounded-xl bg-white border border-purple-200 hover:border-purple-400 cursor-pointer"
              >
                <div className="text-[11px] font-bold text-purple-800 uppercase">Dependências Comigo (@)</div>
                <div className="text-xl font-extrabold text-purple-700 mt-1">{kpis.dependenciaComigo} pendente(s)</div>
                <div className="text-[11px] text-purple-600">Aguardando meu parecer/ação</div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-emerald-200">
                <div className="text-[11px] font-bold text-emerald-800 uppercase">Minhas Entregas</div>
                <div className="text-xl font-mono font-extrabold text-emerald-700 mt-1">
                  {myPersonalMetrics.percent}%
                </div>
                <div className="text-[11px] text-emerald-700 font-bold">
                  {myPersonalMetrics.concluidas}/{myPersonalMetrics.totalAssigned} tarefas concluídas
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CARDS DE STATUS RÁPIDOS GLOBAIS (Exibidos nas Visões Operacionais de Tarefas) */}
        {(['LISTA', 'MATRIZ', 'KANBAN', 'AVULSAS'].includes(activeTab)) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div
            onClick={() => { setStatusFilter('TODOS'); setQuickFilter('TODAS'); }}
            className={`p-3 rounded-xl border transition-all cursor-pointer bg-white hover:shadow-sm ${statusFilter === 'TODOS' && quickFilter === 'TODAS' ? 'ring-2 ring-slate-900 border-slate-900' : 'border-slate-200'}`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>TOTAL OBRIGAÇÕES</span>
              <Layers className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-xl font-extrabold text-slate-900 tabular-nums">{kpis.total}</span>
              <span className="text-[10px] text-slate-500">{kpis.fechamentoCount} Fech. + {kpis.avulsasCount} Avul.</span>
            </div>
          </div>

          <div
            onClick={() => { setStatusFilter('EM_ANDAMENTO'); setQuickFilter('TODAS'); }}
            className={`p-3 rounded-xl border transition-all cursor-pointer bg-white hover:shadow-sm ${statusFilter === 'EM_ANDAMENTO' ? 'ring-2 ring-blue-600 border-blue-600' : 'border-blue-200'}`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-blue-700">
              <span>INICIADAS / ATIVAS</span>
              <Play className="w-3.5 h-3.5 text-blue-600 fill-blue-600" />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-xl font-extrabold text-blue-700 tabular-nums">{kpis.emAndamento}</span>
              <span className="text-[10px] font-semibold text-blue-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" /> Timer ON
              </span>
            </div>
          </div>

          <div
            onClick={() => { setStatusFilter('PAUSADA'); setQuickFilter('TODAS'); }}
            className={`p-3 rounded-xl border transition-all cursor-pointer bg-white hover:shadow-sm ${statusFilter === 'PAUSADA' ? 'ring-2 ring-amber-500 border-amber-500' : 'border-amber-200'}`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-amber-800">
              <span>PAUSADAS</span>
              <Pause className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-xl font-extrabold text-amber-700 tabular-nums">{kpis.pausadas}</span>
              <span className="text-[10px] text-amber-700">Tempo salvo</span>
            </div>
          </div>

          <div
            onClick={() => { setStatusFilter('AGUARDANDO_DEPENDENCIA'); setQuickFilter('TODAS'); }}
            className={`p-3 rounded-xl border transition-all cursor-pointer bg-white hover:shadow-sm ${statusFilter === 'AGUARDANDO_DEPENDENCIA' ? 'ring-2 ring-purple-600 border-purple-600' : 'border-purple-200'}`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-purple-800">
              <span>DEPENDÊNCIA (@)</span>
              <ArrowRightLeft className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-xl font-extrabold text-purple-700 tabular-nums">{kpis.aguardandoDep}</span>
              <span className="text-[10px] font-bold text-purple-700">{kpis.dependenciaComigo} p/ @{currentUser}</span>
            </div>
          </div>

          <div
            onClick={() => { setStatusFilter('PENDENTE'); setQuickFilter('TODAS'); }}
            className={`p-3 rounded-xl border transition-all cursor-pointer bg-white hover:shadow-sm ${statusFilter === 'PENDENTE' ? 'ring-2 ring-slate-500 border-slate-500' : 'border-slate-200'}`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
              <span>NÃO INICIADAS</span>
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-xl font-extrabold text-slate-700 tabular-nums">{kpis.pendentes}</span>
              <span className="text-[10px] text-slate-500">Na fila</span>
            </div>
          </div>

          <div
            onClick={() => { setStatusFilter('CONCLUIDA'); setQuickFilter('TODAS'); }}
            className={`p-3 rounded-xl border transition-all cursor-pointer bg-white hover:shadow-sm ${statusFilter === 'CONCLUIDA' ? 'ring-2 ring-emerald-600 border-emerald-600' : 'border-emerald-200'}`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800">
              <span>CONCLUÍDAS</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-xl font-extrabold text-emerald-700 tabular-nums">{kpis.concluidas}</span>
              <span className="text-[10px] font-bold text-emerald-700">{kpis.percentConcluido}% entregue</span>
            </div>
          </div>
        </div>
        )}

        {/* ==========================================
            ABA: CADASTRO DE TAREFAS PADRÃO (CATÁLOGO DE FECHAMENTO RECORRENTE)
        ========================================== */}
        {activeTab === 'CADASTRO_PADRAO' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 text-white rounded-2xl p-5 border border-indigo-800/60 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Catálogo Mestre de Padronização Contábil & Fiscal</span>
                </div>
                <h2 className="text-base sm:text-lg font-extrabold text-white">
                  Cadastro de Tarefas Padrão de Fechamento ({taskTemplates.length} Obrigações Recorrentes)
                </h2>
                <p className="text-xs text-slate-300 max-w-3xl">
                  Padronização estruturada por <strong>Departamento (Contábil / Fiscal)</strong>, <strong>Grupo</strong>, <strong>Sub-Grupo</strong>, <strong>Descrição da Tarefa</strong>, <strong>Competência (Mensal ou Anual)</strong>, <strong>Vencimento</strong> e <strong>Recorrência (Esporádica, Mensal, Trimestral, Anual)</strong>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  onClick={() => setActiveTab('CHECKLIST_TEMPLATES')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                  title="Biblioteca de Modelos de Checklist Customizados & Reutilizáveis"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>Modelos de Checklist ({checklistTemplates.length})</span>
                </button>
                <button
                  onClick={() => openAutoGenerateModal('11', '2026')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow-sm transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Gerar Tarefas p/ Próximo Mês (Automático)</span>
                </button>
                {unlaunchedTemplatesCount > 0 && (
                  <button
                    onClick={handleGenerateMissingClosingTasks}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-sm transition-all cursor-pointer"
                  >
                    <CopyPlus className="w-4 h-4" />
                    <span>Gerar Faltantes ({unlaunchedTemplatesCount})</span>
                  </button>
                )}
                <button
                  onClick={openCreateTemplateModal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Cadastrar Nova Tarefa Padrão</span>
                </button>
              </div>
            </div>

            {/* Busca e Filtro por Departamento no Catálogo Padrão */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {['TODOS', ...DEPARTMENTS].map((dept) => (
                  <button
                    key={dept}
                    onClick={() => setTemplateDepartmentFilter(dept)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      templateDepartmentFilter === dept
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {dept === 'TODOS' ? 'Todos os Departamentos' : `Depto: ${dept}`}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 min-w-[260px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={templateSearchQuery}
                  onChange={(e) => setTemplateSearchQuery(e.target.value)}
                  placeholder="Buscar por código (CTB-01, FIS-01), departamento, grupo, sub-grupo, descrição..."
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
                />
              </div>
              <div className="text-xs text-slate-500 font-medium">
                Exibindo <strong>{filteredTemplates.length}</strong> de {taskTemplates.length} tarefas padrão cadastradas
              </div>
            </div>

            {/* Visão em Tabela (Planilha) do Cadastro de Tarefas Padrão */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    Tabela do Cadastro Mestre de Tarefas Padrão ({filteredTemplates.length} registros)
                  </h3>
                  <p className="text-xs text-slate-600">
                    Visão tabular padronizada por Departamento, Grupo, Sub-Grupo, Descrição da Tarefa, Competência, Vencimento e Recorrência.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="px-2 py-1 rounded bg-indigo-100 text-indigo-900 font-bold border border-indigo-300">Contábil</span>
                  <span className="px-2 py-1 rounded bg-teal-100 text-teal-900 font-bold border border-teal-300">Fiscal</span>
                  <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">✓ Ativa na Competência</span>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[72vh]">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="bg-slate-900 text-white sticky top-0 z-20">
                    <tr>
                      <th className="p-2.5 border-r border-slate-700 sticky left-0 bg-slate-900 z-30 min-w-[85px]">Código</th>
                      <th className="p-2.5 border-r border-slate-700 min-w-[110px]">Departamento</th>
                      <th className="p-2.5 border-r border-slate-700 min-w-[180px]">Grupo</th>
                      <th className="p-2.5 border-r border-slate-700 min-w-[130px]">Sub-Grupo</th>
                      <th className="p-2.5 border-r border-slate-700 min-w-[300px]">Descrição da Tarefa Padronizada</th>
                      <th className="p-2.5 border-r border-slate-700 min-w-[130px] text-center">Competência</th>
                      <th className="p-2.5 border-r border-slate-700 min-w-[260px]">Vencimento (Regra de Repetição)</th>
                      <th className="p-2.5 border-r border-slate-700 min-w-[115px]">Resp. Padrão</th>
                      <th className="p-2.5 border-r border-slate-700 min-w-[115px] text-center">Escopo / Check</th>
                      <th className="p-2.5 border-r border-slate-700 min-w-[130px] text-center">Status Período</th>
                      <th className="p-2.5 min-w-[230px] text-center bg-slate-800">Ações do Cadastro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredTemplates.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="p-8 text-center text-slate-500 font-medium">
                          Nenhuma tarefa padrão encontrada para os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredTemplates.map((tpl) => {
                        const alreadyLaunched = tasks.some(
                          (t) => t.templateId === tpl.id || t.code === tpl.standardCode
                        );
                        const member = TEAM_MEMBERS.find((m) => m.id === tpl.defaultAssignee) || TEAM_MEMBERS[0];
                        const checklistCount = tpl.checklistKey
                          ? (CHECKLISTS_P1[tpl.checklistKey] || []).length
                          : (tpl.customChecklistItems || []).length;
                        const recCfg = RECURRENCE_CONFIG[tpl.recurrence || 'MENSAL'] || RECURRENCE_CONFIG.MENSAL;
                        const dueRuleText = formatTemplateDueRule(tpl.recurrence || 'MENSAL', tpl.defaultDueDate);
                        const deptBadgeCls =
                          tpl.department === 'Fiscal'
                            ? 'bg-teal-100 text-teal-900 border-teal-300'
                            : 'bg-indigo-100 text-indigo-900 border-indigo-300';
                        const scopeText =
                          tpl.defaultCompanyScope === 'ALL'
                            ? '40 Filiais'
                            : tpl.defaultCompanyScope === 'MATRIZ_010101'
                            ? 'Matriz 010101'
                            : tpl.defaultCompanyScope === 'HOLDING_040101'
                            ? 'Holding 040101'
                            : `${tpl.customBranches?.length || 1} Filiais`;

                        return (
                          <tr key={tpl.id} className="hover:bg-slate-50/90 transition-colors">
                            <td className="p-2.5 border-r border-slate-200 font-mono font-bold sticky left-0 bg-white z-10">
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[11px] font-extrabold">
                                  {tpl.standardCode}
                                </span>
                                {tpl.isCritical && (
                                  <span title="Caminho Crítico" className="text-rose-600">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="p-2.5 border-r border-slate-200">
                              <span className={`px-2 py-0.5 rounded-md border text-[11px] font-extrabold ${deptBadgeCls}`}>
                                {tpl.department || 'Contábil'}
                              </span>
                            </td>

                            <td className="p-2.5 border-r border-slate-200 font-semibold text-slate-800">
                              {tpl.group || tpl.topic}
                            </td>

                            <td className="p-2.5 border-r border-slate-200">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-bold">
                                {tpl.subGroup || tpl.accountingType}
                              </span>
                            </td>

                            <td className="p-2.5 border-r border-slate-200">
                              <div className="font-bold text-slate-900">{tpl.title}</div>
                              {tpl.standardNotes && (
                                <div className="text-[11px] text-slate-500 truncate max-w-[340px]" title={tpl.standardNotes}>
                                  {tpl.standardNotes}
                                </div>
                              )}
                            </td>

                            <td className="p-2.5 border-r border-slate-200 text-center">
                              <span className={`px-2.5 py-1 rounded-md border text-[11px] font-extrabold inline-flex items-center gap-1 ${recCfg.badge}`}>
                                ↻ {recCfg.label}
                              </span>
                            </td>

                            <td className="p-2.5 border-r border-slate-200">
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 font-bold text-[11px]">
                                <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <span>{dueRuleText}</span>
                              </div>
                            </td>

                            <td className="p-2.5 border-r border-slate-200">
                              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                <span className={`w-5 h-5 rounded-full ${member.color} text-white text-[10px] font-bold flex items-center justify-center shrink-0`}>
                                  {member.avatar}
                                </span>
                                <span>@{tpl.defaultAssignee}</span>
                              </div>
                            </td>

                            <td className="p-2.5 border-r border-slate-200 text-center">
                              <div className="font-bold text-slate-800 text-[11px]">{scopeText}</div>
                              <div className="text-[10px] text-slate-500">{checklistCount} etapa(s)</div>
                            </td>

                            <td className="p-2.5 border-r border-slate-200 text-center">
                              {alreadyLaunched ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Ativa
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                  Não lançada
                                </span>
                              )}
                            </td>

                            <td className="p-2 text-center bg-slate-50/60">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => {
                                    instantiateTaskFromTemplate(tpl, false);
                                    setActiveTab('LISTA');
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer"
                                  title="Lançar diretamente no fechamento"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Lançar</span>
                                </button>
                                <button
                                  onClick={() => openNewTaskModal('FECHAMENTO', tpl)}
                                  className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-bold cursor-pointer"
                                  title="Abrir no formulário de nova tarefa"
                                >
                                  Usar
                                </button>
                                <button
                                  onClick={() => openEditTemplateModal(tpl)}
                                  className="p-1.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer"
                                  title="Editar Tarefa Padrão"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                {activeRoleView === 'ADMINISTRADOR' && (
                                  <button
                                    onClick={() => handleDeleteTemplate(tpl.id)}
                                    className="p-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer"
                                    title="Excluir do Cadastro Padrão (Exclusivo Administrador)"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            ABA: MODELOS DE CHECKLIST CUSTOMIZADOS & REUTILIZÁVEIS (COORDENADORES & ADMIN)
        ========================================== */}
        {activeTab === 'CHECKLIST_TEMPLATES' && (
          <div className="space-y-4">
            {/* Feedback Toast */}
            {checklistToastFeedback && (
              <div className="p-3.5 rounded-xl bg-purple-900 text-white text-xs font-bold flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2">
                  <CheckCheck className="w-4 h-4 text-emerald-400" />
                  <span>{checklistToastFeedback}</span>
                </div>
                <button
                  onClick={() => setChecklistToastFeedback(null)}
                  className="text-white/70 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Cabeçalho do Painel de Checklists */}
            <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-5 border border-purple-800/60 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-400/30">
                  <CheckSquare className="w-3.5 h-3.5 text-purple-300" />
                  <span>Biblioteca Central de Checklists Reutilizáveis</span>
                </div>
                <h2 className="text-base sm:text-lg font-extrabold text-white">
                  Modelos de Checklist Customizados ({checklistTemplates.length} Modelos Cadastrados)
                </h2>
                <p className="text-xs text-slate-300 max-w-3xl">
                  Coordenadores e Administradores podem criar modelos de checklist reutilizáveis, padronizando passos de conciliação e auditoria para as 40 filiais. Vincule a tarefas padrão do catálogo ou aplique em novas demandas.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  onClick={() => setActiveTab('CADASTRO_PADRAO')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 shadow-sm transition-all cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Ir para Catálogo de Tarefas</span>
                </button>
                <button
                  onClick={() => openCreateChecklistModal('Contábil')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Criar Novo Modelo de Checklist</span>
                </button>
              </div>
            </div>

            {/* 4 Cards de Diagnóstico / Métricas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>TOTAL DE MODELOS</span>
                  <CheckSquare className="w-4 h-4 text-purple-600" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-slate-900">{checklistKpis.total}</span>
                  <span className="text-[11px] text-purple-700 font-bold">Biblioteca ativa</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-xs font-semibold text-indigo-700">
                  <span>CHECKLISTS CONTÁBEIS</span>
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-indigo-950">{checklistKpis.contabeis}</span>
                  <span className="text-[11px] text-indigo-700 font-bold">Rotinas Contábeis</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-xs font-semibold text-teal-700">
                  <span>CHECKLISTS FISCAIS</span>
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-teal-950">{checklistKpis.fiscais}</span>
                  <span className="text-[11px] text-teal-700 font-bold">Rotinas Fiscais</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>TOTAL DE ETAPAS</span>
                  <ListChecks className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-slate-900">{checklistKpis.totalSteps}</span>
                  <span className="text-[11px] text-slate-500 font-medium">Média: {checklistKpis.avgSteps} / mod.</span>
                </div>
              </div>
            </div>

            {/* Barra de Busca e Filtros */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {['TODOS', 'Contábil', 'Fiscal', 'Geral'].map((dept) => (
                  <button
                    key={dept}
                    onClick={() => setChecklistDeptFilter(dept)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      checklistDeptFilter === dept
                        ? 'bg-purple-700 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {dept === 'TODOS' ? 'Todos os Departamentos' : dept}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 min-w-[260px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={checklistSearchQuery}
                  onChange={(e) => setChecklistSearchQuery(e.target.value)}
                  placeholder="Pesquisar por nome do checklist, descrição ou palavras das etapas..."
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white"
                />
              </div>

              <div className="text-xs text-slate-500 font-medium">
                Exibindo <strong>{filteredChecklistTemplates.length}</strong> de {checklistTemplates.length} modelos
              </div>
            </div>

            {/* Grid de Modelos de Checklist */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredChecklistTemplates.length === 0 ? (
                <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 mx-auto flex items-center justify-center">
                    <CheckSquare className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Nenhum modelo de checklist encontrado</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Não encontramos modelos com os filtros atuais. Você pode criar um novo modelo de checklist reutilizável agora mesmo.
                  </p>
                  <button
                    onClick={() => openCreateChecklistModal('Contábil')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Cadastrar Primeiro Modelo</span>
                  </button>
                </div>
              ) : (
                filteredChecklistTemplates.map((tpl) => {
                  const deptBadge =
                    tpl.department === 'Fiscal'
                      ? 'bg-teal-100 text-teal-900 border-teal-300'
                      : tpl.department === 'Contábil'
                      ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                      : 'bg-slate-100 text-slate-800 border-slate-300';

                  const tasksUsingThisChecklist = tasks.filter((t) => t.checklistKey === tpl.id).length;

                  return (
                    <div
                      key={tpl.id}
                      className="bg-white rounded-2xl border border-slate-200 hover:border-purple-300 p-5 shadow-xs transition-all flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-3">
                        {/* Header do Card */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${deptBadge}`}>
                                {tpl.department}
                              </span>
                              {tpl.isBuiltin ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                  Padrão do Sistema
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                                  <Bookmark className="w-2.5 h-2.5" />
                                  Customizado
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                {tpl.items.length} etapas
                              </span>
                            </div>
                            <h3 className="font-extrabold text-sm text-slate-900 leading-snug">
                              {tpl.name}
                            </h3>
                          </div>
                        </div>

                        {/* Descrição */}
                        {tpl.description && (
                          <p className="text-xs text-slate-600 line-clamp-2" title={tpl.description}>
                            {tpl.description}
                          </p>
                        )}

                        {/* Lista de Etapas (Preview) */}
                        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80 space-y-2 max-h-48 overflow-y-auto">
                          <div className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center justify-between">
                            <span>Etapas Sequenciais de Conferência:</span>
                            <span className="text-purple-700 font-mono">1 a {tpl.items.length}</span>
                          </div>
                          <div className="space-y-1.5">
                            {tpl.items.map((step, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                                <span className="w-4 h-4 rounded bg-purple-100 text-purple-800 font-mono text-[10px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                                  {idx + 1}
                                </span>
                                <span className="leading-snug">{step}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Rodapé e Ações do Card */}
                      <div className="pt-3 border-t border-slate-100 space-y-2.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>Criado por <strong>@{tpl.createdBy}</strong></span>
                          <span>{tasksUsingThisChecklist > 0 ? `${tasksUsingThisChecklist} tarefa(s) ativas` : 'Pronto p/ vincular'}</span>
                        </div>

                        <div className="flex items-center justify-end gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleDuplicateChecklistTemplate(tpl)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
                            title="Clonar / Duplicar Modelo para criar variação"
                          >
                            <CopyPlus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditChecklistModal(tpl)}
                            className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold cursor-pointer transition-colors"
                            title="Editar Modelo de Checklist"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteChecklistTemplate(tpl.id)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer transition-colors"
                            title="Excluir Modelo de Checklist"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              openCreateTemplateModal();
                              setTemplateForm((prev) => ({
                                ...prev,
                                checklistKey: tpl.id,
                                department: tpl.department === 'Fiscal' ? 'Fiscal' : 'Contábil'
                              }));
                            }}
                            className="ml-1 px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-600 text-white text-[11px] font-bold cursor-pointer flex items-center gap-1.5 shadow-xs transition-colors"
                            title="Criar nova tarefa padrão vinculando este checklist"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Vincular em Tarefa</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            ABA: PAINEL DE CADASTRO E GESTÃO DE USUÁRIOS (ADMINISTRADOR, COORDENADOR E ANALISTA)
        ========================================== */}
        {activeTab === 'USUARIOS' && (
          <div className="space-y-4">
            {/* Cabeçalho do Módulo de Usuários */}
            <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 border border-indigo-800/60 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-400/30">
                  <Users className="w-3.5 h-3.5" />
                  <span>Controle de Acessos, Equipe & Perfis RACI</span>
                </div>
                <h2 className="text-base sm:text-lg font-extrabold text-white">
                  Painel de Cadastro e Gestão de Usuários ({TEAM_MEMBERS.length} integrantes)
                </h2>
                <p className="text-xs text-slate-300 max-w-3xl">
                  Gerencie os membros dos departamentos <strong>Contábil e Fiscal</strong> estruturados nas 3 categorias hierárquicas: <strong>Administrador</strong>, <strong>Coordenador</strong> e <strong>Analista</strong>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  onClick={openCreateUserModal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Cadastrar Novo Usuário</span>
                </button>
              </div>
            </div>

            {/* Cards das 3 Categorias: Administrador, Coordenador e Analista */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {(['ADMINISTRADOR', 'COORDENADOR', 'ANALISTA'] as const).map((catKey) => {
                const catCfg = USER_CATEGORIES_CONFIG[catKey];
                const membersInCat = TEAM_MEMBERS.filter((m) => (m.category || 'ANALISTA') === catKey);
                const isSelectedFilter = userCategoryFilter === catKey;

                return (
                  <div
                    key={catKey}
                    onClick={() => setUserCategoryFilter(isSelectedFilter ? 'TODOS' : catKey)}
                    className={`bg-white rounded-2xl border p-4 shadow-xs transition-all cursor-pointer flex flex-col justify-between ${
                      isSelectedFilter ? 'ring-2 ring-slate-900 border-slate-900' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-3 py-1 rounded-lg border text-xs font-extrabold ${catCfg.badgeCls}`}>
                          {catKey === 'ADMINISTRADOR' ? '🛡️ ' : catKey === 'COORDENADOR' ? '🧭 ' : '⚙️ '}
                          Categoria: {catCfg.label}
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-slate-900 text-white text-xs font-extrabold">
                          {membersInCat.length} {membersInCat.length === 1 ? 'usuário' : 'usuários'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">{catCfg.description}</p>

                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                          Alçadas & Permissões da Categoria:
                        </div>
                        {catCfg.permissions.map((perm, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{perm}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center -space-x-1.5 overflow-hidden">
                        {membersInCat.map((m) => (
                          <span
                            key={m.id}
                            title={`@${m.name} (${m.role})`}
                            className={`w-6 h-6 rounded-full ${m.color} text-white text-[10px] font-extrabold flex items-center justify-center ring-2 ring-white`}
                          >
                            {m.avatar}
                          </span>
                        ))}
                        {membersInCat.length === 0 && (
                          <span className="text-[11px] text-slate-400 italic">Nenhum usuário nesta categoria</span>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-indigo-600">
                        {isSelectedFilter ? 'Filtro ativo ✕' : 'Filtrar categoria →'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Barra de Filtro por Categoria, Departamento e Busca */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'TODOS', label: `Todas Categorias (${TEAM_MEMBERS.length})` },
                  { id: 'ADMINISTRADOR', label: '🛡️ Administrador' },
                  { id: 'COORDENADOR', label: '🧭 Coordenador' },
                  { id: 'ANALISTA', label: '⚙️ Analista' }
                ].map((catBtn) => (
                  <button
                    key={catBtn.id}
                    onClick={() => setUserCategoryFilter(catBtn.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      userCategoryFilter === catBtn.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {catBtn.label}
                  </button>
                ))}

                <div className="h-5 w-px bg-slate-200 mx-1" />

                {['TODOS', 'Contábil', 'Fiscal', 'Ambos'].map((dept) => (
                  <button
                    key={dept}
                    onClick={() => setUserDepartmentFilter(dept)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      userDepartmentFilter === dept
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {dept === 'TODOS' ? 'Todos Deptos' : `Depto: ${dept}`}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Buscar por nome, @usuario, e-mail ou cargo..."
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                />
              </div>
            </div>

            {/* Tabela de Usuários Cadastrados */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600" />
                    Tabela de Usuários e Categorias de Acesso ({filteredUsersList.length} exibidos)
                  </h3>
                  <p className="text-xs text-slate-600">
                    Você pode alterar a categoria (Administrador, Coordenador ou Analista) diretamente na tabela ou editar os dados completos do usuário.
                  </p>
                </div>
                <div className="text-xs text-slate-600">
                  Operador ativo na sessão:{' '}
                  <strong className="text-indigo-700">@{currentUser}</strong> (
                  {USER_CATEGORIES_CONFIG[activeMemberObj.category || 'ANALISTA']?.label || 'Analista'})
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="p-3 border-r border-slate-700 min-w-[200px]">Usuário / Identificador (@)</th>
                      <th className="p-3 border-r border-slate-700 min-w-[190px]">Categoria de Acesso</th>
                      <th className="p-3 border-r border-slate-700 min-w-[120px] text-center">Departamento</th>
                      <th className="p-3 border-r border-slate-700 min-w-[220px]">Cargo / Função & E-mail</th>
                      <th className="p-3 border-r border-slate-700 min-w-[150px] text-center">Carteira de Tarefas</th>
                      <th className="p-3 border-r border-slate-700 min-w-[130px] text-center">Tempo Cronometrado</th>
                      <th className="p-3 border-r border-slate-700 min-w-[100px] text-center">Status</th>
                      <th className="p-3 min-w-[230px] text-center bg-slate-800">Ações de Gestão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredUsersList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-500 font-medium">
                          Nenhum usuário encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredUsersList.map((member) => {
                        const catCfg =
                          USER_CATEGORIES_CONFIG[member.category || 'ANALISTA'] || USER_CATEGORIES_CONFIG.ANALISTA;
                        const memberMetric = kpis.userMetrics.find((um: any) => um.id === member.id) || {
                          totalAssigned: 0,
                          concluidas: 0,
                          emAndamento: 0,
                          secondsSpent: 0
                        };
                        const isCurrentOperator = currentUser === member.id;

                        return (
                          <tr key={member.id} className="hover:bg-slate-50/90 transition-colors">
                            <td className="p-3 border-r border-slate-200">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-9 h-9 rounded-xl ${member.color} text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs`}
                                >
                                  {member.avatar}
                                </div>
                                <div>
                                  <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                                    <span>{member.name}</span>
                                    <span className="font-mono text-[11px] text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                                      @{member.id}
                                    </span>
                                    {isCurrentOperator && (
                                      <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white text-[9px] font-extrabold">
                                        OPERADOR ATUAL
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500">{member.email}</div>
                                </div>
                              </div>
                            </td>

                            <td className="p-3 border-r border-slate-200">
                              <select
                                value={member.category || 'ANALISTA'}
                                onChange={(e) => handleChangeUserCategoryDirect(member, e.target.value)}
                                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-extrabold cursor-pointer focus:outline-none ${catCfg.badgeCls}`}
                              >
                                <option value="ADMINISTRADOR">🛡️ Administrador</option>
                                <option value="COORDENADOR">🧭 Coordenador</option>
                                <option value="ANALISTA">⚙️ Analista</option>
                              </select>
                            </td>

                            <td className="p-3 border-r border-slate-200 text-center">
                              <span
                                className={`px-2.5 py-1 rounded-md border text-[11px] font-extrabold ${
                                  member.department === 'Fiscal'
                                    ? 'bg-teal-100 text-teal-900 border-teal-300'
                                    : member.department === 'Ambos'
                                    ? 'bg-purple-100 text-purple-900 border-purple-300'
                                    : 'bg-indigo-100 text-indigo-900 border-indigo-300'
                                }`}
                              >
                                {member.department || 'Contábil'}
                              </span>
                            </td>

                            <td className="p-3 border-r border-slate-200">
                              <div className="font-bold text-slate-800">{member.role}</div>
                              <div className="text-[11px] text-slate-500">{catCfg.shortLabel} • Equipe Agriconnection</div>
                            </td>

                            <td className="p-3 border-r border-slate-200 text-center">
                              <div className="font-extrabold text-slate-900">
                                {memberMetric.concluidas}/{memberMetric.totalAssigned} concluídas
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {memberMetric.emAndamento > 0
                                  ? `${memberMetric.emAndamento} em andamento agora`
                                  : 'Sem timer rodando'}
                              </div>
                            </td>

                            <td className="p-3 border-r border-slate-200 text-center font-mono font-bold text-slate-900">
                              {formatDuration(memberMetric.secondsSpent)}
                            </td>

                            <td className="p-3 border-r border-slate-200 text-center">
                              <button
                                onClick={() => handleToggleUserStatus(member)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border cursor-pointer ${
                                  member.status === 'INATIVO'
                                    ? 'bg-slate-100 text-slate-500 border-slate-300'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                }`}
                                title="Clique para alternar entre Ativo e Inativo"
                              >
                                {member.status === 'INATIVO' ? 'Inativo' : '✓ Ativo'}
                              </button>
                            </td>

                            <td className="p-2.5 text-center bg-slate-50/60">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => {
                                    const cat = (member.category || 'ANALISTA') as 'ADMINISTRADOR' | 'COORDENADOR' | 'ANALISTA';
                                    handleSelectRoleView(cat, member.id);
                                  }}
                                  className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer ${
                                    isCurrentOperator
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-slate-900 hover:bg-slate-700 text-white'
                                  }`}
                                  title="Assumir este usuário e abrir a visão correspondente ao seu perfil"
                                >
                                  {isCurrentOperator ? 'Ativo' : 'Assumir Visão'}
                                </button>
                                <button
                                  onClick={() => openEditUserModal(member)}
                                  className="p-1.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer"
                                  title="Editar Usuário"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                {TEAM_MEMBERS.length > 1 && (
                                  <button
                                    onClick={() => handleDeleteUser(member.id)}
                                    className="p-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer"
                                    title="Excluir Usuário"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            ABA: CADASTRO DE EMPRESAS (40 FILIAIS E UNIDADES DO GRUPO)
        ========================================== */}
        {activeTab === 'EMPRESAS' && (
          <div className="space-y-4">
            {/* Banner de Topo com Ações Rápidas */}
            <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white rounded-2xl p-5 border border-emerald-800/60 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <Building className="w-3.5 h-3.5" />
                  <span>CADASTRO & GESTÃO CORPORATIVA DE EMPRESAS</span>
                </div>
                <h2 className="text-base sm:text-lg font-extrabold text-white">
                  Cadastro de Empresas e Filiais ({companies.length} Unidades Mapeadas)
                </h2>
                <p className="text-xs text-slate-300 max-w-3xl">
                  Registro completo das 40 filiais e holdings do Grupo Agriconnection: Código contábil, Razão Social, CNPJ oficial, Município/UF, Regime Tributário (Lucro Real ou Presumido), Responsável Contábil designado e Status Operacional.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('MATRIZ')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <span>Ver na Matriz 40 Filiais</span>
                </button>
                <button
                  type="button"
                  onClick={openCreateCompanyModal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Cadastrar Nova Empresa / Filial</span>
                </button>
              </div>
            </div>

            {/* Deck de KPIs do Cadastro de Empresas */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div
                onClick={() => {
                  setCompanyStatusFilter('TODAS');
                  setCompanyTaxRegimeFilter('TODOS');
                  setCompanyUfFilter('TODAS');
                  setCompanySearchQuery('');
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer bg-white hover:shadow-md ${
                  companyStatusFilter === 'TODAS' && companyTaxRegimeFilter === 'TODOS'
                    ? 'ring-2 ring-emerald-600 border-emerald-600'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>TOTAL EMPRESAS</span>
                  <Building2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-slate-900">{companyKpis.total}</span>
                  <span className="text-[11px] font-bold text-emerald-700">100% cadastradas</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Grupo Agriconnection</div>
              </div>

              <div
                onClick={() => setCompanyStatusFilter(companyStatusFilter === 'ATIVA' ? 'TODAS' : 'ATIVA')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer bg-white hover:shadow-md ${
                  companyStatusFilter === 'ATIVA'
                    ? 'ring-2 ring-emerald-600 border-emerald-600 shadow-xs'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-700">
                  <span>FILIAIS ATIVAS</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-emerald-700">{companyKpis.ativas}</span>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                    {companyKpis.total > 0 ? Math.round((companyKpis.ativas / companyKpis.total) * 100) : 0}%
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Operando no fechamento</div>
              </div>

              <div
                onClick={() => setCompanyTaxRegimeFilter(companyTaxRegimeFilter === 'Lucro Real' ? 'TODOS' : 'Lucro Real')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer bg-white hover:shadow-md ${
                  companyTaxRegimeFilter === 'Lucro Real'
                    ? 'ring-2 ring-indigo-600 border-indigo-600 shadow-xs'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold text-indigo-700">
                  <span>LUCRO REAL</span>
                  <Briefcase className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-indigo-700">{companyKpis.lucroReal}</span>
                  <span className="text-[11px] font-bold text-indigo-800 bg-indigo-50 px-1.5 py-0.2 rounded">
                    Grandes Unidades
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">LALUR, ECD & ECF</div>
              </div>

              <div
                onClick={() => setCompanyTaxRegimeFilter(companyTaxRegimeFilter === 'Lucro Presumido' ? 'TODOS' : 'Lucro Presumido')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer bg-white hover:shadow-md ${
                  companyTaxRegimeFilter === 'Lucro Presumido'
                    ? 'ring-2 ring-amber-500 border-amber-500 shadow-xs'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold text-amber-800">
                  <span>LUCRO PRESUMIDO</span>
                  <FileText className="w-4 h-4 text-amber-600" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-amber-700">{companyKpis.lucroPresumido}</span>
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded">
                    Serviços / Apoio
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Logística, Seguros, Solar</div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>ESTADOS (UFs)</span>
                  <MapPin className="w-4 h-4 text-rose-500" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-slate-900">{companyKpis.ufsCount} UFs</span>
                  <span className="text-[11px] font-mono font-bold text-slate-700">Brasil</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">
                  {companyKpis.ufs.slice(0, 5).join(', ')}{companyKpis.ufs.length > 5 ? '...' : ''}
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
                  <span>FECHAMENTO ATIVO</span>
                  <Clock className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-emerald-700">{kpis.percentConcluido}%</span>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded">
                    Comp. 10/2026
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{kpis.concluidas} de {kpis.total} concluídas</div>
              </div>
            </div>

            {/* Barra de Filtros & Busca do Cadastro de Empresas */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5 text-emerald-600" />
                    Filtrar Status:
                  </span>
                  {[
                    { id: 'TODAS', label: `Todas (${companies.length})` },
                    { id: 'ATIVA', label: `Ativas (${companyKpis.ativas})` },
                    { id: 'INATIVA', label: `Inativas (${companyKpis.inativas})` }
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => setCompanyStatusFilter(btn.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        companyStatusFilter === btn.id
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}

                  <div className="h-5 w-px bg-slate-200 mx-1" />

                  <span className="text-[11px] font-bold text-slate-500 mr-1">Regime:</span>
                  {['TODOS', 'Lucro Real', 'Lucro Presumido'].map((reg) => (
                    <button
                      key={reg}
                      type="button"
                      onClick={() => setCompanyTaxRegimeFilter(reg)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        companyTaxRegimeFilter === reg
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {reg}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {(companyStatusFilter !== 'TODAS' ||
                    companyTaxRegimeFilter !== 'TODOS' ||
                    companyUfFilter !== 'TODAS' ||
                    companyTypeFilter !== 'TODOS' ||
                    companySearchQuery.trim() !== '') && (
                    <button
                      type="button"
                      onClick={() => {
                        setCompanyStatusFilter('TODAS');
                        setCompanyTaxRegimeFilter('TODOS');
                        setCompanyUfFilter('TODAS');
                        setCompanyTypeFilter('TODOS');
                        setCompanySearchQuery('');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Limpar Filtros</span>
                    </button>
                  )}
                  <div className="text-xs text-slate-500 font-medium">
                    Exibindo <strong>{filteredCompanies.length}</strong> de {companies.length} empresas
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
                <div className="sm:col-span-2 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={companySearchQuery}
                    onChange={(e) => setCompanySearchQuery(e.target.value)}
                    placeholder="Buscar por código (ex: 010101), razão social, CNPJ, município ou responsável..."
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                  />
                </div>

                <select
                  value={companyUfFilter}
                  onChange={(e) => setCompanyUfFilter(e.target.value)}
                  className="px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="TODAS">📍 Todos os Estados (UFs)</option>
                  {companyKpis.ufs.map((uf) => (
                    <option key={uf} value={uf}>
                      Estado: {uf}
                    </option>
                  ))}
                </select>

                <select
                  value={companyTypeFilter}
                  onChange={(e) => setCompanyTypeFilter(e.target.value)}
                  className="px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="TODOS">🏢 Todos os Tipos de Unidade</option>
                  <option value="Matriz">Matriz</option>
                  <option value="Filial Insumos">Filial Insumos</option>
                  <option value="Centro Distribuição">Centro Distribuição</option>
                  <option value="Sementes Matriz">Sementes</option>
                  <option value="Grãos & Barter">Grãos & Barter</option>
                  <option value="Holding">Holding</option>
                  <option value="Agropecuária MT">Agropecuária</option>
                  <option value="Logística & Frota">Logística & Frota</option>
                  <option value="Armazéns Gerais">Armazéns Gerais</option>
                  <option value="Aviação Agrícola">Aviação Agrícola</option>
                  <option value="Imobiliária Rural">Imobiliária Rural</option>
                  <option value="Beneficiamento Sementes">Beneficiamento Sementes</option>
                  <option value="Trading Exportação">Trading Exportação</option>
                  <option value="Corretora Seguros">Corretora Seguros</option>
                  <option value="Energia Solar Agro">Energia Solar Agro</option>
                  <option value="Pesquisa & Genética">Pesquisa & Genética</option>
                  <option value="Serviços Compartilhados CSC">Serviços Compartilhados CSC</option>
                </select>
              </div>
            </div>

            {/* Tabela do Cadastro de Empresas (Visão Tabular Padronizada) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                    <Building className="w-4 h-4 text-emerald-600" />
                    Tabela Cadastral de Empresas e Filiais ({filteredCompanies.length} registros)
                  </h3>
                  <p className="text-xs text-slate-600">
                    Visão tabular completa com código, razão social, CNPJ, localização, regime tributário e percentual de entrega no fechamento 10/2026.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold border border-emerald-300">
                    {companyKpis.ativas} Ativas
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 font-bold border border-indigo-300">
                    {companyKpis.lucroReal} Lucro Real
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[72vh]">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="bg-slate-900 text-white sticky top-0 z-20">
                    <tr>
                      <th className="p-3 border-r border-slate-700 min-w-[90px] sticky left-0 bg-slate-900 z-30">Código</th>
                      <th className="p-3 border-r border-slate-700 min-w-[280px]">Razão Social / Nome Fantasia</th>
                      <th className="p-3 border-r border-slate-700 min-w-[170px]">CNPJ Oficial</th>
                      <th className="p-3 border-r border-slate-700 min-w-[150px]">Município / UF</th>
                      <th className="p-3 border-r border-slate-700 min-w-[130px] text-center">Regime Tributário</th>
                      <th className="p-3 border-r border-slate-700 min-w-[140px]">Responsável</th>
                      <th className="p-3 border-r border-slate-700 min-w-[160px] text-center">Fechamento 10/2026</th>
                      <th className="p-3 border-r border-slate-700 min-w-[100px] text-center">Status</th>
                      <th className="p-3 min-w-[220px] text-center bg-slate-800">Ações de Gestão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredCompanies.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-500 font-medium">
                          Nenhuma empresa ou filial encontrada para os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredCompanies.map((comp) => {
                        const member = TEAM_MEMBERS.find((m) => m.id === comp.manager) || TEAM_MEMBERS[0];
                        // Calculate task completion percentage for this branch in current tasks
                        const applicableTasks = tasks.filter((t) => t.branches && t.branches[comp.code] !== 'n/a');
                        const okTasks = applicableTasks.filter((t) => t.branches && t.branches[comp.code] === 'ok');
                        const branchPct =
                          applicableTasks.length > 0 ? Math.round((okTasks.length / applicableTasks.length) * 100) : 0;
                        const isMatriz = comp.code === '010101' || comp.branchType === 'Matriz';

                        return (
                          <tr key={comp.code} className="hover:bg-slate-50/90 transition-colors">
                            <td className="p-3 border-r border-slate-200 font-mono font-bold sticky left-0 bg-white z-10">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-extrabold ${
                                    isMatriz ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-white'
                                  }`}
                                >
                                  {comp.code}
                                </span>
                                {isMatriz && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[9px] font-extrabold border border-amber-300">
                                    MATRIZ
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="p-3 border-r border-slate-200">
                              <div className="font-extrabold text-slate-900">{comp.name}</div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <span className="font-medium text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                  {comp.tradingName}
                                </span>
                                <span>•</span>
                                <span>{comp.branchType}</span>
                              </div>
                            </td>

                            <td className="p-3 border-r border-slate-200 font-mono text-slate-800 font-bold">
                              {comp.cnpj}
                            </td>

                            <td className="p-3 border-r border-slate-200">
                              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                <span>{comp.city} - {comp.uf}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">Região Centro-Oeste / Brasil</div>
                            </td>

                            <td className="p-3 border-r border-slate-200 text-center">
                              <span
                                className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold border inline-block ${
                                  comp.taxRegime === 'Lucro Real'
                                    ? 'bg-indigo-50 text-indigo-900 border-indigo-300'
                                    : 'bg-amber-50 text-amber-900 border-amber-300'
                                }`}
                              >
                                {comp.taxRegime}
                              </span>
                            </td>

                            <td className="p-3 border-r border-slate-200">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-6 h-6 rounded-full ${member.color} text-white font-extrabold text-[10px] flex items-center justify-center shrink-0`}
                                >
                                  {member.avatar}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900">@{comp.manager}</div>
                                  <div className="text-[10px] text-slate-400">Responsável Contábil</div>
                                </div>
                              </div>
                            </td>

                            <td className="p-3 border-r border-slate-200 text-center">
                              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                                <span>{okTasks.length}/{applicableTasks.length} OK</span>
                                <span className={branchPct === 100 ? 'text-emerald-700' : 'text-slate-900'}>{branchPct}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${branchPct === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                                  style={{ width: `${branchPct}%` }}
                                />
                              </div>
                            </td>

                            <td className="p-3 border-r border-slate-200 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleCompanyStatus(comp)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border cursor-pointer transition-all ${
                                  comp.status === 'INATIVA'
                                    ? 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                }`}
                                title="Clique para alternar o status da empresa"
                              >
                                {comp.status === 'INATIVA' ? 'Inativa' : '✓ Ativa'}
                              </button>
                            </td>

                            <td className="p-2.5 text-center bg-slate-50/60">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSingleCompany(comp.code);
                                    setCompanyScopeMode('SINGLE');
                                    setActiveTab('LISTA');
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                                  title="Filtrar tarefas da bancada para esta filial específica"
                                >
                                  <ListTodo className="w-3 h-3" />
                                  <span>Tarefas</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditCompanyModal(comp)}
                                  className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer transition-colors"
                                  title="Editar dados da Empresa"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            BARRA DE FILTROS & BUSCA DINÂMICA (PARA LISTA, MATRIZ, KANBAN, AVULSAS)
        ========================================== */}
        {(activeTab === 'LISTA' || activeTab === 'MATRIZ' || activeTab === 'KANBAN' || activeTab === 'AVULSAS') && (
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
            {/* Linha 1: Busca Rápida + Pílulas de Filtro Rápido + Alternador Cards/Tabela + Botão Filtros Avançados */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-[280px]">
                <div className="relative w-full sm:w-64 lg:w-72 shrink-0">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar código, tarefa, grupo..."
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {[
                  { id: 'TODAS', label: 'Todas' },
                  { id: 'MINHAS', label: `Minhas (@${currentUser})` },
                  { id: 'DEPENDENCIA_COMIGO', label: `Comigo (@)`, count: kpis.dependenciaComigo, purple: true },
                  { id: 'EM_EXECUCAO', label: 'Em Andamento', count: kpis.emAndamento },
                  { id: 'FECHAMENTO', label: 'Fechamento' },
                  { id: 'AVULSAS', label: 'Avulsas' }
                ].map((pill) => {
                  const active = quickFilter === pill.id;
                  return (
                    <button
                      key={pill.id}
                      onClick={() => setQuickFilter(pill.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
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

              {/* Controles de Densidade (Cards vs Tabela), Expansão em Lote e Filtros Avançados */}
              <div className="flex flex-wrap items-center gap-2">
                {(activeTab === 'LISTA' || activeTab === 'AVULSAS') && (
                  <>
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setTaskListDensity('CARDS')}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          taskListDensity === 'CARDS'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Exibir obrigações em Cards detalhados"
                      >
                        <ListTodo className="w-3.5 h-3.5" />
                        <span>Cards</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaskListDensity('TABELA')}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          taskListDensity === 'TABELA'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Exibir obrigações em Tabela Rápida compacta"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Tabela</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const anyExpanded = filteredTasks.some((t) => expandedTaskBranches[t.id]);
                        if (anyExpanded) {
                          setExpandedTaskBranches({});
                        } else {
                          const next: Record<string, boolean> = {};
                          filteredTasks.forEach((t) => {
                            next[t.id] = true;
                          });
                          setExpandedTaskBranches(next);
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition-all cursor-pointer hidden xl:inline-flex items-center gap-1"
                      title="Expandir ou recolher a grade de 40 filiais em todas as tarefas visíveis"
                    >
                      <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        {filteredTasks.some((t) => expandedTaskBranches[t.id]) ? 'Recolher Filiais ▲' : 'Expandir Filiais ▼'}
                      </span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setIsAdvancedFiltersOpen((prev) => !prev)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isAdvancedFiltersOpen ||
                    departmentFilter !== 'TODOS' ||
                    topicFilter !== 'TODOS' ||
                    subGroupFilter !== 'TODOS' ||
                    recurrenceFilter !== 'TODOS' ||
                    userFilter !== 'TODOS' ||
                    statusFilter !== 'TODOS'
                      ? 'bg-indigo-50 text-indigo-900 border-indigo-300'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Filtros</span>
                  <span className="text-[10px]">{isAdvancedFiltersOpen ? '▲' : '▼'}</span>
                </button>

                {(quickFilter !== 'TODAS' ||
                  userFilter !== 'TODOS' ||
                  statusFilter !== 'TODOS' ||
                  departmentFilter !== 'TODOS' ||
                  topicFilter !== 'TODOS' ||
                  subGroupFilter !== 'TODOS' ||
                  recurrenceFilter !== 'TODOS' ||
                  competenceFilter !== 'TODOS' ||
                  companyScopeMode !== 'ALL' ||
                  activeOperatorFilter !== 'TODOS' ||
                  searchQuery.trim() !== '') && (
                  <button
                    onClick={() => {
                      setQuickFilter('TODAS');
                      setUserFilter('TODOS');
                      setStatusFilter('TODOS');
                      setDepartmentFilter('TODOS');
                      setTopicFilter('TODOS');
                      setSubGroupFilter('TODOS');
                      setRecurrenceFilter('TODOS');
                      setCompetenceFilter('TODOS');
                      setCompanyScopeMode('ALL');
                      setActiveOperatorFilter('TODOS');
                      setSearchQuery('');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer"
                    title="Limpar todos os filtros"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Limpar</span>
                  </button>
                )}

                <span className="text-xs font-semibold text-slate-500 tabular-nums">
                  <strong>{filteredTasks.length}</strong>/{tasks.length}
                </span>
              </div>
            </div>

            {/* Linha de Escopo 40 Filiais Integrada como Filtro da Tela de Acompanhamento */}
            <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-black text-slate-700 flex items-center gap-1.5 uppercase tracking-wider mr-1">
                  <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                  Escopo 40 Filiais:
                </span>

                <button
                  type="button"
                  onClick={() => setCompanyScopeMode('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    companyScopeMode === 'ALL'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Todas as 40 Empresas</span>
                </button>

                <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCompanyScopeMode('SINGLE')}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      companyScopeMode === 'SINGLE'
                        ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Filial Individual:
                  </button>
                  <select
                    value={selectedSingleCompany}
                    onChange={(e) => {
                      setSelectedSingleCompany(e.target.value);
                      setCompanyScopeMode('SINGLE');
                    }}
                    className="bg-transparent text-slate-800 text-xs font-mono font-bold px-2 py-1 focus:outline-none cursor-pointer max-w-[240px] truncate"
                  >
                    {BRANCH_CODES.map((code) => (
                      <option key={code} value={code} className="bg-white text-slate-900">
                        {getBranchDisplayName(code)}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCompanySelectorModalOpen(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                    companyScopeMode === 'CUSTOM'
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>
                    {companyScopeMode === 'CUSTOM'
                      ? `Subconjunto (${selectedCustomCompanies.length} Filiais)`
                      : 'Múltiplas Filiais...'}
                  </span>
                </button>
              </div>

              {/* Atalhos Rápidos para Filiais Estratégicas */}
              <div className="hidden lg:flex items-center gap-1 text-xs">
                <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Atalhos:</span>
                {['010101', '010109', '010180', '020101', '040101'].map((quickCode) => {
                  const isCurr = companyScopeMode === 'SINGLE' && selectedSingleCompany === quickCode;
                  return (
                    <button
                      key={quickCode}
                      type="button"
                      onClick={() => {
                        setSelectedSingleCompany(quickCode);
                        setCompanyScopeMode('SINGLE');
                      }}
                      className={`px-2 py-1 rounded font-mono text-[11px] font-bold transition-all cursor-pointer ${
                        isCurr
                          ? 'bg-blue-600 text-white shadow-2xs ring-1 ring-blue-400'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title={getBranchDisplayName(quickCode)}
                    >
                      {quickCode}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Painel Expansível de Filtros Avançados (Depto, Grupo, Sub-Grupo, Recorrência, Resp, Status) */}
            {(isAdvancedFiltersOpen ||
              departmentFilter !== 'TODOS' ||
              topicFilter !== 'TODOS' ||
              subGroupFilter !== 'TODOS' ||
              recurrenceFilter !== 'TODOS' ||
              userFilter !== 'TODOS' ||
              statusFilter !== 'TODOS') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 pt-2 border-t border-slate-100">
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="TODOS">🏢 Todos os Deptos</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      Depto: {d}
                    </option>
                  ))}
                </select>

                <select
                  value={topicFilter}
                  onChange={(e) => setTopicFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="TODOS">📂 Todos os Grupos</option>
                  {GROUPS_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      Grupo: {g}
                    </option>
                  ))}
                </select>

                <select
                  value={subGroupFilter}
                  onChange={(e) => setSubGroupFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="TODOS">📑 Todos os Sub-Grupos</option>
                  {SUBGROUPS_OPTIONS.map((sg) => (
                    <option key={sg} value={sg}>
                      Sub-Grupo: {sg}
                    </option>
                  ))}
                </select>

                <select
                  value={recurrenceFilter}
                  onChange={(e) => setRecurrenceFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="TODOS">↻ Todas Recorrências</option>
                  <option value="ESPORADICA">Recorrência: Esporádica</option>
                  <option value="MENSAL">Recorrência: Mensal</option>
                  <option value="TRIMESTRAL">Recorrência: Trimestral</option>
                  <option value="ANUAL">Recorrência: Anual</option>
                </select>

                <select
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="TODOS">👤 Todos Responsáveis</option>
                  {TEAM_MEMBERS.map((m) => (
                    <option key={m.id} value={m.id}>
                      Resp: @{m.name}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="TODOS">📌 Todos Status</option>
                  <option value="PENDENTE">Pendente</option>
                  <option value="EM_ANDAMENTO">Em Andamento</option>
                  <option value="PAUSADA">Pausada</option>
                  <option value="AGUARDANDO_DEPENDENCIA">Dependência (@)</option>
                  <option value="CONCLUIDA">Concluída</option>
                </select>
              </div>
            )}

            {/* Linha 2: Seleção Rápida de Competência (Mês) + Geração Automática */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mr-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  Competência:
                </span>
                <button
                  onClick={() => setCompetenceFilter('TODOS')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    competenceFilter === 'TODOS'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todas ({tasks.length})
                </button>
                {availableCompetences.map((comp) => {
                  const countInComp = tasks.filter((t) => (t.competence || '10/2026') === comp).length;
                  const active = competenceFilter === comp;
                  return (
                    <button
                      key={comp}
                      onClick={() => setCompetenceFilter(comp)}
                      className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        active
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-800'
                      }`}
                    >
                      <span>{comp}</span>
                      <span className={`px-1 rounded text-[10px] ${active ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-700'}`}>
                        {countInComp}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => openAutoGenerateModal('11', '2026')}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-extrabold transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Gerar Tarefas Recorrentes p/ Mês...</span>
              </button>
            </div>

            {autoGenFeedback && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-950">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Foram geradas automaticamente <strong>{autoGenFeedback.count} tarefa(s) recorrente(s)</strong> para a competência{' '}
                    <strong className="font-mono">{autoGenFeedback.competence}</strong> ({autoGenFeedback.dueRuleLabel}).
                  </span>
                </div>
                <button
                  onClick={() => setAutoGenFeedback(null)}
                  className="text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer"
                >
                  Fechar ✕
                </button>
              </div>
            )}
          </div>
        )}

        {/* ==========================================
            ABA 1 E 3: BANCADA DE TAREFAS (COM ALTERNADOR CARDS DINÂMICOS vs TABELA RÁPIDA + ACORDEÃO 40 FILIAIS)
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
                      Gestão de Tarefas Avulsas / Esporádicas do Dia a Dia
                    </h2>
                    <p className="text-xs text-slate-600">
                      Registre chamados urgentes, atendimentos à auditoria, parametrizações no TOTVS e demandas extras segregadas por Departamento, Grupo e Sub-Grupo.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => openNewTaskModal('AVULSA')}
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
                    setDepartmentFilter('TODOS');
                    setTopicFilter('TODOS');
                    setSubGroupFilter('TODOS');
                    setRecurrenceFilter('TODOS');
                    setCompetenceFilter('TODOS');
                    setActiveOperatorFilter('TODOS');
                    setSearchQuery('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                >
                  Limpar todos os filtros
                </button>
              </div>
            ) : taskListDensity === 'TABELA' ? (
              /* ==============================================================
                 MODO 1: VISÃO EM TABELA RÁPIDA (ALTA DENSIDADE + AÇÕES INLINE)
              ============================================================== */
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto max-h-[72vh]">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="bg-slate-900 text-white sticky top-0 z-20">
                      <tr>
                        <th className="p-2.5 border-r border-slate-800 w-[90px]">Código</th>
                        <th className="p-2.5 border-r border-slate-800 min-w-[260px]">Obrigação / Tarefa</th>
                        <th className="p-2.5 border-r border-slate-800 min-w-[150px]">Depto / Grupo</th>
                        <th className="p-2.5 border-r border-slate-800 text-center w-[110px]">Vencimento</th>
                        <th className="p-2.5 border-r border-slate-800 w-[135px]">Responsável</th>
                        <th className="p-2.5 border-r border-slate-800 text-center w-[140px]">Status</th>
                        <th className="p-2.5 border-r border-slate-800 text-center w-[160px]">40 Filiais (Acordeão)</th>
                        <th className="p-2.5 text-center min-w-[215px] bg-slate-800">Ações Rápidas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredTasks.map((task) => {
                        const st = STATUS_CONFIG[task.status] || STATUS_CONFIG.PENDENTE;
                        const liveSeconds = getLiveTaskSeconds(
                          task,
                          companyScopeMode === 'SINGLE' ? selectedSingleCompany : null
                        );
                        const allBranchStats = calculateBranchStats(task.branches, BRANCH_CODES);
                        const member = TEAM_MEMBERS.find((m) => m.id === task.assignee) || TEAM_MEMBERS[0];
                        const isRunning = task.status === 'EM_ANDAMENTO';
                        const isDone = task.status === 'CONCLUIDA';
                        const isGridExpanded = !!expandedTaskBranches[task.id];
                        const localScope = taskActionScope[task.id] || {
                          mode: companyScopeMode === 'SINGLE' ? 'SELECTED' : 'ALL',
                          branches: companyScopeMode === 'SINGLE' ? [selectedSingleCompany] : []
                        };
                        const targetBranchesForAction = getTaskTargetBranches(task);

                        return (
                          <React.Fragment key={task.id}>
                            <tr
                              className={`transition-colors ${
                                isRunning
                                  ? 'bg-blue-50/40 hover:bg-blue-50/70'
                                  : 'hover:bg-slate-50/90'
                              }`}
                            >
                              <td className="p-2.5 border-r border-slate-200 font-mono font-bold">
                                <div className="flex items-center gap-1">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[11px] ${
                                      task.category === 'AVULSA'
                                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                        : 'bg-slate-900 text-white'
                                    }`}
                                  >
                                    {task.code}
                                  </span>
                                  {task.isCritical && (
                                    <span title="Caminho Crítico">
                                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="p-2.5 border-r border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => setSelectedTaskId(task.id)}
                                  className="text-left font-bold text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer block leading-snug"
                                >
                                  {task.title}
                                </button>
                                {reminders24hData.remindersMap[task.id] && (
                                  <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-100 text-amber-950 border border-amber-300">
                                    <AlarmClock className="w-3 h-3 text-amber-700" />
                                    {reminders24hData.remindersMap[task.id].countdownLabel}
                                  </span>
                                )}
                              </td>

                              <td className="p-2.5 border-r border-slate-200">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                    task.department === 'Fiscal'
                                      ? 'bg-teal-100 text-teal-900'
                                      : 'bg-indigo-100 text-indigo-900'
                                  }`}
                                >
                                  {task.department || 'Contábil'}
                                </span>
                                <div className="text-[11px] font-semibold text-slate-700 truncate max-w-[160px] mt-0.5">
                                  {task.group || task.topic}
                                </div>
                              </td>

                              <td className="p-2.5 border-r border-slate-200 text-center font-mono">
                                <div className="font-bold text-slate-900">
                                  {(task.dueDate || '2026-10-30').split('-').reverse().join('/')}
                                </div>
                                <div className="text-[10px] text-slate-500">Comp: {task.competence || '10/2026'}</div>
                              </td>

                              <td className="p-2.5 border-r border-slate-200">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`w-6 h-6 rounded-full ${member.color} text-white text-[10px] font-bold flex items-center justify-center shrink-0`}
                                  >
                                    {member.avatar}
                                  </span>
                                  <span className="font-bold text-slate-800">@{task.assignee}</span>
                                </div>
                              </td>

                              <td className="p-2.5 border-r border-slate-200 text-center">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${st.bg} ${st.text} ${st.border}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                  {st.label}
                                </span>
                              </td>

                              <td className="p-2.5 border-r border-slate-200 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedTaskBranches((prev) => ({
                                      ...prev,
                                      [task.id]: !prev[task.id]
                                    }))
                                  }
                                  className={`w-full px-2 py-1 rounded-lg border text-left transition-all cursor-pointer ${
                                    isGridExpanded
                                      ? 'bg-slate-900 text-white border-slate-900'
                                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-[10px] font-bold mb-0.5 tabular-nums">
                                    <span>{allBranchStats.ok + allBranchStats.na}/40</span>
                                    <span>{allBranchStats.percent}% {isGridExpanded ? '▲' : '▼'}</span>
                                  </div>
                                  <div className="w-full h-1.5 bg-slate-200/70 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-emerald-500"
                                      style={{ width: `${allBranchStats.percent}%` }}
                                    />
                                  </div>
                                 </button>
                              </td>

                              <td className="p-2 text-center bg-slate-50/50">
                                <div className="flex items-center justify-center gap-1">
                                  {!isRunning ? (
                                    <button
                                      onClick={() => handleStartTask(task)}
                                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                                      title={task.status === 'PAUSADA' ? 'Retomar Tarefa (Status: Em Andamento)' : 'Iniciar Tarefa (Status: Em Andamento)'}
                                    >
                                      <Play className="w-3 h-3 fill-white" />
                                      <span>{task.status === 'PAUSADA' ? 'Retomar' : 'Iniciar'}</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => openPauseModal(task)}
                                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                                      title="Pausar Tarefa (Status: Pausada)"
                                    >
                                      <Pause className="w-3 h-3 fill-white" />
                                      <span>Pausar</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => openTransferModal(task)}
                                    className="px-2 py-1 rounded bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-200 text-[11px] font-bold cursor-pointer"
                                    title="Transferir (@)"
                                  >
                                    @
                                  </button>
                                  {!isDone ? (
                                    <button
                                      onClick={() => handleCompleteTask(task)}
                                      className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"
                                      title="Concluir Obrigação"
                                    >
                                      ✓
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleReopenTask(task)}
                                      className="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold cursor-pointer"
                                      title="Reabrir"
                                    >
                                      ↺
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setSelectedTaskId(task.id)}
                                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold cursor-pointer"
                                  >
                                    Abrir
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {isGridExpanded && (
                              <tr className="bg-slate-50 border-b border-slate-200">
                                <td colSpan={8} className="p-3.5 space-y-2.5">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold text-slate-700">
                                        Filiais de [{task.code}] (Duplo clique alterna OK / P / N/A):
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setTaskScopeConfig(task.id, 'ALL', [])}
                                        className="px-2 py-0.5 rounded bg-slate-900 text-white text-[11px] font-bold cursor-pointer"
                                      >
                                        Todas (40)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setTaskScopeConfig(task.id, 'PENDING', [])}
                                        className="px-2 py-0.5 rounded bg-amber-600 text-white text-[11px] font-bold cursor-pointer"
                                      >
                                        Pendentes ({allBranchStats.p})
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleCompleteTask(task, targetBranchesForAction)}
                                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"
                                      >
                                        ✓ Marcar Alvo OK ({targetBranchesForAction.length})
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSetBranchStatusDirect(task, targetBranchesForAction, 'p')}
                                        className="px-2.5 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold cursor-pointer"
                                      >
                                        Voltar Pendente
                                      </button>
                                    </div>
                                  </div>
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
                                          className={`px-2 py-1 rounded-lg border text-center transition-all cursor-pointer select-none ${chipCfg.cls} ${
                                            isSelectedIndividual ? 'ring-2 ring-slate-950 scale-105' : ''
                                          }`}
                                        >
                                          <div className="text-[10px] font-mono font-bold">{bCode}</div>
                                          <div className="text-[9px] uppercase font-extrabold">{chipCfg.short}</div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* ==============================================================
                 MODO 2: VISÃO EM CARDS DINÂMICOS (HIERARQUIA VISUAL LIMPA)
              ============================================================== */
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
                  const recCfg = RECURRENCE_CONFIG[task.recurrence || 'MENSAL'] || RECURRENCE_CONFIG.MENSAL;
                  const deptBadgeCls =
                    task.department === 'Fiscal'
                      ? 'bg-teal-100 text-teal-900 border-teal-300'
                      : 'bg-indigo-100 text-indigo-900 border-indigo-300';

                  return (
                    <div
                      key={task.id}
                      className={`bg-white rounded-xl border border-l-4 transition-all hover:shadow-md ${
                        isRunning
                          ? 'border-blue-300 border-l-blue-600 ring-1 ring-blue-400/40 bg-blue-50/5'
                          : isDep
                          ? 'border-purple-300 border-l-purple-600 bg-purple-50/5'
                          : isPaused
                          ? 'border-amber-300 border-l-amber-500'
                          : isDone
                          ? 'border-slate-200 border-l-emerald-500'
                          : 'border-slate-200 border-l-slate-400'
                      }`}
                    >
                      <div className="p-4 space-y-3">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
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

                              <span className={`px-2 py-0.5 rounded-md border text-[11px] font-extrabold ${deptBadgeCls}`}>
                                {task.department || 'Contábil'}
                              </span>

                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-bold">
                                {task.group || task.topic} ▸ {task.subGroup || task.accountingType}
                              </span>

                              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold ${recCfg.badge}`}>
                                ↻ {recCfg.label}
                              </span>

                              <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-900 border border-sky-200 text-[11px] font-bold font-mono">
                                Comp: {task.competence || '10/2026'}
                              </span>

                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-bold font-mono">
                                Venc: {(task.dueDate || '2026-10-30').split('-').reverse().join('/')}
                              </span>

                              {reminders24hData.remindersMap[task.id] && (
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-black border animate-pulse ${
                                    reminders24hData.remindersMap[task.id].isOverdue
                                      ? 'bg-rose-100 text-rose-950 border-rose-400'
                                      : 'bg-amber-100 text-amber-950 border-amber-400'
                                  }`}
                                  title={`Alerta 24h: ${reminders24hData.remindersMap[task.id].countdownLabel}`}
                                >
                                  <AlarmClock className={`w-3.5 h-3.5 ${reminders24hData.remindersMap[task.id].isOverdue ? 'text-rose-700' : 'text-amber-700'}`} />
                                  <span>{reminders24hData.remindersMap[task.id].countdownLabel}</span>
                                </span>
                              )}

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

                              {task.isCritical && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                  <AlertTriangle className="w-3 h-3" /> Crítica
                                </span>
                              )}
                            </div>

                            {/* TÍTULO CLICÁVEL: Expande empresas na MESMA TELA (Acordeão) */}
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
                                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                                  {isGridExpanded ? 'Ocultar 40 filiais ▲' : '40 filiais ▼'}
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
                              <div className="flex items-center justify-between text-[11px] font-bold mb-1 tabular-nums">
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
                              <div className="text-[10px] opacity-75 mt-0.5 flex items-center justify-between tabular-nums">
                                <span>{allBranchStats.ok} OK • {allBranchStats.p} P</span>
                                <span className="underline font-semibold">
                                  {isGridExpanded ? 'Ocultar ▲' : 'Selecionar ▼'}
                                </span>
                              </div>
                            </button>

                            {/* Status da Tarefa */}
                            <div className="text-center min-w-[120px]">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border shadow-2xs ${st.bg} ${st.text} ${st.border}`}>
                                <span className={`w-2 h-2 rounded-full ${st.dot} ${isRunning ? 'animate-ping' : ''}`} />
                                <span>{st.label}</span>
                              </span>
                            </div>

                            {/* Botões de Ação */}
                            <div className="flex items-center gap-1.5">
                              {!isRunning && (
                                <button
                                  onClick={() => handleStartTask(task)}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs cursor-pointer"
                                  title={task.status === 'PAUSADA' ? 'Retomar Tarefa (Status: Em Andamento)' : 'Iniciar Tarefa (Status: Em Andamento)'}
                                >
                                  <Play className="w-3.5 h-3.5 fill-white" />
                                  <span>{task.status === 'PAUSADA' ? 'Retomar' : 'Iniciar'}</span>
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
                    <th className="p-2.5 border-r border-slate-700 min-w-[105px] text-center">Status</th>
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
                        <td className="p-2 border-r border-slate-200 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_CONFIG[task.status]?.bg || 'bg-slate-100'} ${STATUS_CONFIG[task.status]?.text || 'text-slate-800'} ${STATUS_CONFIG[task.status]?.border || 'border-slate-200'}`}>
                            {STATUS_CONFIG[task.status]?.label || task.status}
                          </span>
                        </td>
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
            ABA 3: KANBAN DINÂMICO POR STATUS
        ========================================== */}
        {activeTab === 'KANBAN' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3.5 items-start">
            {[
              { key: 'PENDENTE', title: 'Pendente', headerBg: 'bg-slate-800', accentBorder: 'border-l-slate-400' },
              { key: 'EM_ANDAMENTO', title: 'Em Andamento', headerBg: 'bg-blue-700', accentBorder: 'border-l-blue-600' },
              { key: 'PAUSADA', title: 'Pausada', headerBg: 'bg-amber-600', accentBorder: 'border-l-amber-500' },
              { key: 'AGUARDANDO_DEPENDENCIA', title: 'Dependência (@)', headerBg: 'bg-purple-700', accentBorder: 'border-l-purple-600' },
              { key: 'CONCLUIDA', title: 'Concluída', headerBg: 'bg-emerald-700', accentBorder: 'border-l-emerald-500' }
            ].map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.key);
              return (
                <div key={col.key} className="bg-slate-100/90 rounded-xl border border-slate-200 overflow-hidden flex flex-col max-h-[75vh]">
                  <div className={`${col.headerBg} text-white px-3.5 py-2.5 flex items-center justify-between`}>
                    <span className="text-xs font-bold uppercase tracking-wider">{col.title}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-black/25 tabular-nums">{colTasks.length}</span>
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
                        const member = TEAM_MEMBERS.find((m) => m.id === task.assignee) || TEAM_MEMBERS[0];
                        return (
                          <div
                            key={task.id}
                            className={`bg-white p-3 rounded-xl border border-slate-200 border-l-4 ${col.accentBorder} shadow-2xs hover:shadow-md transition-all space-y-2.5`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${task.category === 'AVULSA' ? 'bg-amber-100 text-amber-900' : 'bg-slate-900 text-white'}`}>
                                  {task.code}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${task.department === 'Fiscal' ? 'bg-teal-100 text-teal-900' : 'bg-indigo-100 text-indigo-900'}`}>
                                  {task.department || 'Contábil'}
                                </span>
                                {task.isCritical && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                              </div>
                              <span className="font-mono text-[10px] text-slate-500 font-bold">
                                {(task.dueDate || '2026-10-30').split('-').reverse().join('/')}
                              </span>
                            </div>

                            <button
                              onClick={() => setSelectedTaskId(task.id)}
                              className="text-left text-xs font-bold text-slate-900 hover:text-indigo-600 line-clamp-2 cursor-pointer block leading-snug"
                            >
                              {task.title}
                            </button>

                            <div className="space-y-1 pt-1 border-t border-slate-100">
                              <div className="flex items-center justify-between text-[11px] text-slate-500">
                                <span className="flex items-center gap-1 font-bold text-slate-800">
                                  <span className={`w-4 h-4 rounded-full ${member.color} text-white text-[8px] font-bold flex items-center justify-center`}>
                                    {member.avatar}
                                  </span>
                                  @{task.assignee}
                                </span>
                                <span className="font-mono text-[10px] text-slate-600">
                                  Venc: {(task.dueDate || '2026-10-30').split('-').reverse().join('/')}
                                </span>
                              </div>

                              <div className="space-y-0.5 pt-0.5">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 tabular-nums">
                                  <span>40 Filiais</span>
                                  <span>{branchStats.ok + branchStats.na}/40 ({branchStats.percent}%)</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500" style={{ width: `${branchStats.percent}%` }} />
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 pt-1">
                              {task.status !== 'EM_ANDAMENTO' && task.status !== 'CONCLUIDA' && (
                                <button
                                  onClick={() => handleStartTask(task)}
                                  className="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <Play className="w-3 h-3 fill-white" /> Iniciar
                                </button>
                              )}
                              {task.status === 'EM_ANDAMENTO' && (
                                <button
                                  onClick={() => openPauseModal(task)}
                                  className="flex-1 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <Pause className="w-3 h-3 fill-white" /> Pausar
                                </button>
                              )}
                              {task.status !== 'CONCLUIDA' ? (
                                <>
                                  <button
                                    onClick={() => openTransferModal(task)}
                                    className="px-2 py-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 text-[11px] font-bold cursor-pointer"
                                    title="Transferir (@)"
                                  >
                                    @
                                  </button>
                                  <button
                                    onClick={() => handleCompleteTask(task)}
                                    className="px-2 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"
                                    title="Concluir"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleReopenTask(task)}
                                  className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <RotateCcw className="w-3 h-3" /> Reabrir
                                </button>
                              )}
                              <button
                                onClick={() => setSelectedTaskId(task.id)}
                                className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold cursor-pointer"
                                title="Abrir Detalhes e Checklist"
                              >
                                Abrir
                              </button>
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
            ABA SEPARADA: PAINEL DE ANÁLISE & SLA (ENTREGAS, DISTRIBUIÇÃO, VENCIMENTOS, ATRASOS)
        ========================================== */}
        {activeTab === 'ANALISE_SLA' && (
          <div className="space-y-5">
            {/* Cabeçalho do Painel de Análise & SLA com Data de Referência e Filtros Simples */}
            <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-5 border border-slate-800 shadow-md space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>PAINEL EXECUTIVO DE ANÁLISE, SLA, PRAZOS & ENTREGAS</span>
                  </div>
                  <h2 className="text-base sm:text-lg font-extrabold text-white">
                    Visão Consolidada de Tarefas, Entregas, Distribuição, Vencimentos e Atrasos
                  </h2>
                  <p className="text-xs text-slate-300 max-w-3xl">
                    Analise de forma simples o cumprimento dos prazos (SLA), obrigações vencidas ou que vencem hoje, equilíbrio da carga entre analistas e gargalos por departamento.
                  </p>
                </div>

                {/* Seletor de Data Base para Simulação/Análise de Vencimentos */}
                <div className="flex flex-wrap items-center gap-3 bg-slate-900/90 p-3 rounded-xl border border-slate-700">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-amber-300">
                      Data Base p/ Cálculo de Atraso/Vencimento:
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="date"
                        value={analysisRefDate}
                        onChange={(e) => setAnalysisRefDate(e.target.value || '2026-10-30')}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() => setAnalysisRefDate('2026-10-30')}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer"
                        title="Voltar para 30/10/2026"
                      >
                        30/10/2026
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnalysisRefDate('2026-11-12')}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-bold cursor-pointer"
                        title="Simular dia 12/11/2026 para testar atrasos"
                      >
                        Simular 12/11
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Barra de Filtros Rápidos do Painel Analítico */}
              <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Departamento</label>
                  <select
                    value={analysisDeptFilter}
                    onChange={(e) => setAnalysisDeptFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-none"
                  >
                    <option value="TODOS">Todos os Departamentos (Contábil + Fiscal)</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        Departamento {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Competência</label>
                  <select
                    value={analysisCompetenceFilter}
                    onChange={(e) => setAnalysisCompetenceFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-none"
                  >
                    <option value="TODAS">Todas as Competências</option>
                    {slaAnalysisData.distinctCompetences.map((comp) => (
                      <option key={comp} value={comp}>
                        Competência {comp}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Responsável / Analista</label>
                  <select
                    value={analysisAssigneeFilter}
                    onChange={(e) => setAnalysisAssigneeFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-none"
                  >
                    <option value="TODOS">Toda a Equipe ({TEAM_MEMBERS.length} integrantes)</option>
                    {TEAM_MEMBERS.map((m) => (
                      <option key={m.id} value={m.id}>
                        @{m.name} ({USER_CATEGORIES_CONFIG[m.category || 'ANALISTA']?.shortLabel})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Busca Rápida</label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={analysisSearchQuery}
                      onChange={(e) => setAnalysisSearchQuery(e.target.value)}
                      placeholder="Código, tarefa, grupo, sub-grupo..."
                      className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 6 CARDS DE DIAGNÓSTICO RÁPIDO (CLICÁVEIS PARA FILTRAR) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div
                onClick={() => setAnalysisSlaFilter(analysisSlaFilter === 'ENTREGUES' ? 'TODAS' : 'ENTREGUES')}
                className={`p-4 rounded-xl border bg-white transition-all cursor-pointer ${
                  analysisSlaFilter === 'ENTREGUES'
                    ? 'ring-2 ring-emerald-600 border-emerald-600 shadow-sm'
                    : 'border-emerald-200 hover:border-emerald-400'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-extrabold uppercase text-emerald-800">
                  <span>ENTREGUES / CONCL.</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-emerald-700">
                    {slaAnalysisData.entregues}/{slaAnalysisData.total}
                  </span>
                  <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                    {slaAnalysisData.pctEntregue}%
                  </span>
                </div>
                <div className="mt-2 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${slaAnalysisData.pctEntregue}%` }} />
                </div>
              </div>

              <div
                onClick={() => setAnalysisSlaFilter(analysisSlaFilter === 'ATRASADAS' ? 'TODAS' : 'ATRASADAS')}
                className={`p-4 rounded-xl border bg-white transition-all cursor-pointer ${
                  analysisSlaFilter === 'ATRASADAS'
                    ? 'ring-2 ring-rose-600 border-rose-600 shadow-sm'
                    : 'border-rose-200 hover:border-rose-400'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-extrabold uppercase text-rose-800">
                  <span>EM ATRASO (VENCIDAS)</span>
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-rose-700">{slaAnalysisData.atrasadas}</span>
                  <span className="text-[11px] font-bold text-rose-700">
                    {slaAnalysisData.total > 0
                      ? `${Math.round((slaAnalysisData.atrasadas / slaAnalysisData.total) * 100)}% do lote`
                      : '0%'}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Vencimento anterior a {analysisRefDate.split('-').reverse().join('/')}
                </div>
              </div>

              <div
                onClick={() => setAnalysisSlaFilter(analysisSlaFilter === 'VENCE_HOJE' ? 'TODAS' : 'VENCE_HOJE')}
                className={`p-4 rounded-xl border bg-white transition-all cursor-pointer ${
                  analysisSlaFilter === 'VENCE_HOJE'
                    ? 'ring-2 ring-amber-500 border-amber-500 shadow-sm'
                    : 'border-amber-200 hover:border-amber-400'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-extrabold uppercase text-amber-800">
                  <span>VENCEM HOJE</span>
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-amber-700">{slaAnalysisData.venceHoje}</span>
                  <span className="text-[11px] font-bold text-amber-800">Prioridade Dia</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Prazo limite em {analysisRefDate.split('-').reverse().join('/')}
                </div>
              </div>

              <div
                onClick={() => setAnalysisSlaFilter(analysisSlaFilter === 'PROXIMAS_3_DIAS' ? 'TODAS' : 'PROXIMAS_3_DIAS')}
                className={`p-4 rounded-xl border bg-white transition-all cursor-pointer ${
                  analysisSlaFilter === 'PROXIMAS_3_DIAS'
                    ? 'ring-2 ring-orange-500 border-orange-500 shadow-sm'
                    : 'border-orange-200 hover:border-orange-400'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-extrabold uppercase text-orange-800">
                  <span>PRÓXIMOS 3 DIAS</span>
                  <Calendar className="w-4 h-4 text-orange-600" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-orange-700">{slaAnalysisData.proximas3Dias}</span>
                  <span className="text-[11px] font-bold text-orange-700">Curto Prazo</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Janela preventiva de 1 a 3 dias
                </div>
              </div>

              <div
                onClick={() => setAnalysisSlaFilter(analysisSlaFilter === 'BLOQUEADAS' ? 'TODAS' : 'BLOQUEADAS')}
                className={`p-4 rounded-xl border bg-white transition-all cursor-pointer ${
                  analysisSlaFilter === 'BLOQUEADAS'
                    ? 'ring-2 ring-purple-600 border-purple-600 shadow-sm'
                    : 'border-purple-200 hover:border-purple-400'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-extrabold uppercase text-purple-800">
                  <span>TRAVADAS (@ / PAUSA)</span>
                  <ArrowRightLeft className="w-4 h-4 text-purple-600" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-purple-700">{slaAnalysisData.bloqueadas}</span>
                  <span className="text-[11px] font-bold text-purple-700">
                    {slaAnalysisData.criticasAbertas} críticas abertas
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Dependência @ ou cronômetro pausado
                </div>
              </div>

              <div
                onClick={() => setAnalysisSlaFilter('TODAS')}
                className="p-4 rounded-xl border border-slate-200 bg-white cursor-pointer"
              >
                <div className="flex items-center justify-between text-[11px] font-extrabold uppercase text-slate-600">
                  <span>TOTAL MONITORADO</span>
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xl font-extrabold text-slate-900">
                    {slaAnalysisData.total} tarefas
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Entregas concluídas: <strong className="font-bold text-emerald-700">{slaAnalysisData.entregues}</strong> ({slaAnalysisData.total > 0 ? Math.round((slaAnalysisData.entregues / slaAnalysisData.total) * 100) : 0}%)
                </div>
              </div>
            </div>

            {/* ========================================================
                SEÇÃO DEDICADA DE ALERTAS & LEMBRETES 24 HORAS NO PAINEL SLA
            ======================================================== */}
            <div className="bg-white rounded-2xl border border-amber-300/90 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-slate-950 via-amber-950 to-slate-900 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300">
                    <AlarmClock className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                        Central Ativa de Lembretes 24 Horas & Prazos Iminentes
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950">
                        {reminders24hData.urgentItems.length} alerta(s) ativo(s)
                      </span>
                      {reminders24hData.overdueCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
                          {reminders24hData.overdueCount} vencida(s)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Monitoramento contínuo de tarefas que vencem hoje ou dentro de 24 horas em relação à data base{' '}
                      <strong className="font-mono text-white">{analysisRefDate.split('-').reverse().join('/')}</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsReminderModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                  >
                    <BellRing className="w-3.5 h-3.5" />
                    <span>Abrir Central Completa</span>
                  </button>
                </div>
              </div>

              {reminders24hData.urgentItems.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <p className="text-sm font-bold text-slate-800">
                    Nenhuma tarefa vencendo nas próximas 24 horas!
                  </p>
                  <p className="text-xs text-slate-500">
                    Todas as tarefas ativas estão com prazos seguros em relação à data de referência selecionada.
                  </p>
                </div>
              ) : (
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {reminders24hData.urgentItems.map((item) => {
                      const { task, isOverdue, countdownLabel, branchStats } = item;
                      const isMine = task.assignee === currentUser;
                      const stCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.PENDENTE;
                      return (
                        <div
                          key={task.id}
                          className={`p-4 rounded-xl border transition-all space-y-3 ${
                            isOverdue
                              ? 'bg-rose-50/70 border-rose-300 hover:border-rose-400'
                              : 'bg-amber-50/60 border-amber-300 hover:border-amber-400'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                                  task.category === 'AVULSA' ? 'bg-amber-200 text-amber-950' : 'bg-slate-900 text-white'
                                }`}
                              >
                                {task.code}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black border uppercase tracking-wide ${
                                  isOverdue
                                    ? 'bg-rose-200 text-rose-950 border-rose-400 animate-pulse'
                                    : 'bg-amber-200 text-amber-950 border-amber-400'
                                }`}
                              >
                                {countdownLabel}
                              </span>
                            </div>

                            <span className="text-[11px] font-bold text-slate-600 font-mono">
                              Venc: {(task.dueDate || '').split('-').reverse().join('/')}
                            </span>
                          </div>

                          <div>
                            <button
                              onClick={() => setSelectedTaskId(task.id)}
                              className="text-xs sm:text-sm font-bold text-slate-900 hover:text-indigo-600 line-clamp-2 text-left cursor-pointer transition-colors"
                            >
                              {task.title}
                            </button>
                            <div className="flex items-center justify-between text-xs text-slate-500 mt-1.5">
                              <span
                                className={`font-bold ${
                                  isMine ? 'text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200' : 'text-slate-700'
                                }`}
                              >
                                @{task.assignee} {isMine && '(Você)'}
                              </span>
                              <span className="text-[11px] font-medium text-slate-600">
                                Status: <strong className={stCfg.text}>{stCfg.label}</strong> • {branchStats.percent}% Filiais
                              </span>
                            </div>
                          </div>

                          {/* Ações imediatas do lembrete */}
                          <div className="pt-2.5 border-t border-slate-200/80 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              {task.status !== 'EM_ANDAMENTO' && task.status !== 'CONCLUIDA' && (
                                <button
                                  onClick={() => handleStartTask(task, 'ALL')}
                                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Play className="w-3 h-3 fill-white" /> Iniciar
                                </button>
                              )}
                              {task.status === 'EM_ANDAMENTO' && (
                                <button
                                  onClick={() => openPauseModal(task, 'ALL')}
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Pause className="w-3 h-3 fill-white" /> Pausar
                                </button>
                              )}
                              {task.status !== 'CONCLUIDA' && (
                                <button
                                  onClick={() => handleCompleteTask(task, 'ALL')}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Check className="w-3 h-3" /> Concluir
                                </button>
                              )}
                              <button
                                onClick={() => openTransferModal(task, 'ALL')}
                                className="px-2 py-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 text-[11px] font-bold cursor-pointer transition-colors"
                                title="Transferir responsável"
                              >
                                @
                              </button>
                            </div>

                            <button
                              onClick={() => setSelectedTaskId(task.id)}
                              className="text-xs font-bold text-slate-700 hover:text-indigo-600 underline cursor-pointer"
                            >
                              Detalhes →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* BLOCOS ANALÍTICOS LADO A LADO:
                1) RÉGUA DE VENCIMENTOS E ATRASOS (AGING)
                2) DISTRIBUIÇÃO DE CARGA, ENTREGAS E ATRASOS POR ANALISTA */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Bloco 1: Régua de Vencimentos & Atrasos (5 colunas) */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-rose-600" />
                      Régua de Vencimentos & SLA (Clique para Filtrar)
                    </h3>
                    {analysisSlaFilter !== 'TODAS' && (
                      <button
                        onClick={() => setAnalysisSlaFilter('TODAS')}
                        className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        Mostrar todas ✕
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Classificação automática das obrigações em relação à data base ({analysisRefDate.split('-').reverse().join('/')}).
                  </p>

                  <div className="mt-4 space-y-2.5">
                    {[
                      {
                        key: 'ATRASADAS',
                        label: '🔴 Em Atraso (Vencidas)',
                        desc: 'Prazo ultrapassado e ainda pendente de conclusão',
                        count: slaAnalysisData.atrasadas,
                        barCls: 'bg-rose-600',
                        boxCls: 'border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-rose-950'
                      },
                      {
                        key: 'VENCE_HOJE',
                        label: '🟠 Vencem Hoje (Alerta Máximo)',
                        desc: 'Data limite coincide com a data de referência',
                        count: slaAnalysisData.venceHoje,
                        barCls: 'bg-amber-500',
                        boxCls: 'border-amber-200 bg-amber-50/50 hover:bg-amber-50 text-amber-950'
                      },
                      {
                        key: 'PROXIMAS_3_DIAS',
                        label: '🟡 Vencem nos Próximos 3 Dias',
                        desc: 'Obrigações que requerem priorização imediata',
                        count: slaAnalysisData.proximas3Dias,
                        barCls: 'bg-orange-500',
                        boxCls: 'border-orange-200 bg-orange-50/40 hover:bg-orange-50 text-orange-950'
                      },
                      {
                        key: 'NO_PRAZO',
                        label: '🔵 No Prazo (4+ dias para vencer)',
                        desc: 'Dentro do calendário regular de fechamento',
                        count: slaAnalysisData.noPrazo,
                        barCls: 'bg-sky-500',
                        boxCls: 'border-sky-200 bg-sky-50/40 hover:bg-sky-50 text-sky-950'
                      },
                      {
                        key: 'ENTREGUES',
                        label: '🟢 Entregues / Concluídas',
                        desc: 'Obrigações 100% finalizadas no período',
                        count: slaAnalysisData.entregues,
                        barCls: 'bg-emerald-600',
                        boxCls: 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 text-emerald-950'
                      }
                    ].map((row) => {
                      const pct =
                        slaAnalysisData.total > 0 ? Math.round((row.count / slaAnalysisData.total) * 100) : 0;
                      const isSel = analysisSlaFilter === row.key;
                      return (
                        <div
                          key={row.key}
                          onClick={() => setAnalysisSlaFilter(isSel ? 'TODAS' : row.key)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer ${row.boxCls} ${
                            isSel ? 'ring-2 ring-slate-900 shadow-xs' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-extrabold">
                            <span>{row.label}</span>
                            <span className="font-mono">
                              {row.count} tarefa(s) ({pct}%)
                            </span>
                          </div>
                          <div className="text-[11px] opacity-75 mt-0.5">{row.desc}</div>
                          <div className="mt-2 w-full h-2 bg-white/80 rounded-full overflow-hidden border border-slate-200/60">
                            <div className={`h-full ${row.barCls}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Resumo de Caminho Crítico */}
                <div
                  onClick={() => setAnalysisSlaFilter(analysisSlaFilter === 'CRITICAS' ? 'TODAS' : 'CRITICAS')}
                  className="p-3.5 rounded-xl bg-slate-900 text-white flex items-center justify-between cursor-pointer hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-xs font-extrabold">Obrigações de Caminho Crítico (Prioridade Diretoria)</div>
                      <div className="text-[11px] text-slate-300">
                        {slaAnalysisData.criticasAbertas} crítica(s) ainda pendente(s) de conclusão
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 text-xs font-extrabold">
                    Filtrar Críticas →
                  </span>
                </div>
              </div>

              {/* Bloco 2: Distribuição de Tarefas, Entregas e Atrasos por Analista (7 colunas) */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-600" />
                      Distribuição de Carga, Entregas, Atrasos e Tempo por Analista
                    </h3>
                    <p className="text-xs text-slate-500">
                      Compare volume atribuído, taxa de entrega, atrasos vencidos e horas apontadas por membro da equipe.
                    </p>
                  </div>
                  {analysisAssigneeFilter !== 'TODOS' && (
                    <button
                      onClick={() => setAnalysisAssigneeFilter('TODOS')}
                      className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                      Exibir todos os analistas ✕
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-white">
                        <th className="p-2.5 rounded-tl-lg">Integrante / Perfil</th>
                        <th className="p-2.5 text-center">Carga (% Equipe)</th>
                        <th className="p-2.5 text-center">Entregues</th>
                        <th className="p-2.5 text-center">Em Atraso</th>
                        <th className="p-2.5 text-center">Vence Hoje/3d</th>
                        <th className="p-2.5 text-center">Dep. (@)</th>
                        <th className="p-2.5 text-center">Em Andamento</th>
                        <th className="p-2.5 rounded-tr-lg text-center">Status Carteira</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {slaAnalysisData.byAnalyst.map((an) => {
                        const isSelected = analysisAssigneeFilter === an.id;
                        const statusBadge =
                          an.atrasadas > 0
                            ? { label: `${an.atrasadas} em Atraso`, cls: 'bg-rose-100 text-rose-900 border-rose-300' }
                            : an.venceHoje > 0
                            ? { label: `${an.venceHoje} Vence Hoje`, cls: 'bg-amber-100 text-amber-900 border-amber-300' }
                            : an.total > 0 && an.entregues === an.total
                            ? { label: '100% Entregue', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300' }
                            : { label: 'Em Dia', cls: 'bg-sky-100 text-sky-900 border-sky-300' };

                        return (
                          <tr
                            key={an.id}
                            onClick={() => setAnalysisAssigneeFilter(isSelected ? 'TODOS' : an.id)}
                            className={`transition-colors cursor-pointer ${
                              isSelected ? 'bg-indigo-50/90 font-semibold' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="p-2.5">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-7 h-7 rounded-lg ${an.color} text-white text-xs font-extrabold flex items-center justify-center shrink-0`}
                                >
                                  {an.avatar}
                                </span>
                                <div>
                                  <div className="font-extrabold text-slate-900">@{an.name}</div>
                                  <div className="text-[10px] text-slate-500">
                                    {USER_CATEGORIES_CONFIG[an.category || 'ANALISTA']?.shortLabel} • {an.department || 'Contábil'}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="p-2.5 text-center">
                              <div className="font-mono font-extrabold text-slate-900">{an.total} tarefas</div>
                              <div className="text-[10px] text-slate-500">{an.shareOfTeam}% da carga total</div>
                            </td>

                            <td className="p-2.5 text-center">
                              <div className="font-mono font-extrabold text-emerald-700">
                                {an.entregues}/{an.total} ({an.pctEntregue}%)
                              </div>
                              <div className="w-16 mx-auto h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
                                <div className="h-full bg-emerald-600" style={{ width: `${an.pctEntregue}%` }} />
                              </div>
                            </td>

                            <td className="p-2.5 text-center">
                              {an.atrasadas > 0 ? (
                                <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-mono font-extrabold text-xs">
                                  {an.atrasadas}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-mono">0</span>
                              )}
                            </td>

                            <td className="p-2.5 text-center font-mono font-bold text-amber-800">
                              {an.venceHoje + an.proximas}
                            </td>

                            <td className="p-2.5 text-center font-mono font-bold text-purple-700">
                              {an.aguardandoDep}
                            </td>

                            <td className="p-2.5 text-center font-mono font-extrabold text-blue-700">
                              {an.emAndamento}
                            </td>

                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold ${statusBadge.cls}`}>
                                {statusBadge.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Resumo por Departamento e Grupo Contábil / Fiscal */}
                <div className="pt-3 border-t border-slate-200">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-2.5">
                    Entregas e Atrasos por Departamento & Grupo de Fechamento:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {slaAnalysisData.byGroup.map((grp: any) => (
                      <div
                        key={grp.key}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                grp.department === 'Fiscal'
                                  ? 'bg-teal-100 text-teal-900'
                                  : 'bg-indigo-100 text-indigo-900'
                              }`}
                            >
                              {grp.department}
                            </span>
                            <span className="text-xs font-extrabold text-slate-900 truncate">{grp.group}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                            <span>{grp.entregues}/{grp.total} entregues ({grp.pct}%)</span>
                            {grp.atrasadas > 0 && (
                              <span className="text-rose-700 font-extrabold">• {grp.atrasadas} atrasada(s)</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono text-xs font-extrabold text-emerald-700">
                            {grp.pct}%
                          </div>
                          <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
                            <div className="h-full bg-emerald-600" style={{ width: `${grp.pct}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* TABELA DETALHADA DE ANÁLISE DE TAREFAS, VENCIMENTOS, ATRASOS E ENTREGAS */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <ListTodo className="w-4 h-4 text-indigo-600" />
                    Planilha Analítica de Obrigações, Prazos (SLA), Atrasos e Progresso nas 40 Filiais ({slaAnalysisData.tableTasks.length} registros)
                  </h3>
                  <p className="text-xs text-slate-600">
                    Ordenada automaticamente por criticidade de prazo (obrigações atrasadas e que vencem hoje aparecem no topo).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'TODAS', label: `Todas (${slaAnalysisData.total})` },
                    { id: 'ATRASADAS', label: `🔴 Atrasadas (${slaAnalysisData.atrasadas})` },
                    { id: 'VENCE_HOJE', label: `🟠 Vence Hoje (${slaAnalysisData.venceHoje})` },
                    { id: 'PROXIMAS_3_DIAS', label: `🟡 Próx. 3 Dias (${slaAnalysisData.proximas3Dias})` },
                    { id: 'BLOQUEADAS', label: `🟣 Travadas @/Pausa (${slaAnalysisData.bloqueadas})` },
                    { id: 'ENTREGUES', label: `🟢 Entregues (${slaAnalysisData.entregues})` }
                  ].map((fBtn) => (
                    <button
                      key={fBtn.id}
                      onClick={() => setAnalysisSlaFilter(fBtn.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                        analysisSlaFilter === fBtn.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {fBtn.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto max-h-[65vh]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-900 text-white sticky top-0 z-20">
                    <tr>
                      <th className="p-3 border-r border-slate-800">Diagnóstico de Prazo (SLA)</th>
                      <th className="p-3 border-r border-slate-800 text-center">Vencimento / Comp.</th>
                      <th className="p-3 border-r border-slate-800">Código & Obrigação</th>
                      <th className="p-3 border-r border-slate-800">Depto / Grupo / Sub-Grupo</th>
                      <th className="p-3 border-r border-slate-800">Responsável</th>
                      <th className="p-3 border-r border-slate-800 text-center">Status Execução</th>
                      <th className="p-3 border-r border-slate-800 text-center">Entrega 40 Filiais</th>
                      <th className="p-3 text-center">Ações Diretas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {slaAnalysisData.tableTasks.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-500 font-medium">
                          Nenhuma tarefa encontrada para o filtro de SLA selecionado.
                        </td>
                      </tr>
                    ) : (
                      slaAnalysisData.tableTasks.map((t: any) => {
                        const stCfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.PENDENTE;
                        const member = TEAM_MEMBERS.find((m) => m.id === t.assignee) || TEAM_MEMBERS[0];
                        return (
                          <tr
                            key={t.id}
                            className={`hover:bg-slate-50 transition-colors ${
                              t.slaBucket === 'ATRASADA' ? 'bg-rose-50/30' : ''
                            }`}
                          >
                            <td className="p-2.5 border-r border-slate-200">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-extrabold ${t.slaBadgeCls}`}
                              >
                                {t.slaLabel}
                              </span>
                            </td>

                            <td className="p-2.5 border-r border-slate-200 text-center">
                              <div className="font-mono font-extrabold text-slate-900">
                                {(t.dueDate || '2026-10-30').split('-').reverse().join('/')}
                              </div>
                              <div className="text-[10px] text-slate-500 font-semibold">
                                Comp: {t.competence || '10/2026'}
                              </div>
                            </td>

                            <td className="p-2.5 border-r border-slate-200">
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-[10px] font-extrabold">
                                  {t.code}
                                </span>
                                {t.isCritical && (
                                  <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-extrabold">
                                    Crítica
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => setSelectedTaskId(t.id)}
                                className="mt-1 text-left font-bold text-slate-900 hover:text-indigo-600 cursor-pointer block"
                              >
                                {t.title}
                              </button>
                            </td>

                            <td className="p-2.5 border-r border-slate-200">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                  t.department === 'Fiscal'
                                    ? 'bg-teal-100 text-teal-900'
                                    : 'bg-indigo-100 text-indigo-900'
                                }`}
                              >
                                {t.department || 'Contábil'}
                              </span>
                              <div className="text-[11px] font-semibold text-slate-800 mt-0.5">
                                {t.group || t.topic}
                              </div>
                              <div className="text-[10px] text-slate-500">{t.subGroup || t.accountingType}</div>
                            </td>

                            <td className="p-2.5 border-r border-slate-200">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`w-6 h-6 rounded-full ${member.color} text-white text-[10px] font-extrabold flex items-center justify-center shrink-0`}
                                >
                                  {member.avatar}
                                </span>
                                <span className="font-bold text-slate-900">@{t.assignee}</span>
                              </div>
                            </td>

                            <td className="p-2.5 border-r border-slate-200 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${stCfg.bg} ${stCfg.text} ${stCfg.border}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${stCfg.dot}`} />
                                {stCfg.label}
                              </span>
                              {t.dependencyInfo && (
                                <div className="text-[10px] text-purple-700 font-bold mt-0.5">
                                  Depende de @{t.dependencyInfo.toUser}
                                </div>
                              )}
                            </td>

                            <td className="p-2.5 border-r border-slate-200 text-center">
                              <div className="font-mono font-extrabold text-slate-900">
                                {t.branchStats.ok + t.branchStats.na}/{t.branchStats.total} ({t.branchStats.percent}%)
                              </div>
                              <div className="w-20 mx-auto h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
                                <div
                                  className="h-full bg-emerald-600"
                                  style={{ width: `${t.branchStats.percent}%` }}
                                />
                              </div>
                            </td>

                            <td className="p-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => setSelectedTaskId(t.id)}
                                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold cursor-pointer"
                                >
                                  Abrir
                                </button>
                                {t.status !== 'CONCLUIDA' && t.status !== 'EM_ANDAMENTO' && (
                                  <button
                                    onClick={() => handleStartTask(t)}
                                    className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold cursor-pointer"
                                    title="Iniciar Cronômetro"
                                  >
                                    Iniciar
                                  </button>
                                )}
                                {t.status !== 'CONCLUIDA' && (
                                  <button
                                    onClick={() => handleCompleteTask(t)}
                                    className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer"
                                    title="Concluir Obrigação"
                                  >
                                    ✓
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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
                    Matriz de Carga, Status e Entregas por Analista Contábil
                  </h2>
                </div>
                <div className="text-xs font-mono font-bold bg-slate-900 text-white px-3 py-1.5 rounded-lg">
                  Entregas Gerais: {kpis.concluidas}/{tasks.length} ({kpis.percentConcluido}%)
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
                        <span className="text-xs text-slate-600 flex items-center gap-1.5 font-bold">
                          <Play className="w-3.5 h-3.5 text-blue-600 fill-blue-600" /> Em Andamento:
                        </span>
                        <span className="font-mono text-sm font-extrabold text-blue-700">{um.emAndamento} ativa(s)</span>
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
        </div>
      </div>

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
          MODAL DE NOVA TAREFA (BUSCA DO CADASTRO PADRÃO OU AVULSA) (z-[100])
      ========================================== */}
      {isNewTaskModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Lançar Nova Obrigação (Do Cadastro Padrão) ou Tarefa Avulsa / Esporádica</span>
              </div>
              <button onClick={() => setIsNewTaskModalOpen(false)} className="text-white/80 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleCreateNewTask} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              {/* Seletor de Tipo: Fechamento (Busca do Cadastro Padrão) vs. Avulsa */}
              <div className="grid grid-cols-2 gap-2.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    const tpl = taskTemplates.find((t) => t.id === newTaskForm.templateId) || taskTemplates[0];
                    if (tpl) applyTemplateToNewTaskForm(tpl);
                    else setNewTaskForm((prev) => ({ ...prev, category: 'FECHAMENTO', recurrence: 'MENSAL' }));
                  }}
                  className={`py-2.5 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    newTaskForm.category === 'FECHAMENTO'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>📅 Rotina de Fechamento (Do Cadastro Padrão)</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setNewTaskForm({
                      templateId: '',
                      standardCode: '',
                      title: '',
                      department: 'Contábil',
                      group: 'Demanda Avulsa / Dia a Dia',
                      subGroup: 'Societário',
                      category: 'AVULSA',
                      topic: 'Demanda Avulsa / Dia a Dia',
                      accountingType: 'Societário',
                      competenceType: 'MENSAL',
                      competence: '10/2026',
                      dueDate: '2026-10-30',
                      recurrence: 'ESPORADICA',
                      assignee: currentUser,
                      isCritical: false,
                      startImmediately: true,
                      initialNote: '',
                      companyScope: 'ALL',
                      customBranches: ['010101'],
                      checklistKey: '',
                      customChecklistItems: [],
                      evidenceUrl: ''
                    })
                  }
                  className={`py-2.5 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    newTaskForm.category === 'AVULSA'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span>⚡ Tarefa Avulsa / Esporádica (Livre)</span>
                </button>
              </div>

              {/* BLOCO DE BUSCA NO CADASTRO PADRÃO (QUANDO FECHAMENTO) */}
              {newTaskForm.category === 'FECHAMENTO' && (
                <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-indigo-600" />
                      <span>1. Buscar no Cadastro de Tarefas Padrão de Fechamento *</span>
                    </label>
                    <button
                      type="button"
                      onClick={openCreateTemplateModal}
                      className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Cadastrar Novo Padrão no Catálogo
                    </button>
                  </div>

                  {/* Filtro rápido de busca no catálogo */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={templatePickerFilter}
                      onChange={(e) => setTemplatePickerFilter(e.target.value)}
                      placeholder="Pesquisar por código (CTB-01, FIS-01), departamento, grupo, sub-grupo ou descrição..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>

                  {/* Lista selecionável do Cadastro Padrão */}
                  <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                    {taskTemplates
                      .filter((tpl) => {
                        if (!templatePickerFilter.trim()) return true;
                        const q = templatePickerFilter.toLowerCase();
                        return (
                          tpl.standardCode?.toLowerCase().includes(q) ||
                          tpl.title?.toLowerCase().includes(q) ||
                          tpl.department?.toLowerCase().includes(q) ||
                          (tpl.group || tpl.topic || '').toLowerCase().includes(q) ||
                          (tpl.subGroup || tpl.accountingType || '').toLowerCase().includes(q)
                        );
                      })
                      .map((tpl) => {
                        const isSelected = newTaskForm.templateId === tpl.id;
                        const isLaunched = tasks.some(
                          (t) => t.templateId === tpl.id || t.code === tpl.standardCode
                        );
                        return (
                          <div
                            key={tpl.id}
                            onClick={() => applyTemplateToNewTaskForm(tpl)}
                            className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                                : 'bg-white hover:bg-indigo-50/60 text-slate-800 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`px-2 py-0.5 rounded font-mono text-[10px] font-extrabold shrink-0 ${
                                  isSelected ? 'bg-white text-indigo-900' : 'bg-slate-900 text-white'
                                }`}
                              >
                                {tpl.standardCode}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                  isSelected
                                    ? 'bg-indigo-800 text-indigo-100'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {tpl.department} • {tpl.group || tpl.topic} ▸ {tpl.subGroup || tpl.accountingType}
                              </span>
                              <span className="font-bold truncate">{tpl.title}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-[10px] ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                                @{tpl.defaultAssignee}
                              </span>
                              {isLaunched && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    isSelected ? 'bg-indigo-800 text-emerald-300' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}
                                >
                                  Já ativa
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Segregação Hierárquica: Departamento, Grupo e Sub-Grupo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Departamento *</label>
                  <select
                    value={newTaskForm.department}
                    onChange={(e) => setNewTaskForm((prev) => ({ ...prev, department: e.target.value }))}
                    disabled={newTaskForm.category === 'FECHAMENTO'}
                    className={`w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg font-bold ${
                      newTaskForm.category === 'FECHAMENTO' ? 'bg-slate-100 text-slate-700' : 'bg-white'
                    }`}
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Grupo *</label>
                  <select
                    value={newTaskForm.group}
                    onChange={(e) =>
                      setNewTaskForm((prev) => ({
                        ...prev,
                        group: e.target.value,
                        topic: e.target.value
                      }))
                    }
                    disabled={newTaskForm.category === 'FECHAMENTO'}
                    className={`w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg ${
                      newTaskForm.category === 'FECHAMENTO' ? 'bg-slate-100 font-semibold text-slate-700' : 'bg-white'
                    }`}
                  >
                    {GROUPS_OPTIONS.map((grp) => (
                      <option key={grp} value={grp}>
                        {grp}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sub-Grupo *</label>
                  <select
                    value={newTaskForm.subGroup}
                    onChange={(e) =>
                      setNewTaskForm((prev) => ({
                        ...prev,
                        subGroup: e.target.value,
                        accountingType: e.target.value
                      }))
                    }
                    disabled={newTaskForm.category === 'FECHAMENTO'}
                    className={`w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg ${
                      newTaskForm.category === 'FECHAMENTO' ? 'bg-slate-100 font-semibold text-slate-700' : 'bg-white'
                    }`}
                  >
                    {SUBGROUPS_OPTIONS.map((sg) => (
                      <option key={sg} value={sg}>
                        {sg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Descrição da Tarefa (somente leitura se Fechamento, editável se Avulsa) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {newTaskForm.category === 'FECHAMENTO'
                      ? `Descrição da Tarefa (${newTaskForm.standardCode || 'Catálogo'}) *`
                      : 'Descrição da Tarefa *'}
                  </label>
                  {newTaskForm.category === 'FECHAMENTO' && (
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      🔒 Padronizado pelo Cadastro Mestre
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={newTaskForm.title}
                  onChange={(e) => setNewTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                  readOnly={newTaskForm.category === 'FECHAMENTO'}
                  placeholder="Ex: Amortização - SEGUROS (Imóveis e Veículos)..."
                  className={`w-full px-3 py-2 text-xs sm:text-sm border rounded-lg focus:outline-none ${
                    newTaskForm.category === 'FECHAMENTO'
                      ? 'bg-slate-100 border-slate-300 text-slate-800 font-bold cursor-not-allowed'
                      : 'bg-white border-slate-300 focus:ring-2 focus:ring-slate-900'
                  }`}
                  required
                />
              </div>

              {/* Competência (Mensal ou Anual), Vencimento e Recorrência */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tipo Competência *</label>
                  <select
                    value={newTaskForm.competenceType}
                    onChange={(e) => {
                      const cType = e.target.value;
                      setNewTaskForm((prev) => ({
                        ...prev,
                        competenceType: cType,
                        competence: cType === 'ANUAL' ? '2025' : '10/2026'
                      }));
                    }}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white font-semibold"
                  >
                    <option value="MENSAL">Mensal (MM/AAAA)</option>
                    <option value="ANUAL">Anual (AAAA)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Competência ({newTaskForm.competenceType === 'ANUAL' ? 'Ex: 2025' : 'Ex: 10/2026'}) *
                  </label>
                  <input
                    type="text"
                    value={newTaskForm.competence}
                    onChange={(e) => setNewTaskForm((prev) => ({ ...prev, competence: e.target.value }))}
                    placeholder={newTaskForm.competenceType === 'ANUAL' ? '2025' : '10/2026'}
                    className="w-full px-2.5 py-2 text-xs font-mono font-bold border border-slate-300 rounded-lg bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Vencimento *</label>
                  <input
                    type="date"
                    value={newTaskForm.dueDate}
                    onChange={(e) => setNewTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Recorrência *</label>
                  <select
                    value={newTaskForm.recurrence}
                    onChange={(e) => setNewTaskForm((prev) => ({ ...prev, recurrence: e.target.value }))}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white font-bold"
                  >
                    <option value="ESPORADICA">Esporádica</option>
                    <option value="MENSAL">Mensal</option>
                    <option value="TRIMESTRAL">Trimestral</option>
                    <option value="ANUAL">Anual</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Responsável pela Execução</label>
                  <select
                    value={newTaskForm.assignee}
                    onChange={(e) => setNewTaskForm((prev) => ({ ...prev, assignee: e.target.value }))}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white font-semibold"
                  >
                    {TEAM_MEMBERS.map((m) => (
                      <option key={m.id} value={m.id}>@{m.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Escopo de Empresas</label>
                  <select
                    value={newTaskForm.companyScope}
                    onChange={(e) => setNewTaskForm((prev) => ({ ...prev, companyScope: e.target.value }))}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="ALL">Todas as 40 Empresas</option>
                    <option value="MATRIZ_010101">Apenas Matriz (010101)</option>
                    <option value="HOLDING_040101">Apenas Holding (040101)</option>
                  </select>
                </div>
              </div>

              {/* Checklist da Tarefa com suporte a Modelos Reutilizáveis */}
              <div className="p-3.5 rounded-xl bg-purple-50/50 border border-purple-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-purple-600" />
                    <span>Checklist Operacional Vinculado</span>
                  </label>
                  <span className="text-[10px] text-purple-700 font-medium">Modelos padronizados</span>
                </div>

                <select
                  value={newTaskForm.checklistKey}
                  onChange={(e) => {
                    const key = e.target.value;
                    const found = checklistTemplates.find((c) => c.id === key);
                    setNewTaskForm((prev) => ({
                      ...prev,
                      checklistKey: key,
                      customChecklistItems: found ? found.items : []
                    }));
                  }}
                  className="w-full px-2.5 py-2 text-xs border border-purple-300 rounded-lg bg-white font-medium"
                >
                  <option value="">Nenhum checklist vinculado</option>
                  <optgroup label="Modelos Contábeis">
                    {checklistTemplates
                      .filter((c) => c.department === 'Contábil')
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.items.length} etapas)
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Modelos Fiscais">
                    {checklistTemplates
                      .filter((c) => c.department === 'Fiscal')
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.items.length} etapas)
                        </option>
                      ))}
                  </optgroup>
                  {checklistTemplates.some((c) => c.department === 'Geral') && (
                    <optgroup label="Modelos Gerais">
                      {checklistTemplates
                        .filter((c) => c.department === 'Geral')
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.items.length} etapas)
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>

                {newTaskForm.checklistKey && (() => {
                  const selectedChk = checklistTemplates.find((c) => c.id === newTaskForm.checklistKey);
                  if (!selectedChk) return null;
                  return (
                    <div className="bg-white p-2.5 rounded-lg border border-purple-200 text-xs space-y-1">
                      <div className="font-bold text-slate-800 text-[11px] flex items-center justify-between">
                        <span>{selectedChk.name}</span>
                        <span className="text-purple-700 font-mono">{selectedChk.items.length} etapas</span>
                      </div>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {selectedChk.items.map((it, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                            <span className="w-3.5 h-3.5 rounded bg-purple-100 text-purple-700 text-[9px] font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="truncate">{it}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
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
                <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer">
                  {newTaskForm.category === 'FECHAMENTO'
                    ? `Lançar Obrigação Padronizada (${newTaskForm.standardCode})`
                    : 'Criar Tarefa Avulsa / Esporádica'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL DE CADASTRO / EDIÇÃO DE TAREFA PADRÃO (CATÁLOGO MESTRE) (z-[110])
      ========================================== */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-indigo-950 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <span>
                  {editingTemplateId
                    ? 'Editar Tarefa Padrão do Catálogo de Fechamento'
                    : 'Cadastrar Nova Tarefa Padrão no Catálogo Mestre'}
                </span>
              </div>
              <button onClick={() => setIsTemplateModalOpen(false)} className="text-white/80 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              {/* Segregação: Departamento, Grupo e Sub-Grupo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-200">
                <div>
                  <label className="block text-xs font-bold text-indigo-950 mb-1">Departamento *</label>
                  <select
                    value={templateForm.department}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, department: e.target.value }))}
                    className="w-full px-2.5 py-2 text-xs font-bold border border-indigo-300 rounded-lg bg-white"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-indigo-950 mb-1">Grupo *</label>
                  <select
                    value={templateForm.group}
                    onChange={(e) =>
                      setTemplateForm((prev) => ({
                        ...prev,
                        group: e.target.value,
                        topic: e.target.value
                      }))
                    }
                    className="w-full px-2.5 py-2 text-xs font-semibold border border-indigo-300 rounded-lg bg-white"
                  >
                    {GROUPS_OPTIONS.map((grp) => (
                      <option key={grp} value={grp}>
                        {grp}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-indigo-950 mb-1">Sub-Grupo *</label>
                  <select
                    value={templateForm.subGroup}
                    onChange={(e) =>
                      setTemplateForm((prev) => ({
                        ...prev,
                        subGroup: e.target.value,
                        accountingType: e.target.value
                      }))
                    }
                    className="w-full px-2.5 py-2 text-xs font-semibold border border-indigo-300 rounded-lg bg-white"
                  >
                    {SUBGROUPS_OPTIONS.map((sg) => (
                      <option key={sg} value={sg}>
                        {sg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Código Padrão *</label>
                  <input
                    type="text"
                    value={templateForm.standardCode}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, standardCode: e.target.value }))}
                    placeholder="Ex: CTB-11 ou FIS-04"
                    className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Descrição da Tarefa Padronizada *</label>
                  <input
                    type="text"
                    value={templateForm.title}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Ex: Amortização - SEGUROS (Imóveis e Veículos)..."
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    required
                  />
                </div>
              </div>

              {/* Competência (Mensal, Trimestral, Anual ou Esporádica) e Regra de Vencimento */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Competência (Periodicidade) *
                    </label>
                    <select
                      value={templateForm.recurrence}
                      onChange={(e) => {
                        const rec = e.target.value;
                        const label = RECURRENCE_CONFIG[rec]?.label || 'Mensal';
                        setTemplateForm((prev) => ({
                          ...prev,
                          recurrence: rec,
                          competenceType: rec,
                          defaultCompetence: label
                        }));
                      }}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    >
                      <option value="MENSAL">Mensal</option>
                      <option value="TRIMESTRAL">Trimestral</option>
                      <option value="ANUAL">Anual</option>
                      <option value="ESPORADICA">Esporádica</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Dia do Vencimento *
                    </label>
                    <select
                      value={extractTemplateDueDay(templateForm.defaultDueDate)}
                      onChange={(e) =>
                        setTemplateForm((prev) => ({
                          ...prev,
                          defaultDueDate: e.target.value
                        }))
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    >
                      {Array.from({ length: 31 }, (_, idx) => {
                        const dayStr = String(idx + 1).padStart(2, '0');
                        return (
                          <option key={dayStr} value={dayStr}>
                            Dia {dayStr}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-indigo-50/80 border border-indigo-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-indigo-950">
                    <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="font-semibold text-slate-600">Vencimento no Cadastro:</span>
                    <span className="font-extrabold text-indigo-900">
                      {formatTemplateDueRule(templateForm.recurrence, templateForm.defaultDueDate)}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-extrabold shrink-0 ${(RECURRENCE_CONFIG[templateForm.recurrence] || RECURRENCE_CONFIG.MENSAL).badge}`}>
                    {RECURRENCE_CONFIG[templateForm.recurrence]?.label || 'Mensal'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Responsável Padrão</label>
                  <select
                    value={templateForm.defaultAssignee}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, defaultAssignee: e.target.value }))}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                  >
                    {TEAM_MEMBERS.map((m) => (
                      <option key={m.id} value={m.id}>@{m.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Escopo Padrão de Filiais</label>
                  <select
                    value={templateForm.defaultCompanyScope}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, defaultCompanyScope: e.target.value }))}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                  >
                    <option value="ALL">Todas as 40 Empresas</option>
                    <option value="MATRIZ_010101">Apenas Matriz (010101)</option>
                    <option value="HOLDING_040101">Apenas Holding (040101)</option>
                  </select>
                </div>
              </div>

              {/* Checklist Padrão com Suporte a Modelos Reutilizáveis */}
              <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-purple-700" />
                      <span>Checklist da Tarefa Padrão *</span>
                    </label>
                    <p className="text-[11px] text-purple-800">
                      Vincule um modelo reutilizável ou crie etapas customizadas para esta obrigação.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openCreateChecklistModal(templateForm.department === 'Fiscal' ? 'Fiscal' : 'Contábil')}
                    className="text-[11px] font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-purple-300 shadow-2xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Novo Modelo de Checklist</span>
                  </button>
                </div>

                {/* Seletor de Modelo */}
                <div>
                  <select
                    value={templateForm.checklistKey}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, checklistKey: e.target.value }))}
                    className="w-full px-3 py-2 text-xs font-semibold border border-purple-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
                  >
                    <option value="">⚙️ Checklist Customizado / Escrever etapas personalizadas...</option>
                    
                    <optgroup label="Modelos Contábeis">
                      {checklistTemplates
                        .filter((c) => c.department === 'Contábil')
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.items.length} etapas)
                          </option>
                        ))}
                    </optgroup>

                    <optgroup label="Modelos Fiscais">
                      {checklistTemplates
                        .filter((c) => c.department === 'Fiscal')
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.items.length} etapas)
                          </option>
                        ))}
                    </optgroup>

                    {checklistTemplates.some((c) => c.department === 'Geral') && (
                      <optgroup label="Modelos Gerais">
                        {checklistTemplates
                          .filter((c) => c.department === 'Geral')
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.items.length} etapas)
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                {/* Exibição quando um modelo estiver vinculado */}
                {templateForm.checklistKey ? (
                  (() => {
                    const selectedChk = checklistTemplates.find((c) => c.id === templateForm.checklistKey);
                    if (!selectedChk) return null;
                    return (
                      <div className="bg-white rounded-xl p-3 border border-purple-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-extrabold text-[10px]">
                              {selectedChk.department}
                            </span>
                            <span className="font-bold text-xs text-slate-900">
                              {selectedChk.name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setTemplateForm((prev) => ({
                                ...prev,
                                checklistKey: '',
                                customChecklistText: selectedChk.items.join('\n')
                              }));
                            }}
                            className="text-[11px] font-bold text-purple-700 hover:text-purple-900 underline flex items-center gap-1 cursor-pointer"
                            title="Desvincula do modelo e copia as etapas para o campo de texto para personalizar nesta tarefa"
                          >
                            <CopyPlus className="w-3 h-3" />
                            <span>Copiar etapas para personalizar</span>
                          </button>
                        </div>
                        {selectedChk.description && (
                          <p className="text-[11px] text-slate-500">{selectedChk.description}</p>
                        )}
                        <div className="space-y-1 pt-1 max-h-36 overflow-y-auto">
                          {selectedChk.items.map((step, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                              <span className="w-4 h-4 rounded bg-purple-100 text-purple-800 font-mono text-[10px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  /* Modo Customizado com botão de Salvar como Modelo */
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold text-purple-950">
                        Etapas do Checklist (1 etapa por linha):
                      </label>
                      <button
                        type="button"
                        onClick={() => openSaveCurrentStepsModal('TEMPLATE_FORM')}
                        disabled={!templateForm.customChecklistText.trim()}
                        className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                          templateForm.customChecklistText.trim()
                            ? 'bg-purple-700 hover:bg-purple-600 text-white shadow-2xs cursor-pointer'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                        title="Salva as etapas digitadas acima como um modelo permanente na biblioteca reutilizável"
                      >
                        <Save className="w-3 h-3" />
                        <span>Salvar etapas como Novo Modelo Reutilizável</span>
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={templateForm.customChecklistText}
                      onChange={(e) => setTemplateForm((prev) => ({ ...prev, customChecklistText: e.target.value }))}
                      placeholder={'Extrair relatório auxiliar no TOTVS\nCruzar saldo com razão contábil\nSalvar memória de cálculo na rede'}
                      className="w-full p-2.5 text-xs border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 bg-white"
                    />
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Dica: Coordenadores podem salvar estas etapas como modelo reutilizável clicando no botão acima.</span>
                      <span className="font-mono">
                        {templateForm.customChecklistText.split('\n').filter((s) => s.trim()).length} etapa(s)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Caminho Padrão de Evidência</label>
                  <input
                    type="text"
                    value={templateForm.defaultEvidencePath}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, defaultEvidencePath: e.target.value }))}
                    placeholder="G:\Contabilidade\2026\10_Outubro\..."
                    className="w-full px-2.5 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Instrução / Procedimento Padrão</label>
                  <input
                    type="text"
                    value={templateForm.standardNotes}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, standardNotes: e.target.value }))}
                    placeholder="Procedimento operacional resumido..."
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-rose-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={templateForm.isCritical}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, isCritical: e.target.checked }))}
                    className="rounded text-rose-600"
                  />
                  <span>Obrigação pertencente ao Caminho Crítico do Fechamento</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Salvar no Cadastro Padrão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: PARÂMETROS E GERAÇÃO AUTOMÁTICA DE TAREFAS POR MÊS/PERÍODO
      ========================================== */}
      {isAutoGenerateModalOpen && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden my-8">
            <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold">
                    Parâmetros de Geração Automática de Tarefas por Mês
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Selecione o mês de competência e o sistema gerará todas as obrigações recorrentes conforme a periodicidade e o dia de vencimento de cada tarefa padrão
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAutoGenerateModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteAutoGeneration} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
              {/* 1. Seleção do Mês e Ano de Competência Alvo + Atalhos Rápidos */}
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    1. Selecionar Mês e Ano para Geração das Tarefas:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 font-semibold">Atalhos rápidos:</span>
                    {[
                      { m: '10', y: '2026', label: 'Out/2026 (Atual)' },
                      { m: '11', y: '2026', label: 'Nov/2026 (Próximo Mês)' },
                      { m: '12', y: '2026', label: 'Dez/2026 (Trim. + Anual)' },
                      { m: '01', y: '2027', label: 'Jan/2027' },
                      { m: '03', y: '2027', label: 'Mar/2027 (1º Trim.)' }
                    ].map((preset) => {
                      const isCurr =
                        autoGenParams.targetMonth === preset.m && autoGenParams.targetYear === preset.y;
                      return (
                        <button
                          key={`${preset.m}-${preset.y}`}
                          type="button"
                          onClick={() => handleSelectAutoGenMonthYear(preset.m, preset.y)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                            isCurr
                              ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                              : 'bg-white text-indigo-900 border-indigo-200 hover:bg-indigo-100'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mês da Competência *
                    </label>
                    <select
                      value={autoGenParams.targetMonth}
                      onChange={(e) => handleSelectAutoGenMonthYear(e.target.value, autoGenParams.targetYear)}
                      className="w-full px-3 py-2 text-xs font-bold border border-indigo-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    >
                      {MONTH_OPTIONS.map((mo) => (
                        <option key={mo.value} value={mo.value}>
                          {mo.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Ano da Competência *
                    </label>
                    <select
                      value={autoGenParams.targetYear}
                      onChange={(e) => handleSelectAutoGenMonthYear(autoGenParams.targetMonth, e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold border border-indigo-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    >
                      {['2025', '2026', '2027', '2028'].map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Regra de Cálculo do Vencimento *
                    </label>
                    <select
                      value={autoGenParams.dueMonthRule}
                      onChange={(e) =>
                        setAutoGenParams((prev) => ({
                          ...prev,
                          dueMonthRule: e.target.value as 'SAME_MONTH' | 'NEXT_MONTH'
                        }))
                      }
                      className="w-full px-3 py-2 text-xs font-bold border border-indigo-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    >
                      <option value="SAME_MONTH">
                        No próprio mês selecionado ({autoGenTargetCompetence})
                      </option>
                      <option value="NEXT_MONTH">
                        No mês subsequente à competência
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Parâmetros de Periodicidade/Recorrência e Departamento */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    2. Parâmetros de Recorrência & Escopo do Catálogo Padrão:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">Departamento:</span>
                    {['TODOS', 'Contábil', 'Fiscal'].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setAutoGenParams((prev) => ({ ...prev, departmentScope: d }))}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer transition-all ${
                          autoGenParams.departmentScope === d
                            ? 'bg-slate-900 text-white'
                            : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {d === 'TODOS' ? 'Todos (Contábil + Fiscal)' : d}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <label
                    className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                      autoGenParams.includeMensal
                        ? 'bg-blue-50/80 border-blue-300 text-blue-950'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={autoGenParams.includeMensal}
                      onChange={(e) =>
                        setAutoGenParams((prev) => ({ ...prev, includeMensal: e.target.checked }))
                      }
                      className="mt-0.5 w-4 h-4 rounded text-blue-600"
                    />
                    <div className="text-xs">
                      <div className="font-extrabold">Tarefas Mensais</div>
                      <div className="text-[11px] opacity-80">Repetem todo mês no dia configurado</div>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                      autoGenParams.includeTrimestral
                        ? 'bg-purple-50/80 border-purple-300 text-purple-950'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={autoGenParams.includeTrimestral}
                      onChange={(e) =>
                        setAutoGenParams((prev) => ({ ...prev, includeTrimestral: e.target.checked }))
                      }
                      className="mt-0.5 w-4 h-4 rounded text-purple-600"
                    />
                    <div className="text-xs">
                      <div className="font-extrabold">Tarefas Trimestrais</div>
                      <div className="text-[11px] opacity-80">Fechamentos de trimestre (Mar/Jun/Set/Dez)</div>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                      autoGenParams.includeAnual
                        ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={autoGenParams.includeAnual}
                      onChange={(e) =>
                        setAutoGenParams((prev) => ({ ...prev, includeAnual: e.target.checked }))
                      }
                      className="mt-0.5 w-4 h-4 rounded text-emerald-600"
                    />
                    <div className="text-xs">
                      <div className="font-extrabold">Tarefas Anuais</div>
                      <div className="text-[11px] opacity-80">Obrigações anuais (ECD, ECF, DFs, etc.)</div>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                      autoGenParams.includeEsporadica
                        ? 'bg-amber-50/80 border-amber-300 text-amber-950'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={autoGenParams.includeEsporadica}
                      onChange={(e) =>
                        setAutoGenParams((prev) => ({ ...prev, includeEsporadica: e.target.checked }))
                      }
                      className="mt-0.5 w-4 h-4 rounded text-amber-600"
                    />
                    <div className="text-xs">
                      <div className="font-extrabold">Tarefas Esporádicas</div>
                      <div className="text-[11px] opacity-80">Incluir demandas sob solicitação</div>
                    </div>
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoGenParams.skipExisting}
                      onChange={(e) =>
                        setAutoGenParams((prev) => ({ ...prev, skipExisting: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <span>
                      Ignorar automaticamente tarefas que já foram geradas para a competência{' '}
                      <strong className="font-mono text-indigo-700">{autoGenTargetCompetence}</strong> (evitar duplicidade)
                    </span>
                  </label>

                  <span className="text-xs font-semibold text-slate-600">
                    Selecionadas para gerar:{' '}
                    <strong className="text-emerald-700">
                      {autoGenPreviewList.filter((i) => i.willGenerate).length}
                    </strong>{' '}
                    de {autoGenPreviewList.length} tarefas compatíveis
                  </span>
                </div>
              </div>

              {/* 3. Tabela de Prévia das Tarefas que Serão Geradas para o Mês */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between text-xs">
                  <span className="font-bold">
                    3. Prévia das Tarefas Recorrentes para a Competência {autoGenTargetCompetence}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setAutoGenParams((prev) => ({ ...prev, excludedTemplateIds: [] }))}
                      className="text-indigo-300 hover:text-white underline cursor-pointer"
                    >
                      Marcar todas
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAutoGenParams((prev) => ({
                          ...prev,
                          excludedTemplateIds: autoGenPreviewList.map((i) => i.tpl.id)
                        }))
                      }
                      className="text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Desmarcar todas
                    </button>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="p-2 text-center w-10">Gerar</th>
                        <th className="p-2">Código</th>
                        <th className="p-2">Depto</th>
                        <th className="p-2">Grupo / Sub-Grupo</th>
                        <th className="p-2">Descrição da Tarefa</th>
                        <th className="p-2 text-center">Periodicidade</th>
                        <th className="p-2 text-center">Nova Competência</th>
                        <th className="p-2 text-center">Vencimento Calculado</th>
                        <th className="p-2">Resp.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {autoGenPreviewList.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-6 text-center text-slate-400">
                            Nenhuma tarefa padrão atende aos parâmetros selecionados acima.
                          </td>
                        </tr>
                      ) : (
                        autoGenPreviewList.map((item) => {
                          const { tpl, alreadyExists, calculatedCompetence, calculatedDueDate, willGenerate } = item;
                          const recCfg = RECURRENCE_CONFIG[tpl.recurrence || 'MENSAL'] || RECURRENCE_CONFIG.MENSAL;
                          return (
                            <tr
                              key={tpl.id}
                              className={`${
                                willGenerate ? 'bg-white hover:bg-indigo-50/40' : 'bg-slate-50 text-slate-400'
                              }`}
                            >
                              <td className="p-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={willGenerate}
                                  disabled={autoGenParams.skipExisting && alreadyExists}
                                  onChange={() => {
                                    setAutoGenParams((prev) => {
                                      const exists = prev.excludedTemplateIds.includes(tpl.id);
                                      return {
                                        ...prev,
                                        excludedTemplateIds: exists
                                          ? prev.excludedTemplateIds.filter((id) => id !== tpl.id)
                                          : [...prev.excludedTemplateIds, tpl.id]
                                      };
                                    });
                                  }}
                                  className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                                />
                              </td>
                              <td className="p-2 font-mono font-bold text-slate-900">{tpl.standardCode}</td>
                              <td className="p-2 font-bold">{tpl.department}</td>
                              <td className="p-2">
                                <span className="font-semibold">{tpl.group}</span>{' '}
                                <span className="text-slate-400">▸</span> {tpl.subGroup}
                              </td>
                              <td className="p-2 font-bold text-slate-900">
                                {tpl.title}
                                {alreadyExists && (
                                  <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                                    Já existe em {calculatedCompetence}
                                  </span>
                                )}
                              </td>
                              <td className="p-2 text-center">
                                <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${recCfg.badge}`}>
                                  {recCfg.label}
                                </span>
                              </td>
                              <td className="p-2 text-center font-mono font-extrabold text-indigo-700">
                                {calculatedCompetence}
                              </td>
                              <td className="p-2 text-center font-mono font-bold text-emerald-800">
                                {calculatedDueDate.split('-').reverse().join('/')}
                              </td>
                              <td className="p-2 font-bold">@{tpl.defaultAssignee}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
                <div className="text-xs text-slate-500">
                  Ao confirmar, o sistema criará as tarefas padronizadas com o checklist e as 40 empresas vinculadas e mudará a visão para a competência <strong>{autoGenTargetCompetence}</strong>.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAutoGenerateModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={autoGenPreviewList.filter((i) => i.willGenerate).length === 0}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 text-white text-xs font-extrabold shadow-sm cursor-pointer transition-all"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>
                      Gerar {autoGenPreviewList.filter((i) => i.willGenerate).length} Tarefa(s) para {autoGenTargetCompetence}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: CADASTRO E EDIÇÃO DE USUÁRIO (ADMINISTRADOR, COORDENADOR, ANALISTA)
      ========================================== */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold">
                    {editingUserId ? `Editar Usuário (@${editingUserId})` : 'Cadastrar Novo Usuário na Equipe'}
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Defina os dados do integrante e sua categoria de acesso (Administrador, Coordenador ou Analista)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-5 space-y-4">
              {/* Seleção Visual das 3 Categorias */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Categoria do Usuário (Perfil de Acesso) *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(['ADMINISTRADOR', 'COORDENADOR', 'ANALISTA'] as const).map((catKey) => {
                    const cfg = USER_CATEGORIES_CONFIG[catKey];
                    const selected = userForm.category === catKey;
                    return (
                      <div
                        key={catKey}
                        onClick={() => {
                          const defaultRoleByCat =
                            catKey === 'ADMINISTRADOR'
                              ? 'Administrador do Sistema Contábil/Fiscal'
                              : catKey === 'COORDENADOR'
                              ? 'Coordenador Contábil & Fiscal (RACI)'
                              : 'Analista Contábil / Fiscal';
                          setUserForm((prev) => ({
                            ...prev,
                            category: catKey,
                            role: prev.role ? prev.role : defaultRoleByCat
                          }));
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          selected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-indigo-500'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                        }`}
                      >
                        <div className="font-extrabold text-xs flex items-center justify-between">
                          <span>
                            {catKey === 'ADMINISTRADOR' ? '🛡️ ' : catKey === 'COORDENADOR' ? '🧭 ' : '⚙️ '}
                            {cfg.label}
                          </span>
                          {selected && <Check className="w-4 h-4 text-emerald-400" />}
                        </div>
                        <p className={`text-[10px] mt-1 leading-snug ${selected ? 'text-slate-300' : 'text-slate-500'}`}>
                          {cfg.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome do Usuário *
                  </label>
                  <input
                    type="text"
                    value={userForm.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setUserForm((prev) => ({
                        ...prev,
                        name: val,
                        id: editingUserId ? prev.id : val.trim().split(' ')[0] || ''
                      }));
                    }}
                    placeholder="Ex: Marcos Oliveira"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Identificador de Menção (@usuario) *
                  </label>
                  <input
                    type="text"
                    value={userForm.id}
                    disabled={!!editingUserId}
                    onChange={(e) =>
                      setUserForm((prev) => ({
                        ...prev,
                        id: e.target.value.replace(/\s+/g, '')
                      }))
                    }
                    placeholder="Ex: Marcos"
                    className={`w-full px-3 py-2 text-xs sm:text-sm font-mono font-bold border border-slate-300 rounded-lg ${
                      editingUserId ? 'bg-slate-100 text-slate-500' : 'bg-white'
                    }`}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    E-mail Corporativo *
                  </label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="usuario@agriconnection.com.br"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cargo / Função Descritiva *
                  </label>
                  <input
                    type="text"
                    value={userForm.role}
                    onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value }))}
                    placeholder="Ex: Analista Contábil Sênior / Coordenador Fiscal"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Departamento *</label>
                  <select
                    value={userForm.department}
                    onChange={(e) => setUserForm((prev) => ({ ...prev, department: e.target.value }))}
                    className="w-full px-2.5 py-2 text-xs font-bold border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Contábil">Contábil</option>
                    <option value="Fiscal">Fiscal</option>
                    <option value="Ambos">Ambos (Contábil & Fiscal)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sigla do Avatar (2 letras)</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={userForm.avatar}
                    onChange={(e) => setUserForm((prev) => ({ ...prev, avatar: e.target.value.toUpperCase() }))}
                    placeholder="Auto (Ex: MO)"
                    className="w-full px-2.5 py-2 text-xs font-mono font-bold uppercase border border-slate-300 rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status do Usuário</label>
                  <select
                    value={userForm.status}
                    onChange={(e) => setUserForm((prev) => ({ ...prev, status: e.target.value }))}
                    className="w-full px-2.5 py-2 text-xs font-bold border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Cor de Identificação do Avatar</label>
                <div className="flex flex-wrap items-center gap-2">
                  {AVATAR_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => setUserForm((prev) => ({ ...prev, colorKey: preset.key }))}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                        userForm.colorKey === preset.key
                          ? 'ring-2 ring-slate-900 border-slate-900 bg-slate-100'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full ${preset.color}`} />
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold shadow-xs cursor-pointer"
                >
                  {editingUserId ? 'Salvar Alterações do Usuário' : 'Confirmar Cadastro do Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CENTRAL DE LEMBRETES & ALERTAS DE PRAZO (24 HORAS)
      ======================================================== */}
      {isReminderModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Cabeçalho do Modal */}
            <div className="bg-gradient-to-r from-slate-950 via-amber-950 to-slate-900 text-white px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300">
                  <AlarmClock className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-white">
                      Central de Lembretes & Alertas de Prazo (24 Horas)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-400 text-slate-950">
                      {reminders24hData.urgentItems.length} ativo(s)
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Notificações automáticas de tarefas com vencimento iminente ou em atraso para a data base{' '}
                    <strong className="font-mono text-white">{analysisRefDate.split('-').reverse().join('/')}</strong>.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsReminderModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Barra de Filtros e Escopo dos Lembretes */}
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Escopo:</span>
                <div className="inline-flex rounded-lg bg-slate-200/80 p-0.5 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setReminderFilterScope('MINHAS')}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      reminderFilterScope === 'MINHAS'
                        ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Minhas Tarefas ({reminders24hData.myCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReminderFilterScope('TODAS')}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      reminderFilterScope === 'TODAS'
                        ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Toda a Equipe ({reminders24hData.totalCount})
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {dismissedReminderIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetDismissedReminders}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                  >
                    Restaurar {dismissedReminderIds.length} silenciado(s)
                  </button>
                )}

                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  <span>Base: {analysisRefDate.split('-').reverse().join('/')}</span>
                </div>
              </div>
            </div>

            {/* Lista dos Lembretes com Ações Rápidas */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {(() => {
                const modalItems =
                  reminderFilterScope === 'MINHAS'
                    ? reminders24hData.myUrgentItems
                    : reminders24hData.urgentItems;

                if (modalItems.length === 0) {
                  return (
                    <div className="p-12 text-center space-y-3 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                      <h4 className="text-base font-extrabold text-slate-800">
                        Nenhum lembrete pendente para este filtro!
                      </h4>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        {reminderFilterScope === 'MINHAS'
                          ? `Você (@${currentUser}) não possui tarefas com vencimento nas próximas 24 horas.`
                          : 'Nenhuma tarefa da equipe possui prazo crítico nas próximas 24 horas.'}
                      </p>
                    </div>
                  );
                }

                return modalItems.map((item) => {
                  const { task, isOverdue, countdownLabel, branchStats } = item;
                  const isMine = task.assignee === currentUser;
                  const stCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.PENDENTE;

                  return (
                    <div
                      key={task.id}
                      className={`p-4 rounded-xl border transition-all space-y-3 ${
                        isOverdue
                          ? 'bg-rose-50/60 border-rose-300 hover:border-rose-400'
                          : 'bg-amber-50/50 border-amber-300 hover:border-amber-400'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                              task.category === 'AVULSA' ? 'bg-amber-200 text-amber-950' : 'bg-slate-900 text-white'
                            }`}
                          >
                            {task.code}
                          </span>

                          <span
                            className={`px-2.5 py-0.5 rounded text-[10px] font-black border uppercase tracking-wider ${
                              isOverdue
                                ? 'bg-rose-200 text-rose-950 border-rose-400 animate-pulse'
                                : 'bg-amber-200 text-amber-950 border-amber-400'
                            }`}
                          >
                            {countdownLabel}
                          </span>

                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-white text-slate-700 border border-slate-200">
                            Depto: {task.department || 'Contábil'}
                          </span>

                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-white text-slate-700 border border-slate-200">
                            Comp: {task.competence || '10/2026'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-700">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Vencimento: {(task.dueDate || '').split('-').reverse().join('/')}</span>
                        </div>
                      </div>

                      <div>
                        <button
                          onClick={() => {
                            setSelectedTaskId(task.id);
                            setIsReminderModalOpen(false);
                          }}
                          className="text-sm font-extrabold text-slate-900 hover:text-indigo-600 text-left cursor-pointer transition-colors"
                        >
                          {task.title}
                        </button>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-1">
                          <span
                            className={`font-bold ${
                              isMine ? 'text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200' : 'text-slate-700'
                            }`}
                          >
                            Responsável: @{task.assignee} {isMine && '(Você)'}
                          </span>
                          <span>•</span>
                          <span>
                            Status: <strong className={stCfg.text}>{stCfg.label}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Filiais Concluídas: <strong>{branchStats.ok}/{branchStats.total} ({branchStats.percent}%)</strong>
                          </span>
                        </div>
                      </div>

                      {/* Ações imediatas do lembrete */}
                      <div className="pt-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {task.status !== 'EM_ANDAMENTO' && task.status !== 'CONCLUIDA' && (
                            <button
                              onClick={() => handleStartTask(task, 'ALL')}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                            >
                              <Play className="w-3.5 h-3.5 fill-white" /> Iniciar Agora
                            </button>
                          )}
                          {task.status === 'EM_ANDAMENTO' && (
                            <button
                              onClick={() => openPauseModal(task, 'ALL')}
                              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                            >
                              <Pause className="w-3.5 h-3.5 fill-white" /> Pausar
                            </button>
                          )}
                          {task.status !== 'CONCLUIDA' && (
                            <button
                              onClick={() => handleCompleteTask(task, 'ALL')}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" /> Concluir
                            </button>
                          )}
                          <button
                            onClick={() => openTransferModal(task, 'ALL')}
                            className="px-2.5 py-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-900 text-xs font-bold cursor-pointer transition-colors"
                            title="Transferir responsável"
                          >
                            @ Transferir
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleDismissReminder(task.id)}
                            className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                            title="Silenciar temporariamente este alerta"
                          >
                            🔕 Silenciar
                          </button>
                          <button
                            onClick={() => {
                              setSelectedTaskId(task.id);
                              setIsReminderModalOpen(false);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition-colors"
                          >
                            Abrir Detalhes →
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Rodapé do Modal */}
            <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-slate-600">
                Os alertas de 24h permanecem visíveis até a tarefa ser concluída ou o prazo estendido.
              </span>
              <button
                type="button"
                onClick={() => setIsReminderModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
              >
                Fechar Central
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL DE CADASTRO / EDIÇÃO DE EMPRESA / FILIAL (z-[110])
      ========================================== */}
      {isCompanyModalOpen && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Cabeçalho do Modal */}
            <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center border border-white/20">
                  <Building2 className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base">
                    {editingCompanyCode ? `Editar Filial [${editingCompanyCode}]` : 'Cadastrar Nova Empresa / Filial'}
                  </h3>
                  <p className="text-emerald-200 text-xs">
                    Gestão cadastral, regime tributário, enquadramento e controlador responsável
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCompanyModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSaveCompany} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              {/* Código e CNPJ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Código Interno / Filial *
                  </label>
                  <input
                    type="text"
                    value={companyForm.code}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, code: e.target.value }))}
                    disabled={!!editingCompanyCode}
                    placeholder="Ex: 010141"
                    maxLength={6}
                    className={`w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border ${
                      editingCompanyCode
                        ? 'bg-slate-100 text-slate-500 border-slate-300 cursor-not-allowed'
                        : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none'
                    }`}
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {editingCompanyCode ? 'O código não pode ser alterado após o cadastro' : 'Identificador de 6 dígitos no ERP (ex: 010141)'}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    CNPJ *
                  </label>
                  <input
                    type="text"
                    value={companyForm.cnpj}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, cnpj: e.target.value }))}
                    placeholder="00.000.000/0000-00"
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Razão Social e Nome Fantasia */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Razão Social Completa *
                  </label>
                  <input
                    type="text"
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Agriconnection Distribuidora de Insumos Agrícolas Ltda"
                    className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome Fantasia / Identificação Operacional *
                  </label>
                  <input
                    type="text"
                    value={companyForm.tradingName}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, tradingName: e.target.value }))}
                    placeholder="Ex: Filial Primavera do Leste - Hub Sul"
                    className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Município e Estado/UF */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Município *
                  </label>
                  <input
                    type="text"
                    value={companyForm.city}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="Ex: Primavera do Leste"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estado / UF *
                  </label>
                  <select
                    value={companyForm.uf}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, uf: e.target.value }))}
                    className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  >
                    {['MT', 'MS', 'GO', 'BA', 'MA', 'TO', 'PR', 'SP', 'MG', 'RO', 'PA', 'PI', 'RS', 'SC', 'DF'].map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Regime Tributário e Tipo de Unidade */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Regime Tributário *
                  </label>
                  <select
                    value={companyForm.taxRegime}
                    onChange={(e) =>
                      setCompanyForm((prev) => ({
                        ...prev,
                        taxRegime: e.target.value as 'Lucro Real' | 'Lucro Presumido' | 'Simples Nacional'
                      }))
                    }
                    className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  >
                    <option value="Lucro Real">Lucro Real (Apuração Trimestral/Mensal)</option>
                    <option value="Lucro Presumido">Lucro Presumido</option>
                    <option value="Simples Nacional">Simples Nacional</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tipo de Unidade / Operação *
                  </label>
                  <select
                    value={companyForm.branchType}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, branchType: e.target.value }))}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  >
                    <option value="Matriz">Matriz Corporativa</option>
                    <option value="Filial Insumos">Filial Insumos</option>
                    <option value="Centro Distribuição">Centro Distribuição (CD)</option>
                    <option value="Sementes Matriz">Sementes & Biotecnologia</option>
                    <option value="Grãos & Barter">Grãos & Barter</option>
                    <option value="Holding">Holding Patrimonial</option>
                    <option value="Logística & Frota">Logística & Frota</option>
                    <option value="Armazéns Gerais">Armazéns Gerais</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>

              {/* Responsável Contábil e Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Controlador / Responsável Contábil *
                  </label>
                  <select
                    value={companyForm.manager}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, manager: e.target.value }))}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  >
                    {TEAM_MEMBERS.map((m) => (
                      <option key={m.id} value={m.name}>
                        @{m.name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Status Operacional *
                  </label>
                  <select
                    value={companyForm.status}
                    onChange={(e) =>
                      setCompanyForm((prev) => ({
                        ...prev,
                        status: e.target.value as 'ATIVA' | 'INATIVA'
                      }))
                    }
                    className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  >
                    <option value="ATIVA">✅ Filial Ativa</option>
                    <option value="INATIVA">⏸ Filial Inativa / Encerrada</option>
                  </select>
                </div>
              </div>

              {/* Contatos (Telefone e E-mail) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={companyForm.phone}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="Ex: (66) 3512-8900"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    E-mail de Contato
                  </label>
                  <input
                    type="email"
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="Ex: filial@agriconnection.com.br"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Observações Operacionais */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observações Operacionais / Particularidades Fiscais
                </label>
                <textarea
                  rows={2}
                  value={companyForm.notes}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Ex: Unidade com benefício fiscal Prodeic; Inscrição estadual com termo de acordo especial..."
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCompanyModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Building2 className="w-4 h-4" />
                  <span>{editingCompanyCode ? 'Salvar Alterações' : 'Cadastrar Empresa / Filial'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: CADASTRO / EDIÇÃO DE MODELO DE CHECKLIST REUTILIZÁVEL (z-[120])
      ========================================== */}
      {isChecklistModalOpen && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-[120] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Cabeçalho do Modal */}
            <div className="bg-gradient-to-r from-purple-900 to-indigo-950 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center border border-white/20">
                  <CheckSquare className="w-5 h-5 text-purple-300" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base">
                    {editingChecklistId ? 'Editar Modelo de Checklist' : 'Cadastrar Novo Modelo de Checklist Reutilizável'}
                  </h3>
                  <p className="text-purple-200 text-xs">
                    Padronize etapas de auditoria para que coordenadores e analistas reutilizem em fechamentos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChecklistModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSaveChecklistTemplate} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome do Modelo de Checklist *
                  </label>
                  <input
                    type="text"
                    value={checklistForm.name}
                    onChange={(e) => setChecklistForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Conciliação de Ativo Imobilizado e Depreciação"
                    className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-purple-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Departamento *
                  </label>
                  <select
                    value={checklistForm.department}
                    onChange={(e) =>
                      setChecklistForm((prev) => ({
                        ...prev,
                        department: e.target.value as 'Contábil' | 'Fiscal' | 'Geral'
                      }))
                    }
                    className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  >
                    <option value="Contábil">Contábil</option>
                    <option value="Fiscal">Fiscal</option>
                    <option value="Geral">Geral</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descrição / Instrução Geral do Procedimento
                </label>
                <input
                  type="text"
                  value={checklistForm.description}
                  onChange={(e) => setChecklistForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Ex: Batimento mensal obrigatório do módulo ATFA012 contra as contas de Ativo e Despesa."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-purple-600 focus:outline-none"
                />
              </div>

              {/* Etapas do Checklist */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Etapas do Checklist (1 etapa por linha) *
                  </label>
                  <span className="text-[11px] font-mono font-bold text-purple-700">
                    {checklistForm.itemsText.split('\n').filter((s) => s.trim()).length} etapa(s)
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={checklistForm.itemsText}
                  onChange={(e) => setChecklistForm((prev) => ({ ...prev, itemsText: e.target.value }))}
                  placeholder={'Extrair mapa de depreciação mensal do módulo Ativo Fixo (ATFA012)\nValidar aquisições e transferências entre filiais no período\nConferir cálculo de depreciação e contabilização\nConciliar saldo do Ativo Imobilizado e Depreciação Acumulada no Razão'}
                  className="w-full p-3 text-xs font-mono leading-relaxed rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  required
                />
              </div>

              {/* Pré-visualização Dinâmica das Etapas */}
              {checklistForm.itemsText.trim() && (
                <div className="bg-purple-50/70 rounded-xl p-3.5 border border-purple-200 space-y-2">
                  <div className="text-[11px] font-extrabold uppercase text-purple-900 flex items-center justify-between">
                    <span>Pré-visualização do Modelo:</span>
                    <span className="text-purple-700 font-mono">
                      {checklistForm.itemsText.split('\n').filter((s) => s.trim()).length} passos
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {checklistForm.itemsText
                      .split('\n')
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((step, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-slate-800">
                          <span className="w-4 h-4 rounded bg-purple-200 text-purple-900 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span>{step}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsChecklistModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingChecklistId ? 'Salvar Alterações no Modelo' : 'Salvar Modelo na Biblioteca'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: SALVAR ETAPAS ATUAIS COMO NOVO MODELO REUTILIZÁVEL (z-[130])
      ========================================== */}
      {isSaveCurrentStepsModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[130] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-purple-800 to-indigo-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <Bookmark className="w-4 h-4 text-purple-300" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base">Salvar Etapas como Modelo Reutilizável</h3>
                  <p className="text-purple-200 text-xs">Disponibilize este checklist para outros fechamentos</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSaveCurrentStepsModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCurrentStepsAsTemplate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome do Novo Modelo de Checklist *
                </label>
                <input
                  type="text"
                  value={saveCurrentStepsForm.name}
                  onChange={(e) => setSaveCurrentStepsForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Checklist - Amortização de Seguros"
                  className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Departamento *
                </label>
                <select
                  value={saveCurrentStepsForm.department}
                  onChange={(e) =>
                    setSaveCurrentStepsForm((prev) => ({
                      ...prev,
                      department: e.target.value as 'Contábil' | 'Fiscal' | 'Geral'
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-purple-600 focus:outline-none"
                >
                  <option value="Contábil">Contábil</option>
                  <option value="Fiscal">Fiscal</option>
                  <option value="Geral">Geral</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descrição Operacional (Opcional)
                </label>
                <input
                  type="text"
                  value={saveCurrentStepsForm.description}
                  onChange={(e) => setSaveCurrentStepsForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Ex: Modelo padrão de conferência pro-rata die de seguros."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-purple-600 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs text-purple-900 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-purple-700 shrink-0" />
                <span>
                  As etapas escritas no formulário serão salvas na biblioteca e vinculadas automaticamente a esta tarefa.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsSaveCurrentStepsModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar na Biblioteca e Vincular</span>
                </button>
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
          checklistTemplates={checklistTemplates}
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
  checklistTemplates,
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
  checklistTemplates?: ChecklistTemplate[];
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
  const recCfg = RECURRENCE_CONFIG[task.recurrence || 'MENSAL'] || RECURRENCE_CONFIG.MENSAL;
  const checklistItems = task.checklistKey
    ? (checklistTemplates?.find((c) => c.id === task.checklistKey)?.items || CHECKLISTS_P1[task.checklistKey] || [])
    : Array.isArray(task.customChecklistItems)
    ? task.customChecklistItems
    : [];
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
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-mono text-xs font-extrabold">{task.code}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${st.bg} ${st.text}`}>{st.label}</span>
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[11px] font-bold">
                Depto: {task.department || 'Contábil'}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-bold">
                {task.group || task.topic} ▸ {task.subGroup || task.accountingType}
              </span>
              <span className="text-xs text-slate-400">Responsável: <strong className="text-white">@{task.assignee}</strong></span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white">{task.title}</h2>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
              <span>📅 Competência ({task.competenceType === 'ANUAL' ? 'Anual' : 'Mensal'}): <strong className="text-emerald-400">{task.competence || '10/2026'}</strong></span>
              <span>•</span>
              <span>⏰ Vencimento: <strong className="text-white">{(task.dueDate || '2026-10-30').split('-').reverse().join('/')}</strong></span>
              <span>•</span>
              <span>↻ Recorrência: <strong className="text-sky-300">{recCfg.label}</strong></span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="bg-slate-100 border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status:</span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-extrabold border shadow-2xs ${STATUS_CONFIG[task.status]?.bg || 'bg-slate-100'} ${STATUS_CONFIG[task.status]?.text || 'text-slate-800'} ${STATUS_CONFIG[task.status]?.border || 'border-slate-200'}`}>
                <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[task.status]?.dot || 'bg-slate-500'} ${task.status === 'EM_ANDAMENTO' ? 'animate-ping' : ''}`} />
                <span>{STATUS_CONFIG[task.status]?.label || task.status}</span>
              </span>
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
                  checklistItems.map((itemText: string, idx: number) => {
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
