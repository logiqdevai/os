import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { ContractsService } from './contracts/contracts.service';
import { ContractVersionsService } from './versions/versions.service';
import { ContractObligationsService } from './obligations/obligations.service';
import { SignaturesService } from './signatures/signatures.service';
import { ContractLibraryService } from './library/library.service';
import { ContractQuerySchema, CreateContractSchema, RenewalsQuerySchema, TerminateContractSchema, UpdateContractSchema } from './contracts/dto/contract.dto';
import { ApprovalDecisionSchema, SubmitApprovalSchema } from './versions/dto/version.dto';
import { CreateObligationSchema, ObligationQuerySchema } from './obligations/dto/obligation.dto';
import { SendSignatureSchema, SignatureRequestQuerySchema } from './signatures/dto/signature.dto';
import { LibraryQuerySchema } from './library/dto/library.dto';

const id = z.object({ id: z.string().uuid() });
const M = ModuleKey.CONTRACTS;

/** MCP adapters for 04 Contracts — same service methods and validation as REST. */
@Injectable()
export class ContractsMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly contracts: ContractsService,
        private readonly versions: ContractVersionsService,
        private readonly obligations: ContractObligationsService,
        private readonly signatures: SignaturesService,
        private readonly library: ContractLibraryService,
    ) { }

    onModuleInit() {
        this.registry.registerMany([
            { name: 'contracts_contracts_list', description: 'List contracts (filter by status, type, customer, owner, expiring window; search by title/number/customer).', permission: 'contracts.contracts.read', module: M, resource_type: 'contract', input: ContractQuerySchema, handler: (ctx, a) => this.contracts.findAll(ctx, a) },
            { name: 'contracts_contracts_get', description: 'Get one contract with parties, versions, lineage and termination.', permission: 'contracts.contracts.read', module: M, resource_type: 'contract', input: id, handler: (ctx, a) => this.contracts.findOne(ctx, a.id) },
            { name: 'contracts_dashboard_get', description: 'Contract portfolio summary: counts per status, expiring windows, pending signatures, obligations.', permission: 'contracts.contracts.read', module: M, resource_type: 'contract', input: z.object({}), handler: (ctx) => this.contracts.dashboard(ctx) },
            { name: 'contracts_renewals_list', description: 'Contracts with end, renewal or notice dates inside the next N days.', permission: 'contracts.contracts.read', module: M, resource_type: 'contract', input: RenewalsQuerySchema, handler: (ctx, a) => this.contracts.renewals(ctx, a) },
            { name: 'contracts_contracts_create', description: 'Create a draft contract (optionally from a template).', permission: 'contracts.contracts.create', module: M, resource_type: 'contract', input: CreateContractSchema, handler: (ctx, a) => this.contracts.create(ctx, a) },
            { name: 'contracts_contracts_update', description: 'Update contract metadata (dates, renewal, owner, value).', permission: 'contracts.contracts.update', module: M, resource_type: 'contract', input: UpdateContractSchema, handler: (ctx, { id: cid, ...dto }) => this.contracts.update(ctx, cid, dto) },
            { name: 'contracts_contracts_submit_for_approval', description: 'Submit the current version for approval (rules decide the approvers).', permission: 'contracts.contracts.update', module: M, resource_type: 'contract', input: SubmitApprovalSchema, handler: (ctx, a) => this.versions.submitForApproval(ctx, a.contract_id, a.version_id, { comment: a.comment }) },
            { name: 'contracts_contracts_approve', description: 'Approve or reject an approval step assigned to the caller.', permission: 'contracts.contracts.approve', module: M, resource_type: 'contract', sensitive: true, input: ApprovalDecisionSchema, handler: (ctx, a) => this.versions.decideApproval(ctx, a.contract_id, a.approval_id, { decision: a.decision, comment: a.comment }) },
            { name: 'contracts_contracts_terminate', description: 'Terminate a contract (records the termination; never alters the signed document).', permission: 'contracts.contracts.terminate', module: M, resource_type: 'contract', sensitive: true, input: TerminateContractSchema, handler: (ctx, { id: cid, ...dto }) => this.contracts.terminate(ctx, cid, dto) },
            { name: 'contracts_contracts_delete', description: 'Delete a draft contract that was never sent for signature.', permission: 'contracts.contracts.delete', module: M, resource_type: 'contract', sensitive: true, input: id, handler: (ctx, a) => this.contracts.remove(ctx, a.id) },
            { name: 'contracts_signatures_send', description: 'Send the approved current version for e-signature to the contract signatories.', permission: 'contracts.signatures.send', module: M, resource_type: 'signature_request', sensitive: true, input: SendSignatureSchema, handler: (ctx, a) => this.signatures.create(ctx, a.contract_id, a.version_id, { signing_order: a.signing_order, message: a.message, expires_in_days: a.expires_in_days }) },
            { name: 'contracts_signatures_list', description: 'List signature requests and their status.', permission: 'contracts.signatures.read', module: M, resource_type: 'signature_request', input: SignatureRequestQuerySchema, handler: (ctx, a) => this.signatures.findAll(ctx, a) },
            { name: 'contracts_obligations_list', description: 'List contract obligations (overdue, due soon, mine).', permission: 'contracts.contracts.read', module: M, resource_type: 'contract_obligation', input: ObligationQuerySchema, handler: (ctx, a) => this.obligations.findAll(ctx, a) },
            { name: 'contracts_obligations_create', description: 'Create an obligation on a contract.', permission: 'contracts.obligations.manage', module: M, resource_type: 'contract_obligation', input: CreateObligationSchema, handler: (ctx, a) => this.obligations.create(ctx, a) },
            { name: 'contracts_clauses_list', description: 'Search the clause library.', permission: 'contracts.contracts.read', module: M, resource_type: 'contract_clause', input: LibraryQuerySchema, handler: (ctx, a) => this.library.listClauses(ctx, a) },
            { name: 'contracts_templates_list', description: 'List contract templates.', permission: 'contracts.contracts.read', module: M, resource_type: 'contract_template', input: LibraryQuerySchema, handler: (ctx, a) => this.library.listTemplates(ctx, a) },
        ]);
    }
}
