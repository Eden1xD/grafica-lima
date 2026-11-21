import type { Role } from "@/db/schema";

/** Catálogo de permissões por módulo — princípio do menor privilégio. */
export const PERMISSIONS = [
  { key: "alunos.ver", label: "Visualizar alunos", module: "Acadêmico" },
  { key: "alunos.editar", label: "Editar alunos", module: "Acadêmico" },
  { key: "matriculas.gerenciar", label: "Gerenciar matrículas", module: "Acadêmico" },
  { key: "turmas.ver", label: "Visualizar turmas", module: "Acadêmico" },
  { key: "turmas.gerenciar", label: "Gerenciar turmas", module: "Acadêmico" },
  { key: "professores.gerenciar", label: "Gerenciar professores", module: "Acadêmico" },
  { key: "notas.lancar", label: "Lançar notas", module: "Acadêmico" },
  { key: "frequencia.registrar", label: "Registrar frequência", module: "Acadêmico" },
  { key: "certificados.emitir", label: "Emitir certificados", module: "Acadêmico" },
  { key: "financeiro.ver", label: "Visualizar financeiro", module: "Financeiro" },
  { key: "financeiro.registrar", label: "Registrar pagamentos", module: "Financeiro" },
  { key: "comunicados.gerenciar", label: "Gerenciar comunicados", module: "Comunicação" },
  { key: "usuarios.gerenciar", label: "Gerenciar usuários", module: "Sistema" },
  { key: "cargos.alterar", label: "Alterar cargos", module: "Sistema" },
  { key: "sistema.configurar", label: "Configurar o sistema", module: "Sistema" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];
export const ALL_PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as PermissionKey[];

/** Permissões críticas: só podem existir em contas com cargo admin. */
export const CRITICAL_PERMISSIONS: PermissionKey[] = ["usuarios.gerenciar", "cargos.alterar", "sistema.configurar"];

export function isCriticalPermission(key: string): boolean {
  return (CRITICAL_PERMISSIONS as string[]).includes(key);
}

export function isValidPermission(key: string): key is PermissionKey {
  return (ALL_PERMISSION_KEYS as string[]).includes(key);
}

export const ROLE_PERMISSIONS: Record<Role, PermissionKey[]> = {
  admin: ALL_PERMISSION_KEYS,
  secretaria: [
    "alunos.ver", "alunos.editar", "matriculas.gerenciar", "turmas.ver", "turmas.gerenciar",
    "professores.gerenciar", "notas.lancar", "frequencia.registrar", "certificados.emitir", "comunicados.gerenciar",
  ],
  financeiro: ["financeiro.ver", "financeiro.registrar", "matriculas.gerenciar", "alunos.ver"],
  professor: ["turmas.ver", "notas.lancar", "frequencia.registrar", "comunicados.gerenciar"],
  aluno: [],
};

export type PermissionOverride = { permission: string; effect: "grant" | "deny" };

/** Efetivas = união dos cargos + concessões explícitas − restrições explícitas (deny sempre vence). */
export function effectivePermissions(roles: Role[], overrides: PermissionOverride[]): Set<PermissionKey> {
  const set = new Set<PermissionKey>();
  for (const r of roles) for (const p of ROLE_PERMISSIONS[r] ?? []) set.add(p);
  for (const o of overrides) if (o.effect === "grant" && isValidPermission(o.permission)) set.add(o.permission);
  for (const o of overrides) if (o.effect === "deny" && isValidPermission(o.permission)) set.delete(o.permission);
  return set;
}

/** Concessão de permissão crítica exige que o alvo tenha cargo admin. */
export function canGrantPermission(targetRoles: Role[], key: string): boolean {
  return !isCriticalPermission(key) || targetRoles.includes("admin");
}

export const ROLE_PRIORITY: Role[] = ["admin", "secretaria", "financeiro", "professor", "aluno"];

export function primaryRole(roles: Role[]): Role {
  for (const r of ROLE_PRIORITY) if (roles.includes(r)) return r;
  return "aluno";
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  secretaria: "Secretaria",
  financeiro: "Financeiro",
  professor: "Professor",
  aluno: "Aluno",
};

export const ROLE_HOME: Record<Role, string> = {
  admin: "/admin",
  secretaria: "/secretaria",
  financeiro: "/financeiro",
  professor: "/professor",
  aluno: "/aluno",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  admin: "Gestão completa da plataforma, usuários e configurações.",
  secretaria: "Alunos, matrículas, turmas, documentos e atendimento.",
  financeiro: "Pagamentos, mensalidades, recibos e relatórios.",
  professor: "Suas turmas, atividades, notas e chamada.",
  aluno: "Seus cursos, notas, frequência e pagamentos.",
};