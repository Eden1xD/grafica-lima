import { describe, expect, it } from "vitest";
import {
  canGrantPermission, effectivePermissions, isCriticalPermission, isValidPermission,
  primaryRole, ROLE_HOME, ROLE_PERMISSIONS,
} from "../permissions";

describe("permissões por cargo (menor privilégio)", () => {
  it("aluno não tem permissões administrativas", () => {
    const perms = effectivePermissions(["aluno"], []);
    expect(perms.size).toBe(0);
  });
  it("secretaria não vê financeiro por padrão", () => {
    const perms = effectivePermissions(["secretaria"], []);
    expect(perms.has("financeiro.ver")).toBe(false);
    expect(perms.has("alunos.editar")).toBe(true);
  });
  it("concessão explícita libera módulo específico sem dar o cargo", () => {
    const perms = effectivePermissions(["secretaria"], [{ permission: "financeiro.ver", effect: "grant" }]);
    expect(perms.has("financeiro.ver")).toBe(true);
    expect(perms.has("financeiro.registrar")).toBe(false);
  });
  it("restrição explícita vence o cargo e a concessão", () => {
    const perms = effectivePermissions(["admin"], [{ permission: "sistema.configurar", effect: "deny" }]);
    expect(perms.has("sistema.configurar")).toBe(false);
    const both = effectivePermissions(["secretaria"], [
      { permission: "financeiro.ver", effect: "grant" },
      { permission: "financeiro.ver", effect: "deny" },
    ]);
    expect(both.has("financeiro.ver")).toBe(false);
  });
  it("múltiplos cargos unem permissões", () => {
    const perms = effectivePermissions(["secretaria", "financeiro", "professor"], []);
    expect(perms.has("financeiro.registrar")).toBe(true);
    expect(perms.has("alunos.editar")).toBe(true);
    expect(perms.has("notas.lancar")).toBe(true);
    expect(perms.has("cargos.alterar")).toBe(false);
  });
  it("permissões críticas exigem cargo admin no alvo", () => {
    expect(isCriticalPermission("cargos.alterar")).toBe(true);
    expect(canGrantPermission(["secretaria"], "cargos.alterar")).toBe(false);
    expect(canGrantPermission(["admin"], "cargos.alterar")).toBe(true);
    expect(canGrantPermission(["secretaria"], "financeiro.ver")).toBe(true);
  });
  it("chaves inválidas são rejeitadas", () => {
    expect(isValidPermission("financeiro.ver")).toBe(true);
    expect(isValidPermission("hack.root")).toBe(false);
    const perms = effectivePermissions(["aluno"], [{ permission: "hack.root", effect: "grant" }]);
    expect(perms.size).toBe(0);
  });
});

describe("cargo principal e destinos", () => {
  it("prioridade define o espelho legado users.role", () => {
    expect(primaryRole(["professor", "secretaria", "aluno"])).toBe("secretaria");
    expect(primaryRole(["financeiro", "professor"])).toBe("financeiro");
    expect(primaryRole(["admin", "professor", "financeiro"])).toBe("admin");
    expect(primaryRole(["aluno"])).toBe("aluno");
    expect(primaryRole([])).toBe("aluno");
  });
  it("cada cargo tem painel próprio (secretaria não cai no admin)", () => {
    expect(ROLE_HOME.secretaria).toBe("/secretaria");
    expect(ROLE_HOME.financeiro).toBe("/financeiro");
    expect(ROLE_HOME.admin).toBe("/admin");
    expect(ROLE_HOME.professor).toBe("/professor");
    expect(ROLE_HOME.aluno).toBe("/aluno");
  });
  it("admin recebe todas as permissões do catálogo", () => {
    expect(effectivePermissions(["admin"], []).size).toBe(ROLE_PERMISSIONS.admin.length);
  });
});