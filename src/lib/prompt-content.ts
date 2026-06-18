import "server-only";

import rolesData from "@/data/prompt-builder/roles.json";
import type { RolesCatalog } from "@/lib/prompt-types";

const rolesCatalog = rolesData as RolesCatalog;

export function getPromptRoles() {
  return rolesCatalog.roles;
}
