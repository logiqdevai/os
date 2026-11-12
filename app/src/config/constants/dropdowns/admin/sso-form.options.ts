import type { DropdownOption } from "@/lib/dropdown-option-label.utils";
import type { SsoProtocol } from "@/features/admin/sso/interfaces/sso.interfaces";

/** SsoProtocol (01 §69). */
export const SsoProtocolFormOptions: DropdownOption<SsoProtocol>[] = [
    { id: "SAML", label: "SAML 2.0" },
    { id: "OIDC", label: "OpenID Connect" },
];

/** Readiness reported by the API. */
export const SsoStatusOptions: DropdownOption<"configured" | "incomplete">[] = [
    { id: "configured", label: "Configured · not tested" },
    { id: "incomplete", label: "Incomplete" },
];
