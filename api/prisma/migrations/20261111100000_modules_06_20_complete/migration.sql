-- Modules 06–20: completes 06/07/08 and adds 09–15, 17–20 (see docs/features/*.md "Data model (Prisma)").
-- Generated with `prisma migrate diff --from-schema <HEAD schema> --to-schema prisma/schema.prisma --script`;
-- hand edits: documents.updated_at gets DEFAULT CURRENT_TIMESTAMP so existing rows migrate; full-text search
-- trigger functions are appended at the end (search_vector columns are Unsupported("tsvector") in the schema).
-- Before applying on a database with data: null out any *_document_id / communication_id / ticket_id /
-- channel_id values that do not reference existing rows, since they become foreign keys here.

-- CreateEnum
CREATE TYPE "PortalProfileChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'AUTO_APPLIED');

-- CreateEnum
CREATE TYPE "LedgerRecordType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "LedgerRecordStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'POSTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "LedgerRecordSource" AS ENUM ('MANUAL', 'INVOICE_SYNC', 'PAYMENT_SYNC', 'SUBSCRIPTION_SYNC', 'SUPPLIER_INVOICE_IMPORT', 'RECURRING_EXPENSE', 'PAYROLL', 'API');

-- CreateEnum
CREATE TYPE "LedgerPaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "LedgerVatTreatment" AS ENUM ('STANDARD', 'REDUCED', 'ZERO_RATED', 'EXEMPT', 'REVERSE_CHARGE', 'OUT_OF_SCOPE');

-- CreateEnum
CREATE TYPE "LedgerSettlementKind" AS ENUM ('PAYMENT', 'REFUND', 'WRITE_OFF', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LedgerAttachmentKind" AS ENUM ('INVOICE', 'RECEIPT', 'PAYMENT_CONFIRMATION', 'CONTRACT', 'EXPENSE_DOCUMENTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "LedgerCategoryKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "LedgerPlLine" AS ENUM ('REVENUE', 'COST_OF_OPERATIONS', 'EMPLOYEE_EXPENSES', 'OFFICE_EXPENSES', 'SOFTWARE_EXPENSES', 'MARKETING_EXPENSES', 'PROFESSIONAL_EXPENSES', 'OTHER_OPERATING_EXPENSES');

-- CreateEnum
CREATE TYPE "LedgerImportStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'DUPLICATE', 'FAILED');

-- CreateEnum
CREATE TYPE "RecurringExpenseStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollEntryKind" AS ENUM ('SALARY', 'MONTHLY_PAYMENT', 'HOURLY_PAYMENT', 'BONUS', 'COMMISSION', 'OVERTIME', 'EMPLOYER_COST', 'BENEFIT', 'REIMBURSEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "PayrollEntryStatus" AS ENUM ('DRAFT', 'APPROVED', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FinancialPeriodType" AS ENUM ('DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FinancialPeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'LOCKED');

-- CreateEnum
CREATE TYPE "LedgerReportBasis" AS ENUM ('ACCRUAL', 'CASH');

-- CreateEnum
CREATE TYPE "LedgerProfitabilityScope" AS ENUM ('PROJECT', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "LedgerInsightKind" AS ENUM ('UNUSUAL_EXPENSE', 'DUPLICATE_SUSPECTED', 'MISSING_RECORD', 'CATEGORY_SUGGESTION', 'RECURRING_COST_DETECTED', 'FORECAST', 'MONTHLY_SUMMARY', 'OTHER');

-- CreateEnum
CREATE TYPE "LedgerInsightStatus" AS ENUM ('OPEN', 'ACCEPTED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'OFFBOARDING', 'TERMINATED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'INTERN');

-- CreateEnum
CREATE TYPE "EmployeePayType" AS ENUM ('MONTHLY_SALARY', 'HOURLY', 'DAILY', 'PER_PROJECT');

-- CreateEnum
CREATE TYPE "CompensationComponentKind" AS ENUM ('SOCIAL_CONTRIBUTION', 'INSURANCE', 'BENEFIT', 'ALLOWANCE', 'BONUS', 'COMMISSION', 'OTHER');

-- CreateEnum
CREATE TYPE "CompensationFrequency" AS ENUM ('MONTHLY', 'ANNUAL', 'PER_PAYMENT', 'ONE_OFF');

-- CreateEnum
CREATE TYPE "EmployeeSeniorityLevel" AS ENUM ('INTERN', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'PRINCIPAL', 'MANAGER', 'DIRECTOR', 'EXECUTIVE');

-- CreateEnum
CREATE TYPE "EmployeePositionChangeReason" AS ENUM ('HIRE', 'PROMOTION', 'DEMOTION', 'TRANSFER', 'TITLE_CHANGE', 'MANAGER_CHANGE', 'TYPE_CHANGE', 'REHIRE', 'OTHER');

-- CreateEnum
CREATE TYPE "EmployeeWorkLocation" AS ENUM ('OFFICE', 'REMOTE', 'HYBRID', 'CLIENT_SITE', 'TRAVEL');

-- CreateEnum
CREATE TYPE "EmployeeAvailabilityStatus" AS ENUM ('AVAILABLE', 'BUSY', 'ON_LEAVE', 'VACATION', 'SICK_LEAVE', 'PUBLIC_HOLIDAY', 'REMOTE', 'IN_OFFICE', 'TRAINING', 'BUSINESS_TRAVEL');

-- CreateEnum
CREATE TYPE "EmployeeAvailabilitySource" AS ENUM ('MANUAL', 'LEAVE', 'HOLIDAY', 'ATTENDANCE', 'CALENDAR', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EmployeeScheduleType" AS ENUM ('FIXED', 'FLEXIBLE', 'SHIFT');

-- CreateEnum
CREATE TYPE "LeaveCategory" AS ENUM ('VACATION', 'SICK', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'PARENTAL', 'UNPAID', 'PUBLIC_HOLIDAY', 'COMPANY_HOLIDAY', 'TIME_OFF', 'OTHER');

-- CreateEnum
CREATE TYPE "LeaveAccrualMethod" AS ENUM ('NONE', 'ANNUAL_UPFRONT', 'MONTHLY', 'PER_HOURS_WORKED');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "LeaveDayPart" AS ENUM ('FULL_DAY', 'FIRST_HALF', 'SECOND_HALF');

-- CreateEnum
CREATE TYPE "LeaveApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "LeaveBalanceTransactionType" AS ENUM ('ACCRUAL', 'USAGE', 'REVERSAL', 'ADJUSTMENT', 'CARRY_OVER', 'EXPIRY');

-- CreateEnum
CREATE TYPE "CompanyHolidayKind" AS ENUM ('PUBLIC', 'COMPANY');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('CLOCKED_IN', 'COMPLETED', 'ABSENT', 'ON_LEAVE', 'HOLIDAY', 'EXCUSED');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('WEB', 'MOBILE', 'MANUAL', 'IMPORT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AttendanceBreakKind" AS ENUM ('PAID', 'UNPAID');

-- CreateEnum
CREATE TYPE "EmployeePeriodType" AS ENUM ('DAY', 'WEEK', 'MONTH');

-- CreateEnum
CREATE TYPE "EmployeeCapacityStatus" AS ENUM ('UNDERUTILIZED', 'BALANCED', 'OVERLOADED');

-- CreateEnum
CREATE TYPE "PerformanceReviewType" AS ENUM ('ANNUAL', 'SEMI_ANNUAL', 'QUARTERLY', 'PROBATION', 'PROJECT', 'ONE_ON_ONE', 'AD_HOC');

-- CreateEnum
CREATE TYPE "PerformanceReviewCycleStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PerformanceReviewStatus" AS ENUM ('DRAFT', 'SELF_ASSESSMENT', 'MANAGER_ASSESSMENT', 'SUBMITTED', 'COMPLETED', 'ACKNOWLEDGED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PerformanceGoalKind" AS ENUM ('GOAL', 'OBJECTIVE', 'KEY_RESULT');

-- CreateEnum
CREATE TYPE "PerformanceGoalStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'AT_RISK', 'ACHIEVED', 'PARTIALLY_ACHIEVED', 'MISSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PerformanceFeedbackKind" AS ENUM ('MANAGER_FEEDBACK', 'EMPLOYEE_FEEDBACK', 'PEER_FEEDBACK', 'PERFORMANCE_NOTE', 'ACHIEVEMENT', 'RECOGNITION');

-- CreateEnum
CREATE TYPE "PerformanceFeedbackVisibility" AS ENUM ('MANAGERS_ONLY', 'EMPLOYEE_VISIBLE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "PerformanceImprovementPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED_SUCCESSFUL', 'COMPLETED_UNSUCCESSFUL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PerformanceImprovementItemStatus" AS ENUM ('OPEN', 'MET', 'NOT_MET');

-- CreateEnum
CREATE TYPE "SkillCategory" AS ENUM ('TECHNICAL', 'PROGRAMMING_LANGUAGE', 'FRAMEWORK', 'PLATFORM', 'TOOL', 'DOMAIN', 'SOFT_SKILL', 'OTHER');

-- CreateEnum
CREATE TYPE "SkillProficiency" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateEnum
CREATE TYPE "LanguageProficiency" AS ENUM ('BASIC', 'CONVERSATIONAL', 'PROFESSIONAL', 'FLUENT', 'NATIVE');

-- CreateEnum
CREATE TYPE "EmployeeTrainingStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmployeeDocumentCategory" AS ENUM ('EMPLOYMENT_CONTRACT', 'NDA', 'CERTIFICATION', 'IDENTIFICATION', 'SIGNED_AGREEMENT', 'HR_FORM', 'RESUME', 'OTHER');

-- CreateEnum
CREATE TYPE "EmployeeDocumentStatus" AS ENUM ('REQUESTED', 'UPLOADED', 'VERIFIED', 'REJECTED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "HrNoteCategory" AS ENUM ('PERFORMANCE_OBSERVATION', 'MEETING', 'HR_COMMENT', 'WARNING', 'OTHER');

-- CreateEnum
CREATE TYPE "HrNoteVisibility" AS ENUM ('HR_ONLY', 'HR_AND_MANAGERS', 'EMPLOYEE_VISIBLE');

-- CreateEnum
CREATE TYPE "HrNoteSeverity" AS ENUM ('INFO', 'MINOR', 'MAJOR', 'FINAL');

-- CreateEnum
CREATE TYPE "EmployeeChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeaveApproverStrategy" AS ENUM ('DIRECT_MANAGER', 'HR', 'MANAGER_THEN_HR', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CommChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "CommMessageKind" AS ENUM ('CUSTOMER', 'CAMPAIGN', 'TRANSACTIONAL', 'NOTIFICATION', 'INTERNAL');

-- CreateEnum
CREATE TYPE "CommMessageSource" AS ENUM ('MANUAL', 'CAMPAIGN', 'AUTOMATION', 'MODULE', 'NOTIFICATION', 'API');

-- CreateEnum
CREATE TYPE "CommMessageStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommDeliveryEventType" AS ENUM ('QUEUED', 'SENT', 'DEFERRED', 'DELIVERED', 'OPENED', 'CLICKED', 'REPLIED', 'READ', 'BOUNCED', 'COMPLAINED', 'FAILED', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "CommBounceType" AS ENUM ('HARD', 'SOFT');

-- CreateEnum
CREATE TYPE "CommRecipientKind" AS ENUM ('CRM_CONTACT', 'MEMBERSHIP', 'PORTAL_USER', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "CommRecipientRole" AS ENUM ('TO', 'CC', 'BCC');

-- CreateEnum
CREATE TYPE "CommRecipientStatus" AS ENUM ('PENDING', 'EXCLUDED', 'QUEUED', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'REPLIED', 'BOUNCED', 'FAILED', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "CommTemplateCategory" AS ENUM ('PROJECT_UPDATE', 'MILESTONE_COMPLETION', 'INVOICE_NOTIFICATION', 'PAYMENT_CONFIRMATION', 'PAYMENT_REMINDER', 'SUBSCRIPTION_RENEWAL', 'WELCOME', 'CUSTOMER_ONBOARDING', 'MEETING_REMINDER', 'MAINTENANCE_ANNOUNCEMENT', 'SERVICE_INTERRUPTION', 'SUPPORT_RESPONSE', 'MARKETING_CAMPAIGN', 'HOLIDAY_GREETING', 'DEVELOPMENT_UPDATE', 'FEATURE_RELEASE', 'BUG_FIX', 'DOWNTIME_NOTIFICATION', 'MEETING_INVITATION', 'APPROVAL_REQUEST', 'FEEDBACK_REQUEST', 'CONTRACT_RENEWAL', 'CONTRACT_EXPIRATION_REMINDER', 'PROJECT_CREATED', 'PROJECT_COMPLETED', 'FAILED_PAYMENT', 'CUSTOMER_FOLLOW_UP', 'GENERAL_ANNOUNCEMENT', 'NOTIFICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "CommTemplateKind" AS ENUM ('COMMUNICATION', 'CAMPAIGN', 'NOTIFICATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CommTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CommTemplateVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CommProviderKind" AS ENUM ('RESEND', 'SENDGRID', 'POSTMARK', 'MAILGUN', 'AWS_SES', 'SMTP', 'TWILIO', 'VONAGE', 'MESSAGEBIRD', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CommProviderAccountStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ERROR');

-- CreateEnum
CREATE TYPE "CommSenderDomainStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'DISABLED');

-- CreateEnum
CREATE TYPE "CommSenderIdentityStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'FAILED', 'DISABLED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'SENDING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "CampaignApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CampaignAudienceMode" AS ENUM ('INCLUDE', 'EXCLUDE');

-- CreateEnum
CREATE TYPE "CampaignRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SegmentEntityType" AS ENUM ('CRM_CONTACT', 'CRM_COMPANY', 'MEMBERSHIP');

-- CreateEnum
CREATE TYPE "CommConsentStatus" AS ENUM ('UNKNOWN', 'PENDING_DOUBLE_OPT_IN', 'OPTED_IN', 'OPTED_OUT');

-- CreateEnum
CREATE TYPE "CommConsentSource" AS ENUM ('FORM', 'IMPORT', 'MANUAL', 'DOUBLE_OPT_IN', 'UNSUBSCRIBE_LINK', 'PORTAL', 'API');

-- CreateEnum
CREATE TYPE "CommSuppressionReason" AS ENUM ('UNSUBSCRIBE', 'HARD_BOUNCE', 'SOFT_BOUNCE', 'COMPLAINT', 'INVALID_ADDRESS', 'CONSENT_WITHDRAWN', 'MANUAL');

-- CreateEnum
CREATE TYPE "CommAiTaskKind" AS ENUM ('WRITE_EMAIL', 'WRITE_SMS', 'PERSONALIZE', 'PROJECT_UPDATE', 'PAYMENT_REMINDER', 'CAMPAIGN', 'SUMMARIZE', 'TRANSLATE', 'IMPROVE_TONE', 'SUBJECT_LINES', 'GENERATE_TEMPLATE', 'AUTO_REPLY', 'EXECUTIVE_SUMMARY');

-- CreateEnum
CREATE TYPE "ChannelKind" AS ENUM ('PUBLIC', 'PRIVATE', 'DIRECT', 'GROUP_DIRECT', 'PROJECT', 'CUSTOMER', 'ANNOUNCEMENT', 'RECORD');

-- CreateEnum
CREATE TYPE "ChannelVisibility" AS ENUM ('DISCOVERABLE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ChannelStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "ChannelPostingPolicy" AS ENUM ('ALL_MEMBERS', 'INTERNAL_MEMBERS_ONLY', 'ADMINS_ONLY', 'OWNERS_ONLY');

-- CreateEnum
CREATE TYPE "ChannelMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'GUEST', 'EXTERNAL', 'READ_ONLY');

-- CreateEnum
CREATE TYPE "ChannelMembershipSource" AS ENUM ('MANUAL', 'TEAM', 'ROLE', 'PROJECT', 'CUSTOMER', 'ORGANIZATION_DEFAULT', 'TEMPLATE', 'JOINED', 'INTEGRATION');

-- CreateEnum
CREATE TYPE "ChannelGuestKind" AS ENUM ('SINGLE_CHANNEL', 'MULTI_CHANNEL', 'CUSTOMER', 'PARTNER', 'TEMPORARY');

-- CreateEnum
CREATE TYPE "ChannelNotificationLevel" AS ENUM ('ALL_MESSAGES', 'MENTIONS_AND_DIRECT', 'DIRECT_ONLY', 'NOTHING', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ChannelDigestFrequency" AS ENUM ('NONE', 'HOURLY', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('USER', 'SYSTEM', 'INTEGRATION', 'VOICE');

-- CreateEnum
CREATE TYPE "MessageVisibility" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "MessageDeliveryStatus" AS ENUM ('SCHEDULED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING', 'DELETED');

-- CreateEnum
CREATE TYPE "MessageMentionKind" AS ENUM ('MEMBER', 'EXTERNAL_USER', 'TEAM', 'ROLE', 'CHANNEL', 'EVERYONE', 'CHANNEL_LINK');

-- CreateEnum
CREATE TYPE "MessageAttachmentKind" AS ENUM ('IMAGE', 'PDF', 'DOCUMENT', 'SPREADSHEET', 'PRESENTATION', 'VIDEO', 'AUDIO', 'VOICE_MESSAGE', 'ARCHIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "MessageLinkPreviewStatus" AS ENUM ('PENDING', 'RESOLVED', 'FAILED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "MessagingPresenceState" AS ENUM ('ACTIVE', 'AWAY', 'DO_NOT_DISTURB', 'OFFLINE');

-- CreateEnum
CREATE TYPE "MessageReminderStatus" AS ENUM ('PENDING', 'TRIGGERED', 'COMPLETED', 'SNOOZED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MessagingRetentionScope" AS ENUM ('ORGANIZATION', 'BRANCH', 'TEAM', 'CHANNEL_KIND', 'CHANNEL');

-- CreateEnum
CREATE TYPE "MessagingRetentionAction" AS ENUM ('UNLIMITED', 'ARCHIVE', 'DELETE');

-- CreateEnum
CREATE TYPE "MessagingExportStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MessagingExportFormat" AS ENUM ('JSON', 'CSV', 'HTML');

-- CreateEnum
CREATE TYPE "MessageReportStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'ACTIONED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ChannelRestrictionKind" AS ENUM ('MUTED', 'BANNED');

-- CreateEnum
CREATE TYPE "MessagingIntegrationKind" AS ENUM ('INBOUND_WEBHOOK', 'BOT', 'GITHUB', 'GITLAB', 'JIRA', 'LINEAR', 'GOOGLE_DRIVE', 'NOTION', 'MICROSOFT_365', 'GOOGLE_WORKSPACE', 'SLACK', 'DISCORD', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MessagingIntegrationStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ERROR');

-- CreateEnum
CREATE TYPE "ChannelCallKind" AS ENUM ('VOICE', 'VIDEO', 'HUDDLE');

-- CreateEnum
CREATE TYPE "ChannelCallStatus" AS ENUM ('RINGING', 'IN_PROGRESS', 'ENDED', 'MISSED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "ChannelTemplateTrigger" AS ENUM ('MANUAL', 'PROJECT_CREATED', 'CUSTOMER_CREATED');

-- CreateEnum
CREATE TYPE "SupportChannelType" AS ENUM ('LIVE_CHAT', 'EMAIL', 'WIDGET', 'PORTAL', 'FORM', 'API', 'PHONE');

-- CreateEnum
CREATE TYPE "SupportConversationStatus" AS ENUM ('OPEN', 'PENDING', 'SNOOZED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "SupportMessageKind" AS ENUM ('CUSTOMER', 'AGENT', 'INTERNAL_NOTE', 'AI_AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SupportMessageDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "SupportParticipantRole" AS ENUM ('ASSIGNEE', 'COLLABORATOR', 'MENTIONED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketStatusCategory" AS ENUM ('NEW', 'OPEN', 'PENDING_CUSTOMER', 'ON_HOLD', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('QUESTION', 'BUG', 'FEATURE_REQUEST', 'CHANGE_REQUEST', 'BILLING', 'ACCOUNT', 'INCIDENT', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketSource" AS ENUM ('CONVERSATION', 'EMAIL', 'LIVE_CHAT', 'WIDGET', 'PORTAL', 'FORM', 'AI_AGENT', 'MANUAL', 'API');

-- CreateEnum
CREATE TYPE "TicketRelationType" AS ENUM ('RELATED', 'DUPLICATE_OF', 'BLOCKS', 'SAME_INCIDENT');

-- CreateEnum
CREATE TYPE "TicketTaskLinkKind" AS ENUM ('CONVERTED', 'LINKED');

-- CreateEnum
CREATE TYPE "SlaMetric" AS ENUM ('FIRST_RESPONSE', 'NEXT_RESPONSE', 'RESOLUTION');

-- CreateEnum
CREATE TYPE "SlaTimerStatus" AS ENUM ('RUNNING', 'PAUSED', 'MET', 'BREACHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupportSentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'FRUSTRATED');

-- CreateEnum
CREATE TYPE "KnowledgeArticleStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "KnowledgeVisibility" AS ENUM ('PUBLIC', 'CUSTOMERS', 'INTERNAL');

-- CreateEnum
CREATE TYPE "SupportCannedResponseScope" AS ENUM ('PERSONAL', 'TEAM', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "SupportAiSessionStatus" AS ENUM ('ACTIVE', 'RESOLVED_BY_AI', 'HANDED_OVER', 'ABANDONED', 'FAILED');

-- CreateEnum
CREATE TYPE "SupportAiSuggestionKind" AS ENUM ('CLASSIFICATION', 'PRIORITY', 'ASSIGNMENT', 'REPLY', 'REWRITE', 'SUMMARY', 'TRANSLATION', 'ARTICLE_RECOMMENDATION', 'FOLLOW_UP_QUESTION', 'TROUBLESHOOTING', 'ACTION_ITEMS', 'DUPLICATE_TICKET', 'TASK_CREATION', 'KNOWLEDGE_GAP', 'ARTICLE_DRAFT', 'INCIDENT_GROUPING', 'FEEDBACK_EXTRACTION');

-- CreateEnum
CREATE TYPE "SupportAiSuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'AUTO_APPLIED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SupportIncidentStatus" AS ENUM ('DETECTED', 'CONFIRMED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH', 'DESKTOP', 'SLACK');

-- CreateEnum
CREATE TYPE "NotificationRecipientType" AS ENUM ('MEMBERSHIP', 'PORTAL_USER');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('GENERAL', 'MENTION', 'DIRECT_MESSAGE', 'REPLY', 'REACTION', 'ASSIGNMENT', 'APPROVAL', 'STATUS_CHANGE', 'REMINDER', 'DUE_DATE', 'INVITATION', 'SHARE', 'SLA', 'SECURITY', 'BILLING', 'ANNOUNCEMENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'IMPORTANT', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationLevel" AS ENUM ('ALL', 'IMPORTANT_ONLY', 'MENTIONS_AND_DIRECT', 'NONE');

-- CreateEnum
CREATE TYPE "NotificationDeliveryMode" AS ENUM ('IMMEDIATE', 'DIGEST', 'OFF');

-- CreateEnum
CREATE TYPE "NotificationDigestFrequency" AS ENUM ('IMMEDIATE', 'HOURLY', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "NotificationEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED', 'DIGESTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationSkipReason" AS ENUM ('PREFERENCE_OFF', 'LEVEL_FILTERED', 'RECORD_MUTED', 'QUIET_HOURS', 'CHANNEL_DISABLED', 'CHANNEL_NOT_AVAILABLE', 'NO_ADDRESS', 'NO_DEVICE', 'DEDUPLICATED', 'COALESCED', 'THROTTLED', 'PERMISSION_DENIED', 'NOT_CUSTOMER_VISIBLE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NotificationDigestStatus" AS ENUM ('OPEN', 'SCHEDULED', 'SENDING', 'SENT', 'EMPTY', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationPushPlatform" AS ENUM ('IOS', 'ANDROID', 'WEB', 'DESKTOP');

-- CreateEnum
CREATE TYPE "NotificationDeliveryRuleKind" AS ENUM ('DEDUPLICATE', 'COALESCE', 'THROTTLE', 'SUPPRESS');

-- CreateEnum
CREATE TYPE "NotificationCoalesceKey" AS ENUM ('RECORD', 'RECORD_AND_ACTOR', 'EVENT_TYPE', 'RECIPIENT');

-- CreateEnum
CREATE TYPE "WikiSpaceKind" AS ENUM ('DEPARTMENT', 'TEAM', 'BRANCH', 'PROJECT', 'TOPIC');

-- CreateEnum
CREATE TYPE "WikiPageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'NEEDS_REVIEW', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WikiPageType" AS ENUM ('GENERAL', 'POLICY', 'PROCEDURE', 'RUNBOOK', 'MEETING_NOTES', 'DECISION_RECORD', 'HANDBOOK_CHAPTER', 'ONBOARDING_GUIDE', 'OFFBOARDING_GUIDE', 'FAQ');

-- CreateEnum
CREATE TYPE "WikiVisibility" AS ENUM ('ORGANIZATION', 'BRANCH', 'TEAM', 'ROLE', 'MEMBERS');

-- CreateEnum
CREATE TYPE "WikiPermissionLevel" AS ENUM ('VIEW', 'COMMENT', 'EDIT', 'MANAGE');

-- CreateEnum
CREATE TYPE "WikiPrincipalType" AS ENUM ('MEMBERSHIP', 'TEAM', 'BRANCH', 'ROLE', 'DEPARTMENT');

-- CreateEnum
CREATE TYPE "WikiChecklistKind" AS ENUM ('ONBOARDING', 'OFFBOARDING');

-- CreateEnum
CREATE TYPE "WikiChecklistAssigneeKind" AS ENUM ('SUBJECT', 'MANAGER', 'CHECKLIST_OWNER', 'SPECIFIC_MEMBER');

-- CreateEnum
CREATE TYPE "WikiChecklistRunStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WikiChecklistTrigger" AS ENUM ('MEMBER_ONBOARDING', 'MEMBER_OFFBOARDING', 'MANUAL', 'AUTOMATION');

-- CreateEnum
CREATE TYPE "WikiChecklistItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "CustomFormStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CustomFormKind" AS ENUM ('FEEDBACK_SURVEY', 'CHECK_IN', 'EQUIPMENT_REQUEST', 'INCIDENT_REPORT', 'COMPLIANCE_ACKNOWLEDGEMENT', 'EXIT_INTERVIEW', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CustomFormFieldType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'NUMBER', 'EMAIL', 'SINGLE_CHOICE', 'MULTI_CHOICE', 'CHECKBOX', 'SCALE', 'DATE', 'FILE_UPLOAD', 'SIGNATURE', 'SECTION');

-- CreateEnum
CREATE TYPE "FormAssignmentTargetType" AS ENUM ('MEMBERSHIP', 'TEAM', 'DEPARTMENT', 'BRANCH', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "FormAssignmentRecipientStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FormSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVIEWED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WikiAiSourceType" AS ENUM ('WIKI_PAGE', 'CUSTOM_FORM', 'FORM_SUBMISSION', 'LINKED_RECORD', 'KNOWLEDGE_ARTICLE');

-- CreateEnum
CREATE TYPE "WikiAiIndexStatus" AS ENUM ('PENDING', 'INDEXED', 'STALE', 'FAILED');

-- CreateEnum
CREATE TYPE "WikiAiSuggestionKind" AS ENUM ('DRAFT_PAGE', 'UPDATE_PAGE', 'STALE_PAGE', 'CONTRADICTION');

-- CreateEnum
CREATE TYPE "WikiAiSuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'APPROVED', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "DocumentScope" AS ENUM ('ORGANIZATION', 'BRANCH', 'TEAM', 'PROJECT', 'CUSTOMER', 'EMPLOYEE', 'RECORD');

-- CreateEnum
CREATE TYPE "DocumentSource" AS ENUM ('UPLOAD', 'URL_IMPORT', 'PORTAL_UPLOAD', 'EMAIL_CAPTURE', 'GENERATED', 'OCR_INTAKE', 'EXTERNAL_LINK', 'API');

-- CreateEnum
CREATE TYPE "DocumentVersionStatus" AS ENUM ('PENDING', 'SCANNING', 'AVAILABLE', 'QUARANTINED', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentScanStatus" AS ENUM ('PENDING', 'SCANNING', 'CLEAN', 'INFECTED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "DocumentStorageProvider" AS ENUM ('PLATFORM', 'S3_COMPATIBLE', 'GOOGLE_DRIVE', 'MICROSOFT_365');

-- CreateEnum
CREATE TYPE "DocumentStorageConnectionStatus" AS ENUM ('PENDING', 'CONNECTED', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "DocumentUploadJobStatus" AS ENUM ('PENDING', 'UPLOADING', 'SCANNING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentPreviewKind" AS ENUM ('THUMBNAIL', 'IMAGE', 'PDF', 'TEXT', 'VIDEO', 'AUDIO');

-- CreateEnum
CREATE TYPE "DocumentPreviewStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'UNSUPPORTED');

-- CreateEnum
CREATE TYPE "DocumentShareSubjectType" AS ENUM ('MEMBERSHIP', 'TEAM', 'PORTAL_USER', 'EXTERNAL_EMAIL', 'PUBLIC_LINK');

-- CreateEnum
CREATE TYPE "DocumentSharePermission" AS ENUM ('VIEW', 'COMMENT', 'EDIT', 'MANAGE');

-- CreateEnum
CREATE TYPE "DocumentShareStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "DocumentApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentApprovalDecision" AS ENUM ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "DocumentApproverKind" AS ENUM ('MEMBERSHIP', 'PORTAL_USER');

-- CreateEnum
CREATE TYPE "FolderTemplateTarget" AS ENUM ('PROJECT_TYPE', 'CUSTOMER', 'EMPLOYEE', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "DocumentRetentionAnchor" AS ENUM ('CREATED', 'LAST_MODIFIED', 'ARCHIVED', 'RECORD_CLOSED');

-- CreateEnum
CREATE TYPE "DocumentRetentionAction" AS ENUM ('ARCHIVE', 'SOFT_DELETE', 'PERMANENT_DELETE');

-- CreateEnum
CREATE TYPE "DocumentDeletionKind" AS ENUM ('SOFT', 'PERMANENT', 'RETENTION');

-- CreateEnum
CREATE TYPE "DocumentDeletionStatus" AS ENUM ('REQUESTED', 'APPROVED', 'EXECUTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VaultEntryType" AS ENUM ('PASSWORD', 'API_KEY', 'SSH_KEY', 'NOTE', 'FILE');

-- CreateEnum
CREATE TYPE "VaultScope" AS ENUM ('ORGANIZATION', 'CUSTOMER', 'PROJECT');

-- CreateEnum
CREATE TYPE "VaultGrantSubjectType" AS ENUM ('MEMBERSHIP', 'TEAM', 'PORTAL_USER');

-- CreateEnum
CREATE TYPE "VaultAccessAction" AS ENUM ('VIEW', 'REVEAL', 'COPY', 'CREATE', 'UPDATE', 'ROTATE', 'DELETE', 'GRANT', 'REVOKE');

-- CreateEnum
CREATE TYPE "VaultKeyStatus" AS ENUM ('ACTIVE', 'ROTATING', 'RETIRED');

-- CreateEnum
CREATE TYPE "TimeEntryStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'INVOICED', 'LOCKED');

-- CreateEnum
CREATE TYPE "TimeEntrySource" AS ENUM ('MANUAL', 'TIMER', 'CALENDAR', 'IMPORTED', 'GENERATED');

-- CreateEnum
CREATE TYPE "TimeNonBillableCategory" AS ENUM ('INTERNAL', 'PRE_SALES', 'WARRANTY', 'OVERHEAD', 'LEAVE', 'TRAINING', 'ADMIN');

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('OPEN', 'SUBMITTED', 'APPROVED', 'REJECTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "TimesheetPeriodType" AS ENUM ('WEEKLY', 'BIWEEKLY', 'SEMI_MONTHLY', 'MONTHLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TimesheetApproverPolicy" AS ENUM ('PROJECT_OWNER', 'TEAM_LEAD', 'MANAGER', 'SPECIFIC_MEMBER');

-- CreateEnum
CREATE TYPE "TimesheetActionType" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'REOPENED', 'LOCKED', 'UNLOCKED');

-- CreateEnum
CREATE TYPE "TimeRateKind" AS ENUM ('BILLING', 'COST');

-- CreateEnum
CREATE TYPE "BillingRateScope" AS ENUM ('ORGANIZATION', 'PRODUCT', 'PROJECT', 'MEMBER', 'PROJECT_MEMBER');

-- CreateEnum
CREATE TYPE "TimeSuggestionSource" AS ENUM ('CALENDAR', 'COMMIT', 'TASK_ACTIVITY', 'ATTENDANCE', 'AI');

-- CreateEnum
CREATE TYPE "TimeSuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISMISSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TimeAdjustmentType" AS ENUM ('WRITE_OFF', 'WRITE_UP', 'WRITE_DOWN');

-- CreateEnum
CREATE TYPE "TimeRoundingMode" AS ENUM ('NONE', 'NEAREST', 'UP', 'DOWN');

-- CreateEnum
CREATE TYPE "TimeImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CalendarKind" AS ENUM ('PERSONAL', 'TEAM', 'PROJECT', 'CUSTOMER', 'BRANCH', 'ORGANIZATION', 'RESOURCE', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "CalendarResourceKind" AS ENUM ('ROOM', 'EQUIPMENT', 'VEHICLE', 'OTHER');

-- CreateEnum
CREATE TYPE "CalendarShareRole" AS ENUM ('FREE_BUSY', 'READ', 'WRITE', 'MANAGE');

-- CreateEnum
CREATE TYPE "CalendarEventStatus" AS ENUM ('TENTATIVE', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CalendarEventVisibility" AS ENUM ('PRIVATE', 'TEAM', 'ORGANIZATION', 'CUSTOMER_VISIBLE');

-- CreateEnum
CREATE TYPE "CalendarEventSource" AS ENUM ('INTERNAL', 'SYNCED', 'BOOKING', 'API');

-- CreateEnum
CREATE TYPE "CalendarAttendeeKind" AS ENUM ('MEMBER', 'PORTAL_USER', 'CONTACT', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "CalendarAttendeeRole" AS ENUM ('REQUIRED', 'OPTIONAL', 'INFORMATIONAL');

-- CreateEnum
CREATE TYPE "CalendarAttendeeResponse" AS ENUM ('NEEDS_ACTION', 'ACCEPTED', 'TENTATIVE', 'DECLINED');

-- CreateEnum
CREATE TYPE "CalendarResourceBookingStatus" AS ENUM ('REQUESTED', 'APPROVED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CalendarReminderMethod" AS ENUM ('NOTIFICATION', 'EMAIL', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "CalendarAvailabilityOverrideKind" AS ENUM ('UNAVAILABLE', 'AVAILABLE');

-- CreateEnum
CREATE TYPE "BookingLinkStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BookingHostAssignment" AS ENUM ('SINGLE', 'ROUND_ROBIN', 'COLLECTIVE');

-- CreateEnum
CREATE TYPE "BookingLinkAudience" AS ENUM ('PUBLIC', 'PORTAL', 'INTERNAL');

-- CreateEnum
CREATE TYPE "CalendarBookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED', 'NO_SHOW', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CalendarBookingSource" AS ENUM ('PUBLIC_LINK', 'PORTAL', 'INTERNAL', 'API');

-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('GOOGLE', 'MICROSOFT');

-- CreateEnum
CREATE TYPE "CalendarConnectionStatus" AS ENUM ('PENDING_AUTH', 'ACTIVE', 'PAUSED', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "CalendarSyncDirection" AS ENUM ('TWO_WAY', 'PULL_ONLY', 'PUSH_ONLY');

-- CreateEnum
CREATE TYPE "CalendarSyncMappingStatus" AS ENUM ('SYNCED', 'PENDING_PUSH', 'PENDING_PULL', 'CONFLICT', 'FAILED', 'DELETED_REMOTELY');

-- CreateEnum
CREATE TYPE "CalendarSyncRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "ConferencingProvider" AS ENUM ('GOOGLE_MEET', 'MICROSOFT_TEAMS', 'ZOOM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ConferencingAccountStatus" AS ENUM ('ACTIVE', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "AutomationTriggerKind" AS ENUM ('EVENT', 'SCHEDULE', 'DATE_RELATIVE', 'MANUAL', 'INBOUND_WEBHOOK');

-- CreateEnum
CREATE TYPE "AutomationActionKind" AS ENUM ('UPDATE_FIELD', 'ADD_TAG', 'SET_CUSTOM_FIELD', 'CHANGE_STATUS', 'ASSIGN', 'CREATE_RECORD', 'NOTIFY', 'SEND_COMMUNICATION', 'POST_MESSAGE', 'MANAGE_CHANNEL', 'CALL_WEBHOOK', 'AI_STEP', 'WAIT', 'APPROVAL', 'BRANCH', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AutomationAssignStrategy" AS ENUM ('MEMBER', 'TEAM', 'ROUND_ROBIN', 'LEAST_LOADED');

-- CreateEnum
CREATE TYPE "AutomationRuleScopeType" AS ENUM ('ORGANIZATION', 'BRANCH', 'TEAM', 'PROJECT_TYPE', 'PROJECT');

-- CreateEnum
CREATE TYPE "AutomationRuleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AutomationRunMode" AS ENUM ('LIVE', 'TEST', 'DRY_RUN');

-- CreateEnum
CREATE TYPE "AutomationRunStatus" AS ENUM ('PENDING', 'RUNNING', 'WAITING', 'AWAITING_APPROVAL', 'RETRY_SCHEDULED', 'SUCCEEDED', 'FAILED', 'DEAD_LETTERED', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AutomationStepStatus" AS ENUM ('PENDING', 'RUNNING', 'WAITING', 'AWAITING_APPROVAL', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AutomationApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AutomationAiStepKind" AS ENUM ('CLASSIFY', 'SUMMARIZE', 'EXTRACT', 'DRAFT');

-- CreateEnum
CREATE TYPE "PlatformEventSource" AS ENUM ('MODULE', 'API', 'INBOUND_WEBHOOK', 'SCHEDULED_JOB', 'AUTOMATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ScheduledJobKind" AS ENUM ('CRON', 'INTERVAL', 'ONCE');

-- CreateEnum
CREATE TYPE "ScheduledJobStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ScheduledJobRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'CANCELLED', 'TIMED_OUT');

-- CreateEnum
CREATE TYPE "OutboundWebhookStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'RETRY_SCHEDULED', 'SUCCEEDED', 'FAILED', 'DEAD_LETTERED');

-- CreateEnum
CREATE TYPE "InboundWebhookStatus" AS ENUM ('ACTIVE', 'PAUSED', 'REVOKED');

-- CreateEnum
CREATE TYPE "InboundWebhookAuthScheme" AS ENUM ('HMAC_SHA256', 'BEARER_TOKEN', 'BASIC', 'NONE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'SPREADSHEET';
ALTER TYPE "DocumentType" ADD VALUE 'PRESENTATION';
ALTER TYPE "DocumentType" ADD VALUE 'TEXT';
ALTER TYPE "DocumentType" ADD VALUE 'CODE';
ALTER TYPE "DocumentType" ADD VALUE 'ARCHIVE';
ALTER TYPE "DocumentType" ADD VALUE 'LINK';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RecordEntityType" ADD VALUE 'RECURRING_EXPENSE';
ALTER TYPE "RecordEntityType" ADD VALUE 'PAYROLL_ENTRY';
ALTER TYPE "RecordEntityType" ADD VALUE 'LEAVE_REQUEST';
ALTER TYPE "RecordEntityType" ADD VALUE 'PERFORMANCE_REVIEW';
ALTER TYPE "RecordEntityType" ADD VALUE 'PERFORMANCE_GOAL';
ALTER TYPE "RecordEntityType" ADD VALUE 'COMM_MESSAGE';
ALTER TYPE "RecordEntityType" ADD VALUE 'CAMPAIGN';
ALTER TYPE "RecordEntityType" ADD VALUE 'COMM_TEMPLATE';
ALTER TYPE "RecordEntityType" ADD VALUE 'CHANNEL';
ALTER TYPE "RecordEntityType" ADD VALUE 'MESSAGE';
ALTER TYPE "RecordEntityType" ADD VALUE 'PROJECT_MILESTONE';
ALTER TYPE "RecordEntityType" ADD VALUE 'PROJECT_CHANGE_REQUEST';
ALTER TYPE "RecordEntityType" ADD VALUE 'PAYMENT';
ALTER TYPE "RecordEntityType" ADD VALUE 'SUPPORT_CONVERSATION';
ALTER TYPE "RecordEntityType" ADD VALUE 'KNOWLEDGE_ARTICLE';
ALTER TYPE "RecordEntityType" ADD VALUE 'NOTIFICATION';
ALTER TYPE "RecordEntityType" ADD VALUE 'WIKI_SPACE';
ALTER TYPE "RecordEntityType" ADD VALUE 'WIKI_PAGE';
ALTER TYPE "RecordEntityType" ADD VALUE 'CUSTOM_FORM';
ALTER TYPE "RecordEntityType" ADD VALUE 'FORM_SUBMISSION';
ALTER TYPE "RecordEntityType" ADD VALUE 'FOLDER';
ALTER TYPE "RecordEntityType" ADD VALUE 'VAULT_ENTRY';
ALTER TYPE "RecordEntityType" ADD VALUE 'TIME_ENTRY';
ALTER TYPE "RecordEntityType" ADD VALUE 'TIMESHEET';
ALTER TYPE "RecordEntityType" ADD VALUE 'CALENDAR_EVENT';
ALTER TYPE "RecordEntityType" ADD VALUE 'CALENDAR_BOOKING';
ALTER TYPE "RecordEntityType" ADD VALUE 'AUTOMATION_RULE';
ALTER TYPE "RecordEntityType" ADD VALUE 'AUTOMATION_RUN';
ALTER TYPE "RecordEntityType" ADD VALUE 'SCHEDULED_JOB';
ALTER TYPE "RecordEntityType" ADD VALUE 'SUBSCRIPTION';

-- DropIndex
DROP INDEX "task_statuses_organization_id_team_id_slug_key";

-- AlterTable
ALTER TABLE "user_preferences" DROP COLUMN "notification_preferences";

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "customer_id" TEXT,
ADD COLUMN     "portal_membership_id" TEXT;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "approval_status" "DocumentApprovalStatus",
ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_version_id" TEXT,
ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "branch_id" TEXT,
ADD COLUMN     "category_id" TEXT,
ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "company_id" TEXT,
ADD COLUMN     "created_by_user_id" TEXT,
ADD COLUMN     "current_version_id" TEXT,
ADD COLUMN     "customer_visible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by_user_id" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "employee_id" TEXT,
ADD COLUMN     "entity_id" TEXT,
ADD COLUMN     "entity_type" "RecordEntityType",
ADD COLUMN     "external_url" TEXT,
ADD COLUMN     "folder_id" TEXT,
ADD COLUMN     "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "last_accessed_at" TIMESTAMP(3),
ADD COLUMN     "legal_hold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "legal_hold_reason" TEXT,
ADD COLUMN     "legal_hold_set_at" TIMESTAMP(3),
ADD COLUMN     "legal_hold_set_by_user_id" TEXT,
ADD COLUMN     "organization_id" TEXT,
ADD COLUMN     "owner_membership_id" TEXT,
ADD COLUMN     "project_id" TEXT,
ADD COLUMN     "purge_scheduled_at" TIMESTAMP(3),
ADD COLUMN     "retention_expires_at" TIMESTAMP(3),
ADD COLUMN     "retention_policy_id" TEXT,
ADD COLUMN     "scope" "DocumentScope" NOT NULL DEFAULT 'ORGANIZATION',
ADD COLUMN     "search_text" TEXT,
ADD COLUMN     "search_vector" tsvector,
ADD COLUMN     "source" "DocumentSource" NOT NULL DEFAULT 'UPLOAD',
ADD COLUMN     "source_module" "ModuleKey",
ADD COLUMN     "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "team_id" TEXT,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "uploaded_via_portal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "version_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "watermark_enabled" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "user_uuid" DROP NOT NULL,
ALTER COLUMN "mimetype" DROP NOT NULL,
ALTER COLUMN "size" DROP NOT NULL,
ALTER COLUMN "size" SET DATA TYPE BIGINT,
ALTER COLUMN "url" DROP NOT NULL,
ALTER COLUMN "path" DROP NOT NULL,
ALTER COLUMN "type" SET DEFAULT 'OTHER';

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "billing_model" "BillingModel",
ADD COLUMN     "default_time_billable" BOOLEAN,
ADD COLUMN     "default_time_non_billable_category" "TimeNonBillableCategory";

-- AlterTable
ALTER TABLE "project_types" ADD COLUMN     "default_time_billable" BOOLEAN,
ADD COLUMN     "default_time_non_billable_category" "TimeNonBillableCategory";

-- AlterTable
ALTER TABLE "task_statuses" ADD COLUMN     "project_type_id" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "actual_hours" DECIMAL(8,2),
ADD COLUMN     "blocked_reason" TEXT,
ADD COLUMN     "cloned_from_task_id" TEXT,
ADD COLUMN     "search_vector" tsvector;

-- AlterTable
ALTER TABLE "customer_portal_settings" ADD COLUMN     "profile_changes_require_approval" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "billing_profiles" ADD COLUMN     "dunning_policy_id" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by_user_id" TEXT,
ADD COLUMN     "proposal_payment_schedule_item_id" TEXT,
ADD COLUMN     "proposal_version_id" TEXT;

-- AlterTable
ALTER TABLE "invoice_line_items" DROP COLUMN "time_entry_ids",
ADD COLUMN     "adjustment_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "adjustment_reason" TEXT;

-- AlterTable
ALTER TABLE "invoice_reminders" ADD COLUMN     "automation_run_id" TEXT,
ADD COLUMN     "scheduled_job_run_id" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "proposal_version_id" TEXT,
ADD COLUMN     "setup_fee" DECIMAL(18,2),
ADD COLUMN     "setup_fee_invoiced_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "project_deliverable_reviews" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "deliverable_id" TEXT NOT NULL,
    "decision" "DeliverableStatus" NOT NULL,
    "comment" TEXT,
    "reviewer_user_id" TEXT,
    "reviewer_membership_id" TEXT,
    "document_version_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_deliverable_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_status_update_comments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "status_update_id" TEXT NOT NULL,
    "author_membership_id" TEXT,
    "author_user_id" TEXT,
    "body" TEXT NOT NULL,
    "edited_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_status_update_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_status_history" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "from_status_id" TEXT,
    "to_status_id" TEXT,
    "to_category" "TaskStatusCategory",
    "changed_by_membership_id" TEXT,
    "seconds_in_previous" INTEGER,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_portal_profile_change_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "requested_by_user_id" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "status" "PortalProfileChangeStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_membership_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_portal_profile_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "layout" JSONB,
    "branding" JSONB,
    "locale" TEXT,
    "default_notes" TEXT,
    "default_footer" TEXT,
    "payment_instructions" TEXT,
    "payment_terms_days" INTEGER,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_provider_connections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
    "provider_account_id" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'live',
    "credentials_ref" TEXT,
    "config" JSONB,
    "is_default" BOOLEAN NOT NULL DEFAULT true,
    "connected_by_user_id" TEXT,
    "connected_at" TIMESTAMP(3),
    "disconnected_at" TIMESTAMP(3),
    "last_checked_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_provider_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_settings" (
    "organization_id" TEXT NOT NULL,
    "reporting_currency" TEXT,
    "default_income_tax_rate_id" TEXT,
    "default_expense_tax_rate_id" TEXT,
    "default_pricing_mode" "TaxBehavior" NOT NULL DEFAULT 'EXCLUSIVE',
    "fiscal_year_start_month" INTEGER NOT NULL DEFAULT 1,
    "approval_threshold_amount" DECIMAL(18,2),
    "require_approval_for_imports" BOOLEAN NOT NULL DEFAULT true,
    "auto_sync_invoices" BOOLEAN NOT NULL DEFAULT true,
    "auto_sync_payments" BOOLEAN NOT NULL DEFAULT true,
    "auto_sync_subscriptions" BOOLEAN NOT NULL DEFAULT true,
    "auto_categorize_suppliers" BOOLEAN NOT NULL DEFAULT true,
    "duplicate_detection_enabled" BOOLEAN NOT NULL DEFAULT true,
    "upcoming_expense_reminder_days" INTEGER NOT NULL DEFAULT 7,
    "overdue_check_enabled" BOOLEAN NOT NULL DEFAULT true,
    "monthly_summary_enabled" BOOLEAN NOT NULL DEFAULT true,
    "ai_enabled" BOOLEAN NOT NULL DEFAULT true,
    "ai_auto_categorize" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_settings_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "ledger_categories" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "parent_category_id" TEXT,
    "kind" "LedgerCategoryKind" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "system_key" TEXT,
    "pl_line" "LedgerPlLine",
    "default_tax_rate_id" TEXT,
    "default_vat_treatment" "LedgerVatTreatment",
    "is_operating" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_payment_methods" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "PaymentMethodType" NOT NULL DEFAULT 'BANK_TRANSFER',
    "details" JSONB,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_supplier_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "default_category_id" TEXT,
    "default_tax_rate_id" TEXT,
    "default_vat_treatment" "LedgerVatTreatment",
    "default_pricing_mode" "TaxBehavior",
    "payment_terms_days" INTEGER,
    "matching_aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "vat_number" TEXT,
    "bank_details" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_supplier_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "number" TEXT NOT NULL,
    "type" "LedgerRecordType" NOT NULL,
    "status" "LedgerRecordStatus" NOT NULL DEFAULT 'POSTED',
    "source" "LedgerRecordSource" NOT NULL DEFAULT 'MANUAL',
    "is_manual" BOOLEAN NOT NULL DEFAULT true,
    "category_id" TEXT,
    "subcategory_id" TEXT,
    "category_path_snapshot" TEXT,
    "description" TEXT NOT NULL,
    "reference_number" TEXT,
    "transaction_date" DATE NOT NULL,
    "due_date" DATE,
    "payment_date" DATE,
    "period_id" TEXT,
    "currency" TEXT NOT NULL,
    "fx_rate" DECIMAL(18,6),
    "net_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vat_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "vat_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gross_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reporting_gross_amount" DECIMAL(18,2),
    "tax_rate_id" TEXT,
    "vat_treatment" "LedgerVatTreatment" NOT NULL DEFAULT 'STANDARD',
    "pricing_mode" "TaxBehavior" NOT NULL DEFAULT 'EXCLUSIVE',
    "amounts_overridden" BOOLEAN NOT NULL DEFAULT false,
    "payment_status" "LedgerPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "payment_method_id" TEXT,
    "amount_paid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "amount_remaining" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "company_id" TEXT,
    "counterparty_name" TEXT,
    "project_id" TEXT,
    "milestone_id" TEXT,
    "invoice_id" TEXT,
    "origin_payment_id" TEXT,
    "subscription_id" TEXT,
    "contract_id" TEXT,
    "employee_id" TEXT,
    "department_id" TEXT,
    "recurring_expense_id" TEXT,
    "recurrence_sequence" INTEGER,
    "automation_run_id" TEXT,
    "notes" TEXT,
    "line_items" JSONB,
    "ai_suggestions" JSONB,
    "flagged_unusual" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_by_membership_id" TEXT,
    "approved_by_membership_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "posted_at" TIMESTAMP(3),
    "voided_at" TIMESTAMP(3),
    "void_reason" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_settlements" (
    "id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "kind" "LedgerSettlementKind" NOT NULL DEFAULT 'PAYMENT',
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "settled_on" DATE NOT NULL,
    "payment_method_id" TEXT,
    "reference" TEXT,
    "payment_id" TEXT,
    "refund_id" TEXT,
    "document_id" TEXT,
    "notes" TEXT,
    "recorded_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_attachments" (
    "id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "kind" "LedgerAttachmentKind" NOT NULL DEFAULT 'OTHER',
    "is_original" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "added_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_invoice_imports" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "file_name" TEXT,
    "file_hash" TEXT,
    "status" "LedgerImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "record_type" "LedgerRecordType" NOT NULL DEFAULT 'EXPENSE',
    "uploaded_by_membership_id" TEXT,
    "extraction_raw" JSONB,
    "extraction_provider" TEXT,
    "confidence" DECIMAL(5,2),
    "field_confidence" JSONB,
    "supplier_name" TEXT,
    "supplier_vat_number" TEXT,
    "customer_name" TEXT,
    "matched_company_id" TEXT,
    "suggested_category_id" TEXT,
    "invoice_number" TEXT,
    "invoice_date" DATE,
    "due_date" DATE,
    "description" TEXT,
    "currency" TEXT,
    "net_amount" DECIMAL(18,2),
    "vat_percent" DECIMAL(5,2),
    "vat_amount" DECIMAL(18,2),
    "gross_amount" DECIMAL(18,2),
    "payment_info" JSONB,
    "ledger_record_id" TEXT,
    "duplicate_of_record_id" TEXT,
    "duplicate_of_import_id" TEXT,
    "reviewed_by_membership_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "error" TEXT,
    "processing_started_at" TIMESTAMP(3),
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_invoice_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_invoice_import_lines" (
    "id" TEXT NOT NULL,
    "import_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vat_percent" DECIMAL(5,2),
    "vat_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gross_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "confidence" DECIMAL(5,2),
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ledger_invoice_import_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_expenses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RecurringExpenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "category_id" TEXT,
    "subcategory_id" TEXT,
    "company_id" TEXT,
    "project_id" TEXT,
    "department_id" TEXT,
    "payment_method_id" TEXT,
    "currency" TEXT NOT NULL,
    "expected_net_amount" DECIMAL(18,2) NOT NULL,
    "vat_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "expected_vat_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "expected_gross_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_rate_id" TEXT,
    "vat_treatment" "LedgerVatTreatment" NOT NULL DEFAULT 'STANDARD',
    "pricing_mode" "TaxBehavior" NOT NULL DEFAULT 'EXCLUSIVE',
    "interval" "BillingInterval" NOT NULL DEFAULT 'MONTH',
    "interval_count" INTEGER NOT NULL DEFAULT 1,
    "custom_rrule" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "day_of_month" INTEGER,
    "due_days" INTEGER,
    "next_occurrence_date" DATE,
    "last_generated_at" TIMESTAMP(3),
    "occurrences_generated" INTEGER NOT NULL DEFAULT 0,
    "auto_generate" BOOLEAN NOT NULL DEFAULT true,
    "reminder_days_before" INTEGER,
    "scheduled_job_id" TEXT,
    "notes" TEXT,
    "created_by_membership_id" TEXT,
    "paused_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_schedules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "department_id" TEXT,
    "kind" "PayrollEntryKind" NOT NULL DEFAULT 'SALARY',
    "category_id" TEXT,
    "payment_method_id" TEXT,
    "currency" TEXT NOT NULL,
    "base_amount" DECIMAL(18,2) NOT NULL,
    "employer_cost_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "interval" "BillingInterval" NOT NULL DEFAULT 'MONTH',
    "interval_count" INTEGER NOT NULL DEFAULT 1,
    "payment_day" INTEGER,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "next_occurrence_date" DATE,
    "last_generated_at" TIMESTAMP(3),
    "auto_generate" BOOLEAN NOT NULL DEFAULT true,
    "status" "RecurringExpenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "scheduled_job_id" TEXT,
    "notes" TEXT,
    "created_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_entries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "employee_name_snapshot" TEXT,
    "department_id" TEXT,
    "schedule_id" TEXT,
    "period_id" TEXT,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "kind" "PayrollEntryKind" NOT NULL DEFAULT 'SALARY',
    "status" "PayrollEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL,
    "base_amount" DECIMAL(18,2) NOT NULL,
    "employer_cost_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "hours" DECIMAL(8,2),
    "hourly_rate" DECIMAL(18,2),
    "breakdown" JSONB,
    "description" TEXT,
    "payment_date" DATE,
    "payment_method_id" TEXT,
    "document_id" TEXT,
    "ledger_record_id" TEXT,
    "notes" TEXT,
    "created_by_membership_id" TEXT,
    "approved_by_membership_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "posted_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_periods" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "FinancialPeriodType" NOT NULL,
    "name" TEXT NOT NULL,
    "fiscal_year" INTEGER,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "FinancialPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closed_by_membership_id" TEXT,
    "closed_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_period_summaries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "basis" "LedgerReportBasis" NOT NULL DEFAULT 'ACCRUAL',
    "scope_key" TEXT NOT NULL DEFAULT 'org',
    "branch_id" TEXT,
    "project_id" TEXT,
    "company_id" TEXT,
    "currency" TEXT NOT NULL,
    "total_income" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_expenses" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net_profit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gross_income" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "outstanding_income" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paid_income" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "outstanding_expenses" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paid_expenses" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vat_collected" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vat_paid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net_vat" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "recurring_expenses" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "payroll_expenses" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "operating_expenses" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "income_by_category" JSONB,
    "expenses_by_category" JSONB,
    "pl_lines" JSONB,
    "vat_breakdown" JSONB,
    "trend" JSONB,
    "ai_summary" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_period_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_profitability_snapshots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "scope" "LedgerProfitabilityScope" NOT NULL,
    "subject_id" TEXT NOT NULL,
    "project_id" TEXT,
    "company_id" TEXT,
    "period_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "revenue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "payments_received" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "outstanding_revenue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "direct_expenses" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "employee_costs" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "other_expenses" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gross_profit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "margin_percent" DECIMAL(5,2),
    "details" JSONB,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_profitability_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_insights" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" "LedgerInsightKind" NOT NULL,
    "status" "LedgerInsightStatus" NOT NULL DEFAULT 'OPEN',
    "confidence" DECIMAL(5,2),
    "severity" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "record_id" TEXT,
    "data" JSONB,
    "period_id" TEXT,
    "resolved_by_membership_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_hr_settings" (
    "organization_id" TEXT NOT NULL,
    "default_weekly_hours" DECIMAL(5,2) NOT NULL DEFAULT 40,
    "default_schedule" JSONB,
    "leave_approver_strategy" "LeaveApproverStrategy" NOT NULL DEFAULT 'DIRECT_MANAGER',
    "leave_conflict_threshold_percent" DECIMAL(5,2),
    "attendance_required" BOOLEAN NOT NULL DEFAULT false,
    "allowed_clock_sources" "AttendanceSource"[] DEFAULT ARRAY['WEB', 'MOBILE']::"AttendanceSource"[],
    "late_tolerance_minutes" INTEGER NOT NULL DEFAULT 0,
    "overtime_threshold_minutes" INTEGER NOT NULL DEFAULT 0,
    "overtime_requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "prefill_time_entries_from_attendance" BOOLEAN NOT NULL DEFAULT false,
    "target_utilization_percent" DECIMAL(5,2) NOT NULL DEFAULT 80,
    "overload_threshold_percent" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "underutilized_threshold_percent" DECIMAL(5,2) NOT NULL DEFAULT 60,
    "self_service_editable_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "profile_changes_require_approval" BOOLEAN NOT NULL DEFAULT false,
    "directory_visible_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notify_birthdays" BOOLEAN NOT NULL DEFAULT true,
    "notify_anniversaries" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_hr_settings_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "employee_number" TEXT NOT NULL,
    "legal_first_name" TEXT,
    "legal_last_name" TEXT,
    "preferred_name" TEXT,
    "date_of_birth" DATE,
    "gender" TEXT,
    "nationality" TEXT,
    "national_id_number" TEXT,
    "tax_id" TEXT,
    "social_security_number" TEXT,
    "bank_details" JSONB,
    "work_email" TEXT,
    "work_phone" TEXT,
    "personal_email" TEXT,
    "personal_phone" TEXT,
    "address" JSONB,
    "photo_document_id" TEXT,
    "resume_document_id" TEXT,
    "job_title" TEXT,
    "position" TEXT,
    "role" TEXT,
    "seniority_level" "EmployeeSeniorityLevel",
    "department_team_id" TEXT,
    "primary_branch_id" TEXT,
    "manager_employee_id" TEXT,
    "employment_status" "EmploymentStatus" NOT NULL DEFAULT 'ONBOARDING',
    "employment_status_since" DATE,
    "employment_type" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "work_location" "EmployeeWorkLocation" NOT NULL DEFAULT 'OFFICE',
    "hire_date" DATE,
    "probation_end_date" DATE,
    "contract_end_date" DATE,
    "notice_period_days" INTEGER,
    "termination_date" DATE,
    "termination_reason" TEXT,
    "responsibilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "areas_of_expertise" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "technical_stack" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bio" TEXT,
    "availability_status" "EmployeeAvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "availability_note" TEXT,
    "availability_updated_at" TIMESTAMP(3),
    "weekly_capacity_hours" DECIMAL(5,2),
    "target_utilization_percent" DECIMAL(5,2),
    "timezone" TEXT,
    "onboarding_completed_at" TIMESTAMP(3),
    "offboarding_completed_at" TIMESTAMP(3),
    "directory_visible" BOOLEAN NOT NULL DEFAULT true,
    "archived_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_emergency_contacts" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" JSONB,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_positions" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "job_title" TEXT NOT NULL,
    "position" TEXT,
    "role" TEXT,
    "seniority_level" "EmployeeSeniorityLevel",
    "employment_type" "EmploymentType" NOT NULL,
    "department_team_id" TEXT,
    "branch_id" TEXT,
    "manager_employee_id" TEXT,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "reason" "EmployeePositionChangeReason" NOT NULL DEFAULT 'HIRE',
    "note" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_compensations" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "employment_type" "EmploymentType" NOT NULL,
    "pay_type" "EmployeePayType" NOT NULL,
    "base_amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "employer_cost_monthly" DECIMAL(18,2),
    "total_cost_monthly" DECIMAL(18,2),
    "cost_rate_hourly" DECIMAL(18,2),
    "billing_rate_default" DECIMAL(18,2),
    "billing_currency" TEXT,
    "contracted_weekly_hours" DECIMAL(5,2),
    "bonus_scheme" TEXT,
    "commission_scheme" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "approved_by_membership_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_compensations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_compensation_components" (
    "id" TEXT NOT NULL,
    "compensation_id" TEXT NOT NULL,
    "kind" "CompensationComponentKind" NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(18,2),
    "percent_of_base" DECIMAL(5,2),
    "currency" TEXT,
    "frequency" "CompensationFrequency" NOT NULL DEFAULT 'MONTHLY',
    "rule" JSONB,
    "paid_to_employee" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_compensation_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "SkillCategory" NOT NULL DEFAULT 'TECHNICAL',
    "description" TEXT,
    "parent_skill_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_skills" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "proficiency" "SkillProficiency" NOT NULL DEFAULT 'INTERMEDIATE',
    "years_experience" DECIMAL(4,1),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "last_used_on" DATE,
    "verified_by_membership_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_certifications" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "skill_id" TEXT,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "credential_id" TEXT,
    "credential_url" TEXT,
    "issued_on" DATE,
    "expires_on" DATE,
    "document_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_trainings" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "skill_id" TEXT,
    "title" TEXT NOT NULL,
    "provider" TEXT,
    "kind" TEXT,
    "status" "EmployeeTrainingStatus" NOT NULL DEFAULT 'PLANNED',
    "start_date" DATE,
    "end_date" DATE,
    "hours" DECIMAL(8,2),
    "cost" DECIMAL(18,2),
    "currency" TEXT,
    "completed_at" TIMESTAMP(3),
    "document_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_trainings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_languages" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "proficiency" "LanguageProficiency" NOT NULL DEFAULT 'PROFESSIONAL',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_work_schedules" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "name" TEXT,
    "schedule_type" "EmployeeScheduleType" NOT NULL DEFAULT 'FIXED',
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "timezone" TEXT,
    "weekly_hours" DECIMAL(5,2) NOT NULL,
    "core_hours" JSONB,
    "work_location" "EmployeeWorkLocation" NOT NULL DEFAULT 'OFFICE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_work_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_work_schedule_days" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "starts_at" TEXT,
    "ends_at" TEXT,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "hours" DECIMAL(4,2) NOT NULL,
    "work_location" "EmployeeWorkLocation",

    CONSTRAINT "employee_work_schedule_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_availability_entries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "status" "EmployeeAvailabilityStatus" NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "all_day" BOOLEAN NOT NULL DEFAULT true,
    "source" "EmployeeAvailabilitySource" NOT NULL DEFAULT 'MANUAL',
    "leave_request_id" TEXT,
    "calendar_event_id" TEXT,
    "note" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_availability_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "LeaveCategory" NOT NULL,
    "color" TEXT,
    "is_paid" BOOLEAN NOT NULL DEFAULT true,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "requires_attachment" BOOLEAN NOT NULL DEFAULT false,
    "attachment_after_days" INTEGER,
    "allows_half_day" BOOLEAN NOT NULL DEFAULT true,
    "deducts_balance" BOOLEAN NOT NULL DEFAULT true,
    "min_notice_days" INTEGER,
    "max_consecutive_days" INTEGER,
    "applies_to_types" "EmploymentType"[] DEFAULT ARRAY[]::"EmploymentType"[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_policies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "leave_type_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "name" TEXT NOT NULL,
    "accrual_method" "LeaveAccrualMethod" NOT NULL DEFAULT 'ANNUAL_UPFRONT',
    "annual_entitlement_days" DECIMAL(6,2) NOT NULL,
    "accrual_rate" DECIMAL(6,2),
    "prorate_first_year" BOOLEAN NOT NULL DEFAULT true,
    "seniority_bonus_days_per_year" DECIMAL(6,2),
    "max_entitlement_days" DECIMAL(6,2),
    "carry_over_max_days" DECIMAL(6,2),
    "carry_over_expiry_months" INTEGER,
    "allow_negative_balance" BOOLEAN NOT NULL DEFAULT false,
    "max_negative_days" DECIMAL(6,2),
    "period_start_month" INTEGER NOT NULL DEFAULT 1,
    "period_start_day" INTEGER NOT NULL DEFAULT 1,
    "applies_to_types" "EmploymentType"[] DEFAULT ARRAY[]::"EmploymentType"[],
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "effective_from" DATE,
    "effective_to" DATE,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_leave_policies" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "leave_policy_id" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_leave_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "leave_type_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "entitled_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "accrued_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "carried_over_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "adjusted_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "used_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "pending_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "carry_over_expires_on" DATE,
    "last_accrued_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balance_transactions" (
    "id" TEXT NOT NULL,
    "leave_balance_id" TEXT NOT NULL,
    "leave_request_id" TEXT,
    "type" "LeaveBalanceTransactionType" NOT NULL,
    "days" DECIMAL(6,2) NOT NULL,
    "effective_on" DATE NOT NULL,
    "reason" TEXT,
    "created_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_balance_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "leave_type_id" TEXT NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "start_day_part" "LeaveDayPart" NOT NULL DEFAULT 'FULL_DAY',
    "end_day_part" "LeaveDayPart" NOT NULL DEFAULT 'FULL_DAY',
    "total_days" DECIMAL(6,2) NOT NULL,
    "total_hours" DECIMAL(8,2),
    "reason" TEXT,
    "attachment_document_id" TEXT,
    "covering_employee_id" TEXT,
    "current_approver_membership_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "decided_by_membership_id" TEXT,
    "decision_note" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "conflicts" JSONB,
    "has_conflicts" BOOLEAN NOT NULL DEFAULT false,
    "calendar_event_id" TEXT,
    "automation_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_request_days" (
    "id" TEXT NOT NULL,
    "leave_request_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "day_part" "LeaveDayPart" NOT NULL DEFAULT 'FULL_DAY',
    "hours" DECIMAL(5,2),

    CONSTRAINT "leave_request_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_request_approvals" (
    "id" TEXT NOT NULL,
    "leave_request_id" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 1,
    "approver_membership_id" TEXT NOT NULL,
    "decision" "LeaveApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "decided_at" TIMESTAMP(3),
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_request_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_holidays" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" "CompanyHolidayKind" NOT NULL DEFAULT 'COMPANY',
    "is_half_day" BOOLEAN NOT NULL DEFAULT false,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "applies_to_branch_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'CLOCKED_IN',
    "work_location" "EmployeeWorkLocation" NOT NULL DEFAULT 'OFFICE',
    "first_clock_in_at" TIMESTAMP(3),
    "last_clock_out_at" TIMESTAMP(3),
    "scheduled_minutes" INTEGER NOT NULL DEFAULT 0,
    "worked_minutes" INTEGER NOT NULL DEFAULT 0,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "early_leave_minutes" INTEGER NOT NULL DEFAULT 0,
    "overtime_approved" BOOLEAN NOT NULL DEFAULT false,
    "overtime_approved_by_membership_id" TEXT,
    "overtime_approved_at" TIMESTAMP(3),
    "prefilled_time_entry_id" TEXT,
    "note" TEXT,
    "edited_by_membership_id" TEXT,
    "edited_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_sessions" (
    "id" TEXT NOT NULL,
    "attendance_record_id" TEXT NOT NULL,
    "clock_in_at" TIMESTAMP(3) NOT NULL,
    "clock_out_at" TIMESTAMP(3),
    "work_location" "EmployeeWorkLocation" NOT NULL DEFAULT 'OFFICE',
    "clock_in_source" "AttendanceSource" NOT NULL DEFAULT 'WEB',
    "clock_out_source" "AttendanceSource",
    "clock_in_meta" JSONB,
    "clock_out_meta" JSONB,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_breaks" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "kind" "AttendanceBreakKind" NOT NULL DEFAULT 'UNPAID',
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "attendance_breaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_summaries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "period_type" "EmployeePeriodType" NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "scheduled_minutes" INTEGER NOT NULL DEFAULT 0,
    "worked_minutes" INTEGER NOT NULL DEFAULT 0,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "days_present" INTEGER NOT NULL DEFAULT 0,
    "days_remote" INTEGER NOT NULL DEFAULT 0,
    "days_absent" INTEGER NOT NULL DEFAULT 0,
    "days_on_leave" INTEGER NOT NULL DEFAULT 0,
    "days_holiday" INTEGER NOT NULL DEFAULT 0,
    "late_count" INTEGER NOT NULL DEFAULT 0,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_capacity_periods" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "period_type" "EmployeePeriodType" NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "scheduled_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "leave_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "holiday_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "available_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "planned_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "logged_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "allocation_percent" DECIMAL(5,2),
    "utilization_percent" DECIMAL(5,2),
    "status" "EmployeeCapacityStatus" NOT NULL DEFAULT 'BALANCED',
    "breakdown" JSONB,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_capacity_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_review_cycles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PerformanceReviewType" NOT NULL DEFAULT 'ANNUAL',
    "status" "PerformanceReviewCycleStatus" NOT NULL DEFAULT 'PLANNED',
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "due_date" DATE,
    "template" JSONB,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_review_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_reviews" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "cycle_id" TEXT,
    "reviewer_membership_id" TEXT,
    "type" "PerformanceReviewType" NOT NULL DEFAULT 'ANNUAL',
    "status" "PerformanceReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "due_date" DATE,
    "self_assessment" TEXT,
    "self_submitted_at" TIMESTAMP(3),
    "manager_assessment" TEXT,
    "manager_submitted_at" TIMESTAMP(3),
    "ratings" JSONB,
    "overall_rating" DECIMAL(4,2),
    "rating_scale_max" INTEGER NOT NULL DEFAULT 5,
    "strengths" TEXT,
    "improvement_areas" TEXT,
    "summary" TEXT,
    "employee_comment" TEXT,
    "completed_at" TIMESTAMP(3),
    "acknowledged_at" TIMESTAMP(3),
    "next_review_date" DATE,
    "meeting_event_id" TEXT,
    "document_id" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_goals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "review_id" TEXT,
    "parent_goal_id" TEXT,
    "project_id" TEXT,
    "kind" "PerformanceGoalKind" NOT NULL DEFAULT 'GOAL',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "PerformanceGoalStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "weight_percent" DECIMAL(5,2),
    "target_value" DECIMAL(18,2),
    "current_value" DECIMAL(18,2),
    "unit" TEXT,
    "progress_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "start_date" DATE,
    "due_date" DATE,
    "completed_at" TIMESTAMP(3),
    "employee_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_goal_updates" (
    "id" TEXT NOT NULL,
    "goal_id" TEXT NOT NULL,
    "author_membership_id" TEXT,
    "progress_percent" DECIMAL(5,2),
    "current_value" DECIMAL(18,2),
    "status" "PerformanceGoalStatus",
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_goal_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_feedback" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "author_membership_id" TEXT,
    "review_id" TEXT,
    "goal_id" TEXT,
    "project_id" TEXT,
    "kind" "PerformanceFeedbackKind" NOT NULL,
    "visibility" "PerformanceFeedbackVisibility" NOT NULL DEFAULT 'MANAGERS_ONLY',
    "title" TEXT,
    "body" TEXT NOT NULL,
    "rating" DECIMAL(4,2),
    "occurred_on" DATE,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "edited_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_improvement_plans" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "review_id" TEXT,
    "status" "PerformanceImprovementPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "reason" TEXT,
    "objectives" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "check_in_frequency_days" INTEGER,
    "next_check_in_on" DATE,
    "manager_membership_id" TEXT,
    "hr_membership_id" TEXT,
    "outcome_note" TEXT,
    "closed_at" TIMESTAMP(3),
    "document_id" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_improvement_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_improvement_plan_items" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_date" DATE,
    "status" "PerformanceImprovementItemStatus" NOT NULL DEFAULT 'OPEN',
    "evaluated_at" TIMESTAMP(3),
    "note" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_improvement_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "category" "EmployeeDocumentCategory" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "EmployeeDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "document_id" TEXT,
    "contract_id" TEXT,
    "signature_request_id" TEXT,
    "requested_by_membership_id" TEXT,
    "requested_at" TIMESTAMP(3),
    "due_date" DATE,
    "uploaded_by_user_id" TEXT,
    "uploaded_at" TIMESTAMP(3),
    "verified_by_membership_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "valid_from" DATE,
    "expires_on" DATE,
    "employee_visible" BOOLEAN NOT NULL DEFAULT true,
    "is_confidential" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_hr_notes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "author_membership_id" TEXT,
    "category" "HrNoteCategory" NOT NULL DEFAULT 'HR_COMMENT',
    "visibility" "HrNoteVisibility" NOT NULL DEFAULT 'HR_AND_MANAGERS',
    "restricted_to_membership_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "severity" "HrNoteSeverity",
    "title" TEXT,
    "body" TEXT NOT NULL,
    "occurred_on" DATE,
    "requires_acknowledgement" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_at" TIMESTAMP(3),
    "related_entity_type" "RecordEntityType",
    "related_entity_id" TEXT,
    "attachment_document_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "edited_at" TIMESTAMP(3),
    "edit_history" JSONB,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_hr_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_profile_change_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "status" "EmployeeChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "changes" JSONB NOT NULL,
    "employee_note" TEXT,
    "submitted_by_user_id" TEXT,
    "decided_by_membership_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_profile_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comm_provider_accounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "channel" "CommChannel" NOT NULL,
    "provider" "CommProviderKind" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CommProviderAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "credentials" JSONB,
    "settings" JSONB,
    "webhook_secret" TEXT,
    "last_error" TEXT,
    "last_used_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comm_provider_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comm_sender_domains" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider_account_id" TEXT,
    "domain" TEXT NOT NULL,
    "status" "CommSenderDomainStatus" NOT NULL DEFAULT 'PENDING',
    "provider_domain_id" TEXT,
    "dns_records" JSONB,
    "spf_verified_at" TIMESTAMP(3),
    "dkim_verified_at" TIMESTAMP(3),
    "dmarc_verified_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "last_checked_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "tracking_domain" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comm_sender_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comm_sender_identities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "channel" "CommChannel" NOT NULL,
    "provider_account_id" TEXT,
    "sender_domain_id" TEXT,
    "address" TEXT NOT NULL,
    "display_name" TEXT,
    "reply_to_address" TEXT,
    "status" "CommSenderIdentityStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "provider_identity_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comm_sender_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comm_signatures" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "membership_id" TEXT,
    "name" TEXT NOT NULL,
    "body_html" TEXT NOT NULL,
    "body_text" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comm_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comm_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "channel" "CommChannel" NOT NULL,
    "kind" "CommTemplateKind" NOT NULL DEFAULT 'COMMUNICATION',
    "category" "CommTemplateCategory" NOT NULL DEFAULT 'OTHER',
    "status" "CommTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "language" TEXT NOT NULL DEFAULT 'en',
    "current_version_id" TEXT,
    "default_sender_identity_id" TEXT,
    "notification_event_type_id" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "use_branded_layout" BOOLEAN NOT NULL DEFAULT true,
    "variables" JSONB,
    "ai_generation_id" TEXT,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comm_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comm_template_versions" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "CommTemplateVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "subject" TEXT,
    "preheader" TEXT,
    "body_html" TEXT,
    "body_text" TEXT,
    "design" JSONB,
    "variables" JSONB,
    "attachment_document_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "change_note" TEXT,
    "published_at" TIMESTAMP(3),
    "created_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comm_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comm_template_translations" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "subject" TEXT,
    "preheader" TEXT,
    "body_html" TEXT,
    "body_text" TEXT,
    "is_machine_translated" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by_membership_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comm_template_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comm_threads" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subject" TEXT,
    "channel" "CommChannel" NOT NULL DEFAULT 'EMAIL',
    "contact_id" TEXT,
    "company_id" TEXT,
    "project_id" TEXT,
    "support_conversation_id" TEXT,
    "provider_thread_id" TEXT,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "last_message_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comm_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comm_messages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "channel" "CommChannel" NOT NULL,
    "kind" "CommMessageKind" NOT NULL DEFAULT 'CUSTOMER',
    "source" "CommMessageSource" NOT NULL DEFAULT 'MANUAL',
    "status" "CommMessageStatus" NOT NULL DEFAULT 'DRAFT',
    "thread_id" TEXT,
    "in_reply_to_message_id" TEXT,
    "template_id" TEXT,
    "category" "CommTemplateCategory",
    "template_version_id" TEXT,
    "subject" TEXT,
    "preheader" TEXT,
    "body_html" TEXT,
    "body_text" TEXT,
    "render_context" JSONB,
    "language" TEXT,
    "signature_id" TEXT,
    "branding_snapshot" JSONB,
    "sender_identity_id" TEXT,
    "from_address" TEXT,
    "from_name" TEXT,
    "reply_to_address" TEXT,
    "sent_by_membership_id" TEXT,
    "owner_membership_id" TEXT,
    "recipient_kind" "CommRecipientKind" NOT NULL DEFAULT 'CRM_CONTACT',
    "to_address" TEXT NOT NULL,
    "to_name" TEXT,
    "recipient_contact_id" TEXT,
    "recipient_membership_id" TEXT,
    "recipient_user_id" TEXT,
    "company_id" TEXT,
    "project_id" TEXT,
    "campaign_id" TEXT,
    "campaign_run_id" TEXT,
    "automation_rule_id" TEXT,
    "automation_run_id" TEXT,
    "notification_id" TEXT,
    "notification_delivery_id" TEXT,
    "source_entity_type" "RecordEntityType",
    "source_entity_id" TEXT,
    "ai_generation_id" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "schedule_timezone" TEXT,
    "scheduled_job_id" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3),
    "last_error" TEXT,
    "provider_account_id" TEXT,
    "provider" "CommProviderKind",
    "provider_message_id" TEXT,
    "queued_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "first_opened_at" TIMESTAMP(3),
    "last_opened_at" TIMESTAMP(3),
    "first_clicked_at" TIMESTAMP(3),
    "replied_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "bounced_at" TIMESTAMP(3),
    "bounce_type" "CommBounceType",
    "complained_at" TIMESTAMP(3),
    "unsubscribed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "open_count" INTEGER NOT NULL DEFAULT 0,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "sms_segment_count" INTEGER,
    "cost" DECIMAL(18,4),
    "cost_currency" TEXT,
    "tracking_enabled" BOOLEAN NOT NULL DEFAULT true,
    "unsubscribe_token" TEXT,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "provider_metadata" JSONB,
    "search_vector" tsvector,
    "archived_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comm_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comm_message_recipients" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "role" "CommRecipientRole" NOT NULL DEFAULT 'TO',
    "kind" "CommRecipientKind" NOT NULL DEFAULT 'CRM_CONTACT',
    "address" TEXT NOT NULL,
    "name" TEXT,
    "contact_id" TEXT,
    "membership_id" TEXT,
    "user_id" TEXT,
    "status" "CommRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "provider_recipient_id" TEXT,
    "delivered_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "clicked_at" TIMESTAMP(3),
    "bounced_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comm_message_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comm_message_attachments" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "document_id" TEXT,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT,
    "size" INTEGER,
    "url" TEXT,
    "is_inline" BOOLEAN NOT NULL DEFAULT false,
    "content_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comm_message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comm_message_links" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "entity_type" "RecordEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT 'related',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comm_message_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comm_delivery_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "recipient_id" TEXT,
    "type" "CommDeliveryEventType" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "provider" "CommProviderKind",
    "provider_event_id" TEXT,
    "provider_webhook_event_id" TEXT,
    "tracked_link_id" TEXT,
    "url" TEXT,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "bounce_type" "CommBounceType",
    "bounce_code" TEXT,
    "reason" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comm_delivery_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comm_tracked_links" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "message_id" TEXT,
    "campaign_id" TEXT,
    "token" TEXT NOT NULL,
    "original_url" TEXT NOT NULL,
    "label" TEXT,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "unique_click_count" INTEGER NOT NULL DEFAULT 0,
    "first_clicked_at" TIMESTAMP(3),
    "last_clicked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comm_tracked_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comm_recipient_lists" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "channel" "CommChannel",
    "member_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_membership_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comm_recipient_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comm_recipient_list_members" (
    "id" TEXT NOT NULL,
    "list_id" TEXT NOT NULL,
    "kind" "CommRecipientKind" NOT NULL DEFAULT 'CRM_CONTACT',
    "contact_id" TEXT,
    "membership_id" TEXT,
    "address" TEXT,
    "name" TEXT,
    "added_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comm_recipient_list_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "entity_type" "SegmentEntityType" NOT NULL DEFAULT 'CRM_CONTACT',
    "saved_view_id" TEXT,
    "definition" JSONB NOT NULL,
    "channel" "CommChannel",
    "require_consent" BOOLEAN NOT NULL DEFAULT true,
    "last_evaluated_at" TIMESTAMP(3),
    "last_count" INTEGER,
    "created_by_membership_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comm_consents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "channel" "CommChannel" NOT NULL,
    "status" "CommConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
    "source" "CommConsentSource" NOT NULL DEFAULT 'MANUAL',
    "marketing_opted_in" BOOLEAN NOT NULL DEFAULT false,
    "consented_at" TIMESTAMP(3),
    "withdrawn_at" TIMESTAMP(3),
    "confirmation_token" TEXT,
    "confirmation_expires_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "evidence" JSONB,
    "notes" TEXT,
    "updated_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comm_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comm_suppressions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "channel" "CommChannel" NOT NULL,
    "address" TEXT NOT NULL,
    "reason" "CommSuppressionReason" NOT NULL,
    "contact_id" TEXT,
    "source_message_id" TEXT,
    "campaign_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "blocks_transactional" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_by_membership_id" TEXT,
    "removed_at" TIMESTAMP(3),
    "removed_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comm_suppressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "channel" "CommChannel" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "campaign_type" TEXT,
    "is_template" BOOLEAN NOT NULL DEFAULT false,
    "duplicated_from_campaign_id" TEXT,
    "template_id" TEXT,
    "template_version_id" TEXT,
    "subject" TEXT,
    "preheader" TEXT,
    "body_html" TEXT,
    "body_text" TEXT,
    "sender_identity_id" TEXT,
    "from_name" TEXT,
    "reply_to_address" TEXT,
    "attachment_document_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tracking_enabled" BOOLEAN NOT NULL DEFAULT true,
    "utm" JSONB,
    "language" TEXT,
    "require_consent" BOOLEAN NOT NULL DEFAULT true,
    "scheduled_at" TIMESTAMP(3),
    "schedule_timezone" TEXT,
    "send_in_recipient_timezone" BOOLEAN NOT NULL DEFAULT false,
    "recurrence_rule" TEXT,
    "recurrence_ends_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "scheduled_job_id" TEXT,
    "send_rate_per_hour" INTEGER,
    "owner_membership_id" TEXT,
    "submitted_for_approval_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approved_by_membership_id" TEXT,
    "started_at" TIMESTAMP(3),
    "paused_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "audience_count" INTEGER NOT NULL DEFAULT 0,
    "excluded_count" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "opened_count" INTEGER NOT NULL DEFAULT 0,
    "clicked_count" INTEGER NOT NULL DEFAULT 0,
    "replied_count" INTEGER NOT NULL DEFAULT 0,
    "bounced_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "complained_count" INTEGER NOT NULL DEFAULT 0,
    "unsubscribed_count" INTEGER NOT NULL DEFAULT 0,
    "stats_refreshed_at" TIMESTAMP(3),
    "ai_generation_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_audiences" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "mode" "CampaignAudienceMode" NOT NULL DEFAULT 'INCLUDE',
    "list_id" TEXT,
    "segment_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_audiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_recipients" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "run_id" TEXT,
    "kind" "CommRecipientKind" NOT NULL DEFAULT 'CRM_CONTACT',
    "address" TEXT NOT NULL,
    "name" TEXT,
    "contact_id" TEXT,
    "membership_id" TEXT,
    "status" "CommRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "exclusion_reason" TEXT,
    "message_id" TEXT,
    "render_context" JSONB,
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_runs" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "run_number" INTEGER NOT NULL,
    "status" "CampaignRunStatus" NOT NULL DEFAULT 'PENDING',
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "audience_count" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_approvals" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "approver_membership_id" TEXT NOT NULL,
    "decision" "CampaignApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "campaign_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comm_daily_stats" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "channel" "CommChannel" NOT NULL,
    "kind" "CommMessageKind" NOT NULL,
    "campaign_id" TEXT,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "opened_count" INTEGER NOT NULL DEFAULT 0,
    "unique_opened_count" INTEGER NOT NULL DEFAULT 0,
    "clicked_count" INTEGER NOT NULL DEFAULT 0,
    "unique_clicked_count" INTEGER NOT NULL DEFAULT 0,
    "replied_count" INTEGER NOT NULL DEFAULT 0,
    "bounced_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "complained_count" INTEGER NOT NULL DEFAULT 0,
    "unsubscribed_count" INTEGER NOT NULL DEFAULT 0,
    "cost" DECIMAL(18,4),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comm_daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comm_ai_generations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "requested_by_membership_id" TEXT,
    "task" "CommAiTaskKind" NOT NULL,
    "channel" "CommChannel",
    "prompt" TEXT,
    "input" JSONB,
    "output" JSONB,
    "model" TEXT,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "accepted" BOOLEAN,
    "template_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comm_ai_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging_settings" (
    "organization_id" TEXT NOT NULL,
    "allow_delete_own_messages" BOOLEAN NOT NULL DEFAULT true,
    "delete_own_time_limit_minutes" INTEGER,
    "allow_admin_delete_messages" BOOLEAN NOT NULL DEFAULT true,
    "edit_time_limit_minutes" INTEGER,
    "preserve_edit_history" BOOLEAN NOT NULL DEFAULT true,
    "allowed_reactions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "custom_emoji" JSONB,
    "read_receipts_direct" BOOLEAN NOT NULL DEFAULT true,
    "read_receipts_group" BOOLEAN NOT NULL DEFAULT true,
    "read_receipts_customer" BOOLEAN NOT NULL DEFAULT false,
    "presence_visibility" TEXT NOT NULL DEFAULT 'everyone',
    "default_notification_level" "ChannelNotificationLevel" NOT NULL DEFAULT 'MENTIONS_AND_DIRECT',
    "default_channel_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "channel_naming_rules" JSONB,
    "file_policy" JSONB,
    "external_access_enabled" BOOLEAN NOT NULL DEFAULT false,
    "guest_access_enabled" BOOLEAN NOT NULL DEFAULT false,
    "guest_default_expiry_days" INTEGER,
    "broadcast_mention_policy" TEXT NOT NULL DEFAULT 'admins',
    "announcement_policy" TEXT NOT NULL DEFAULT 'admins',
    "auto_create_project_channels" BOOLEAN NOT NULL DEFAULT false,
    "voice_messages_enabled" BOOLEAN NOT NULL DEFAULT true,
    "calls_enabled" BOOLEAN NOT NULL DEFAULT false,
    "call_provider" TEXT,
    "rate_limits" JSONB,
    "sensitive_content_controls" JSONB,
    "admin_private_message_access_enabled" BOOLEAN NOT NULL DEFAULT false,
    "notification_previews_include_text" BOOLEAN NOT NULL DEFAULT true,
    "default_sections" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_settings_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "messaging_retention_policies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "MessagingRetentionScope" NOT NULL DEFAULT 'ORGANIZATION',
    "branch_id" TEXT,
    "team_id" TEXT,
    "channel_kind" "ChannelKind",
    "action" "MessagingRetentionAction" NOT NULL DEFAULT 'UNLIMITED',
    "retention_days" INTEGER,
    "applies_to_attachments" BOOLEAN NOT NULL DEFAULT true,
    "applies_to_reactions" BOOLEAN NOT NULL DEFAULT true,
    "applies_to_metadata" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by_user_id" TEXT,
    "last_applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "channel_kind" "ChannelKind" NOT NULL DEFAULT 'PROJECT',
    "trigger" "ChannelTemplateTrigger" NOT NULL DEFAULT 'MANUAL',
    "name_pattern" TEXT,
    "default_description" TEXT,
    "default_purpose" TEXT,
    "default_topic" TEXT,
    "posting_policy" "ChannelPostingPolicy" NOT NULL DEFAULT 'ALL_MEMBERS',
    "visibility" "ChannelVisibility" NOT NULL DEFAULT 'DISCOVERABLE',
    "external_access" BOOLEAN NOT NULL DEFAULT false,
    "member_rules" JSONB,
    "pinned_content" JSONB,
    "discussion_sections" JSONB,
    "archive_rule" JSONB,
    "retention_policy_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" "ChannelKind" NOT NULL,
    "visibility" "ChannelVisibility" NOT NULL DEFAULT 'DISCOVERABLE',
    "status" "ChannelStatus" NOT NULL DEFAULT 'ACTIVE',
    "slug" TEXT,
    "name" TEXT,
    "display_name" TEXT,
    "description" TEXT,
    "purpose" TEXT,
    "topic" TEXT,
    "icon_url" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "owner_membership_id" TEXT,
    "created_by_membership_id" TEXT,
    "team_id" TEXT,
    "membership_rules" JSONB,
    "branch_id" TEXT,
    "project_id" TEXT,
    "company_id" TEXT,
    "entity_type" "RecordEntityType",
    "entity_id" TEXT,
    "posting_policy" "ChannelPostingPolicy" NOT NULL DEFAULT 'ALL_MEMBERS',
    "external_access_enabled" BOOLEAN NOT NULL DEFAULT false,
    "read_receipts_enabled" BOOLEAN,
    "default_notification_level" "ChannelNotificationLevel",
    "auto_join" BOOLEAN NOT NULL DEFAULT false,
    "require_acknowledgement" BOOLEAN NOT NULL DEFAULT false,
    "is_confidential" BOOLEAN NOT NULL DEFAULT false,
    "dm_key" TEXT,
    "retention_policy_id" TEXT,
    "template_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "auto_archive_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "archived_by_user_id" TEXT,
    "archive_reason" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_user_id" TEXT,
    "member_count" INTEGER NOT NULL DEFAULT 0,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "last_message_at" TIMESTAMP(3),
    "settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_members" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "membership_id" TEXT,
    "external_user_id" TEXT,
    "role" "ChannelMemberRole" NOT NULL DEFAULT 'MEMBER',
    "source" "ChannelMembershipSource" NOT NULL DEFAULT 'MANUAL',
    "guest_kind" "ChannelGuestKind",
    "access_expires_at" TIMESTAMP(3),
    "external_label" TEXT,
    "invited_by_user_id" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),
    "removed_at" TIMESTAMP(3),
    "removed_by_user_id" TEXT,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "last_viewed_at" TIMESTAMP(3),
    "muted_until" TIMESTAMP(3),
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_notification_settings" (
    "channel_member_id" TEXT NOT NULL,
    "level" "ChannelNotificationLevel",
    "notify_thread_replies" BOOLEAN NOT NULL DEFAULT true,
    "notify_reactions" BOOLEAN NOT NULL DEFAULT false,
    "notify_keywords" BOOLEAN NOT NULL DEFAULT true,
    "desktop_enabled" BOOLEAN NOT NULL DEFAULT true,
    "mobile_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_enabled" BOOLEAN NOT NULL DEFAULT false,
    "sound" TEXT,
    "schedule" JSONB,
    "digest_frequency" "ChannelDigestFrequency" NOT NULL DEFAULT 'NONE',
    "priority_customer_messages" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_notification_settings_pkey" PRIMARY KEY ("channel_member_id")
);

-- CreateTable
CREATE TABLE "channel_member_restrictions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "channel_id" TEXT,
    "membership_id" TEXT,
    "external_user_id" TEXT,
    "kind" "ChannelRestrictionKind" NOT NULL,
    "reason" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "lifted_at" TIMESTAMP(3),
    "lifted_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_member_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "kind" "MessageKind" NOT NULL DEFAULT 'USER',
    "visibility" "MessageVisibility" NOT NULL DEFAULT 'INTERNAL',
    "status" "MessageDeliveryStatus" NOT NULL DEFAULT 'SENT',
    "author_membership_id" TEXT,
    "author_user_id" TEXT,
    "integration_id" TEXT,
    "body" TEXT NOT NULL,
    "body_rich" JSONB,
    "body_plain" TEXT,
    "parent_message_id" TEXT,
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "last_reply_at" TIMESTAMP(3),
    "quoted_message_id" TEXT,
    "forwarded_from_message_id" TEXT,
    "scheduled_for" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "is_announcement" BOOLEAN NOT NULL DEFAULT false,
    "requires_acknowledgement" BOOLEAN NOT NULL DEFAULT false,
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "edited_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "deleted_by_user_id" TEXT,
    "delete_reason" TEXT,
    "pinned_at" TIMESTAMP(3),
    "system_event" TEXT,
    "integration_source" TEXT,
    "external_event_id" TEXT,
    "client_message_id" TEXT,
    "has_attachments" BOOLEAN NOT NULL DEFAULT false,
    "has_links" BOOLEAN NOT NULL DEFAULT false,
    "has_record_shares" BOOLEAN NOT NULL DEFAULT false,
    "reaction_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "search_vector" tsvector,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_versions" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "body_rich" JSONB,
    "edited_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_reactions" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "membership_id" TEXT,
    "external_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_mentions" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "kind" "MessageMentionKind" NOT NULL,
    "membership_id" TEXT,
    "external_user_id" TEXT,
    "team_id" TEXT,
    "role_id" TEXT,
    "mentioned_channel_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_attachments" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "kind" "MessageAttachmentKind" NOT NULL DEFAULT 'OTHER',
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "duration_seconds" INTEGER,
    "preview" JSONB,
    "uploaded_by_user_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_link_previews" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT,
    "title" TEXT,
    "description" TEXT,
    "image_url" TEXT,
    "status" "MessageLinkPreviewStatus" NOT NULL DEFAULT 'PENDING',
    "entity_type" "RecordEntityType",
    "entity_id" TEXT,
    "fetched_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_link_previews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_record_shares" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "entity_type" "RecordEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "snapshot" JSONB,
    "snapshot_at" TIMESTAMP(3),
    "shared_by_user_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_record_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_acknowledgements" (
    "message_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "acknowledged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_acknowledgements_pkey" PRIMARY KEY ("message_id","membership_id")
);

-- CreateTable
CREATE TABLE "channel_read_states" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "membership_id" TEXT,
    "external_user_id" TEXT,
    "last_read_message_id" TEXT,
    "last_read_at" TIMESTAMP(3),
    "marked_unread_from_id" TEXT,
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "mention_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_read_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_read_receipts" (
    "message_id" TEXT NOT NULL,
    "reader_id" TEXT NOT NULL,
    "membership_id" TEXT,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_read_receipts_pkey" PRIMARY KEY ("message_id","reader_id")
);

-- CreateTable
CREATE TABLE "message_thread_followers" (
    "root_message_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "last_read_at" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'auto',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_thread_followers_pkey" PRIMARY KEY ("root_message_id","membership_id")
);

-- CreateTable
CREATE TABLE "channel_pins" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "pinned_by_membership_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_pins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_messages" (
    "id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_reminders" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "remind_at" TIMESTAMP(3) NOT NULL,
    "preset" TEXT,
    "note" TEXT,
    "status" "MessageReminderStatus" NOT NULL DEFAULT 'PENDING',
    "triggered_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "notification_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_drafts" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "thread_root_message_id" TEXT,
    "body" TEXT NOT NULL,
    "body_rich" JSONB,
    "attachment_document_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scheduled_for" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging_keywords" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "match_whole_word" BOOLEAN NOT NULL DEFAULT true,
    "case_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "disabled_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_sections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_collapsed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_section_items" (
    "section_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_section_items_pkey" PRIMARY KEY ("section_id","channel_id")
);

-- CreateTable
CREATE TABLE "messaging_presence" (
    "membership_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "state" "MessagingPresenceState" NOT NULL DEFAULT 'OFFLINE',
    "manual_state" "MessagingPresenceState",
    "manual_state_until" TIMESTAMP(3),
    "status_text" TEXT,
    "status_emoji" TEXT,
    "status_starts_at" TIMESTAMP(3),
    "status_ends_at" TIMESTAMP(3),
    "status_expires_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "active_connections" INTEGER NOT NULL DEFAULT 0,
    "presence_hidden" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_presence_pkey" PRIMARY KEY ("membership_id")
);

-- CreateTable
CREATE TABLE "messaging_member_settings" (
    "membership_id" TEXT NOT NULL,
    "default_channel_level" "ChannelNotificationLevel",
    "default_dm_level" "ChannelNotificationLevel",
    "notification_previews_with_text" BOOLEAN NOT NULL DEFAULT true,
    "notification_sound" TEXT,
    "share_read_receipts" BOOLEAN NOT NULL DEFAULT true,
    "share_typing_indicator" BOOLEAN NOT NULL DEFAULT true,
    "keyboard_shortcuts" JSONB,
    "sidebar_preferences" JSONB,
    "composer_preferences" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_member_settings_pkey" PRIMARY KEY ("membership_id")
);

-- CreateTable
CREATE TABLE "message_reports" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "reporter_membership_id" TEXT,
    "reporter_user_id" TEXT,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "MessageReportStatus" NOT NULL DEFAULT 'OPEN',
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "action_taken" TEXT,
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging_export_jobs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "requested_by_membership_id" TEXT,
    "status" "MessagingExportStatus" NOT NULL DEFAULT 'PENDING',
    "format" "MessagingExportFormat" NOT NULL DEFAULT 'JSON',
    "filters" JSONB NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "result_document_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "message_count" INTEGER,
    "channel_count" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging_integrations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" "MessagingIntegrationKind" NOT NULL,
    "status" "MessagingIntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "bot_display_name" TEXT,
    "bot_avatar_url" TEXT,
    "default_channel_id" TEXT,
    "allowed_channel_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inbound_token_hash" TEXT,
    "config" JSONB,
    "subscribed_events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rate_limit_per_minute" INTEGER,
    "automation_rule_id" TEXT,
    "created_by_user_id" TEXT,
    "last_event_at" TIMESTAMP(3),
    "last_error" TEXT,
    "last_error_at" TIMESTAMP(3),
    "disconnected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_calls" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "kind" "ChannelCallKind" NOT NULL DEFAULT 'VOICE',
    "status" "ChannelCallStatus" NOT NULL DEFAULT 'RINGING',
    "started_by_membership_id" TEXT,
    "title" TEXT,
    "provider" TEXT,
    "meeting_url" TEXT,
    "external_ref" TEXT,
    "calendar_event_id" TEXT,
    "message_id" TEXT,
    "screen_sharing_used" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "recording_document_id" TEXT,
    "participant_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_call_participants" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "membership_id" TEXT,
    "external_user_id" TEXT,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joined_at" TIMESTAMP(3),
    "left_at" TIMESTAMP(3),
    "state" TEXT NOT NULL DEFAULT 'invited',

    CONSTRAINT "channel_call_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging_usage_daily" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "channel_id" TEXT,
    "date" DATE NOT NULL,
    "messages_count" INTEGER NOT NULL DEFAULT 0,
    "direct_messages_count" INTEGER NOT NULL DEFAULT 0,
    "threads_count" INTEGER NOT NULL DEFAULT 0,
    "thread_replies_count" INTEGER NOT NULL DEFAULT 0,
    "reactions_count" INTEGER NOT NULL DEFAULT 0,
    "files_count" INTEGER NOT NULL DEFAULT 0,
    "files_bytes" BIGINT NOT NULL DEFAULT 0,
    "active_members_count" INTEGER NOT NULL DEFAULT 0,
    "active_channels_count" INTEGER NOT NULL DEFAULT 0,
    "external_messages_count" INTEGER NOT NULL DEFAULT 0,
    "mentions_count" INTEGER NOT NULL DEFAULT 0,
    "avg_response_seconds" INTEGER,
    "unread_snapshot" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_usage_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_settings" (
    "organization_id" TEXT NOT NULL,
    "ticket_prefix" TEXT NOT NULL DEFAULT 'SUP',
    "default_sla_policy_id" TEXT,
    "default_inbox_id" TEXT,
    "auto_close_after_days" INTEGER,
    "inactivity_after_hours" INTEGER,
    "reopen_window_days" INTEGER,
    "csat_enabled" BOOLEAN NOT NULL DEFAULT true,
    "csat_delay_minutes" INTEGER NOT NULL DEFAULT 0,
    "ai_agent_enabled" BOOLEAN NOT NULL DEFAULT false,
    "ai_model" TEXT NOT NULL DEFAULT 'jev',
    "ai_auto_classify_threshold" DECIMAL(5,4),
    "ai_auto_assign_threshold" DECIMAL(5,4),
    "ai_auto_task_threshold" DECIMAL(5,4),
    "ai_require_task_approval" BOOLEAN NOT NULL DEFAULT true,
    "ai_require_reply_approval" BOOLEAN NOT NULL DEFAULT true,
    "ai_handover_after_turns" INTEGER,
    "ai_escalation_intents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "default_task_type_id" TEXT,
    "task_priority_mapping" JSONB,
    "task_status_sync_mapping" JSONB,
    "default_signature" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_settings_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "support_inboxes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "team_id" TEXT,
    "branch_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "default_assignee_membership_id" TEXT,
    "default_sla_policy_id" TEXT,
    "routing_strategy" TEXT NOT NULL DEFAULT 'manual',
    "signature" TEXT,
    "auto_reply_body" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_inboxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_channels" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "inbox_id" TEXT NOT NULL,
    "type" "SupportChannelType" NOT NULL,
    "name" TEXT NOT NULL,
    "email_address" TEXT,
    "sender_identity_id" TEXT,
    "widget_key" TEXT,
    "allowed_origins" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "config" JSONB,
    "ai_agent_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_conversations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "inbox_id" TEXT,
    "channel_id" TEXT,
    "channel_type" "SupportChannelType" NOT NULL,
    "status" "SupportConversationStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "subject" TEXT,
    "contact_id" TEXT,
    "company_id" TEXT,
    "customer_user_id" TEXT,
    "visitor_key" TEXT,
    "customer_name" TEXT,
    "customer_email" TEXT,
    "assignee_membership_id" TEXT,
    "team_id" TEXT,
    "snoozed_until" TIMESTAMP(3),
    "merged_into_conversation_id" TEXT,
    "split_from_conversation_id" TEXT,
    "email_thread_key" TEXT,
    "language" TEXT,
    "sentiment" "SupportSentiment",
    "sentiment_score" DECIMAL(5,4),
    "ai_summary" TEXT,
    "ai_summary_at" TIMESTAMP(3),
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "first_customer_message_at" TIMESTAMP(3),
    "first_agent_response_at" TIMESTAMP(3),
    "last_message_at" TIMESTAMP(3),
    "last_customer_message_at" TIMESTAMP(3),
    "last_agent_message_at" TIMESTAMP(3),
    "customer_last_read_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "resolved_by_membership_id" TEXT,
    "reopened_at" TIMESTAMP(3),
    "created_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_conversation_participants" (
    "conversation_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "role" "SupportParticipantRole" NOT NULL DEFAULT 'COLLABORATOR',
    "last_read_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_conversation_participants_pkey" PRIMARY KEY ("conversation_id","membership_id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" "SupportMessageKind" NOT NULL,
    "channel_type" "SupportChannelType",
    "author_membership_id" TEXT,
    "author_user_id" TEXT,
    "author_name" TEXT,
    "author_email" TEXT,
    "body" TEXT NOT NULL,
    "body_html" TEXT,
    "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "canned_response_id" TEXT,
    "ai_suggestion_id" TEXT,
    "language" TEXT,
    "translations" JSONB,
    "comm_message_id" TEXT,
    "external_message_id" TEXT,
    "in_reply_to_message_id" TEXT,
    "delivery_status" "SupportMessageDeliveryStatus",
    "delivered_at" TIMESTAMP(3),
    "delivery_error" TEXT,
    "read_by_customer_at" TIMESTAMP(3),
    "is_first_response" BOOLEAN NOT NULL DEFAULT false,
    "edited_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "search_vector" tsvector,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_message_attachments" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "file_name" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_statuses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "TicketStatusCategory" NOT NULL,
    "color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "allowed_transitions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pauses_sla" BOOLEAN NOT NULL DEFAULT false,
    "customer_label" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_categories" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "parent_category_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "default_team_id" TEXT,
    "default_inbox_id" TEXT,
    "default_priority" "TicketPriority",
    "default_sla_policy_id" TEXT,
    "default_project_id" TEXT,
    "ai_hints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_policies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "use_business_hours" BOOLEAN NOT NULL DEFAULT true,
    "calendar_id" TEXT,
    "conditions" JSONB,
    "at_risk_threshold_percent" DECIMAL(5,2) NOT NULL DEFAULT 80,
    "escalation_rule_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_policy_targets" (
    "id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL,
    "first_response_minutes" INTEGER,
    "next_response_minutes" INTEGER,
    "resolution_minutes" INTEGER,

    CONSTRAINT "sla_policy_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "branch_id" TEXT,
    "inbox_id" TEXT,
    "conversation_id" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "type" "TicketType" NOT NULL DEFAULT 'QUESTION',
    "source" "TicketSource" NOT NULL DEFAULT 'MANUAL',
    "channel_type" "SupportChannelType",
    "status_id" TEXT,
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "category_id" TEXT,
    "requester_contact_id" TEXT,
    "company_id" TEXT,
    "requester_user_id" TEXT,
    "requester_email" TEXT,
    "requester_name" TEXT,
    "assignee_membership_id" TEXT,
    "team_id" TEXT,
    "project_id" TEXT,
    "change_request_id" TEXT,
    "release_id" TEXT,
    "sla_policy_id" TEXT,
    "first_response_due_at" TIMESTAMP(3),
    "next_response_due_at" TIMESTAMP(3),
    "resolution_due_at" TIMESTAMP(3),
    "sla_breached" BOOLEAN NOT NULL DEFAULT false,
    "sla_at_risk" BOOLEAN NOT NULL DEFAULT false,
    "first_responded_at" TIMESTAMP(3),
    "last_customer_reply_at" TIMESTAMP(3),
    "last_agent_reply_at" TIMESTAMP(3),
    "due_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "resolved_by_membership_id" TEXT,
    "resolution" TEXT,
    "closed_at" TIMESTAMP(3),
    "auto_close_at" TIMESTAMP(3),
    "auto_close_job_id" TEXT,
    "reopened_at" TIMESTAMP(3),
    "reopen_count" INTEGER NOT NULL DEFAULT 0,
    "escalation_level" INTEGER NOT NULL DEFAULT 0,
    "escalated_at" TIMESTAMP(3),
    "escalated_to_membership_id" TEXT,
    "merged_into_ticket_id" TEXT,
    "incident_id" TEXT,
    "ai_classification" JSONB,
    "ai_confidence" DECIMAL(5,4),
    "sentiment" "SupportSentiment",
    "sentiment_score" DECIMAL(5,4),
    "language" TEXT,
    "ai_complexity" TEXT,
    "ai_summary" TEXT,
    "resolved_by_ai" BOOLEAN NOT NULL DEFAULT false,
    "customer_visible" BOOLEAN NOT NULL DEFAULT true,
    "channel_id" TEXT,
    "created_by_membership_id" TEXT,
    "created_by_user_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "search_vector" tsvector,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_conversations" (
    "ticket_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_conversations_pkey" PRIMARY KEY ("ticket_id","conversation_id")
);

-- CreateTable
CREATE TABLE "ticket_status_history" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "from_status_id" TEXT,
    "to_status_id" TEXT,
    "from_category" "TicketStatusCategory",
    "to_category" "TicketStatusCategory",
    "changed_by_membership_id" TEXT,
    "changed_by_user_id" TEXT,
    "changed_via" TEXT NOT NULL DEFAULT 'manual',
    "reason" TEXT,
    "seconds_in_previous" INTEGER,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_sla_timers" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "policy_id" TEXT,
    "metric" "SlaMetric" NOT NULL,
    "status" "SlaTimerStatus" NOT NULL DEFAULT 'RUNNING',
    "target_minutes" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMP(3) NOT NULL,
    "paused_at" TIMESTAMP(3),
    "paused_seconds_total" INTEGER NOT NULL DEFAULT 0,
    "at_risk_at" TIMESTAMP(3),
    "at_risk_notified_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "breached_at" TIMESTAMP(3),
    "elapsed_minutes" INTEGER,
    "scheduled_job_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_sla_timers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_relations" (
    "id" TEXT NOT NULL,
    "source_ticket_id" TEXT NOT NULL,
    "target_ticket_id" TEXT NOT NULL,
    "type" "TicketRelationType" NOT NULL DEFAULT 'RELATED',
    "detected_by_ai" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DECIMAL(5,4),
    "created_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_task_links" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "kind" "TicketTaskLinkKind" NOT NULL DEFAULT 'LINKED',
    "sync_status" BOOLEAN NOT NULL DEFAULT true,
    "idempotency_key" TEXT,
    "ai_suggestion_id" TEXT,
    "created_by_membership_id" TEXT,
    "last_synced_task_status" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_task_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_followers" (
    "ticket_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_followers_pkey" PRIMARY KEY ("ticket_id","membership_id")
);

-- CreateTable
CREATE TABLE "ticket_attachments" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "file_name" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "added_by_user_id" TEXT,
    "added_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_incidents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "SupportIncidentStatus" NOT NULL DEFAULT 'DETECTED',
    "detected_by_ai" BOOLEAN NOT NULL DEFAULT false,
    "project_id" TEXT,
    "task_id" TEXT,
    "knowledge_article_id" TEXT,
    "owner_membership_id" TEXT,
    "ticket_count" INTEGER NOT NULL DEFAULT 0,
    "first_reported_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_csat_ratings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "ticket_id" TEXT,
    "conversation_id" TEXT,
    "contact_id" TEXT,
    "rated_by_user_id" TEXT,
    "agent_membership_id" TEXT,
    "rating" INTEGER,
    "comment" TEXT,
    "token" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "support_csat_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_canned_responses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "scope" "SupportCannedResponseScope" NOT NULL DEFAULT 'ORGANIZATION',
    "team_id" TEXT,
    "owner_membership_id" TEXT,
    "name" TEXT NOT NULL,
    "shortcut" TEXT,
    "category" TEXT,
    "body" TEXT NOT NULL,
    "actions" JSONB,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_canned_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_categories" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "parent_category_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "visibility" "KnowledgeVisibility" NOT NULL DEFAULT 'PUBLIC',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_articles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "category_id" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "status" "KnowledgeArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "KnowledgeVisibility" NOT NULL DEFAULT 'PUBLIC',
    "is_faq" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "related_article_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attachment_document_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "release_id" TEXT,
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "source_ticket_id" TEXT,
    "author_membership_id" TEXT,
    "reviewer_membership_id" TEXT,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "published_at" TIMESTAMP(3),
    "last_reviewed_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "not_helpful_count" INTEGER NOT NULL DEFAULT 0,
    "seo" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "search_vector" tsvector,

    CONSTRAINT "knowledge_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_article_versions" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "change_note" TEXT,
    "author_membership_id" TEXT,
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_article_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_article_feedback" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "is_helpful" BOOLEAN NOT NULL,
    "comment" TEXT,
    "user_id" TEXT,
    "contact_id" TEXT,
    "visitor_key" TEXT,
    "conversation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_article_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ai_sessions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "ticket_id" TEXT,
    "status" "SupportAiSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "model" TEXT NOT NULL,
    "collected_data" JSONB,
    "cited_article_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "handover_summary" TEXT,
    "handover_reason" TEXT,
    "turn_count" INTEGER NOT NULL DEFAULT 0,
    "usage" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handed_over_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "support_ai_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ai_suggestions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" "SupportAiSuggestionKind" NOT NULL,
    "conversation_id" TEXT,
    "ticket_id" TEXT,
    "source_message_id" TEXT,
    "model" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "explanation" TEXT,
    "confidence" DECIMAL(5,4),
    "status" "SupportAiSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "auto_applied" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by_membership_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "applied_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "was_correct" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_ai_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_event_types" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "key" TEXT NOT NULL,
    "module" "ModuleKey" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "NotificationCategory" NOT NULL DEFAULT 'GENERAL',
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "customer_visible" BOOLEAN NOT NULL DEFAULT false,
    "default_channels" "NotificationChannel"[] DEFAULT ARRAY['IN_APP']::"NotificationChannel"[],
    "mandatory_by_default" BOOLEAN NOT NULL DEFAULT false,
    "forced_channels" "NotificationChannel"[] DEFAULT ARRAY[]::"NotificationChannel"[],
    "can_coalesce" BOOLEAN NOT NULL DEFAULT false,
    "coalesce_window_seconds" INTEGER,
    "supports_digest" BOOLEAN NOT NULL DEFAULT true,
    "default_expiry_minutes" INTEGER,
    "available_actions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "payload_schema" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deprecated_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_event_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "event_type_id" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "entity_type" "RecordEntityType",
    "entity_id" TEXT,
    "entity_label" TEXT,
    "actor_membership_id" TEXT,
    "actor_user_id" TEXT,
    "actor_service_account_id" TEXT,
    "payload" JSONB NOT NULL,
    "targets" JSONB,
    "group_key" TEXT,
    "expires_at" TIMESTAMP(3),
    "platform_event_id" TEXT,
    "automation_rule_id" TEXT,
    "status" "NotificationEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "notification_count" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "event_id" TEXT,
    "event_type_id" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "module" "ModuleKey" NOT NULL,
    "category" "NotificationCategory" NOT NULL DEFAULT 'GENERAL',
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "recipient_type" "NotificationRecipientType" NOT NULL,
    "recipient_membership_id" TEXT,
    "recipient_user_id" TEXT,
    "portal_membership_id" TEXT,
    "audience_reason" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "icon" TEXT,
    "action_url" TEXT,
    "entity_type" "RecordEntityType",
    "entity_id" TEXT,
    "entity_label" TEXT,
    "actor_membership_id" TEXT,
    "actor_user_id" TEXT,
    "data" JSONB,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "requires_action" BOOLEAN NOT NULL DEFAULT false,
    "actions" JSONB,
    "action_taken" TEXT,
    "action_taken_at" TIMESTAMP(3),
    "group_key" TEXT,
    "coalesced_count" INTEGER NOT NULL DEFAULT 1,
    "last_event_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seen_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "snoozed_until" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "skip_reason" "NotificationSkipReason",
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "next_attempt_at" TIMESTAMP(3),
    "last_attempted_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "digest_id" TEXT,
    "template_id" TEXT,
    "locale" TEXT,
    "rendered_subject" TEXT,
    "rendered_body" TEXT,
    "destination" TEXT,
    "preview_hidden" BOOLEAN NOT NULL DEFAULT false,
    "comm_message_id" TEXT,
    "push_device_id" TEXT,
    "provider" TEXT,
    "provider_message_id" TEXT,
    "provider_response" JSONB,
    "opened_at" TIMESTAMP(3),
    "clicked_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "event_type_id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "locale" TEXT,
    "subject" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "html_body" TEXT,
    "cta_label" TEXT,
    "cta_url" TEXT,
    "variables" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_membership_id" TEXT,
    "updated_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_org_settings" (
    "organization_id" TEXT NOT NULL,
    "enabled_channels" "NotificationChannel"[] DEFAULT ARRAY['IN_APP', 'EMAIL']::"NotificationChannel"[],
    "portal_enabled_channels" "NotificationChannel"[] DEFAULT ARRAY['IN_APP', 'EMAIL']::"NotificationChannel"[],
    "email_sender_identity_id" TEXT,
    "sms_sender_identity_id" TEXT,
    "default_level" "NotificationLevel" NOT NULL DEFAULT 'ALL',
    "default_digest_frequency" "NotificationDigestFrequency" NOT NULL DEFAULT 'IMMEDIATE',
    "default_digest_hour" INTEGER NOT NULL DEFAULT 8,
    "default_digest_weekday" INTEGER NOT NULL DEFAULT 1,
    "hide_previews_by_default" BOOLEAN NOT NULL DEFAULT false,
    "max_delivery_attempts" INTEGER NOT NULL DEFAULT 5,
    "retry_backoff_seconds" INTEGER NOT NULL DEFAULT 60,
    "retention_days" INTEGER,
    "webhook_events_enabled" BOOLEAN NOT NULL DEFAULT false,
    "updated_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_org_settings_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "notification_org_defaults" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "module" "ModuleKey",
    "event_type_id" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "channels" "NotificationChannel"[] DEFAULT ARRAY['IN_APP']::"NotificationChannel"[],
    "portal_channels" "NotificationChannel"[] DEFAULT ARRAY['IN_APP', 'EMAIL']::"NotificationChannel"[],
    "delivery_mode" "NotificationDeliveryMode" NOT NULL DEFAULT 'IMMEDIATE',
    "digest_frequency" "NotificationDigestFrequency" NOT NULL DEFAULT 'DAILY',
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "updated_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_org_defaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_recipient_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "recipient_type" "NotificationRecipientType" NOT NULL,
    "membership_id" TEXT,
    "portal_membership_id" TEXT,
    "level" "NotificationLevel" NOT NULL DEFAULT 'ALL',
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "desktop_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sound_enabled" BOOLEAN NOT NULL DEFAULT true,
    "dnd_enabled" BOOLEAN NOT NULL DEFAULT false,
    "dnd_start_time" TEXT,
    "dnd_end_time" TEXT,
    "dnd_weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "dnd_until" TIMESTAMP(3),
    "timezone" TEXT,
    "dnd_allow_critical" BOOLEAN NOT NULL DEFAULT true,
    "digest_frequency" "NotificationDigestFrequency" NOT NULL DEFAULT 'IMMEDIATE',
    "digest_channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "digest_hour" INTEGER,
    "digest_weekday" INTEGER,
    "show_previews" BOOLEAN NOT NULL DEFAULT true,
    "thread_notifications" BOOLEAN NOT NULL DEFAULT true,
    "reaction_notifications" BOOLEAN NOT NULL DEFAULT true,
    "keyword_notifications" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_recipient_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "recipient_type" "NotificationRecipientType" NOT NULL,
    "membership_id" TEXT,
    "portal_membership_id" TEXT,
    "recipient_key" TEXT NOT NULL,
    "event_type_id" TEXT,
    "module" "ModuleKey",
    "entity_type" "RecordEntityType",
    "entity_id" TEXT,
    "scope_key" TEXT NOT NULL,
    "channel" "NotificationChannel",
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "level" "NotificationLevel",
    "delivery_mode" "NotificationDeliveryMode" NOT NULL DEFAULT 'IMMEDIATE',
    "is_following" BOOLEAN NOT NULL DEFAULT false,
    "muted_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_keywords" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "match_whole_word" BOOLEAN NOT NULL DEFAULT true,
    "case_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "channels" "NotificationChannel"[] DEFAULT ARRAY[]::"NotificationChannel"[],
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "disabled_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_digests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "recipient_type" "NotificationRecipientType" NOT NULL,
    "membership_id" TEXT,
    "portal_membership_id" TEXT,
    "recipient_user_id" TEXT,
    "frequency" "NotificationDigestFrequency" NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "module" "ModuleKey",
    "entity_type" "RecordEntityType",
    "entity_id" TEXT,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "status" "NotificationDigestStatus" NOT NULL DEFAULT 'OPEN',
    "item_count" INTEGER NOT NULL DEFAULT 0,
    "locale" TEXT,
    "rendered_subject" TEXT,
    "rendered_body" TEXT,
    "comm_message_id" TEXT,
    "provider_message_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_digests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_push_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "membership_id" TEXT,
    "platform" "NotificationPushPlatform" NOT NULL,
    "provider" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "subscription" JSONB,
    "device_name" TEXT,
    "app_version" TEXT,
    "locale" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "disabled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_push_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_delivery_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "NotificationDeliveryRuleKind" NOT NULL,
    "event_type_id" TEXT,
    "module" "ModuleKey",
    "channel" "NotificationChannel",
    "window_seconds" INTEGER,
    "max_per_window" INTEGER,
    "coalesce_key" "NotificationCoalesceKey",
    "conditions" JSONB,
    "automation_rule_id" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_delivery_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_spaces" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "kind" "WikiSpaceKind" NOT NULL DEFAULT 'TOPIC',
    "team_id" TEXT,
    "branch_id" TEXT,
    "department_id" TEXT,
    "project_id" TEXT,
    "owner_membership_id" TEXT,
    "default_visibility" "WikiVisibility" NOT NULL DEFAULT 'ORGANIZATION',
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_space_members" (
    "space_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "level" "WikiPermissionLevel" NOT NULL DEFAULT 'VIEW',
    "added_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wiki_space_members_pkey" PRIMARY KEY ("space_id","membership_id")
);

-- CreateTable
CREATE TABLE "wiki_page_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "space_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "page_type" "WikiPageType" NOT NULL DEFAULT 'GENERAL',
    "content" JSONB,
    "content_markdown" TEXT,
    "default_review_interval_days" INTEGER,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_page_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_pages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "parent_page_id" TEXT,
    "template_id" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "cover_document_id" TEXT,
    "page_type" "WikiPageType" NOT NULL DEFAULT 'GENERAL',
    "status" "WikiPageStatus" NOT NULL DEFAULT 'DRAFT',
    "content" JSONB,
    "content_markdown" TEXT,
    "excerpt" TEXT,
    "path" TEXT NOT NULL DEFAULT '',
    "depth" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "visibility" "WikiVisibility" NOT NULL DEFAULT 'ORGANIZATION',
    "customer_visible" BOOLEAN NOT NULL DEFAULT false,
    "help_center_article_id" TEXT,
    "help_center_published_at" TIMESTAMP(3),
    "owner_membership_id" TEXT,
    "review_interval_days" INTEGER,
    "last_reviewed_at" TIMESTAMP(3),
    "last_reviewed_by_membership_id" TEXT,
    "next_review_at" DATE,
    "stale_flagged_at" TIMESTAMP(3),
    "requires_acknowledgement" BOOLEAN NOT NULL DEFAULT false,
    "current_version_number" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),
    "published_by_membership_id" TEXT,
    "published_version_number" INTEGER,
    "locked_by_membership_id" TEXT,
    "locked_at" TIMESTAMP(3),
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "last_edited_by_membership_id" TEXT,
    "last_edited_at" TIMESTAMP(3),
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "search_vector" tsvector,

    CONSTRAINT "wiki_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_page_reviewers" (
    "page_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wiki_page_reviewers_pkey" PRIMARY KEY ("page_id","membership_id")
);

-- CreateTable
CREATE TABLE "wiki_page_versions" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB,
    "content_markdown" TEXT,
    "change_summary" TEXT,
    "is_published_snapshot" BOOLEAN NOT NULL DEFAULT false,
    "restored_from_version_id" TEXT,
    "ai_suggestion_id" TEXT,
    "created_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wiki_page_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_page_permissions" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "principal_type" "WikiPrincipalType" NOT NULL,
    "principal_id" TEXT NOT NULL,
    "level" "WikiPermissionLevel" NOT NULL DEFAULT 'VIEW',
    "inherit" BOOLEAN NOT NULL DEFAULT true,
    "granted_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wiki_page_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_page_links" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "entity_type" "RecordEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "label" TEXT,
    "block_id" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wiki_page_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_page_attachments" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "block_id" TEXT,
    "added_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wiki_page_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_page_comments" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "parent_comment_id" TEXT,
    "author_membership_id" TEXT,
    "block_id" TEXT,
    "body" TEXT NOT NULL,
    "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reactions" JSONB,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_membership_id" TEXT,
    "edited_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_page_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_page_favorites" (
    "page_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wiki_page_favorites_pkey" PRIMARY KEY ("page_id","membership_id")
);

-- CreateTable
CREATE TABLE "wiki_page_acknowledgements" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "checklist_run_item_id" TEXT,
    "required_by" DATE,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_version_number" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_page_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_checklists" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" "WikiChecklistKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "department_id" TEXT,
    "role_id" TEXT,
    "team_id" TEXT,
    "branch_id" TEXT,
    "guide_page_id" TEXT,
    "owner_membership_id" TEXT,
    "auto_assign" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "archived_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_checklist_items" (
    "id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "page_id" TEXT,
    "requires_acknowledgement" BOOLEAN NOT NULL DEFAULT false,
    "form_id" TEXT,
    "due_offset_days" INTEGER,
    "assignee_kind" "WikiChecklistAssigneeKind" NOT NULL DEFAULT 'SUBJECT',
    "assignee_membership_id" TEXT,
    "task_type_id" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_checklist_runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "subject_membership_id" TEXT NOT NULL,
    "employee_id" TEXT,
    "status" "WikiChecklistRunStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "triggered_by" "WikiChecklistTrigger" NOT NULL DEFAULT 'MANUAL',
    "automation_run_id" TEXT,
    "started_at" TIMESTAMP(3),
    "due_at" DATE,
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "progress_percent" INTEGER NOT NULL DEFAULT 0,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_checklist_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_checklist_run_items" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "checklist_item_id" TEXT NOT NULL,
    "task_id" TEXT,
    "status" "WikiChecklistItemStatus" NOT NULL DEFAULT 'PENDING',
    "form_submission_id" TEXT,
    "completed_by_membership_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "skipped_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_checklist_run_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_forms" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "space_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "kind" "CustomFormKind" NOT NULL DEFAULT 'CUSTOM',
    "status" "CustomFormStatus" NOT NULL DEFAULT 'DRAFT',
    "fields_schema" JSONB NOT NULL,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "allow_multiple_submissions" BOOLEAN NOT NULL DEFAULT false,
    "requires_review" BOOLEAN NOT NULL DEFAULT false,
    "reviewer_membership_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confirmation_message" TEXT,
    "opens_at" TIMESTAMP(3),
    "closes_at" TIMESTAMP(3),
    "current_version_number" INTEGER NOT NULL DEFAULT 0,
    "owner_membership_id" TEXT,
    "published_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_form_versions" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "fields_schema" JSONB NOT NULL,
    "change_summary" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_form_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_assignments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "target_type" "FormAssignmentTargetType" NOT NULL,
    "target_id" TEXT,
    "due_at" TIMESTAMP(3),
    "reminders" JSONB,
    "message" TEXT,
    "automation_rule_id" TEXT,
    "assigned_by_membership_id" TEXT,
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "submitted_count" INTEGER NOT NULL DEFAULT 0,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_assignment_recipients" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "status" "FormAssignmentRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "submission_id" TEXT,
    "last_reminded_at" TIMESTAMP(3),
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_assignment_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_submissions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "form_version_id" TEXT NOT NULL,
    "respondent_membership_id" TEXT,
    "submitted_by_user_id" TEXT,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "status" "FormSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "answers" JSONB NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "reviewed_by_membership_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "created_task_id" TEXT,
    "created_ticket_id" TEXT,
    "exclude_from_ai_index" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_submission_files" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "field_key" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_submission_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_ai_index_entries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "source_type" "WikiAiSourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "page_id" TEXT,
    "form_id" TEXT,
    "submission_id" TEXT,
    "chunk_index" INTEGER NOT NULL DEFAULT 0,
    "heading_path" TEXT,
    "content_text" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "token_count" INTEGER,
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "embedding_model" TEXT,
    "space_id" TEXT,
    "visibility" "WikiVisibility",
    "customer_visible" BOOLEAN NOT NULL DEFAULT false,
    "source_version" INTEGER,
    "status" "WikiAiIndexStatus" NOT NULL DEFAULT 'PENDING',
    "indexed_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "knowledge_article_id" TEXT,

    CONSTRAINT "wiki_ai_index_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_ai_suggestions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" "WikiAiSuggestionKind" NOT NULL,
    "status" "WikiAiSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "page_id" TEXT,
    "related_page_id" TEXT,
    "space_id" TEXT,
    "title" TEXT,
    "content" JSONB,
    "content_markdown" TEXT,
    "rationale" TEXT,
    "source_entity_type" "RecordEntityType",
    "source_entity_id" TEXT,
    "citation_entry_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidence" DECIMAL(5,2),
    "model_name" TEXT,
    "reviewed_by_membership_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "resulting_version_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_ai_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_settings" (
    "organization_id" TEXT NOT NULL,
    "max_file_size_bytes" BIGINT NOT NULL DEFAULT 104857600,
    "allowed_mime_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blocked_extensions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "virus_scan_required" BOOLEAN NOT NULL DEFAULT true,
    "folder_max_depth" INTEGER NOT NULL DEFAULT 10,
    "public_links_enabled" BOOLEAN NOT NULL DEFAULT false,
    "public_link_max_days" INTEGER NOT NULL DEFAULT 30,
    "default_share_expiry_days" INTEGER,
    "watermark_customer_documents" BOOLEAN NOT NULL DEFAULT false,
    "signed_url_ttl_seconds" INTEGER NOT NULL DEFAULT 900,
    "soft_delete_recovery_days" INTEGER NOT NULL DEFAULT 30,
    "portal_upload_enabled" BOOLEAN NOT NULL DEFAULT true,
    "vault_portal_sharing_enabled" BOOLEAN NOT NULL DEFAULT false,
    "vault_reveal_reauth_minutes" INTEGER,
    "full_text_extraction_enabled" BOOLEAN NOT NULL DEFAULT false,
    "default_storage_provider" "DocumentStorageProvider" NOT NULL DEFAULT 'PLATFORM',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_settings_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "document_categories" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "customer_visible_default" BOOLEAN NOT NULL DEFAULT false,
    "default_retention_policy_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_storage_connections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" "DocumentStorageProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "DocumentStorageConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "root_identifier" TEXT,
    "root_path" TEXT,
    "region" TEXT,
    "endpoint_url" TEXT,
    "credentials_ref" TEXT,
    "config" JSONB,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "last_checked_at" TIMESTAMP(3),
    "last_error" TEXT,
    "connected_by_user_id" TEXT,
    "disconnected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_storage_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_retention_policies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category_id" TEXT,
    "scope" "DocumentScope",
    "retain_days" INTEGER,
    "anchor" "DocumentRetentionAnchor" NOT NULL DEFAULT 'CREATED',
    "action" "DocumentRetentionAction" NOT NULL DEFAULT 'ARCHIVE',
    "enforced_by_module" "ModuleKey",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by_user_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folder_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "target" "FolderTemplateTarget" NOT NULL DEFAULT 'PROJECT_TYPE',
    "project_type_id" TEXT,
    "structure" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folder_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folders" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "parent_folder_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "path" TEXT NOT NULL DEFAULT '',
    "depth" INTEGER NOT NULL DEFAULT 0,
    "scope" "DocumentScope" NOT NULL DEFAULT 'ORGANIZATION',
    "branch_id" TEXT,
    "team_id" TEXT,
    "project_id" TEXT,
    "company_id" TEXT,
    "employee_id" TEXT,
    "template_id" TEXT,
    "default_category_id" TEXT,
    "customer_visible" BOOLEAN NOT NULL DEFAULT false,
    "portal_upload_allowed" BOOLEAN NOT NULL DEFAULT false,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_user_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "DocumentVersionStatus" NOT NULL DEFAULT 'PENDING',
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "storage_provider" "DocumentStorageProvider" NOT NULL DEFAULT 'PLATFORM',
    "storage_connection_id" TEXT,
    "storage_key" TEXT NOT NULL,
    "storage_bucket" TEXT,
    "external_file_id" TEXT,
    "scan_status" "DocumentScanStatus" NOT NULL DEFAULT 'PENDING',
    "scan_result" JSONB,
    "scanned_at" TIMESTAMP(3),
    "change_note" TEXT,
    "author_membership_id" TEXT,
    "author_user_id" TEXT,
    "source" "DocumentSource" NOT NULL DEFAULT 'UPLOAD',
    "restored_from_version_id" TEXT,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_by_module" "ModuleKey",
    "locked_reason" TEXT,
    "locked_at" TIMESTAMP(3),
    "extracted_text" TEXT,
    "page_count" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "duration_seconds" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_upload_jobs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "status" "DocumentUploadJobStatus" NOT NULL DEFAULT 'PENDING',
    "source" "DocumentSource" NOT NULL DEFAULT 'UPLOAD',
    "source_module" "ModuleKey",
    "source_url" TEXT,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT,
    "expected_size_bytes" BIGINT,
    "uploaded_bytes" BIGINT NOT NULL DEFAULT 0,
    "expected_checksum" TEXT,
    "upload_session_id" TEXT,
    "storage_key" TEXT,
    "document_id" TEXT,
    "folder_id" TEXT,
    "scope" "DocumentScope" NOT NULL DEFAULT 'ORGANIZATION',
    "project_id" TEXT,
    "company_id" TEXT,
    "entity_type" "RecordEntityType",
    "entity_id" TEXT,
    "category_id" TEXT,
    "title" TEXT,
    "change_note" TEXT,
    "version_id" TEXT,
    "scan_status" "DocumentScanStatus" NOT NULL DEFAULT 'PENDING',
    "error_code" TEXT,
    "error_message" TEXT,
    "initiated_by_membership_id" TEXT,
    "initiated_by_user_id" TEXT,
    "via_portal" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_upload_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_previews" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "kind" "DocumentPreviewKind" NOT NULL,
    "status" "DocumentPreviewStatus" NOT NULL DEFAULT 'PENDING',
    "page_number" INTEGER NOT NULL DEFAULT 0,
    "mimetype" TEXT,
    "storage_key" TEXT,
    "size_bytes" BIGINT,
    "width" INTEGER,
    "height" INTEGER,
    "watermarked" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_previews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_attachments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "entity_type" "RecordEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'attachment',
    "source_module" "ModuleKey",
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "linked_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_favorites" (
    "id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "document_id" TEXT,
    "folder_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_recent_accesses" (
    "membership_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "last_accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "access_count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "document_recent_accesses_pkey" PRIMARY KEY ("membership_id","document_id")
);

-- CreateTable
CREATE TABLE "document_shares" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "document_id" TEXT,
    "folder_id" TEXT,
    "subject_type" "DocumentShareSubjectType" NOT NULL,
    "membership_id" TEXT,
    "team_id" TEXT,
    "portal_user_id" TEXT,
    "external_email" TEXT,
    "external_name" TEXT,
    "link_token" TEXT,
    "link_password_hash" TEXT,
    "permission" "DocumentSharePermission" NOT NULL DEFAULT 'VIEW',
    "status" "DocumentShareStatus" NOT NULL DEFAULT 'ACTIVE',
    "allow_download" BOOLEAN NOT NULL DEFAULT true,
    "watermark" BOOLEAN NOT NULL DEFAULT false,
    "pinned_version_id" TEXT,
    "max_access_count" INTEGER,
    "access_count" INTEGER NOT NULL DEFAULT 0,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "last_accessed_at" TIMESTAMP(3),
    "message" TEXT,
    "expires_at" TIMESTAMP(3),
    "shared_by_membership_id" TEXT,
    "shared_by_user_id" TEXT,
    "revoked_at" TIMESTAMP(3),
    "revoked_by_user_id" TEXT,
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_approvals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "title" TEXT,
    "message" TEXT,
    "status" "DocumentApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "require_all" BOOLEAN NOT NULL DEFAULT true,
    "due_at" TIMESTAMP(3),
    "requested_by_membership_id" TEXT,
    "requested_by_user_id" TEXT,
    "outcome_comment" TEXT,
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_user_id" TEXT,
    "last_reminded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_approvers" (
    "id" TEXT NOT NULL,
    "approval_id" TEXT NOT NULL,
    "kind" "DocumentApproverKind" NOT NULL DEFAULT 'MEMBERSHIP',
    "membership_id" TEXT,
    "portal_user_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "decision" "DocumentApprovalDecision",
    "comment" TEXT,
    "decided_at" TIMESTAMP(3),
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_approvers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_deletion_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "document_id" TEXT,
    "document_title" TEXT NOT NULL,
    "kind" "DocumentDeletionKind" NOT NULL DEFAULT 'SOFT',
    "status" "DocumentDeletionStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "retention_policy_id" TEXT,
    "requested_by_user_id" TEXT,
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "purged_storage_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "executed_at" TIMESTAMP(3),
    "executed_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_keys" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "key_ref" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "algorithm" TEXT NOT NULL DEFAULT 'AES-256-GCM',
    "status" "VaultKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "rotated_at" TIMESTAMP(3),
    "retired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_entries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "scope" "VaultScope" NOT NULL DEFAULT 'ORGANIZATION',
    "company_id" TEXT,
    "project_id" TEXT,
    "name" TEXT NOT NULL,
    "type" "VaultEntryType" NOT NULL DEFAULT 'PASSWORD',
    "username" TEXT,
    "url" TEXT,
    "notes" TEXT,
    "secret_ciphertext" TEXT,
    "vault_key_id" TEXT,
    "secret_hint" TEXT,
    "file_name" TEXT,
    "file_mimetype" TEXT,
    "file_size_bytes" BIGINT,
    "file_storage_key" TEXT,
    "expires_at" TIMESTAMP(3),
    "owner_membership_id" TEXT,
    "created_by_user_id" TEXT,
    "portal_visible" BOOLEAN NOT NULL DEFAULT false,
    "last_rotated_at" TIMESTAMP(3),
    "last_revealed_at" TIMESTAMP(3),
    "reveal_count" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_entry_grants" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "subject_type" "VaultGrantSubjectType" NOT NULL,
    "membership_id" TEXT,
    "team_id" TEXT,
    "portal_user_id" TEXT,
    "can_reveal" BOOLEAN NOT NULL DEFAULT false,
    "can_manage" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "granted_by_user_id" TEXT,
    "revoked_at" TIMESTAMP(3),
    "revoked_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_entry_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_access_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "action" "VaultAccessAction" NOT NULL,
    "actor_user_id" TEXT,
    "actor_membership_id" TEXT,
    "via_portal" BOOLEAN NOT NULL DEFAULT false,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "context" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_tracking_settings" (
    "organization_id" TEXT NOT NULL,
    "period_type" "TimesheetPeriodType" NOT NULL DEFAULT 'WEEKLY',
    "week_start" INTEGER,
    "require_approval" BOOLEAN NOT NULL DEFAULT true,
    "approver_policy" "TimesheetApproverPolicy" NOT NULL DEFAULT 'MANAGER',
    "default_approver_membership_id" TEXT,
    "lock_on_approval" BOOLEAN NOT NULL DEFAULT true,
    "allow_self_approval" BOOLEAN NOT NULL DEFAULT false,
    "default_billable" BOOLEAN NOT NULL DEFAULT true,
    "require_billable_override_reason" BOOLEAN NOT NULL DEFAULT true,
    "rounding_increment_minutes" INTEGER NOT NULL DEFAULT 1,
    "rounding_mode" "TimeRoundingMode" NOT NULL DEFAULT 'NONE',
    "min_entry_minutes" INTEGER,
    "max_hours_per_day" DECIMAL(5,2),
    "allow_overlapping_entries" BOOLEAN NOT NULL DEFAULT false,
    "allow_future_entries" BOOLEAN NOT NULL DEFAULT false,
    "require_project" BOOLEAN NOT NULL DEFAULT false,
    "require_task_or_ticket" BOOLEAN NOT NULL DEFAULT false,
    "require_description" BOOLEAN NOT NULL DEFAULT false,
    "require_activity_type" BOOLEAN NOT NULL DEFAULT false,
    "edit_window_days" INTEGER,
    "idle_timeout_minutes" INTEGER,
    "timer_auto_stop_hours" INTEGER,
    "calendar_capture_enabled" BOOLEAN NOT NULL DEFAULT false,
    "ai_suggestions_enabled" BOOLEAN NOT NULL DEFAULT false,
    "attendance_prefill_enabled" BOOLEAN NOT NULL DEFAULT false,
    "missing_time_reminder_enabled" BOOLEAN NOT NULL DEFAULT true,
    "missing_time_reminder_days" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "missing_time_reminder_time" TEXT,
    "submission_reminder_enabled" BOOLEAN NOT NULL DEFAULT true,
    "submission_reminder_offset_days" INTEGER NOT NULL DEFAULT 1,
    "default_expected_hours_per_week" DECIMAL(5,2) NOT NULL DEFAULT 40,
    "utilization_target_percent" DECIMAL(5,2),
    "utilization_billable_only" BOOLEAN NOT NULL DEFAULT false,
    "reporting_currency" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_tracking_settings_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "time_activity_types" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "default_billable" BOOLEAN,
    "default_non_billable_category" "TimeNonBillableCategory",
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_activity_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_project_settings" (
    "project_id" TEXT NOT NULL,
    "default_billable" BOOLEAN,
    "default_non_billable_category" "TimeNonBillableCategory",
    "default_activity_type_id" TEXT,
    "contract_id" TEXT,
    "approver_membership_id" TEXT,
    "time_tracking_enabled" BOOLEAN NOT NULL DEFAULT true,
    "members_only" BOOLEAN NOT NULL DEFAULT true,
    "require_task" BOOLEAN NOT NULL DEFAULT false,
    "hours_alert_percent" INTEGER,
    "hours_alert_sent_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_project_settings_pkey" PRIMARY KEY ("project_id")
);

-- CreateTable
CREATE TABLE "billing_rates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" "TimeRateKind" NOT NULL DEFAULT 'BILLING',
    "scope" "BillingRateScope" NOT NULL,
    "product_id" TEXT,
    "project_id" TEXT,
    "membership_id" TEXT,
    "activity_type_id" TEXT,
    "name" TEXT,
    "currency" TEXT NOT NULL,
    "hourly_rate" DECIMAL(18,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "source_compensation_id" TEXT,
    "notes" TEXT,
    "created_by_membership_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "employee_id" TEXT,
    "branch_id" TEXT,
    "date" DATE NOT NULL,
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "duration_minutes" INTEGER NOT NULL,
    "billable_minutes" INTEGER NOT NULL,
    "project_id" TEXT,
    "workstream_id" TEXT,
    "milestone_id" TEXT,
    "task_id" TEXT,
    "ticket_id" TEXT,
    "activity_type_id" TEXT,
    "description" TEXT,
    "is_billable" BOOLEAN NOT NULL DEFAULT true,
    "billable_overridden" BOOLEAN NOT NULL DEFAULT false,
    "billable_override_reason" TEXT,
    "non_billable_category" "TimeNonBillableCategory",
    "billing_rate_id" TEXT,
    "billing_rate_amount" DECIMAL(18,2),
    "billing_currency" TEXT,
    "billable_amount" DECIMAL(18,2),
    "cost_rate_id" TEXT,
    "cost_rate_amount" DECIMAL(18,2),
    "cost_currency" TEXT,
    "cost_amount" DECIMAL(18,2),
    "rates_snapshotted_at" TIMESTAMP(3),
    "status" "TimeEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "TimeEntrySource" NOT NULL DEFAULT 'MANUAL',
    "timer_id" TEXT,
    "calendar_event_id" TEXT,
    "attendance_record_id" TEXT,
    "import_job_id" TEXT,
    "external_ref" TEXT,
    "timesheet_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "approved_by_membership_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_by_membership_id" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "invoice_id" TEXT,
    "invoice_line_item_id" TEXT,
    "invoiced_at" TIMESTAMP(3),
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_at" TIMESTAMP(3),
    "locked_by_membership_id" TEXT,
    "unlocked_at" TIMESTAMP(3),
    "unlocked_by_membership_id" TEXT,
    "unlock_reason" TEXT,
    "created_by_user_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "project_id" TEXT,
    "workstream_id" TEXT,
    "milestone_id" TEXT,
    "task_id" TEXT,
    "ticket_id" TEXT,
    "activity_type_id" TEXT,
    "description" TEXT,
    "is_billable" BOOLEAN,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paused_at" TIMESTAMP(3),
    "paused_minutes" INTEGER NOT NULL DEFAULT 0,
    "last_heartbeat_at" TIMESTAMP(3),
    "idle_detected_at" TIMESTAMP(3),
    "idle_discarded_minutes" INTEGER NOT NULL DEFAULT 0,
    "stopped_at" TIMESTAMP(3),
    "discarded_at" TIMESTAMP(3),
    "auto_stopped" BOOLEAN NOT NULL DEFAULT false,
    "device" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_import_jobs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "file_document_id" TEXT,
    "status" "TimeImportStatus" NOT NULL DEFAULT 'PENDING',
    "mapping" JSONB,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "imported_rows" INTEGER NOT NULL DEFAULT 0,
    "skipped_rows" INTEGER NOT NULL DEFAULT 0,
    "failed_rows" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_suggestions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "source" "TimeSuggestionSource" NOT NULL,
    "status" "TimeSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "date" DATE NOT NULL,
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "duration_minutes" INTEGER NOT NULL,
    "project_id" TEXT,
    "task_id" TEXT,
    "ticket_id" TEXT,
    "activity_type_id" TEXT,
    "description" TEXT,
    "is_billable" BOOLEAN,
    "calendar_event_id" TEXT,
    "external_ref" TEXT,
    "confidence" DECIMAL(5,4),
    "rationale" TEXT,
    "payload" JSONB,
    "accepted_time_entry_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entry_adjustments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "time_entry_id" TEXT NOT NULL,
    "type" "TimeAdjustmentType" NOT NULL,
    "adjusted_billable_minutes" INTEGER,
    "adjusted_amount" DECIMAL(18,2) NOT NULL,
    "delta_amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "invoice_line_item_id" TEXT,
    "created_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_entry_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "period_type" "TimesheetPeriodType" NOT NULL DEFAULT 'WEEKLY',
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'OPEN',
    "total_minutes" INTEGER NOT NULL DEFAULT 0,
    "billable_minutes" INTEGER NOT NULL DEFAULT 0,
    "non_billable_minutes" INTEGER NOT NULL DEFAULT 0,
    "expected_minutes" INTEGER,
    "billable_amount" DECIMAL(18,2),
    "currency" TEXT,
    "submitted_at" TIMESTAMP(3),
    "approver_membership_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approved_by_membership_id" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejected_by_membership_id" TEXT,
    "rejection_comment" TEXT,
    "submission_comment" TEXT,
    "locked_at" TIMESTAMP(3),
    "locked_by_membership_id" TEXT,
    "unlocked_at" TIMESTAMP(3),
    "unlocked_by_membership_id" TEXT,
    "unlock_reason" TEXT,
    "last_reminder_sent_at" TIMESTAMP(3),
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet_actions" (
    "id" TEXT NOT NULL,
    "timesheet_id" TEXT NOT NULL,
    "action" "TimesheetActionType" NOT NULL,
    "actor_membership_id" TEXT,
    "comment" TEXT,
    "from_status" "TimesheetStatus",
    "to_status" "TimesheetStatus",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timesheet_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_utilization_periods" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "expected_minutes" INTEGER NOT NULL DEFAULT 0,
    "logged_minutes" INTEGER NOT NULL DEFAULT 0,
    "billable_minutes" INTEGER NOT NULL DEFAULT 0,
    "leave_minutes" INTEGER NOT NULL DEFAULT 0,
    "utilization_percent" DECIMAL(5,2),
    "billable_ratio" DECIMAL(5,2),
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_utilization_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event_types" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "default_duration_minutes" INTEGER,
    "default_visibility" "CalendarEventVisibility" NOT NULL DEFAULT 'TEAM',
    "shows_as_busy" BOOLEAN NOT NULL DEFAULT true,
    "default_reminders" JSONB,
    "is_customer_facing" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_event_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_preferences" (
    "id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "default_calendar_id" TEXT,
    "timezone" TEXT,
    "default_view" TEXT NOT NULL DEFAULT 'week',
    "week_start" INTEGER,
    "show_weekends" BOOLEAN NOT NULL DEFAULT true,
    "show_declined_events" BOOLEAN NOT NULL DEFAULT false,
    "default_event_duration" INTEGER NOT NULL DEFAULT 30,
    "default_reminders" JSONB,
    "projected_modules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "overlay_calendar_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "availability_schedule_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendars" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" "CalendarKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "timezone" TEXT,
    "owner_membership_id" TEXT,
    "team_id" TEXT,
    "project_id" TEXT,
    "company_id" TEXT,
    "branch_id" TEXT,
    "resource_id" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "default_visibility" "CalendarEventVisibility" NOT NULL DEFAULT 'TEAM',
    "free_busy_only" BOOLEAN NOT NULL DEFAULT false,
    "portal_visible" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_user_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_shares" (
    "id" TEXT NOT NULL,
    "calendar_id" TEXT NOT NULL,
    "membership_id" TEXT,
    "team_id" TEXT,
    "role" "CalendarShareRole" NOT NULL DEFAULT 'READ',
    "shared_by_user_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_resources" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "kind" "CalendarResourceKind" NOT NULL DEFAULT 'ROOM',
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "capacity" INTEGER,
    "location" TEXT,
    "color" TEXT,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "manager_membership_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "availability" JSONB,
    "attributes" JSONB,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "calendar_id" TEXT NOT NULL,
    "event_type_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CalendarEventStatus" NOT NULL DEFAULT 'CONFIRMED',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL,
    "recurrence_rule" TEXT,
    "recurrence_exdates" TIMESTAMP(3)[] DEFAULT ARRAY[]::TIMESTAMP(3)[],
    "recurrence_ends_at" TIMESTAMP(3),
    "recurring_event_id" TEXT,
    "original_start_at" TIMESTAMP(3),
    "organizer_membership_id" TEXT,
    "organizer_email" TEXT,
    "visibility" "CalendarEventVisibility" NOT NULL DEFAULT 'TEAM',
    "shows_as_busy" BOOLEAN NOT NULL DEFAULT true,
    "location" TEXT,
    "location_details" JSONB,
    "conferencing_provider" "ConferencingProvider",
    "meeting_url" TEXT,
    "meeting_external_id" TEXT,
    "meeting_details" JSONB,
    "company_id" TEXT,
    "project_id" TEXT,
    "branch_id" TEXT,
    "source" "CalendarEventSource" NOT NULL DEFAULT 'INTERNAL',
    "color" TEXT,
    "ical_uid" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_user_id" TEXT,
    "cancellation_reason" TEXT,
    "automation_rule_id" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event_attendees" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "kind" "CalendarAttendeeKind" NOT NULL,
    "membership_id" TEXT,
    "user_id" TEXT,
    "contact_id" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "CalendarAttendeeRole" NOT NULL DEFAULT 'REQUIRED',
    "response" "CalendarAttendeeResponse" NOT NULL DEFAULT 'NEEDS_ACTION',
    "response_comment" TEXT,
    "responded_at" TIMESTAMP(3),
    "is_organizer" BOOLEAN NOT NULL DEFAULT false,
    "invited_at" TIMESTAMP(3),
    "response_token" TEXT,
    "external_attendee_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_event_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event_resources" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "status" "CalendarResourceBookingStatus" NOT NULL DEFAULT 'APPROVED',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "decided_by_user_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_event_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event_reminders" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "membership_id" TEXT,
    "method" "CalendarReminderMethod" NOT NULL DEFAULT 'NOTIFICATION',
    "minutes_before" INTEGER NOT NULL,
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_event_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event_links" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "entity_type" "RecordEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT 'related',
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_event_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event_attachments" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "external_url" TEXT,
    "title" TEXT,
    "added_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_event_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_availability_schedules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "membership_id" TEXT,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "honor_holidays" BOOLEAN NOT NULL DEFAULT true,
    "honor_leave" BOOLEAN NOT NULL DEFAULT true,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_availability_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_availability_rules" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,

    CONSTRAINT "calendar_availability_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_availability_overrides" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" "CalendarAvailabilityOverrideKind" NOT NULL DEFAULT 'UNAVAILABLE',
    "start_time" TEXT,
    "end_time" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_availability_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_links" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "BookingLinkStatus" NOT NULL DEFAULT 'DRAFT',
    "audience" "BookingLinkAudience" NOT NULL DEFAULT 'PUBLIC',
    "owner_membership_id" TEXT,
    "company_id" TEXT,
    "event_type_id" TEXT,
    "calendar_id" TEXT,
    "availability_schedule_id" TEXT,
    "host_assignment" "BookingHostAssignment" NOT NULL DEFAULT 'SINGLE',
    "duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "duration_options" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "slot_interval_minutes" INTEGER NOT NULL DEFAULT 30,
    "buffer_before_minutes" INTEGER NOT NULL DEFAULT 0,
    "buffer_after_minutes" INTEGER NOT NULL DEFAULT 0,
    "min_notice_minutes" INTEGER NOT NULL DEFAULT 60,
    "max_days_ahead" INTEGER NOT NULL DEFAULT 60,
    "available_from" DATE,
    "available_until" DATE,
    "max_bookings_per_day" INTEGER,
    "seats_per_slot" INTEGER NOT NULL DEFAULT 1,
    "requires_confirmation" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT,
    "location" TEXT,
    "conferencing_provider" "ConferencingProvider",
    "conferencing_account_id" TEXT,
    "questions" JSONB,
    "reminders" JSONB,
    "cancellation_notice_minutes" INTEGER,
    "allow_rescheduling" BOOLEAN NOT NULL DEFAULT true,
    "confirmation_message" TEXT,
    "redirect_url" TEXT,
    "branding" JSONB,
    "event_title_template" TEXT,
    "created_by_user_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_link_hosts" (
    "id" TEXT NOT NULL,
    "booking_link_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "availability_schedule_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_link_hosts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_bookings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "booking_link_id" TEXT NOT NULL,
    "event_id" TEXT,
    "host_membership_id" TEXT,
    "status" "CalendarBookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "source" "CalendarBookingSource" NOT NULL DEFAULT 'PUBLIC_LINK',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "invitee_name" TEXT NOT NULL,
    "invitee_email" TEXT NOT NULL,
    "invitee_phone" TEXT,
    "invitee_user_id" TEXT,
    "contact_id" TEXT,
    "company_id" TEXT,
    "answers" JSONB,
    "notes" TEXT,
    "origin_entity_type" "RecordEntityType",
    "origin_entity_id" TEXT,
    "manage_token" TEXT NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "confirmed_by_user_id" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" TEXT,
    "cancellation_reason" TEXT,
    "rescheduled_from_booking_id" TEXT,
    "no_show_marked_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "attribution" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_connections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "membership_id" TEXT,
    "provider" "CalendarProvider" NOT NULL,
    "status" "CalendarConnectionStatus" NOT NULL DEFAULT 'PENDING_AUTH',
    "external_account_id" TEXT,
    "account_email" TEXT,
    "credentials" JSONB,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "default_direction" "CalendarSyncDirection" NOT NULL DEFAULT 'TWO_WAY',
    "watch_channel_id" TEXT,
    "watch_resource_id" TEXT,
    "watch_expires_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "last_error" TEXT,
    "last_error_at" TIMESTAMP(3),
    "connected_by_user_id" TEXT,
    "disconnected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_connection_calendars" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "access_role" TEXT,
    "sync_enabled" BOOLEAN NOT NULL DEFAULT false,
    "direction" "CalendarSyncDirection" NOT NULL DEFAULT 'TWO_WAY',
    "calendar_id" TEXT,
    "free_busy_only" BOOLEAN NOT NULL DEFAULT true,
    "sync_cursor" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_connection_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event_sync_mappings" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "connection_calendar_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "external_ical_uid" TEXT,
    "external_etag" TEXT,
    "external_updated_at" TIMESTAMP(3),
    "local_synced_version" TIMESTAMP(3),
    "status" "CalendarSyncMappingStatus" NOT NULL DEFAULT 'SYNCED',
    "last_pulled_at" TIMESTAMP(3),
    "last_pushed_at" TIMESTAMP(3),
    "conflict_snapshot" JSONB,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_event_sync_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_sync_runs" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "status" "CalendarSyncRunStatus" NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT NOT NULL DEFAULT 'incremental',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "events_pulled" INTEGER NOT NULL DEFAULT 0,
    "events_pushed" INTEGER NOT NULL DEFAULT 0,
    "events_deleted" INTEGER NOT NULL DEFAULT 0,
    "conflicts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "details" JSONB,

    CONSTRAINT "calendar_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_conferencing_accounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "membership_id" TEXT,
    "provider" "ConferencingProvider" NOT NULL,
    "status" "ConferencingAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "external_account_id" TEXT,
    "account_email" TEXT,
    "credentials" JSONB,
    "calendar_connection_id" TEXT,
    "settings" JSONB,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "last_error" TEXT,
    "disconnected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_conferencing_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_settings" (
    "organization_id" TEXT NOT NULL,
    "org_rate_limit_per_hour" INTEGER NOT NULL DEFAULT 10000,
    "default_rule_rate_limit_per_hour" INTEGER NOT NULL DEFAULT 1000,
    "max_trigger_depth" INTEGER NOT NULL DEFAULT 3,
    "default_max_retries" INTEGER NOT NULL DEFAULT 5,
    "default_retry_backoff_seconds" INTEGER NOT NULL DEFAULT 60,
    "destructive_actions_enabled" BOOLEAN NOT NULL DEFAULT false,
    "destructive_actions_enabled_at" TIMESTAMP(3),
    "destructive_actions_enabled_by_membership_id" TEXT,
    "destructive_requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "run_retention_days" INTEGER DEFAULT 365,
    "event_retention_days" INTEGER DEFAULT 90,
    "job_run_retention_days" INTEGER DEFAULT 90,
    "dead_letter_alerts_enabled" BOOLEAN NOT NULL DEFAULT true,
    "default_service_account_id" TEXT,
    "ai_default_confidence_threshold" DECIMAL(5,2) NOT NULL DEFAULT 80,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_settings_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "automation_trigger_definitions" (
    "id" TEXT NOT NULL,
    "module" "ModuleKey" NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "AutomationTriggerKind" NOT NULL DEFAULT 'EVENT',
    "entity_type" "RecordEntityType",
    "payload_schema" JSONB,
    "sample_payload" JSONB,
    "date_fields" JSONB,
    "config_schema" JSONB,
    "required_permission" TEXT,
    "notifiable" BOOLEAN NOT NULL DEFAULT true,
    "webhook_subscribable" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_trigger_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_action_definitions" (
    "id" TEXT NOT NULL,
    "module" "ModuleKey" NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "AutomationActionKind" NOT NULL,
    "entity_type" "RecordEntityType",
    "input_schema" JSONB,
    "output_schema" JSONB,
    "required_permission" TEXT,
    "is_destructive" BOOLEAN NOT NULL DEFAULT false,
    "is_customer_facing" BOOLEAN NOT NULL DEFAULT false,
    "is_idempotent" BOOLEAN NOT NULL DEFAULT true,
    "retryable" BOOLEAN NOT NULL DEFAULT true,
    "is_engine_builtin" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_action_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rule_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "module" "ModuleKey" NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "definition" JSONB NOT NULL,
    "variables" JSONB,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rule_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "module" "ModuleKey",
    "status" "AutomationRuleStatus" NOT NULL DEFAULT 'DRAFT',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "trigger_kind" "AutomationTriggerKind" NOT NULL,
    "trigger_key" TEXT NOT NULL,
    "trigger_definition_id" TEXT,
    "trigger_config" JSONB,
    "entity_type" "RecordEntityType",
    "conditions" JSONB,
    "actions" JSONB NOT NULL,
    "scope_type" "AutomationRuleScopeType" NOT NULL DEFAULT 'ORGANIZATION',
    "branch_id" TEXT,
    "team_id" TEXT,
    "project_type_id" TEXT,
    "project_id" TEXT,
    "owner_membership_id" TEXT,
    "run_as_service_account_id" TEXT,
    "idempotency_key_template" TEXT,
    "serialize_per_record" BOOLEAN NOT NULL DEFAULT false,
    "max_retries" INTEGER,
    "retry_backoff_seconds" INTEGER,
    "rate_limit_per_hour" INTEGER,
    "max_trigger_depth" INTEGER,
    "allow_destructive_actions" BOOLEAN NOT NULL DEFAULT false,
    "require_approval_for_destructive" BOOLEAN NOT NULL DEFAULT true,
    "timeout_seconds" INTEGER,
    "template_id" TEXT,
    "duplicated_from_rule_id" TEXT,
    "imported_from" JSONB,
    "last_run_at" TIMESTAMP(3),
    "last_run_status" "AutomationRunStatus",
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "next_run_at" TIMESTAMP(3),
    "enabled_at" TIMESTAMP(3),
    "disabled_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rule_versions" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger_kind" "AutomationTriggerKind" NOT NULL,
    "trigger_key" TEXT NOT NULL,
    "trigger_config" JSONB,
    "conditions" JSONB,
    "actions" JSONB NOT NULL,
    "scope_type" "AutomationRuleScopeType" NOT NULL,
    "scope" JSONB,
    "settings" JSONB,
    "change_summary" TEXT,
    "author_membership_id" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "superseded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "event_key" TEXT NOT NULL,
    "module" "ModuleKey" NOT NULL,
    "source" "PlatformEventSource" NOT NULL DEFAULT 'MODULE',
    "entity_type" "RecordEntityType",
    "entity_id" TEXT,
    "entity_kind" TEXT,
    "related_entities" JSONB,
    "payload" JSONB NOT NULL,
    "changes" JSONB,
    "actor_type" "AuditActorType" NOT NULL DEFAULT 'USER',
    "actor_user_id" TEXT,
    "actor_membership_id" TEXT,
    "actor_service_account_id" TEXT,
    "dedupe_key" TEXT,
    "correlation_id" TEXT,
    "causation_run_id" TEXT,
    "trigger_depth" INTEGER NOT NULL DEFAULT 0,
    "inbound_webhook_id" TEXT,
    "scheduled_job_run_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rules_processed_at" TIMESTAMP(3),
    "rules_matched_count" INTEGER NOT NULL DEFAULT 0,
    "notifications_processed_at" TIMESTAMP(3),
    "webhooks_processed_at" TIMESTAMP(3),
    "processed_at" TIMESTAMP(3),
    "processing_attempts" INTEGER NOT NULL DEFAULT 0,
    "processing_error" TEXT,
    "next_processing_at" TIMESTAMP(3),
    "dead_lettered_at" TIMESTAMP(3),

    CONSTRAINT "platform_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "rule_version_id" TEXT,
    "rule_version" INTEGER NOT NULL,
    "mode" "AutomationRunMode" NOT NULL DEFAULT 'LIVE',
    "status" "AutomationRunStatus" NOT NULL DEFAULT 'PENDING',
    "trigger_kind" "AutomationTriggerKind" NOT NULL,
    "trigger_key" TEXT NOT NULL,
    "event_id" TEXT,
    "scheduled_job_run_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "entity_type" "RecordEntityType",
    "entity_id" TEXT,
    "entity_kind" TEXT,
    "input" JSONB,
    "conditions_result" JSONB,
    "conditions_passed" BOOLEAN,
    "output" JSONB,
    "actor_type" "AuditActorType" NOT NULL DEFAULT 'SYSTEM',
    "actor_membership_id" TEXT,
    "run_as_service_account_id" TEXT,
    "parent_run_id" TEXT,
    "trigger_depth" INTEGER NOT NULL DEFAULT 0,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "max_attempts" INTEGER NOT NULL DEFAULT 1,
    "next_retry_at" TIMESTAMP(3),
    "current_step_index" INTEGER,
    "wait_until" TIMESTAMP(3),
    "performed_destructive_action" BOOLEAN NOT NULL DEFAULT false,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "error_code" TEXT,
    "error_message" TEXT,
    "error" JSONB,
    "dead_lettered_at" TIMESTAMP(3),
    "dead_letter_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_run_steps" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "step_index" INTEGER NOT NULL,
    "step_key" TEXT NOT NULL,
    "action_key" TEXT NOT NULL,
    "action_definition_id" TEXT,
    "kind" "AutomationActionKind" NOT NULL,
    "status" "AutomationStepStatus" NOT NULL DEFAULT 'PENDING',
    "input" JSONB,
    "output" JSONB,
    "idempotency_key" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "max_attempts" INTEGER NOT NULL DEFAULT 1,
    "next_retry_at" TIMESTAMP(3),
    "wait_until" TIMESTAMP(3),
    "branch_taken" TEXT,
    "skipped_reason" TEXT,
    "is_destructive" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "error_code" TEXT,
    "error_message" TEXT,
    "error" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_run_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_approvals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "decision" "AutomationApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "context" JSONB,
    "requested_from_membership_id" TEXT,
    "requested_from" JSONB,
    "approver_membership_id" TEXT,
    "comment" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "notification_id" TEXT,

    CONSTRAINT "automation_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_ai_steps" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "kind" "AutomationAiStepKind" NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "prompt_template" TEXT,
    "input" JSONB,
    "output_schema" JSONB,
    "output" JSONB,
    "confidence" DECIMAL(5,2),
    "confidence_threshold" DECIMAL(5,2),
    "passed_threshold" BOOLEAN,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "cost_amount" DECIMAL(18,6),
    "latency_ms" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_ai_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_run_locks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "rule_id" TEXT,
    "run_id" TEXT NOT NULL,
    "entity_type" "RecordEntityType",
    "entity_kind" TEXT,
    "entity_id" TEXT NOT NULL,
    "lock_key" TEXT NOT NULL,
    "acquired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_run_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_jobs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "branch_id" TEXT,
    "module" "ModuleKey" NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "ScheduledJobKind" NOT NULL DEFAULT 'CRON',
    "cron_expression" TEXT,
    "interval_seconds" INTEGER,
    "run_at" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "handler" TEXT NOT NULL,
    "payload" JSONB,
    "status" "ScheduledJobStatus" NOT NULL DEFAULT 'ACTIVE',
    "rule_id" TEXT,
    "next_run_at" TIMESTAMP(3),
    "last_run_at" TIMESTAMP(3),
    "last_run_status" "ScheduledJobRunStatus",
    "last_error" TEXT,
    "last_duration_ms" INTEGER,
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "retry_backoff_seconds" INTEGER NOT NULL DEFAULT 60,
    "timeout_seconds" INTEGER,
    "allow_overlap" BOOLEAN NOT NULL DEFAULT false,
    "catch_up_missed" BOOLEAN NOT NULL DEFAULT false,
    "locked_by" TEXT,
    "locked_at" TIMESTAMP(3),
    "lock_expires_at" TIMESTAMP(3),
    "paused_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_job_runs" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "status" "ScheduledJobRunStatus" NOT NULL DEFAULT 'PENDING',
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "max_attempts" INTEGER NOT NULL DEFAULT 1,
    "next_retry_at" TIMESTAMP(3),
    "input" JSONB,
    "output" JSONB,
    "error_code" TEXT,
    "error_message" TEXT,
    "error" JSONB,
    "worker_id" TEXT,
    "triggered_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_webhooks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "signing_algorithm" TEXT NOT NULL DEFAULT 'hmac-sha256',
    "subscribed_events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "headers" JSONB,
    "channel_id" TEXT,
    "include_direct_messages" BOOLEAN NOT NULL DEFAULT false,
    "content_type" TEXT NOT NULL DEFAULT 'application/json',
    "api_version" TEXT,
    "status" "OutboundWebhookStatus" NOT NULL DEFAULT 'ACTIVE',
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "retry_backoff_seconds" INTEGER NOT NULL DEFAULT 60,
    "timeout_seconds" INTEGER NOT NULL DEFAULT 10,
    "disable_after_failures" INTEGER DEFAULT 50,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "last_delivery_at" TIMESTAMP(3),
    "last_success_at" TIMESTAMP(3),
    "last_failure_at" TIMESTAMP(3),
    "disabled_at" TIMESTAMP(3),
    "disabled_reason" TEXT,
    "created_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "event_id" TEXT,
    "run_step_id" TEXT,
    "event_key" TEXT NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "request_headers" JSONB,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "next_retry_at" TIMESTAMP(3),
    "response_status_code" INTEGER,
    "response_body" TEXT,
    "response_headers" JSONB,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "delivery_key" TEXT NOT NULL,
    "last_attempt_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "dead_lettered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_inbound_webhooks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "rule_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "auth_scheme" "InboundWebhookAuthScheme" NOT NULL DEFAULT 'HMAC_SHA256',
    "secret" TEXT NOT NULL,
    "signature_header" TEXT,
    "payload_schema" JSONB,
    "payload_mapping" JSONB,
    "allowed_ip_ranges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "InboundWebhookStatus" NOT NULL DEFAULT 'ACTIVE',
    "rate_limit_per_minute" INTEGER,
    "received_count" INTEGER NOT NULL DEFAULT 0,
    "rejected_count" INTEGER NOT NULL DEFAULT 0,
    "last_received_at" TIMESTAMP(3),
    "last_rejected_at" TIMESTAMP(3),
    "last_rejection_reason" TEXT,
    "secret_rotated_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_inbound_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_deliverable_reviews_deliverable_id_decided_at_idx" ON "project_deliverable_reviews"("deliverable_id", "decided_at");

-- CreateIndex
CREATE INDEX "project_deliverable_reviews_organization_id_idx" ON "project_deliverable_reviews"("organization_id");

-- CreateIndex
CREATE INDEX "project_status_update_comments_status_update_id_created_at_idx" ON "project_status_update_comments"("status_update_id", "created_at");

-- CreateIndex
CREATE INDEX "project_status_update_comments_organization_id_idx" ON "project_status_update_comments"("organization_id");

-- CreateIndex
CREATE INDEX "task_status_history_task_id_changed_at_idx" ON "task_status_history"("task_id", "changed_at");

-- CreateIndex
CREATE INDEX "task_status_history_to_status_id_changed_at_idx" ON "task_status_history"("to_status_id", "changed_at");

-- CreateIndex
CREATE INDEX "customer_portal_profile_change_requests_organization_id_sta_idx" ON "customer_portal_profile_change_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "customer_portal_profile_change_requests_company_id_idx" ON "customer_portal_profile_change_requests"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_templates_organization_id_name_key" ON "invoice_templates"("organization_id", "name");

-- CreateIndex
CREATE INDEX "payment_provider_connections_organization_id_provider_idx" ON "payment_provider_connections"("organization_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "payment_provider_connections_provider_provider_account_id_key" ON "payment_provider_connections"("provider", "provider_account_id");

-- CreateIndex
CREATE INDEX "ledger_categories_organization_id_kind_idx" ON "ledger_categories"("organization_id", "kind");

-- CreateIndex
CREATE INDEX "ledger_categories_parent_category_id_idx" ON "ledger_categories"("parent_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_categories_organization_id_slug_key" ON "ledger_categories"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_payment_methods_organization_id_slug_key" ON "ledger_payment_methods"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_supplier_profiles_company_id_key" ON "ledger_supplier_profiles"("company_id");

-- CreateIndex
CREATE INDEX "ledger_supplier_profiles_organization_id_idx" ON "ledger_supplier_profiles"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_records_invoice_id_key" ON "ledger_records"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_records_origin_payment_id_key" ON "ledger_records"("origin_payment_id");

-- CreateIndex
CREATE INDEX "ledger_records_organization_id_type_transaction_date_idx" ON "ledger_records"("organization_id", "type", "transaction_date");

-- CreateIndex
CREATE INDEX "ledger_records_organization_id_status_idx" ON "ledger_records"("organization_id", "status");

-- CreateIndex
CREATE INDEX "ledger_records_organization_id_payment_status_idx" ON "ledger_records"("organization_id", "payment_status");

-- CreateIndex
CREATE INDEX "ledger_records_organization_id_due_date_idx" ON "ledger_records"("organization_id", "due_date");

-- CreateIndex
CREATE INDEX "ledger_records_organization_id_payment_date_idx" ON "ledger_records"("organization_id", "payment_date");

-- CreateIndex
CREATE INDEX "ledger_records_category_id_idx" ON "ledger_records"("category_id");

-- CreateIndex
CREATE INDEX "ledger_records_subcategory_id_idx" ON "ledger_records"("subcategory_id");

-- CreateIndex
CREATE INDEX "ledger_records_company_id_idx" ON "ledger_records"("company_id");

-- CreateIndex
CREATE INDEX "ledger_records_project_id_idx" ON "ledger_records"("project_id");

-- CreateIndex
CREATE INDEX "ledger_records_period_id_idx" ON "ledger_records"("period_id");

-- CreateIndex
CREATE INDEX "ledger_records_employee_id_idx" ON "ledger_records"("employee_id");

-- CreateIndex
CREATE INDEX "ledger_records_recurring_expense_id_idx" ON "ledger_records"("recurring_expense_id");

-- CreateIndex
CREATE INDEX "ledger_records_branch_id_idx" ON "ledger_records"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_records_organization_id_number_key" ON "ledger_records"("organization_id", "number");

-- CreateIndex
CREATE INDEX "ledger_settlements_record_id_settled_on_idx" ON "ledger_settlements"("record_id", "settled_on");

-- CreateIndex
CREATE INDEX "ledger_settlements_payment_id_idx" ON "ledger_settlements"("payment_id");

-- CreateIndex
CREATE INDEX "ledger_settlements_refund_id_idx" ON "ledger_settlements"("refund_id");

-- CreateIndex
CREATE INDEX "ledger_attachments_document_id_idx" ON "ledger_attachments"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_attachments_record_id_document_id_key" ON "ledger_attachments"("record_id", "document_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_invoice_imports_ledger_record_id_key" ON "ledger_invoice_imports"("ledger_record_id");

-- CreateIndex
CREATE INDEX "ledger_invoice_imports_organization_id_status_idx" ON "ledger_invoice_imports"("organization_id", "status");

-- CreateIndex
CREATE INDEX "ledger_invoice_imports_organization_id_file_hash_idx" ON "ledger_invoice_imports"("organization_id", "file_hash");

-- CreateIndex
CREATE INDEX "ledger_invoice_imports_organization_id_supplier_vat_number__idx" ON "ledger_invoice_imports"("organization_id", "supplier_vat_number", "invoice_number");

-- CreateIndex
CREATE INDEX "ledger_invoice_imports_matched_company_id_idx" ON "ledger_invoice_imports"("matched_company_id");

-- CreateIndex
CREATE INDEX "ledger_invoice_imports_document_id_idx" ON "ledger_invoice_imports"("document_id");

-- CreateIndex
CREATE INDEX "ledger_invoice_import_lines_import_id_sort_order_idx" ON "ledger_invoice_import_lines"("import_id", "sort_order");

-- CreateIndex
CREATE INDEX "recurring_expenses_organization_id_status_idx" ON "recurring_expenses"("organization_id", "status");

-- CreateIndex
CREATE INDEX "recurring_expenses_organization_id_next_occurrence_date_idx" ON "recurring_expenses"("organization_id", "next_occurrence_date");

-- CreateIndex
CREATE INDEX "recurring_expenses_company_id_idx" ON "recurring_expenses"("company_id");

-- CreateIndex
CREATE INDEX "recurring_expenses_category_id_idx" ON "recurring_expenses"("category_id");

-- CreateIndex
CREATE INDEX "payroll_schedules_organization_id_status_idx" ON "payroll_schedules"("organization_id", "status");

-- CreateIndex
CREATE INDEX "payroll_schedules_organization_id_employee_id_idx" ON "payroll_schedules"("organization_id", "employee_id");

-- CreateIndex
CREATE INDEX "payroll_schedules_next_occurrence_date_idx" ON "payroll_schedules"("next_occurrence_date");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_entries_ledger_record_id_key" ON "payroll_entries"("ledger_record_id");

-- CreateIndex
CREATE INDEX "payroll_entries_organization_id_employee_id_period_start_idx" ON "payroll_entries"("organization_id", "employee_id", "period_start");

-- CreateIndex
CREATE INDEX "payroll_entries_organization_id_status_idx" ON "payroll_entries"("organization_id", "status");

-- CreateIndex
CREATE INDEX "payroll_entries_period_id_idx" ON "payroll_entries"("period_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_entries_schedule_id_period_start_key" ON "payroll_entries"("schedule_id", "period_start");

-- CreateIndex
CREATE INDEX "financial_periods_organization_id_status_idx" ON "financial_periods"("organization_id", "status");

-- CreateIndex
CREATE INDEX "financial_periods_organization_id_start_date_end_date_idx" ON "financial_periods"("organization_id", "start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "financial_periods_organization_id_type_start_date_end_date_key" ON "financial_periods"("organization_id", "type", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "financial_period_summaries_organization_id_period_id_idx" ON "financial_period_summaries"("organization_id", "period_id");

-- CreateIndex
CREATE INDEX "financial_period_summaries_project_id_idx" ON "financial_period_summaries"("project_id");

-- CreateIndex
CREATE INDEX "financial_period_summaries_company_id_idx" ON "financial_period_summaries"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_period_summaries_period_id_basis_scope_key_key" ON "financial_period_summaries"("period_id", "basis", "scope_key");

-- CreateIndex
CREATE INDEX "ledger_profitability_snapshots_project_id_idx" ON "ledger_profitability_snapshots"("project_id");

-- CreateIndex
CREATE INDEX "ledger_profitability_snapshots_company_id_idx" ON "ledger_profitability_snapshots"("company_id");

-- CreateIndex
CREATE INDEX "ledger_profitability_snapshots_period_id_idx" ON "ledger_profitability_snapshots"("period_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_profitability_snapshots_organization_id_scope_subjec_key" ON "ledger_profitability_snapshots"("organization_id", "scope", "subject_id", "period_id");

-- CreateIndex
CREATE INDEX "ledger_insights_organization_id_status_kind_idx" ON "ledger_insights"("organization_id", "status", "kind");

-- CreateIndex
CREATE INDEX "ledger_insights_record_id_idx" ON "ledger_insights"("record_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_membership_id_key" ON "employees"("membership_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_employment_status_idx" ON "employees"("organization_id", "employment_status");

-- CreateIndex
CREATE INDEX "employees_organization_id_department_team_id_idx" ON "employees"("organization_id", "department_team_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_primary_branch_id_idx" ON "employees"("organization_id", "primary_branch_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_availability_status_idx" ON "employees"("organization_id", "availability_status");

-- CreateIndex
CREATE INDEX "employees_manager_employee_id_idx" ON "employees"("manager_employee_id");

-- CreateIndex
CREATE INDEX "employees_hire_date_idx" ON "employees"("hire_date");

-- CreateIndex
CREATE INDEX "employees_date_of_birth_idx" ON "employees"("date_of_birth");

-- CreateIndex
CREATE UNIQUE INDEX "employees_organization_id_employee_number_key" ON "employees"("organization_id", "employee_number");

-- CreateIndex
CREATE INDEX "employee_emergency_contacts_employee_id_idx" ON "employee_emergency_contacts"("employee_id");

-- CreateIndex
CREATE INDEX "employee_positions_employee_id_effective_from_idx" ON "employee_positions"("employee_id", "effective_from");

-- CreateIndex
CREATE INDEX "employee_positions_department_team_id_idx" ON "employee_positions"("department_team_id");

-- CreateIndex
CREATE INDEX "employee_compensations_employee_id_effective_from_idx" ON "employee_compensations"("employee_id", "effective_from");

-- CreateIndex
CREATE INDEX "employee_compensation_components_compensation_id_idx" ON "employee_compensation_components"("compensation_id");

-- CreateIndex
CREATE INDEX "skills_organization_id_category_idx" ON "skills"("organization_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "skills_organization_id_slug_key" ON "skills"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "employee_skills_skill_id_proficiency_idx" ON "employee_skills"("skill_id", "proficiency");

-- CreateIndex
CREATE UNIQUE INDEX "employee_skills_employee_id_skill_id_key" ON "employee_skills"("employee_id", "skill_id");

-- CreateIndex
CREATE INDEX "employee_certifications_employee_id_idx" ON "employee_certifications"("employee_id");

-- CreateIndex
CREATE INDEX "employee_certifications_expires_on_idx" ON "employee_certifications"("expires_on");

-- CreateIndex
CREATE INDEX "employee_trainings_employee_id_status_idx" ON "employee_trainings"("employee_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "employee_languages_employee_id_language_key" ON "employee_languages"("employee_id", "language");

-- CreateIndex
CREATE INDEX "employee_work_schedules_employee_id_effective_from_idx" ON "employee_work_schedules"("employee_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "employee_work_schedule_days_schedule_id_weekday_key" ON "employee_work_schedule_days"("schedule_id", "weekday");

-- CreateIndex
CREATE INDEX "employee_availability_entries_employee_id_starts_at_ends_at_idx" ON "employee_availability_entries"("employee_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "employee_availability_entries_organization_id_status_starts_idx" ON "employee_availability_entries"("organization_id", "status", "starts_at");

-- CreateIndex
CREATE INDEX "leave_types_organization_id_category_idx" ON "leave_types"("organization_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_organization_id_code_key" ON "leave_types"("organization_id", "code");

-- CreateIndex
CREATE INDEX "leave_policies_organization_id_leave_type_id_idx" ON "leave_policies"("organization_id", "leave_type_id");

-- CreateIndex
CREATE INDEX "leave_policies_branch_id_idx" ON "leave_policies"("branch_id");

-- CreateIndex
CREATE INDEX "employee_leave_policies_leave_policy_id_idx" ON "employee_leave_policies"("leave_policy_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_leave_policies_employee_id_leave_policy_id_effecti_key" ON "employee_leave_policies"("employee_id", "leave_policy_id", "effective_from");

-- CreateIndex
CREATE INDEX "leave_balances_organization_id_period_start_idx" ON "leave_balances"("organization_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_employee_id_leave_type_id_period_start_key" ON "leave_balances"("employee_id", "leave_type_id", "period_start");

-- CreateIndex
CREATE INDEX "leave_balance_transactions_leave_balance_id_effective_on_idx" ON "leave_balance_transactions"("leave_balance_id", "effective_on");

-- CreateIndex
CREATE INDEX "leave_balance_transactions_leave_request_id_idx" ON "leave_balance_transactions"("leave_request_id");

-- CreateIndex
CREATE INDEX "leave_requests_organization_id_status_idx" ON "leave_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "leave_requests_employee_id_start_date_idx" ON "leave_requests"("employee_id", "start_date");

-- CreateIndex
CREATE INDEX "leave_requests_organization_id_start_date_end_date_idx" ON "leave_requests"("organization_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "leave_requests_current_approver_membership_id_status_idx" ON "leave_requests"("current_approver_membership_id", "status");

-- CreateIndex
CREATE INDEX "leave_request_days_date_idx" ON "leave_request_days"("date");

-- CreateIndex
CREATE UNIQUE INDEX "leave_request_days_leave_request_id_date_key" ON "leave_request_days"("leave_request_id", "date");

-- CreateIndex
CREATE INDEX "leave_request_approvals_approver_membership_id_decision_idx" ON "leave_request_approvals"("approver_membership_id", "decision");

-- CreateIndex
CREATE UNIQUE INDEX "leave_request_approvals_leave_request_id_step_approver_memb_key" ON "leave_request_approvals"("leave_request_id", "step", "approver_membership_id");

-- CreateIndex
CREATE INDEX "company_holidays_organization_id_date_idx" ON "company_holidays"("organization_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "company_holidays_organization_id_date_name_key" ON "company_holidays"("organization_id", "date", "name");

-- CreateIndex
CREATE INDEX "attendance_records_organization_id_date_idx" ON "attendance_records"("organization_id", "date");

-- CreateIndex
CREATE INDEX "attendance_records_organization_id_status_idx" ON "attendance_records"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_employee_id_date_key" ON "attendance_records"("employee_id", "date");

-- CreateIndex
CREATE INDEX "attendance_sessions_attendance_record_id_clock_in_at_idx" ON "attendance_sessions"("attendance_record_id", "clock_in_at");

-- CreateIndex
CREATE INDEX "attendance_breaks_session_id_idx" ON "attendance_breaks"("session_id");

-- CreateIndex
CREATE INDEX "attendance_summaries_organization_id_period_type_period_sta_idx" ON "attendance_summaries"("organization_id", "period_type", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_summaries_employee_id_period_type_period_start_key" ON "attendance_summaries"("employee_id", "period_type", "period_start");

-- CreateIndex
CREATE INDEX "employee_capacity_periods_organization_id_period_type_perio_idx" ON "employee_capacity_periods"("organization_id", "period_type", "period_start", "status");

-- CreateIndex
CREATE UNIQUE INDEX "employee_capacity_periods_employee_id_period_type_period_st_key" ON "employee_capacity_periods"("employee_id", "period_type", "period_start");

-- CreateIndex
CREATE INDEX "performance_review_cycles_organization_id_status_idx" ON "performance_review_cycles"("organization_id", "status");

-- CreateIndex
CREATE INDEX "performance_reviews_organization_id_status_idx" ON "performance_reviews"("organization_id", "status");

-- CreateIndex
CREATE INDEX "performance_reviews_employee_id_period_start_idx" ON "performance_reviews"("employee_id", "period_start");

-- CreateIndex
CREATE INDEX "performance_reviews_reviewer_membership_id_status_idx" ON "performance_reviews"("reviewer_membership_id", "status");

-- CreateIndex
CREATE INDEX "performance_reviews_cycle_id_idx" ON "performance_reviews"("cycle_id");

-- CreateIndex
CREATE INDEX "performance_goals_organization_id_status_idx" ON "performance_goals"("organization_id", "status");

-- CreateIndex
CREATE INDEX "performance_goals_employee_id_status_idx" ON "performance_goals"("employee_id", "status");

-- CreateIndex
CREATE INDEX "performance_goals_review_id_idx" ON "performance_goals"("review_id");

-- CreateIndex
CREATE INDEX "performance_goals_parent_goal_id_idx" ON "performance_goals"("parent_goal_id");

-- CreateIndex
CREATE INDEX "performance_goals_project_id_idx" ON "performance_goals"("project_id");

-- CreateIndex
CREATE INDEX "performance_goal_updates_goal_id_created_at_idx" ON "performance_goal_updates"("goal_id", "created_at");

-- CreateIndex
CREATE INDEX "performance_feedback_employee_id_kind_created_at_idx" ON "performance_feedback"("employee_id", "kind", "created_at");

-- CreateIndex
CREATE INDEX "performance_feedback_organization_id_kind_idx" ON "performance_feedback"("organization_id", "kind");

-- CreateIndex
CREATE INDEX "performance_feedback_review_id_idx" ON "performance_feedback"("review_id");

-- CreateIndex
CREATE INDEX "performance_improvement_plans_organization_id_status_idx" ON "performance_improvement_plans"("organization_id", "status");

-- CreateIndex
CREATE INDEX "performance_improvement_plans_employee_id_status_idx" ON "performance_improvement_plans"("employee_id", "status");

-- CreateIndex
CREATE INDEX "performance_improvement_plan_items_plan_id_idx" ON "performance_improvement_plan_items"("plan_id");

-- CreateIndex
CREATE INDEX "employee_documents_employee_id_category_idx" ON "employee_documents"("employee_id", "category");

-- CreateIndex
CREATE INDEX "employee_documents_organization_id_status_idx" ON "employee_documents"("organization_id", "status");

-- CreateIndex
CREATE INDEX "employee_documents_document_id_idx" ON "employee_documents"("document_id");

-- CreateIndex
CREATE INDEX "employee_documents_expires_on_idx" ON "employee_documents"("expires_on");

-- CreateIndex
CREATE INDEX "employee_hr_notes_employee_id_created_at_idx" ON "employee_hr_notes"("employee_id", "created_at");

-- CreateIndex
CREATE INDEX "employee_hr_notes_organization_id_category_idx" ON "employee_hr_notes"("organization_id", "category");

-- CreateIndex
CREATE INDEX "employee_hr_notes_related_entity_type_related_entity_id_idx" ON "employee_hr_notes"("related_entity_type", "related_entity_id");

-- CreateIndex
CREATE INDEX "employee_profile_change_requests_organization_id_status_idx" ON "employee_profile_change_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "employee_profile_change_requests_employee_id_status_idx" ON "employee_profile_change_requests"("employee_id", "status");

-- CreateIndex
CREATE INDEX "comm_provider_accounts_organization_id_channel_status_idx" ON "comm_provider_accounts"("organization_id", "channel", "status");

-- CreateIndex
CREATE INDEX "comm_sender_domains_organization_id_status_idx" ON "comm_sender_domains"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "comm_sender_domains_organization_id_domain_key" ON "comm_sender_domains"("organization_id", "domain");

-- CreateIndex
CREATE INDEX "comm_sender_identities_organization_id_channel_status_idx" ON "comm_sender_identities"("organization_id", "channel", "status");

-- CreateIndex
CREATE INDEX "comm_sender_identities_branch_id_idx" ON "comm_sender_identities"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "comm_sender_identities_organization_id_channel_address_key" ON "comm_sender_identities"("organization_id", "channel", "address");

-- CreateIndex
CREATE INDEX "comm_signatures_organization_id_membership_id_idx" ON "comm_signatures"("organization_id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "comm_templates_current_version_id_key" ON "comm_templates"("current_version_id");

-- CreateIndex
CREATE INDEX "comm_templates_organization_id_channel_status_idx" ON "comm_templates"("organization_id", "channel", "status");

-- CreateIndex
CREATE INDEX "comm_templates_organization_id_kind_category_idx" ON "comm_templates"("organization_id", "kind", "category");

-- CreateIndex
CREATE UNIQUE INDEX "comm_templates_organization_id_slug_key" ON "comm_templates"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "comm_template_versions_template_id_status_idx" ON "comm_template_versions"("template_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "comm_template_versions_template_id_version_key" ON "comm_template_versions"("template_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "comm_template_translations_version_id_language_key" ON "comm_template_translations"("version_id", "language");

-- CreateIndex
CREATE INDEX "comm_threads_organization_id_last_message_at_idx" ON "comm_threads"("organization_id", "last_message_at");

-- CreateIndex
CREATE INDEX "comm_threads_contact_id_idx" ON "comm_threads"("contact_id");

-- CreateIndex
CREATE INDEX "comm_threads_company_id_idx" ON "comm_threads"("company_id");

-- CreateIndex
CREATE INDEX "comm_threads_project_id_idx" ON "comm_threads"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "comm_messages_unsubscribe_token_key" ON "comm_messages"("unsubscribe_token");

-- CreateIndex
CREATE INDEX "comm_messages_organization_id_status_scheduled_at_idx" ON "comm_messages"("organization_id", "status", "scheduled_at");

-- CreateIndex
CREATE INDEX "comm_messages_search_vector_idx" ON "comm_messages" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "comm_messages_organization_id_channel_kind_created_at_idx" ON "comm_messages"("organization_id", "channel", "kind", "created_at");

-- CreateIndex
CREATE INDEX "comm_messages_organization_id_status_next_attempt_at_idx" ON "comm_messages"("organization_id", "status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "comm_messages_recipient_contact_id_created_at_idx" ON "comm_messages"("recipient_contact_id", "created_at");

-- CreateIndex
CREATE INDEX "comm_messages_company_id_created_at_idx" ON "comm_messages"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "comm_messages_project_id_created_at_idx" ON "comm_messages"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "comm_messages_campaign_id_status_idx" ON "comm_messages"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "comm_messages_thread_id_created_at_idx" ON "comm_messages"("thread_id", "created_at");

-- CreateIndex
CREATE INDEX "comm_messages_sent_by_membership_id_idx" ON "comm_messages"("sent_by_membership_id");

-- CreateIndex
CREATE INDEX "comm_messages_source_entity_type_source_entity_id_idx" ON "comm_messages"("source_entity_type", "source_entity_id");

-- CreateIndex
CREATE INDEX "comm_messages_notification_delivery_id_idx" ON "comm_messages"("notification_delivery_id");

-- CreateIndex
CREATE INDEX "comm_messages_to_address_idx" ON "comm_messages"("to_address");

-- CreateIndex
CREATE UNIQUE INDEX "comm_messages_provider_provider_message_id_key" ON "comm_messages"("provider", "provider_message_id");

-- CreateIndex
CREATE INDEX "comm_message_recipients_contact_id_idx" ON "comm_message_recipients"("contact_id");

-- CreateIndex
CREATE INDEX "comm_message_recipients_membership_id_idx" ON "comm_message_recipients"("membership_id");

-- CreateIndex
CREATE INDEX "comm_message_recipients_address_idx" ON "comm_message_recipients"("address");

-- CreateIndex
CREATE UNIQUE INDEX "comm_message_recipients_message_id_role_address_key" ON "comm_message_recipients"("message_id", "role", "address");

-- CreateIndex
CREATE INDEX "comm_message_attachments_message_id_idx" ON "comm_message_attachments"("message_id");

-- CreateIndex
CREATE INDEX "comm_message_attachments_document_id_idx" ON "comm_message_attachments"("document_id");

-- CreateIndex
CREATE INDEX "comm_message_links_entity_type_entity_id_idx" ON "comm_message_links"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "comm_message_links_message_id_entity_type_entity_id_key" ON "comm_message_links"("message_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "comm_delivery_events_message_id_occurred_at_idx" ON "comm_delivery_events"("message_id", "occurred_at");

-- CreateIndex
CREATE INDEX "comm_delivery_events_organization_id_type_occurred_at_idx" ON "comm_delivery_events"("organization_id", "type", "occurred_at");

-- CreateIndex
CREATE INDEX "comm_delivery_events_recipient_id_idx" ON "comm_delivery_events"("recipient_id");

-- CreateIndex
CREATE UNIQUE INDEX "comm_delivery_events_provider_provider_event_id_key" ON "comm_delivery_events"("provider", "provider_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "comm_tracked_links_token_key" ON "comm_tracked_links"("token");

-- CreateIndex
CREATE INDEX "comm_tracked_links_message_id_idx" ON "comm_tracked_links"("message_id");

-- CreateIndex
CREATE INDEX "comm_tracked_links_campaign_id_idx" ON "comm_tracked_links"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "comm_recipient_lists_organization_id_name_key" ON "comm_recipient_lists"("organization_id", "name");

-- CreateIndex
CREATE INDEX "comm_recipient_list_members_contact_id_idx" ON "comm_recipient_list_members"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "comm_recipient_list_members_list_id_contact_id_key" ON "comm_recipient_list_members"("list_id", "contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "comm_recipient_list_members_list_id_membership_id_key" ON "comm_recipient_list_members"("list_id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "comm_recipient_list_members_list_id_address_key" ON "comm_recipient_list_members"("list_id", "address");

-- CreateIndex
CREATE INDEX "segments_organization_id_entity_type_idx" ON "segments"("organization_id", "entity_type");

-- CreateIndex
CREATE UNIQUE INDEX "segments_organization_id_name_key" ON "segments"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "comm_consents_confirmation_token_key" ON "comm_consents"("confirmation_token");

-- CreateIndex
CREATE INDEX "comm_consents_organization_id_channel_status_idx" ON "comm_consents"("organization_id", "channel", "status");

-- CreateIndex
CREATE UNIQUE INDEX "comm_consents_contact_id_channel_key" ON "comm_consents"("contact_id", "channel");

-- CreateIndex
CREATE INDEX "comm_suppressions_organization_id_reason_idx" ON "comm_suppressions"("organization_id", "reason");

-- CreateIndex
CREATE INDEX "comm_suppressions_contact_id_idx" ON "comm_suppressions"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "comm_suppressions_organization_id_channel_address_key" ON "comm_suppressions"("organization_id", "channel", "address");

-- CreateIndex
CREATE INDEX "campaigns_organization_id_status_idx" ON "campaigns"("organization_id", "status");

-- CreateIndex
CREATE INDEX "campaigns_organization_id_channel_scheduled_at_idx" ON "campaigns"("organization_id", "channel", "scheduled_at");

-- CreateIndex
CREATE INDEX "campaigns_organization_id_is_template_idx" ON "campaigns"("organization_id", "is_template");

-- CreateIndex
CREATE INDEX "campaigns_next_run_at_idx" ON "campaigns"("next_run_at");

-- CreateIndex
CREATE INDEX "campaigns_owner_membership_id_idx" ON "campaigns"("owner_membership_id");

-- CreateIndex
CREATE INDEX "campaign_audiences_segment_id_idx" ON "campaign_audiences"("segment_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_audiences_campaign_id_list_id_key" ON "campaign_audiences"("campaign_id", "list_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_audiences_campaign_id_segment_id_key" ON "campaign_audiences"("campaign_id", "segment_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_recipients_message_id_key" ON "campaign_recipients"("message_id");

-- CreateIndex
CREATE INDEX "campaign_recipients_campaign_id_status_idx" ON "campaign_recipients"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "campaign_recipients_contact_id_idx" ON "campaign_recipients"("contact_id");

-- CreateIndex
CREATE INDEX "campaign_recipients_run_id_idx" ON "campaign_recipients"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_recipients_campaign_id_run_id_address_key" ON "campaign_recipients"("campaign_id", "run_id", "address");

-- CreateIndex
CREATE INDEX "campaign_runs_campaign_id_status_idx" ON "campaign_runs"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "campaign_runs_scheduled_for_idx" ON "campaign_runs"("scheduled_for");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_runs_campaign_id_run_number_key" ON "campaign_runs"("campaign_id", "run_number");

-- CreateIndex
CREATE INDEX "campaign_approvals_campaign_id_decision_idx" ON "campaign_approvals"("campaign_id", "decision");

-- CreateIndex
CREATE INDEX "campaign_approvals_approver_membership_id_decision_idx" ON "campaign_approvals"("approver_membership_id", "decision");

-- CreateIndex
CREATE INDEX "comm_daily_stats_organization_id_date_idx" ON "comm_daily_stats"("organization_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "comm_daily_stats_organization_id_date_channel_kind_campaign_key" ON "comm_daily_stats"("organization_id", "date", "channel", "kind", "campaign_id");

-- CreateIndex
CREATE INDEX "comm_ai_generations_organization_id_task_created_at_idx" ON "comm_ai_generations"("organization_id", "task", "created_at");

-- CreateIndex
CREATE INDEX "comm_ai_generations_requested_by_membership_id_idx" ON "comm_ai_generations"("requested_by_membership_id");

-- CreateIndex
CREATE INDEX "messaging_retention_policies_organization_id_scope_idx" ON "messaging_retention_policies"("organization_id", "scope");

-- CreateIndex
CREATE INDEX "messaging_retention_policies_branch_id_idx" ON "messaging_retention_policies"("branch_id");

-- CreateIndex
CREATE INDEX "messaging_retention_policies_team_id_idx" ON "messaging_retention_policies"("team_id");

-- CreateIndex
CREATE INDEX "channel_templates_organization_id_trigger_idx" ON "channel_templates"("organization_id", "trigger");

-- CreateIndex
CREATE UNIQUE INDEX "channel_templates_organization_id_name_key" ON "channel_templates"("organization_id", "name");

-- CreateIndex
CREATE INDEX "channels_organization_id_kind_status_idx" ON "channels"("organization_id", "kind", "status");

-- CreateIndex
CREATE INDEX "channels_organization_id_status_last_message_at_idx" ON "channels"("organization_id", "status", "last_message_at");

-- CreateIndex
CREATE INDEX "channels_project_id_idx" ON "channels"("project_id");

-- CreateIndex
CREATE INDEX "channels_company_id_idx" ON "channels"("company_id");

-- CreateIndex
CREATE INDEX "channels_team_id_idx" ON "channels"("team_id");

-- CreateIndex
CREATE INDEX "channels_branch_id_idx" ON "channels"("branch_id");

-- CreateIndex
CREATE INDEX "channels_owner_membership_id_idx" ON "channels"("owner_membership_id");

-- CreateIndex
CREATE INDEX "channels_auto_archive_at_idx" ON "channels"("auto_archive_at");

-- CreateIndex
CREATE UNIQUE INDEX "channels_organization_id_slug_key" ON "channels"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "channels_organization_id_dm_key_key" ON "channels"("organization_id", "dm_key");

-- CreateIndex
CREATE UNIQUE INDEX "channels_organization_id_entity_type_entity_id_key" ON "channels"("organization_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "channel_members_membership_id_left_at_idx" ON "channel_members"("membership_id", "left_at");

-- CreateIndex
CREATE INDEX "channel_members_external_user_id_idx" ON "channel_members"("external_user_id");

-- CreateIndex
CREATE INDEX "channel_members_channel_id_role_idx" ON "channel_members"("channel_id", "role");

-- CreateIndex
CREATE INDEX "channel_members_access_expires_at_idx" ON "channel_members"("access_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "channel_members_channel_id_membership_id_key" ON "channel_members"("channel_id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_members_channel_id_external_user_id_key" ON "channel_members"("channel_id", "external_user_id");

-- CreateIndex
CREATE INDEX "channel_member_restrictions_organization_id_kind_lifted_at_idx" ON "channel_member_restrictions"("organization_id", "kind", "lifted_at");

-- CreateIndex
CREATE INDEX "channel_member_restrictions_channel_id_membership_id_idx" ON "channel_member_restrictions"("channel_id", "membership_id");

-- CreateIndex
CREATE INDEX "channel_member_restrictions_membership_id_idx" ON "channel_member_restrictions"("membership_id");

-- CreateIndex
CREATE INDEX "channel_member_restrictions_external_user_id_idx" ON "channel_member_restrictions"("external_user_id");

-- CreateIndex
CREATE INDEX "messages_search_vector_idx" ON "messages" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "messages_channel_id_created_at_idx" ON "messages"("channel_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_channel_id_parent_message_id_created_at_idx" ON "messages"("channel_id", "parent_message_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_parent_message_id_idx" ON "messages"("parent_message_id");

-- CreateIndex
CREATE INDEX "messages_organization_id_author_membership_id_created_at_idx" ON "messages"("organization_id", "author_membership_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_organization_id_status_scheduled_for_idx" ON "messages"("organization_id", "status", "scheduled_for");

-- CreateIndex
CREATE INDEX "messages_organization_id_kind_idx" ON "messages"("organization_id", "kind");

-- CreateIndex
CREATE INDEX "messages_author_user_id_idx" ON "messages"("author_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_channel_id_client_message_id_key" ON "messages"("channel_id", "client_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_integration_id_external_event_id_key" ON "messages"("integration_id", "external_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_versions_message_id_version_key" ON "message_versions"("message_id", "version");

-- CreateIndex
CREATE INDEX "message_reactions_membership_id_idx" ON "message_reactions"("membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_reactions_message_id_emoji_membership_id_key" ON "message_reactions"("message_id", "emoji", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_reactions_message_id_emoji_external_user_id_key" ON "message_reactions"("message_id", "emoji", "external_user_id");

-- CreateIndex
CREATE INDEX "message_mentions_message_id_idx" ON "message_mentions"("message_id");

-- CreateIndex
CREATE INDEX "message_mentions_membership_id_created_at_idx" ON "message_mentions"("membership_id", "created_at");

-- CreateIndex
CREATE INDEX "message_mentions_team_id_idx" ON "message_mentions"("team_id");

-- CreateIndex
CREATE INDEX "message_mentions_role_id_idx" ON "message_mentions"("role_id");

-- CreateIndex
CREATE INDEX "message_mentions_external_user_id_idx" ON "message_mentions"("external_user_id");

-- CreateIndex
CREATE INDEX "message_attachments_channel_id_created_at_idx" ON "message_attachments"("channel_id", "created_at");

-- CreateIndex
CREATE INDEX "message_attachments_channel_id_kind_idx" ON "message_attachments"("channel_id", "kind");

-- CreateIndex
CREATE INDEX "message_attachments_document_id_idx" ON "message_attachments"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_attachments_message_id_document_id_key" ON "message_attachments"("message_id", "document_id");

-- CreateIndex
CREATE INDEX "message_link_previews_entity_type_entity_id_idx" ON "message_link_previews"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_link_previews_message_id_url_key" ON "message_link_previews"("message_id", "url");

-- CreateIndex
CREATE INDEX "message_record_shares_entity_type_entity_id_idx" ON "message_record_shares"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_record_shares_message_id_entity_type_entity_id_key" ON "message_record_shares"("message_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "message_acknowledgements_membership_id_idx" ON "message_acknowledgements"("membership_id");

-- CreateIndex
CREATE INDEX "channel_read_states_membership_id_unread_count_idx" ON "channel_read_states"("membership_id", "unread_count");

-- CreateIndex
CREATE UNIQUE INDEX "channel_read_states_channel_id_membership_id_key" ON "channel_read_states"("channel_id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_read_states_channel_id_external_user_id_key" ON "channel_read_states"("channel_id", "external_user_id");

-- CreateIndex
CREATE INDEX "message_read_receipts_membership_id_read_at_idx" ON "message_read_receipts"("membership_id", "read_at");

-- CreateIndex
CREATE INDEX "message_thread_followers_membership_id_created_at_idx" ON "message_thread_followers"("membership_id", "created_at");

-- CreateIndex
CREATE INDEX "channel_pins_pinned_by_membership_id_idx" ON "channel_pins"("pinned_by_membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_pins_channel_id_message_id_key" ON "channel_pins"("channel_id", "message_id");

-- CreateIndex
CREATE INDEX "saved_messages_membership_id_created_at_idx" ON "saved_messages"("membership_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "saved_messages_membership_id_message_id_key" ON "saved_messages"("membership_id", "message_id");

-- CreateIndex
CREATE INDEX "message_reminders_organization_id_status_remind_at_idx" ON "message_reminders"("organization_id", "status", "remind_at");

-- CreateIndex
CREATE INDEX "message_reminders_membership_id_status_idx" ON "message_reminders"("membership_id", "status");

-- CreateIndex
CREATE INDEX "message_reminders_message_id_idx" ON "message_reminders"("message_id");

-- CreateIndex
CREATE INDEX "message_drafts_membership_id_updated_at_idx" ON "message_drafts"("membership_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "message_drafts_channel_id_membership_id_thread_root_message_key" ON "message_drafts"("channel_id", "membership_id", "thread_root_message_id");

-- CreateIndex
CREATE INDEX "messaging_keywords_organization_id_is_enabled_idx" ON "messaging_keywords"("organization_id", "is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "messaging_keywords_membership_id_keyword_key" ON "messaging_keywords"("membership_id", "keyword");

-- CreateIndex
CREATE INDEX "channel_sections_membership_id_sort_order_idx" ON "channel_sections"("membership_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "channel_sections_membership_id_name_key" ON "channel_sections"("membership_id", "name");

-- CreateIndex
CREATE INDEX "channel_section_items_channel_id_idx" ON "channel_section_items"("channel_id");

-- CreateIndex
CREATE INDEX "messaging_presence_organization_id_state_idx" ON "messaging_presence"("organization_id", "state");

-- CreateIndex
CREATE INDEX "message_reports_organization_id_status_created_at_idx" ON "message_reports"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "message_reports_message_id_idx" ON "message_reports"("message_id");

-- CreateIndex
CREATE INDEX "message_reports_reporter_membership_id_idx" ON "message_reports"("reporter_membership_id");

-- CreateIndex
CREATE INDEX "messaging_export_jobs_organization_id_status_created_at_idx" ON "messaging_export_jobs"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "messaging_export_jobs_requested_by_membership_id_idx" ON "messaging_export_jobs"("requested_by_membership_id");

-- CreateIndex
CREATE INDEX "messaging_integrations_organization_id_kind_status_idx" ON "messaging_integrations"("organization_id", "kind", "status");

-- CreateIndex
CREATE INDEX "messaging_integrations_default_channel_id_idx" ON "messaging_integrations"("default_channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "messaging_integrations_organization_id_name_key" ON "messaging_integrations"("organization_id", "name");

-- CreateIndex
CREATE INDEX "channel_calls_organization_id_status_idx" ON "channel_calls"("organization_id", "status");

-- CreateIndex
CREATE INDEX "channel_calls_channel_id_started_at_idx" ON "channel_calls"("channel_id", "started_at");

-- CreateIndex
CREATE INDEX "channel_calls_started_by_membership_id_idx" ON "channel_calls"("started_by_membership_id");

-- CreateIndex
CREATE INDEX "channel_call_participants_membership_id_joined_at_idx" ON "channel_call_participants"("membership_id", "joined_at");

-- CreateIndex
CREATE UNIQUE INDEX "channel_call_participants_call_id_membership_id_key" ON "channel_call_participants"("call_id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_call_participants_call_id_external_user_id_key" ON "channel_call_participants"("call_id", "external_user_id");

-- CreateIndex
CREATE INDEX "messaging_usage_daily_organization_id_date_idx" ON "messaging_usage_daily"("organization_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "messaging_usage_daily_organization_id_channel_id_date_key" ON "messaging_usage_daily"("organization_id", "channel_id", "date");

-- CreateIndex
CREATE INDEX "support_inboxes_organization_id_idx" ON "support_inboxes"("organization_id");

-- CreateIndex
CREATE INDEX "support_inboxes_team_id_idx" ON "support_inboxes"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "support_inboxes_organization_id_slug_key" ON "support_inboxes"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "support_channels_widget_key_key" ON "support_channels"("widget_key");

-- CreateIndex
CREATE INDEX "support_channels_inbox_id_idx" ON "support_channels"("inbox_id");

-- CreateIndex
CREATE INDEX "support_channels_organization_id_type_idx" ON "support_channels"("organization_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "support_channels_organization_id_email_address_key" ON "support_channels"("organization_id", "email_address");

-- CreateIndex
CREATE INDEX "support_conversations_organization_id_status_last_message_a_idx" ON "support_conversations"("organization_id", "status", "last_message_at");

-- CreateIndex
CREATE INDEX "support_conversations_inbox_id_status_idx" ON "support_conversations"("inbox_id", "status");

-- CreateIndex
CREATE INDEX "support_conversations_assignee_membership_id_status_idx" ON "support_conversations"("assignee_membership_id", "status");

-- CreateIndex
CREATE INDEX "support_conversations_contact_id_idx" ON "support_conversations"("contact_id");

-- CreateIndex
CREATE INDEX "support_conversations_company_id_idx" ON "support_conversations"("company_id");

-- CreateIndex
CREATE INDEX "support_conversations_customer_user_id_idx" ON "support_conversations"("customer_user_id");

-- CreateIndex
CREATE INDEX "support_conversations_organization_id_email_thread_key_idx" ON "support_conversations"("organization_id", "email_thread_key");

-- CreateIndex
CREATE INDEX "support_conversations_organization_id_visitor_key_idx" ON "support_conversations"("organization_id", "visitor_key");

-- CreateIndex
CREATE INDEX "support_conversation_participants_membership_id_idx" ON "support_conversation_participants"("membership_id");

-- CreateIndex
CREATE INDEX "support_messages_conversation_id_created_at_idx" ON "support_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "support_messages_search_vector_idx" ON "support_messages" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "support_messages_organization_id_created_at_idx" ON "support_messages"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "support_messages_author_membership_id_idx" ON "support_messages"("author_membership_id");

-- CreateIndex
CREATE INDEX "support_messages_external_message_id_idx" ON "support_messages"("external_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "support_message_attachments_message_id_document_id_key" ON "support_message_attachments"("message_id", "document_id");

-- CreateIndex
CREATE INDEX "ticket_statuses_organization_id_category_idx" ON "ticket_statuses"("organization_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_statuses_organization_id_slug_key" ON "ticket_statuses"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "ticket_categories_parent_category_id_idx" ON "ticket_categories"("parent_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_categories_organization_id_slug_key" ON "ticket_categories"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "sla_policies_organization_id_is_default_idx" ON "sla_policies"("organization_id", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "sla_policies_organization_id_name_key" ON "sla_policies"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "sla_policy_targets_policy_id_priority_key" ON "sla_policy_targets"("policy_id", "priority");

-- CreateIndex
CREATE INDEX "tickets_search_vector_idx" ON "tickets" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "tickets_organization_id_status_id_idx" ON "tickets"("organization_id", "status_id");

-- CreateIndex
CREATE INDEX "tickets_organization_id_priority_idx" ON "tickets"("organization_id", "priority");

-- CreateIndex
CREATE INDEX "tickets_organization_id_category_id_idx" ON "tickets"("organization_id", "category_id");

-- CreateIndex
CREATE INDEX "tickets_organization_id_created_at_idx" ON "tickets"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "tickets_inbox_id_status_id_idx" ON "tickets"("inbox_id", "status_id");

-- CreateIndex
CREATE INDEX "tickets_assignee_membership_id_status_id_idx" ON "tickets"("assignee_membership_id", "status_id");

-- CreateIndex
CREATE INDEX "tickets_team_id_status_id_idx" ON "tickets"("team_id", "status_id");

-- CreateIndex
CREATE INDEX "tickets_requester_contact_id_idx" ON "tickets"("requester_contact_id");

-- CreateIndex
CREATE INDEX "tickets_company_id_idx" ON "tickets"("company_id");

-- CreateIndex
CREATE INDEX "tickets_requester_user_id_idx" ON "tickets"("requester_user_id");

-- CreateIndex
CREATE INDEX "tickets_project_id_idx" ON "tickets"("project_id");

-- CreateIndex
CREATE INDEX "tickets_conversation_id_idx" ON "tickets"("conversation_id");

-- CreateIndex
CREATE INDEX "tickets_incident_id_idx" ON "tickets"("incident_id");

-- CreateIndex
CREATE INDEX "tickets_resolution_due_at_idx" ON "tickets"("resolution_due_at");

-- CreateIndex
CREATE INDEX "tickets_first_response_due_at_idx" ON "tickets"("first_response_due_at");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_organization_id_number_key" ON "tickets"("organization_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_organization_id_reference_key" ON "tickets"("organization_id", "reference");

-- CreateIndex
CREATE INDEX "ticket_conversations_conversation_id_idx" ON "ticket_conversations"("conversation_id");

-- CreateIndex
CREATE INDEX "ticket_status_history_ticket_id_changed_at_idx" ON "ticket_status_history"("ticket_id", "changed_at");

-- CreateIndex
CREATE INDEX "ticket_status_history_to_status_id_changed_at_idx" ON "ticket_status_history"("to_status_id", "changed_at");

-- CreateIndex
CREATE INDEX "ticket_sla_timers_ticket_id_metric_idx" ON "ticket_sla_timers"("ticket_id", "metric");

-- CreateIndex
CREATE INDEX "ticket_sla_timers_status_due_at_idx" ON "ticket_sla_timers"("status", "due_at");

-- CreateIndex
CREATE INDEX "ticket_relations_target_ticket_id_idx" ON "ticket_relations"("target_ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_relations_source_ticket_id_target_ticket_id_type_key" ON "ticket_relations"("source_ticket_id", "target_ticket_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_task_links_idempotency_key_key" ON "ticket_task_links"("idempotency_key");

-- CreateIndex
CREATE INDEX "ticket_task_links_task_id_idx" ON "ticket_task_links"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_task_links_ticket_id_task_id_key" ON "ticket_task_links"("ticket_id", "task_id");

-- CreateIndex
CREATE INDEX "ticket_followers_membership_id_idx" ON "ticket_followers"("membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_attachments_ticket_id_document_id_key" ON "ticket_attachments"("ticket_id", "document_id");

-- CreateIndex
CREATE INDEX "support_incidents_organization_id_status_idx" ON "support_incidents"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "support_csat_ratings_token_key" ON "support_csat_ratings"("token");

-- CreateIndex
CREATE INDEX "support_csat_ratings_organization_id_submitted_at_idx" ON "support_csat_ratings"("organization_id", "submitted_at");

-- CreateIndex
CREATE INDEX "support_csat_ratings_ticket_id_idx" ON "support_csat_ratings"("ticket_id");

-- CreateIndex
CREATE INDEX "support_csat_ratings_agent_membership_id_submitted_at_idx" ON "support_csat_ratings"("agent_membership_id", "submitted_at");

-- CreateIndex
CREATE INDEX "support_canned_responses_organization_id_scope_idx" ON "support_canned_responses"("organization_id", "scope");

-- CreateIndex
CREATE INDEX "support_canned_responses_team_id_idx" ON "support_canned_responses"("team_id");

-- CreateIndex
CREATE INDEX "support_canned_responses_owner_membership_id_idx" ON "support_canned_responses"("owner_membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "support_canned_responses_organization_id_shortcut_key" ON "support_canned_responses"("organization_id", "shortcut");

-- CreateIndex
CREATE INDEX "knowledge_categories_parent_category_id_idx" ON "knowledge_categories"("parent_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_categories_organization_id_slug_key" ON "knowledge_categories"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "knowledge_articles_organization_id_status_visibility_idx" ON "knowledge_articles"("organization_id", "status", "visibility");

-- CreateIndex
CREATE INDEX "knowledge_articles_search_vector_idx" ON "knowledge_articles" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "knowledge_articles_category_id_sort_order_idx" ON "knowledge_articles"("category_id", "sort_order");

-- CreateIndex
CREATE INDEX "knowledge_articles_source_ticket_id_idx" ON "knowledge_articles"("source_ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_articles_organization_id_slug_locale_key" ON "knowledge_articles"("organization_id", "slug", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_article_versions_article_id_version_key" ON "knowledge_article_versions"("article_id", "version");

-- CreateIndex
CREATE INDEX "knowledge_article_feedback_article_id_created_at_idx" ON "knowledge_article_feedback"("article_id", "created_at");

-- CreateIndex
CREATE INDEX "knowledge_article_feedback_user_id_idx" ON "knowledge_article_feedback"("user_id");

-- CreateIndex
CREATE INDEX "support_ai_sessions_organization_id_status_started_at_idx" ON "support_ai_sessions"("organization_id", "status", "started_at");

-- CreateIndex
CREATE INDEX "support_ai_sessions_conversation_id_idx" ON "support_ai_sessions"("conversation_id");

-- CreateIndex
CREATE INDEX "support_ai_suggestions_organization_id_kind_status_idx" ON "support_ai_suggestions"("organization_id", "kind", "status");

-- CreateIndex
CREATE INDEX "support_ai_suggestions_conversation_id_kind_idx" ON "support_ai_suggestions"("conversation_id", "kind");

-- CreateIndex
CREATE INDEX "support_ai_suggestions_ticket_id_kind_idx" ON "support_ai_suggestions"("ticket_id", "kind");

-- CreateIndex
CREATE INDEX "notification_event_types_module_is_active_idx" ON "notification_event_types"("module", "is_active");

-- CreateIndex
CREATE INDEX "notification_event_types_category_idx" ON "notification_event_types"("category");

-- CreateIndex
CREATE UNIQUE INDEX "notification_event_types_organization_id_key_key" ON "notification_event_types"("organization_id", "key");

-- CreateIndex
CREATE INDEX "notification_events_organization_id_status_received_at_idx" ON "notification_events"("organization_id", "status", "received_at");

-- CreateIndex
CREATE INDEX "notification_events_organization_id_event_key_occurred_at_idx" ON "notification_events"("organization_id", "event_key", "occurred_at");

-- CreateIndex
CREATE INDEX "notification_events_entity_type_entity_id_idx" ON "notification_events"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "notification_events_group_key_idx" ON "notification_events"("group_key");

-- CreateIndex
CREATE UNIQUE INDEX "notification_events_organization_id_idempotency_key_key" ON "notification_events"("organization_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "notifications_organization_id_recipient_membership_id_read__idx" ON "notifications"("organization_id", "recipient_membership_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "notifications_organization_id_recipient_user_id_read_at_cre_idx" ON "notifications"("organization_id", "recipient_user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "notifications_recipient_membership_id_requires_action_idx" ON "notifications"("recipient_membership_id", "requires_action");

-- CreateIndex
CREATE INDEX "notifications_recipient_membership_id_category_idx" ON "notifications"("recipient_membership_id", "category");

-- CreateIndex
CREATE INDEX "notifications_organization_id_group_key_idx" ON "notifications"("organization_id", "group_key");

-- CreateIndex
CREATE INDEX "notifications_entity_type_entity_id_idx" ON "notifications"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "notifications_snoozed_until_idx" ON "notifications"("snoozed_until");

-- CreateIndex
CREATE INDEX "notifications_expires_at_idx" ON "notifications"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_event_id_recipient_membership_id_key" ON "notifications"("event_id", "recipient_membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_event_id_recipient_user_id_key" ON "notifications"("event_id", "recipient_user_id");

-- CreateIndex
CREATE INDEX "notification_deliveries_organization_id_status_next_attempt_idx" ON "notification_deliveries"("organization_id", "status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_organization_id_channel_created_at_idx" ON "notification_deliveries"("organization_id", "channel", "created_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_digest_id_idx" ON "notification_deliveries"("digest_id");

-- CreateIndex
CREATE INDEX "notification_deliveries_comm_message_id_idx" ON "notification_deliveries"("comm_message_id");

-- CreateIndex
CREATE INDEX "notification_deliveries_provider_message_id_idx" ON "notification_deliveries"("provider_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_notification_id_channel_key" ON "notification_deliveries"("notification_id", "channel");

-- CreateIndex
CREATE INDEX "notification_templates_event_type_id_channel_idx" ON "notification_templates"("event_type_id", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_organization_id_event_type_id_channe_key" ON "notification_templates"("organization_id", "event_type_id", "channel", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "notification_org_defaults_organization_id_module_key" ON "notification_org_defaults"("organization_id", "module");

-- CreateIndex
CREATE UNIQUE INDEX "notification_org_defaults_organization_id_event_type_id_key" ON "notification_org_defaults"("organization_id", "event_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_recipient_settings_membership_id_key" ON "notification_recipient_settings"("membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_recipient_settings_portal_membership_id_key" ON "notification_recipient_settings"("portal_membership_id");

-- CreateIndex
CREATE INDEX "notification_recipient_settings_organization_id_idx" ON "notification_recipient_settings"("organization_id");

-- CreateIndex
CREATE INDEX "notification_preferences_membership_id_event_type_id_idx" ON "notification_preferences"("membership_id", "event_type_id");

-- CreateIndex
CREATE INDEX "notification_preferences_membership_id_entity_type_entity_i_idx" ON "notification_preferences"("membership_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "notification_preferences_portal_membership_id_idx" ON "notification_preferences"("portal_membership_id");

-- CreateIndex
CREATE INDEX "notification_preferences_entity_type_entity_id_idx" ON "notification_preferences"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_organization_id_recipient_key_scop_key" ON "notification_preferences"("organization_id", "recipient_key", "scope_key", "channel");

-- CreateIndex
CREATE INDEX "notification_keywords_organization_id_is_enabled_idx" ON "notification_keywords"("organization_id", "is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "notification_keywords_membership_id_keyword_key" ON "notification_keywords"("membership_id", "keyword");

-- CreateIndex
CREATE INDEX "notification_digests_organization_id_status_scheduled_for_idx" ON "notification_digests"("organization_id", "status", "scheduled_for");

-- CreateIndex
CREATE INDEX "notification_digests_membership_id_status_period_start_idx" ON "notification_digests"("membership_id", "status", "period_start");

-- CreateIndex
CREATE INDEX "notification_digests_portal_membership_id_status_idx" ON "notification_digests"("portal_membership_id", "status");

-- CreateIndex
CREATE INDEX "notification_push_devices_user_id_disabled_at_idx" ON "notification_push_devices"("user_id", "disabled_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_push_devices_platform_token_key" ON "notification_push_devices"("platform", "token");

-- CreateIndex
CREATE INDEX "notification_delivery_rules_organization_id_is_active_kind_idx" ON "notification_delivery_rules"("organization_id", "is_active", "kind");

-- CreateIndex
CREATE INDEX "notification_delivery_rules_event_type_id_idx" ON "notification_delivery_rules"("event_type_id");

-- CreateIndex
CREATE INDEX "wiki_spaces_organization_id_kind_idx" ON "wiki_spaces"("organization_id", "kind");

-- CreateIndex
CREATE INDEX "wiki_spaces_team_id_idx" ON "wiki_spaces"("team_id");

-- CreateIndex
CREATE INDEX "wiki_spaces_branch_id_idx" ON "wiki_spaces"("branch_id");

-- CreateIndex
CREATE INDEX "wiki_spaces_project_id_idx" ON "wiki_spaces"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_spaces_organization_id_slug_key" ON "wiki_spaces"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "wiki_space_members_membership_id_idx" ON "wiki_space_members"("membership_id");

-- CreateIndex
CREATE INDEX "wiki_page_templates_organization_id_page_type_idx" ON "wiki_page_templates"("organization_id", "page_type");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_page_templates_organization_id_slug_key" ON "wiki_page_templates"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "wiki_pages_organization_id_status_idx" ON "wiki_pages"("organization_id", "status");

-- CreateIndex
CREATE INDEX "wiki_pages_organization_id_customer_visible_idx" ON "wiki_pages"("organization_id", "customer_visible");

-- CreateIndex
CREATE INDEX "wiki_pages_search_vector_idx" ON "wiki_pages" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "wiki_pages_space_id_parent_page_id_sort_order_idx" ON "wiki_pages"("space_id", "parent_page_id", "sort_order");

-- CreateIndex
CREATE INDEX "wiki_pages_parent_page_id_idx" ON "wiki_pages"("parent_page_id");

-- CreateIndex
CREATE INDEX "wiki_pages_owner_membership_id_idx" ON "wiki_pages"("owner_membership_id");

-- CreateIndex
CREATE INDEX "wiki_pages_next_review_at_idx" ON "wiki_pages"("next_review_at");

-- CreateIndex
CREATE INDEX "wiki_pages_path_idx" ON "wiki_pages"("path");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_pages_space_id_slug_key" ON "wiki_pages"("space_id", "slug");

-- CreateIndex
CREATE INDEX "wiki_page_reviewers_membership_id_idx" ON "wiki_page_reviewers"("membership_id");

-- CreateIndex
CREATE INDEX "wiki_page_versions_page_id_created_at_idx" ON "wiki_page_versions"("page_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_page_versions_page_id_version_number_key" ON "wiki_page_versions"("page_id", "version_number");

-- CreateIndex
CREATE INDEX "wiki_page_permissions_principal_type_principal_id_idx" ON "wiki_page_permissions"("principal_type", "principal_id");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_page_permissions_page_id_principal_type_principal_id_key" ON "wiki_page_permissions"("page_id", "principal_type", "principal_id");

-- CreateIndex
CREATE INDEX "wiki_page_links_entity_type_entity_id_idx" ON "wiki_page_links"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_page_links_page_id_entity_type_entity_id_key" ON "wiki_page_links"("page_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "wiki_page_attachments_document_id_idx" ON "wiki_page_attachments"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_page_attachments_page_id_document_id_key" ON "wiki_page_attachments"("page_id", "document_id");

-- CreateIndex
CREATE INDEX "wiki_page_comments_page_id_created_at_idx" ON "wiki_page_comments"("page_id", "created_at");

-- CreateIndex
CREATE INDEX "wiki_page_comments_parent_comment_id_idx" ON "wiki_page_comments"("parent_comment_id");

-- CreateIndex
CREATE INDEX "wiki_page_favorites_membership_id_idx" ON "wiki_page_favorites"("membership_id");

-- CreateIndex
CREATE INDEX "wiki_page_acknowledgements_membership_id_acknowledged_at_idx" ON "wiki_page_acknowledgements"("membership_id", "acknowledged_at");

-- CreateIndex
CREATE INDEX "wiki_page_acknowledgements_required_by_idx" ON "wiki_page_acknowledgements"("required_by");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_page_acknowledgements_page_id_membership_id_key" ON "wiki_page_acknowledgements"("page_id", "membership_id");

-- CreateIndex
CREATE INDEX "wiki_checklists_organization_id_kind_is_active_idx" ON "wiki_checklists"("organization_id", "kind", "is_active");

-- CreateIndex
CREATE INDEX "wiki_checklists_department_id_idx" ON "wiki_checklists"("department_id");

-- CreateIndex
CREATE INDEX "wiki_checklists_role_id_idx" ON "wiki_checklists"("role_id");

-- CreateIndex
CREATE INDEX "wiki_checklist_items_checklist_id_sort_order_idx" ON "wiki_checklist_items"("checklist_id", "sort_order");

-- CreateIndex
CREATE INDEX "wiki_checklist_runs_organization_id_status_idx" ON "wiki_checklist_runs"("organization_id", "status");

-- CreateIndex
CREATE INDEX "wiki_checklist_runs_checklist_id_idx" ON "wiki_checklist_runs"("checklist_id");

-- CreateIndex
CREATE INDEX "wiki_checklist_runs_subject_membership_id_status_idx" ON "wiki_checklist_runs"("subject_membership_id", "status");

-- CreateIndex
CREATE INDEX "wiki_checklist_runs_employee_id_idx" ON "wiki_checklist_runs"("employee_id");

-- CreateIndex
CREATE INDEX "wiki_checklist_run_items_task_id_idx" ON "wiki_checklist_run_items"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_checklist_run_items_run_id_checklist_item_id_key" ON "wiki_checklist_run_items"("run_id", "checklist_item_id");

-- CreateIndex
CREATE INDEX "custom_forms_organization_id_status_idx" ON "custom_forms"("organization_id", "status");

-- CreateIndex
CREATE INDEX "custom_forms_space_id_idx" ON "custom_forms"("space_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_forms_organization_id_slug_key" ON "custom_forms"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "custom_form_versions_form_id_version_number_key" ON "custom_form_versions"("form_id", "version_number");

-- CreateIndex
CREATE INDEX "form_assignments_organization_id_form_id_idx" ON "form_assignments"("organization_id", "form_id");

-- CreateIndex
CREATE INDEX "form_assignments_target_type_target_id_idx" ON "form_assignments"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "form_assignments_due_at_idx" ON "form_assignments"("due_at");

-- CreateIndex
CREATE UNIQUE INDEX "form_assignment_recipients_submission_id_key" ON "form_assignment_recipients"("submission_id");

-- CreateIndex
CREATE INDEX "form_assignment_recipients_membership_id_status_idx" ON "form_assignment_recipients"("membership_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "form_assignment_recipients_assignment_id_membership_id_key" ON "form_assignment_recipients"("assignment_id", "membership_id");

-- CreateIndex
CREATE INDEX "form_submissions_organization_id_form_id_status_idx" ON "form_submissions"("organization_id", "form_id", "status");

-- CreateIndex
CREATE INDEX "form_submissions_form_id_submitted_at_idx" ON "form_submissions"("form_id", "submitted_at");

-- CreateIndex
CREATE INDEX "form_submissions_respondent_membership_id_idx" ON "form_submissions"("respondent_membership_id");

-- CreateIndex
CREATE INDEX "form_submission_files_submission_id_field_key_idx" ON "form_submission_files"("submission_id", "field_key");

-- CreateIndex
CREATE INDEX "form_submission_files_document_id_idx" ON "form_submission_files"("document_id");

-- CreateIndex
CREATE INDEX "wiki_ai_index_entries_organization_id_status_idx" ON "wiki_ai_index_entries"("organization_id", "status");

-- CreateIndex
CREATE INDEX "wiki_ai_index_entries_organization_id_space_id_visibility_idx" ON "wiki_ai_index_entries"("organization_id", "space_id", "visibility");

-- CreateIndex
CREATE INDEX "wiki_ai_index_entries_page_id_idx" ON "wiki_ai_index_entries"("page_id");

-- CreateIndex
CREATE INDEX "wiki_ai_index_entries_knowledge_article_id_idx" ON "wiki_ai_index_entries"("knowledge_article_id");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_ai_index_entries_source_type_source_id_chunk_index_key" ON "wiki_ai_index_entries"("source_type", "source_id", "chunk_index");

-- CreateIndex
CREATE INDEX "wiki_ai_suggestions_organization_id_status_kind_idx" ON "wiki_ai_suggestions"("organization_id", "status", "kind");

-- CreateIndex
CREATE INDEX "wiki_ai_suggestions_page_id_idx" ON "wiki_ai_suggestions"("page_id");

-- CreateIndex
CREATE INDEX "wiki_ai_suggestions_source_entity_type_source_entity_id_idx" ON "wiki_ai_suggestions"("source_entity_type", "source_entity_id");

-- CreateIndex
CREATE INDEX "document_categories_organization_id_sort_order_idx" ON "document_categories"("organization_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "document_categories_organization_id_slug_key" ON "document_categories"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "document_storage_connections_organization_id_provider_idx" ON "document_storage_connections"("organization_id", "provider");

-- CreateIndex
CREATE INDEX "document_storage_connections_organization_id_is_default_idx" ON "document_storage_connections"("organization_id", "is_default");

-- CreateIndex
CREATE INDEX "document_retention_policies_organization_id_is_active_idx" ON "document_retention_policies"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "document_retention_policies_category_id_idx" ON "document_retention_policies"("category_id");

-- CreateIndex
CREATE INDEX "folder_templates_organization_id_target_idx" ON "folder_templates"("organization_id", "target");

-- CreateIndex
CREATE INDEX "folder_templates_project_type_id_idx" ON "folder_templates"("project_type_id");

-- CreateIndex
CREATE INDEX "folders_organization_id_scope_idx" ON "folders"("organization_id", "scope");

-- CreateIndex
CREATE INDEX "folders_parent_folder_id_idx" ON "folders"("parent_folder_id");

-- CreateIndex
CREATE INDEX "folders_project_id_idx" ON "folders"("project_id");

-- CreateIndex
CREATE INDEX "folders_company_id_idx" ON "folders"("company_id");

-- CreateIndex
CREATE INDEX "folders_branch_id_idx" ON "folders"("branch_id");

-- CreateIndex
CREATE INDEX "folders_team_id_idx" ON "folders"("team_id");

-- CreateIndex
CREATE INDEX "folders_employee_id_idx" ON "folders"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "folders_organization_id_parent_folder_id_name_key" ON "folders"("organization_id", "parent_folder_id", "name");

-- CreateIndex
CREATE INDEX "document_versions_document_id_created_at_idx" ON "document_versions"("document_id", "created_at");

-- CreateIndex
CREATE INDEX "document_versions_checksum_sha256_idx" ON "document_versions"("checksum_sha256");

-- CreateIndex
CREATE INDEX "document_versions_scan_status_idx" ON "document_versions"("scan_status");

-- CreateIndex
CREATE INDEX "document_versions_storage_connection_id_idx" ON "document_versions"("storage_connection_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_document_id_version_number_key" ON "document_versions"("document_id", "version_number");

-- CreateIndex
CREATE INDEX "document_upload_jobs_organization_id_status_idx" ON "document_upload_jobs"("organization_id", "status");

-- CreateIndex
CREATE INDEX "document_upload_jobs_organization_id_batch_id_idx" ON "document_upload_jobs"("organization_id", "batch_id");

-- CreateIndex
CREATE INDEX "document_upload_jobs_document_id_idx" ON "document_upload_jobs"("document_id");

-- CreateIndex
CREATE INDEX "document_upload_jobs_initiated_by_user_id_idx" ON "document_upload_jobs"("initiated_by_user_id");

-- CreateIndex
CREATE INDEX "document_upload_jobs_expires_at_idx" ON "document_upload_jobs"("expires_at");

-- CreateIndex
CREATE INDEX "document_previews_version_id_status_idx" ON "document_previews"("version_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "document_previews_version_id_kind_page_number_watermarked_key" ON "document_previews"("version_id", "kind", "page_number", "watermarked");

-- CreateIndex
CREATE INDEX "document_attachments_entity_type_entity_id_idx" ON "document_attachments"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "document_attachments_organization_id_entity_type_idx" ON "document_attachments"("organization_id", "entity_type");

-- CreateIndex
CREATE UNIQUE INDEX "document_attachments_document_id_entity_type_entity_id_role_key" ON "document_attachments"("document_id", "entity_type", "entity_id", "role");

-- CreateIndex
CREATE INDEX "document_favorites_document_id_idx" ON "document_favorites"("document_id");

-- CreateIndex
CREATE INDEX "document_favorites_folder_id_idx" ON "document_favorites"("folder_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_favorites_membership_id_document_id_key" ON "document_favorites"("membership_id", "document_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_favorites_membership_id_folder_id_key" ON "document_favorites"("membership_id", "folder_id");

-- CreateIndex
CREATE INDEX "document_recent_accesses_membership_id_last_accessed_at_idx" ON "document_recent_accesses"("membership_id", "last_accessed_at");

-- CreateIndex
CREATE UNIQUE INDEX "document_shares_link_token_key" ON "document_shares"("link_token");

-- CreateIndex
CREATE INDEX "document_shares_organization_id_status_idx" ON "document_shares"("organization_id", "status");

-- CreateIndex
CREATE INDEX "document_shares_document_id_status_idx" ON "document_shares"("document_id", "status");

-- CreateIndex
CREATE INDEX "document_shares_folder_id_status_idx" ON "document_shares"("folder_id", "status");

-- CreateIndex
CREATE INDEX "document_shares_membership_id_idx" ON "document_shares"("membership_id");

-- CreateIndex
CREATE INDEX "document_shares_team_id_idx" ON "document_shares"("team_id");

-- CreateIndex
CREATE INDEX "document_shares_portal_user_id_idx" ON "document_shares"("portal_user_id");

-- CreateIndex
CREATE INDEX "document_shares_external_email_idx" ON "document_shares"("external_email");

-- CreateIndex
CREATE INDEX "document_shares_expires_at_idx" ON "document_shares"("expires_at");

-- CreateIndex
CREATE INDEX "document_approvals_organization_id_status_idx" ON "document_approvals"("organization_id", "status");

-- CreateIndex
CREATE INDEX "document_approvals_document_id_created_at_idx" ON "document_approvals"("document_id", "created_at");

-- CreateIndex
CREATE INDEX "document_approvals_version_id_idx" ON "document_approvals"("version_id");

-- CreateIndex
CREATE INDEX "document_approvals_due_at_idx" ON "document_approvals"("due_at");

-- CreateIndex
CREATE INDEX "document_approvers_membership_id_decision_idx" ON "document_approvers"("membership_id", "decision");

-- CreateIndex
CREATE INDEX "document_approvers_portal_user_id_decision_idx" ON "document_approvers"("portal_user_id", "decision");

-- CreateIndex
CREATE UNIQUE INDEX "document_approvers_approval_id_membership_id_key" ON "document_approvers"("approval_id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_approvers_approval_id_portal_user_id_key" ON "document_approvers"("approval_id", "portal_user_id");

-- CreateIndex
CREATE INDEX "document_deletion_requests_organization_id_status_idx" ON "document_deletion_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "document_deletion_requests_document_id_idx" ON "document_deletion_requests"("document_id");

-- CreateIndex
CREATE INDEX "vault_keys_organization_id_status_idx" ON "vault_keys"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vault_keys_organization_id_version_key" ON "vault_keys"("organization_id", "version");

-- CreateIndex
CREATE INDEX "vault_entries_organization_id_scope_idx" ON "vault_entries"("organization_id", "scope");

-- CreateIndex
CREATE INDEX "vault_entries_organization_id_type_idx" ON "vault_entries"("organization_id", "type");

-- CreateIndex
CREATE INDEX "vault_entries_company_id_idx" ON "vault_entries"("company_id");

-- CreateIndex
CREATE INDEX "vault_entries_project_id_idx" ON "vault_entries"("project_id");

-- CreateIndex
CREATE INDEX "vault_entries_owner_membership_id_idx" ON "vault_entries"("owner_membership_id");

-- CreateIndex
CREATE INDEX "vault_entries_expires_at_idx" ON "vault_entries"("expires_at");

-- CreateIndex
CREATE INDEX "vault_entry_grants_membership_id_idx" ON "vault_entry_grants"("membership_id");

-- CreateIndex
CREATE INDEX "vault_entry_grants_portal_user_id_idx" ON "vault_entry_grants"("portal_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "vault_entry_grants_entry_id_membership_id_key" ON "vault_entry_grants"("entry_id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "vault_entry_grants_entry_id_team_id_key" ON "vault_entry_grants"("entry_id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "vault_entry_grants_entry_id_portal_user_id_key" ON "vault_entry_grants"("entry_id", "portal_user_id");

-- CreateIndex
CREATE INDEX "vault_access_logs_entry_id_created_at_idx" ON "vault_access_logs"("entry_id", "created_at");

-- CreateIndex
CREATE INDEX "vault_access_logs_organization_id_action_created_at_idx" ON "vault_access_logs"("organization_id", "action", "created_at");

-- CreateIndex
CREATE INDEX "vault_access_logs_actor_user_id_created_at_idx" ON "vault_access_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "time_activity_types_organization_id_archived_at_idx" ON "time_activity_types"("organization_id", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "time_activity_types_organization_id_slug_key" ON "time_activity_types"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "time_project_settings_contract_id_idx" ON "time_project_settings"("contract_id");

-- CreateIndex
CREATE INDEX "billing_rates_organization_id_kind_scope_effective_from_idx" ON "billing_rates"("organization_id", "kind", "scope", "effective_from");

-- CreateIndex
CREATE INDEX "billing_rates_project_id_membership_id_effective_from_idx" ON "billing_rates"("project_id", "membership_id", "effective_from");

-- CreateIndex
CREATE INDEX "billing_rates_membership_id_kind_effective_from_idx" ON "billing_rates"("membership_id", "kind", "effective_from");

-- CreateIndex
CREATE INDEX "billing_rates_product_id_idx" ON "billing_rates"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "time_entries_timer_id_key" ON "time_entries"("timer_id");

-- CreateIndex
CREATE INDEX "time_entries_organization_id_status_idx" ON "time_entries"("organization_id", "status");

-- CreateIndex
CREATE INDEX "time_entries_organization_id_date_idx" ON "time_entries"("organization_id", "date");

-- CreateIndex
CREATE INDEX "time_entries_membership_id_date_idx" ON "time_entries"("membership_id", "date");

-- CreateIndex
CREATE INDEX "time_entries_membership_id_status_idx" ON "time_entries"("membership_id", "status");

-- CreateIndex
CREATE INDEX "time_entries_project_id_date_idx" ON "time_entries"("project_id", "date");

-- CreateIndex
CREATE INDEX "time_entries_project_id_is_billable_status_idx" ON "time_entries"("project_id", "is_billable", "status");

-- CreateIndex
CREATE INDEX "time_entries_task_id_idx" ON "time_entries"("task_id");

-- CreateIndex
CREATE INDEX "time_entries_ticket_id_idx" ON "time_entries"("ticket_id");

-- CreateIndex
CREATE INDEX "time_entries_milestone_id_idx" ON "time_entries"("milestone_id");

-- CreateIndex
CREATE INDEX "time_entries_workstream_id_idx" ON "time_entries"("workstream_id");

-- CreateIndex
CREATE INDEX "time_entries_timesheet_id_idx" ON "time_entries"("timesheet_id");

-- CreateIndex
CREATE INDEX "time_entries_invoice_id_idx" ON "time_entries"("invoice_id");

-- CreateIndex
CREATE INDEX "time_entries_invoice_line_item_id_idx" ON "time_entries"("invoice_line_item_id");

-- CreateIndex
CREATE INDEX "time_entries_branch_id_date_idx" ON "time_entries"("branch_id", "date");

-- CreateIndex
CREATE INDEX "time_entries_activity_type_id_idx" ON "time_entries"("activity_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "time_entries_organization_id_import_job_id_external_ref_key" ON "time_entries"("organization_id", "import_job_id", "external_ref");

-- CreateIndex
CREATE INDEX "timers_organization_id_stopped_at_idx" ON "timers"("organization_id", "stopped_at");

-- CreateIndex
CREATE INDEX "timers_membership_id_stopped_at_idx" ON "timers"("membership_id", "stopped_at");

-- CreateIndex
CREATE INDEX "timers_task_id_stopped_at_idx" ON "timers"("task_id", "stopped_at");

-- CreateIndex
CREATE INDEX "timers_project_id_stopped_at_idx" ON "timers"("project_id", "stopped_at");

-- CreateIndex
CREATE INDEX "timers_ticket_id_idx" ON "timers"("ticket_id");

-- CreateIndex
CREATE INDEX "time_import_jobs_organization_id_status_idx" ON "time_import_jobs"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "time_suggestions_accepted_time_entry_id_key" ON "time_suggestions"("accepted_time_entry_id");

-- CreateIndex
CREATE INDEX "time_suggestions_membership_id_status_date_idx" ON "time_suggestions"("membership_id", "status", "date");

-- CreateIndex
CREATE INDEX "time_suggestions_organization_id_status_idx" ON "time_suggestions"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "time_suggestions_membership_id_source_external_ref_key" ON "time_suggestions"("membership_id", "source", "external_ref");

-- CreateIndex
CREATE INDEX "time_entry_adjustments_time_entry_id_idx" ON "time_entry_adjustments"("time_entry_id");

-- CreateIndex
CREATE INDEX "time_entry_adjustments_invoice_line_item_id_idx" ON "time_entry_adjustments"("invoice_line_item_id");

-- CreateIndex
CREATE INDEX "time_entry_adjustments_organization_id_type_created_at_idx" ON "time_entry_adjustments"("organization_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "timesheets_organization_id_status_idx" ON "timesheets"("organization_id", "status");

-- CreateIndex
CREATE INDEX "timesheets_organization_id_period_start_idx" ON "timesheets"("organization_id", "period_start");

-- CreateIndex
CREATE INDEX "timesheets_approver_membership_id_status_idx" ON "timesheets"("approver_membership_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "timesheets_membership_id_period_start_period_end_key" ON "timesheets"("membership_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "timesheet_actions_timesheet_id_created_at_idx" ON "timesheet_actions"("timesheet_id", "created_at");

-- CreateIndex
CREATE INDEX "time_utilization_periods_organization_id_period_start_idx" ON "time_utilization_periods"("organization_id", "period_start");

-- CreateIndex
CREATE INDEX "time_utilization_periods_branch_id_period_start_idx" ON "time_utilization_periods"("branch_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "time_utilization_periods_membership_id_period_start_period__key" ON "time_utilization_periods"("membership_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "calendar_event_types_organization_id_archived_at_idx" ON "calendar_event_types"("organization_id", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_types_organization_id_slug_key" ON "calendar_event_types"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_preferences_membership_id_key" ON "calendar_preferences"("membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendars_resource_id_key" ON "calendars"("resource_id");

-- CreateIndex
CREATE INDEX "calendars_organization_id_kind_idx" ON "calendars"("organization_id", "kind");

-- CreateIndex
CREATE INDEX "calendars_owner_membership_id_idx" ON "calendars"("owner_membership_id");

-- CreateIndex
CREATE INDEX "calendars_team_id_idx" ON "calendars"("team_id");

-- CreateIndex
CREATE INDEX "calendars_project_id_idx" ON "calendars"("project_id");

-- CreateIndex
CREATE INDEX "calendars_company_id_idx" ON "calendars"("company_id");

-- CreateIndex
CREATE INDEX "calendars_branch_id_idx" ON "calendars"("branch_id");

-- CreateIndex
CREATE INDEX "calendar_shares_membership_id_idx" ON "calendar_shares"("membership_id");

-- CreateIndex
CREATE INDEX "calendar_shares_team_id_idx" ON "calendar_shares"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_shares_calendar_id_membership_id_key" ON "calendar_shares"("calendar_id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_shares_calendar_id_team_id_key" ON "calendar_shares"("calendar_id", "team_id");

-- CreateIndex
CREATE INDEX "calendar_resources_organization_id_kind_idx" ON "calendar_resources"("organization_id", "kind");

-- CreateIndex
CREATE INDEX "calendar_resources_branch_id_idx" ON "calendar_resources"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_resources_organization_id_code_key" ON "calendar_resources"("organization_id", "code");

-- CreateIndex
CREATE INDEX "calendar_events_organization_id_starts_at_ends_at_idx" ON "calendar_events"("organization_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "calendar_events_calendar_id_starts_at_idx" ON "calendar_events"("calendar_id", "starts_at");

-- CreateIndex
CREATE INDEX "calendar_events_organization_id_status_idx" ON "calendar_events"("organization_id", "status");

-- CreateIndex
CREATE INDEX "calendar_events_organizer_membership_id_starts_at_idx" ON "calendar_events"("organizer_membership_id", "starts_at");

-- CreateIndex
CREATE INDEX "calendar_events_company_id_idx" ON "calendar_events"("company_id");

-- CreateIndex
CREATE INDEX "calendar_events_project_id_idx" ON "calendar_events"("project_id");

-- CreateIndex
CREATE INDEX "calendar_events_event_type_id_idx" ON "calendar_events"("event_type_id");

-- CreateIndex
CREATE INDEX "calendar_events_recurrence_ends_at_idx" ON "calendar_events"("recurrence_ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_organization_id_ical_uid_key" ON "calendar_events"("organization_id", "ical_uid");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_recurring_event_id_original_start_at_key" ON "calendar_events"("recurring_event_id", "original_start_at");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_attendees_response_token_key" ON "calendar_event_attendees"("response_token");

-- CreateIndex
CREATE INDEX "calendar_event_attendees_membership_id_response_idx" ON "calendar_event_attendees"("membership_id", "response");

-- CreateIndex
CREATE INDEX "calendar_event_attendees_user_id_idx" ON "calendar_event_attendees"("user_id");

-- CreateIndex
CREATE INDEX "calendar_event_attendees_contact_id_idx" ON "calendar_event_attendees"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_attendees_event_id_email_key" ON "calendar_event_attendees"("event_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_attendees_event_id_membership_id_key" ON "calendar_event_attendees"("event_id", "membership_id");

-- CreateIndex
CREATE INDEX "calendar_event_resources_resource_id_status_idx" ON "calendar_event_resources"("resource_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_resources_event_id_resource_id_key" ON "calendar_event_resources"("event_id", "resource_id");

-- CreateIndex
CREATE INDEX "calendar_event_reminders_scheduled_at_sent_at_idx" ON "calendar_event_reminders"("scheduled_at", "sent_at");

-- CreateIndex
CREATE INDEX "calendar_event_reminders_membership_id_idx" ON "calendar_event_reminders"("membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_reminders_event_id_membership_id_method_minu_key" ON "calendar_event_reminders"("event_id", "membership_id", "method", "minutes_before");

-- CreateIndex
CREATE INDEX "calendar_event_links_entity_type_entity_id_idx" ON "calendar_event_links"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_links_event_id_entity_type_entity_id_key" ON "calendar_event_links"("event_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "calendar_event_attachments_document_id_idx" ON "calendar_event_attachments"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_attachments_event_id_document_id_key" ON "calendar_event_attachments"("event_id", "document_id");

-- CreateIndex
CREATE INDEX "calendar_availability_schedules_organization_id_idx" ON "calendar_availability_schedules"("organization_id");

-- CreateIndex
CREATE INDEX "calendar_availability_schedules_membership_id_is_default_idx" ON "calendar_availability_schedules"("membership_id", "is_default");

-- CreateIndex
CREATE INDEX "calendar_availability_rules_schedule_id_weekday_idx" ON "calendar_availability_rules"("schedule_id", "weekday");

-- CreateIndex
CREATE INDEX "calendar_availability_overrides_schedule_id_date_idx" ON "calendar_availability_overrides"("schedule_id", "date");

-- CreateIndex
CREATE INDEX "booking_links_organization_id_status_idx" ON "booking_links"("organization_id", "status");

-- CreateIndex
CREATE INDEX "booking_links_owner_membership_id_idx" ON "booking_links"("owner_membership_id");

-- CreateIndex
CREATE INDEX "booking_links_company_id_idx" ON "booking_links"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_links_organization_id_slug_key" ON "booking_links"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "booking_link_hosts_membership_id_idx" ON "booking_link_hosts"("membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_link_hosts_booking_link_id_membership_id_key" ON "booking_link_hosts"("booking_link_id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_bookings_event_id_key" ON "calendar_bookings"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_bookings_manage_token_key" ON "calendar_bookings"("manage_token");

-- CreateIndex
CREATE INDEX "calendar_bookings_organization_id_status_starts_at_idx" ON "calendar_bookings"("organization_id", "status", "starts_at");

-- CreateIndex
CREATE INDEX "calendar_bookings_booking_link_id_starts_at_idx" ON "calendar_bookings"("booking_link_id", "starts_at");

-- CreateIndex
CREATE INDEX "calendar_bookings_host_membership_id_starts_at_idx" ON "calendar_bookings"("host_membership_id", "starts_at");

-- CreateIndex
CREATE INDEX "calendar_bookings_invitee_email_idx" ON "calendar_bookings"("invitee_email");

-- CreateIndex
CREATE INDEX "calendar_bookings_invitee_user_id_idx" ON "calendar_bookings"("invitee_user_id");

-- CreateIndex
CREATE INDEX "calendar_bookings_contact_id_idx" ON "calendar_bookings"("contact_id");

-- CreateIndex
CREATE INDEX "calendar_bookings_company_id_idx" ON "calendar_bookings"("company_id");

-- CreateIndex
CREATE INDEX "calendar_bookings_origin_entity_type_origin_entity_id_idx" ON "calendar_bookings"("origin_entity_type", "origin_entity_id");

-- CreateIndex
CREATE INDEX "calendar_connections_organization_id_status_idx" ON "calendar_connections"("organization_id", "status");

-- CreateIndex
CREATE INDEX "calendar_connections_membership_id_idx" ON "calendar_connections"("membership_id");

-- CreateIndex
CREATE INDEX "calendar_connections_watch_expires_at_idx" ON "calendar_connections"("watch_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_connections_organization_id_membership_id_provider_key" ON "calendar_connections"("organization_id", "membership_id", "provider", "external_account_id");

-- CreateIndex
CREATE INDEX "calendar_connection_calendars_calendar_id_idx" ON "calendar_connection_calendars"("calendar_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_connection_calendars_connection_id_external_id_key" ON "calendar_connection_calendars"("connection_id", "external_id");

-- CreateIndex
CREATE INDEX "calendar_event_sync_mappings_status_idx" ON "calendar_event_sync_mappings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_sync_mappings_connection_calendar_id_externa_key" ON "calendar_event_sync_mappings"("connection_calendar_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_sync_mappings_event_id_connection_calendar_i_key" ON "calendar_event_sync_mappings"("event_id", "connection_calendar_id");

-- CreateIndex
CREATE INDEX "calendar_sync_runs_connection_id_started_at_idx" ON "calendar_sync_runs"("connection_id", "started_at");

-- CreateIndex
CREATE INDEX "calendar_conferencing_accounts_organization_id_provider_idx" ON "calendar_conferencing_accounts"("organization_id", "provider");

-- CreateIndex
CREATE INDEX "calendar_conferencing_accounts_membership_id_idx" ON "calendar_conferencing_accounts"("membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_conferencing_accounts_organization_id_membership_i_key" ON "calendar_conferencing_accounts"("organization_id", "membership_id", "provider", "external_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_trigger_definitions_key_key" ON "automation_trigger_definitions"("key");

-- CreateIndex
CREATE INDEX "automation_trigger_definitions_module_is_active_idx" ON "automation_trigger_definitions"("module", "is_active");

-- CreateIndex
CREATE INDEX "automation_trigger_definitions_kind_idx" ON "automation_trigger_definitions"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "automation_action_definitions_key_key" ON "automation_action_definitions"("key");

-- CreateIndex
CREATE INDEX "automation_action_definitions_module_is_active_idx" ON "automation_action_definitions"("module", "is_active");

-- CreateIndex
CREATE INDEX "automation_action_definitions_kind_idx" ON "automation_action_definitions"("kind");

-- CreateIndex
CREATE INDEX "automation_rule_templates_module_is_published_idx" ON "automation_rule_templates"("module", "is_published");

-- CreateIndex
CREATE UNIQUE INDEX "automation_rule_templates_organization_id_key_key" ON "automation_rule_templates"("organization_id", "key");

-- CreateIndex
CREATE INDEX "automation_rules_organization_id_status_enabled_idx" ON "automation_rules"("organization_id", "status", "enabled");

-- CreateIndex
CREATE INDEX "automation_rules_organization_id_trigger_kind_trigger_key_idx" ON "automation_rules"("organization_id", "trigger_kind", "trigger_key");

-- CreateIndex
CREATE INDEX "automation_rules_organization_id_module_idx" ON "automation_rules"("organization_id", "module");

-- CreateIndex
CREATE INDEX "automation_rules_trigger_definition_id_idx" ON "automation_rules"("trigger_definition_id");

-- CreateIndex
CREATE INDEX "automation_rules_owner_membership_id_idx" ON "automation_rules"("owner_membership_id");

-- CreateIndex
CREATE INDEX "automation_rules_run_as_service_account_id_idx" ON "automation_rules"("run_as_service_account_id");

-- CreateIndex
CREATE INDEX "automation_rules_branch_id_idx" ON "automation_rules"("branch_id");

-- CreateIndex
CREATE INDEX "automation_rules_team_id_idx" ON "automation_rules"("team_id");

-- CreateIndex
CREATE INDEX "automation_rules_project_type_id_idx" ON "automation_rules"("project_type_id");

-- CreateIndex
CREATE INDEX "automation_rules_project_id_idx" ON "automation_rules"("project_id");

-- CreateIndex
CREATE INDEX "automation_rules_template_id_idx" ON "automation_rules"("template_id");

-- CreateIndex
CREATE INDEX "automation_rules_next_run_at_idx" ON "automation_rules"("next_run_at");

-- CreateIndex
CREATE INDEX "automation_rule_versions_author_membership_id_idx" ON "automation_rule_versions"("author_membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_rule_versions_rule_id_version_key" ON "automation_rule_versions"("rule_id", "version");

-- CreateIndex
CREATE INDEX "platform_events_organization_id_event_key_occurred_at_idx" ON "platform_events"("organization_id", "event_key", "occurred_at");

-- CreateIndex
CREATE INDEX "platform_events_organization_id_entity_type_entity_id_idx" ON "platform_events"("organization_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "platform_events_organization_id_processed_at_idx" ON "platform_events"("organization_id", "processed_at");

-- CreateIndex
CREATE INDEX "platform_events_event_key_occurred_at_idx" ON "platform_events"("event_key", "occurred_at");

-- CreateIndex
CREATE INDEX "platform_events_next_processing_at_idx" ON "platform_events"("next_processing_at");

-- CreateIndex
CREATE INDEX "platform_events_correlation_id_idx" ON "platform_events"("correlation_id");

-- CreateIndex
CREATE INDEX "platform_events_causation_run_id_idx" ON "platform_events"("causation_run_id");

-- CreateIndex
CREATE INDEX "platform_events_actor_user_id_idx" ON "platform_events"("actor_user_id");

-- CreateIndex
CREATE INDEX "platform_events_actor_membership_id_idx" ON "platform_events"("actor_membership_id");

-- CreateIndex
CREATE INDEX "platform_events_actor_service_account_id_idx" ON "platform_events"("actor_service_account_id");

-- CreateIndex
CREATE INDEX "platform_events_inbound_webhook_id_idx" ON "platform_events"("inbound_webhook_id");

-- CreateIndex
CREATE INDEX "platform_events_scheduled_job_run_id_idx" ON "platform_events"("scheduled_job_run_id");

-- CreateIndex
CREATE INDEX "platform_events_occurred_at_idx" ON "platform_events"("occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "platform_events_organization_id_dedupe_key_key" ON "platform_events"("organization_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "automation_runs_organization_id_status_created_at_idx" ON "automation_runs"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "automation_runs_organization_id_rule_id_created_at_idx" ON "automation_runs"("organization_id", "rule_id", "created_at");

-- CreateIndex
CREATE INDEX "automation_runs_organization_id_entity_type_entity_id_idx" ON "automation_runs"("organization_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "automation_runs_rule_version_id_idx" ON "automation_runs"("rule_version_id");

-- CreateIndex
CREATE INDEX "automation_runs_event_id_idx" ON "automation_runs"("event_id");

-- CreateIndex
CREATE INDEX "automation_runs_scheduled_job_run_id_idx" ON "automation_runs"("scheduled_job_run_id");

-- CreateIndex
CREATE INDEX "automation_runs_actor_membership_id_idx" ON "automation_runs"("actor_membership_id");

-- CreateIndex
CREATE INDEX "automation_runs_run_as_service_account_id_idx" ON "automation_runs"("run_as_service_account_id");

-- CreateIndex
CREATE INDEX "automation_runs_parent_run_id_idx" ON "automation_runs"("parent_run_id");

-- CreateIndex
CREATE INDEX "automation_runs_status_next_retry_at_idx" ON "automation_runs"("status", "next_retry_at");

-- CreateIndex
CREATE INDEX "automation_runs_status_wait_until_idx" ON "automation_runs"("status", "wait_until");

-- CreateIndex
CREATE INDEX "automation_runs_created_at_idx" ON "automation_runs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "automation_runs_rule_id_idempotency_key_key" ON "automation_runs"("rule_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "automation_run_steps_action_definition_id_idx" ON "automation_run_steps"("action_definition_id");

-- CreateIndex
CREATE INDEX "automation_run_steps_status_next_retry_at_idx" ON "automation_run_steps"("status", "next_retry_at");

-- CreateIndex
CREATE INDEX "automation_run_steps_status_wait_until_idx" ON "automation_run_steps"("status", "wait_until");

-- CreateIndex
CREATE UNIQUE INDEX "automation_run_steps_run_id_step_index_key" ON "automation_run_steps"("run_id", "step_index");

-- CreateIndex
CREATE UNIQUE INDEX "automation_approvals_step_id_key" ON "automation_approvals"("step_id");

-- CreateIndex
CREATE INDEX "automation_approvals_organization_id_decision_idx" ON "automation_approvals"("organization_id", "decision");

-- CreateIndex
CREATE INDEX "automation_approvals_run_id_idx" ON "automation_approvals"("run_id");

-- CreateIndex
CREATE INDEX "automation_approvals_requested_from_membership_id_decision_idx" ON "automation_approvals"("requested_from_membership_id", "decision");

-- CreateIndex
CREATE INDEX "automation_approvals_approver_membership_id_idx" ON "automation_approvals"("approver_membership_id");

-- CreateIndex
CREATE INDEX "automation_approvals_expires_at_idx" ON "automation_approvals"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "automation_ai_steps_step_id_key" ON "automation_ai_steps"("step_id");

-- CreateIndex
CREATE INDEX "automation_ai_steps_organization_id_kind_created_at_idx" ON "automation_ai_steps"("organization_id", "kind", "created_at");

-- CreateIndex
CREATE INDEX "automation_ai_steps_run_id_idx" ON "automation_ai_steps"("run_id");

-- CreateIndex
CREATE INDEX "automation_run_locks_run_id_idx" ON "automation_run_locks"("run_id");

-- CreateIndex
CREATE INDEX "automation_run_locks_rule_id_idx" ON "automation_run_locks"("rule_id");

-- CreateIndex
CREATE INDEX "automation_run_locks_expires_at_idx" ON "automation_run_locks"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "automation_run_locks_organization_id_lock_key_key" ON "automation_run_locks"("organization_id", "lock_key");

-- CreateIndex
CREATE INDEX "scheduled_jobs_status_next_run_at_idx" ON "scheduled_jobs"("status", "next_run_at");

-- CreateIndex
CREATE INDEX "scheduled_jobs_organization_id_module_idx" ON "scheduled_jobs"("organization_id", "module");

-- CreateIndex
CREATE INDEX "scheduled_jobs_rule_id_idx" ON "scheduled_jobs"("rule_id");

-- CreateIndex
CREATE INDEX "scheduled_jobs_branch_id_idx" ON "scheduled_jobs"("branch_id");

-- CreateIndex
CREATE INDEX "scheduled_jobs_lock_expires_at_idx" ON "scheduled_jobs"("lock_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_jobs_organization_id_module_key_key" ON "scheduled_jobs"("organization_id", "module", "key");

-- CreateIndex
CREATE INDEX "scheduled_job_runs_job_id_scheduled_for_idx" ON "scheduled_job_runs"("job_id", "scheduled_for");

-- CreateIndex
CREATE INDEX "scheduled_job_runs_organization_id_status_created_at_idx" ON "scheduled_job_runs"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "scheduled_job_runs_status_next_retry_at_idx" ON "scheduled_job_runs"("status", "next_retry_at");

-- CreateIndex
CREATE INDEX "scheduled_job_runs_triggered_by_membership_id_idx" ON "scheduled_job_runs"("triggered_by_membership_id");

-- CreateIndex
CREATE INDEX "outbound_webhooks_organization_id_status_idx" ON "outbound_webhooks"("organization_id", "status");

-- CreateIndex
CREATE INDEX "outbound_webhooks_created_by_membership_id_idx" ON "outbound_webhooks"("created_by_membership_id");

-- CreateIndex
CREATE INDEX "outbound_webhooks_channel_id_idx" ON "outbound_webhooks"("channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_deliveries_delivery_key_key" ON "webhook_deliveries"("delivery_key");

-- CreateIndex
CREATE INDEX "webhook_deliveries_webhook_id_created_at_idx" ON "webhook_deliveries"("webhook_id", "created_at");

-- CreateIndex
CREATE INDEX "webhook_deliveries_organization_id_status_created_at_idx" ON "webhook_deliveries"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "webhook_deliveries_event_id_idx" ON "webhook_deliveries"("event_id");

-- CreateIndex
CREATE INDEX "webhook_deliveries_run_step_id_idx" ON "webhook_deliveries"("run_step_id");

-- CreateIndex
CREATE INDEX "webhook_deliveries_status_next_retry_at_idx" ON "webhook_deliveries"("status", "next_retry_at");

-- CreateIndex
CREATE UNIQUE INDEX "automation_inbound_webhooks_slug_key" ON "automation_inbound_webhooks"("slug");

-- CreateIndex
CREATE INDEX "automation_inbound_webhooks_organization_id_status_idx" ON "automation_inbound_webhooks"("organization_id", "status");

-- CreateIndex
CREATE INDEX "automation_inbound_webhooks_rule_id_idx" ON "automation_inbound_webhooks"("rule_id");

-- CreateIndex
CREATE INDEX "automation_inbound_webhooks_created_by_membership_id_idx" ON "automation_inbound_webhooks"("created_by_membership_id");

-- CreateIndex
CREATE INDEX "invitations_organization_id_customer_id_idx" ON "invitations"("organization_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_current_version_id_key" ON "documents"("current_version_id");

-- CreateIndex
CREATE INDEX "documents_organization_id_status_idx" ON "documents"("organization_id", "status");

-- CreateIndex
CREATE INDEX "documents_organization_id_scope_idx" ON "documents"("organization_id", "scope");

-- CreateIndex
CREATE INDEX "documents_search_vector_idx" ON "documents" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "documents_organization_id_category_id_idx" ON "documents"("organization_id", "category_id");

-- CreateIndex
CREATE INDEX "documents_organization_id_created_at_idx" ON "documents"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "documents_folder_id_idx" ON "documents"("folder_id");

-- CreateIndex
CREATE INDEX "documents_project_id_idx" ON "documents"("project_id");

-- CreateIndex
CREATE INDEX "documents_company_id_idx" ON "documents"("company_id");

-- CreateIndex
CREATE INDEX "documents_branch_id_idx" ON "documents"("branch_id");

-- CreateIndex
CREATE INDEX "documents_team_id_idx" ON "documents"("team_id");

-- CreateIndex
CREATE INDEX "documents_employee_id_idx" ON "documents"("employee_id");

-- CreateIndex
CREATE INDEX "documents_entity_type_entity_id_idx" ON "documents"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "documents_owner_membership_id_idx" ON "documents"("owner_membership_id");

-- CreateIndex
CREATE INDEX "documents_retention_expires_at_idx" ON "documents"("retention_expires_at");

-- CreateIndex
CREATE INDEX "documents_deleted_at_idx" ON "documents"("deleted_at");

-- CreateIndex
CREATE INDEX "task_statuses_project_type_id_idx" ON "task_statuses"("project_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_statuses_organization_id_team_id_project_type_id_slug_key" ON "task_statuses"("organization_id", "team_id", "project_type_id", "slug");

-- CreateIndex
CREATE INDEX "tasks_search_vector_idx" ON "tasks" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "invoices_proposal_payment_schedule_item_id_idx" ON "invoices"("proposal_payment_schedule_item_id");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_calendar_event_id_fkey" FOREIGN KEY ("calendar_event_id") REFERENCES "calendar_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_automation_rule_id_fkey" FOREIGN KEY ("automation_rule_id") REFERENCES "automation_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_import_jobs" ADD CONSTRAINT "crm_import_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_pdf_document_id_fkey" FOREIGN KEY ("pdf_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_deliveries" ADD CONSTRAINT "proposal_deliveries_communication_id_fkey" FOREIGN KEY ("communication_id") REFERENCES "comm_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_signed_document_id_fkey" FOREIGN KEY ("signed_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_signed_document_id_fkey" FOREIGN KEY ("signed_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_audit_certificate_document_id_fkey" FOREIGN KEY ("audit_certificate_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_terminations" ADD CONSTRAINT "contract_terminations_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_runbook_page_id_fkey" FOREIGN KEY ("runbook_page_id") REFERENCES "wiki_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_issues" ADD CONSTRAINT "project_issues_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_decisions" ADD CONSTRAINT "project_decisions_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_decisions" ADD CONSTRAINT "project_decisions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deliverable_reviews" ADD CONSTRAINT "project_deliverable_reviews_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deliverable_reviews" ADD CONSTRAINT "project_deliverable_reviews_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "project_deliverables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deliverable_reviews" ADD CONSTRAINT "project_deliverable_reviews_reviewer_membership_id_fkey" FOREIGN KEY ("reviewer_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_status_update_comments" ADD CONSTRAINT "project_status_update_comments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_status_update_comments" ADD CONSTRAINT "project_status_update_comments_status_update_id_fkey" FOREIGN KEY ("status_update_id") REFERENCES "project_status_updates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_status_update_comments" ADD CONSTRAINT "project_status_update_comments_author_membership_id_fkey" FOREIGN KEY ("author_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_statuses" ADD CONSTRAINT "task_statuses_project_type_id_fkey" FOREIGN KEY ("project_type_id") REFERENCES "project_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_automation_rule_id_fkey" FOREIGN KEY ("automation_rule_id") REFERENCES "automation_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_status_history" ADD CONSTRAINT "task_status_history_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_status_history" ADD CONSTRAINT "task_status_history_from_status_id_fkey" FOREIGN KEY ("from_status_id") REFERENCES "task_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_status_history" ADD CONSTRAINT "task_status_history_to_status_id_fkey" FOREIGN KEY ("to_status_id") REFERENCES "task_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_notes_document_id_fkey" FOREIGN KEY ("notes_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_portal_profile_change_requests" ADD CONSTRAINT "customer_portal_profile_change_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_portal_profile_change_requests" ADD CONSTRAINT "customer_portal_profile_change_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_portal_profile_change_requests" ADD CONSTRAINT "customer_portal_profile_change_requests_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_portal_profile_change_requests" ADD CONSTRAINT "customer_portal_profile_change_requests_requested_by_user__fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_profiles" ADD CONSTRAINT "billing_profiles_dunning_policy_id_fkey" FOREIGN KEY ("dunning_policy_id") REFERENCES "dunning_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_templates" ADD CONSTRAINT "invoice_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "invoice_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_pdf_document_id_fkey" FOREIGN KEY ("pdf_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_proposal_payment_schedule_item_id_fkey" FOREIGN KEY ("proposal_payment_schedule_item_id") REFERENCES "proposal_payment_schedule_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_reminders" ADD CONSTRAINT "invoice_reminders_communication_id_fkey" FOREIGN KEY ("communication_id") REFERENCES "comm_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_receipt_document_id_fkey" FOREIGN KEY ("receipt_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_pdf_document_id_fkey" FOREIGN KEY ("pdf_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_provider_connections" ADD CONSTRAINT "payment_provider_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_settings" ADD CONSTRAINT "ledger_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_settings" ADD CONSTRAINT "ledger_settings_default_income_tax_rate_id_fkey" FOREIGN KEY ("default_income_tax_rate_id") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_settings" ADD CONSTRAINT "ledger_settings_default_expense_tax_rate_id_fkey" FOREIGN KEY ("default_expense_tax_rate_id") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_categories" ADD CONSTRAINT "ledger_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_categories" ADD CONSTRAINT "ledger_categories_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "ledger_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_categories" ADD CONSTRAINT "ledger_categories_default_tax_rate_id_fkey" FOREIGN KEY ("default_tax_rate_id") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_payment_methods" ADD CONSTRAINT "ledger_payment_methods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_supplier_profiles" ADD CONSTRAINT "ledger_supplier_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_supplier_profiles" ADD CONSTRAINT "ledger_supplier_profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_supplier_profiles" ADD CONSTRAINT "ledger_supplier_profiles_default_category_id_fkey" FOREIGN KEY ("default_category_id") REFERENCES "ledger_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_supplier_profiles" ADD CONSTRAINT "ledger_supplier_profiles_default_tax_rate_id_fkey" FOREIGN KEY ("default_tax_rate_id") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_records" ADD CONSTRAINT "ledger_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_records" ADD CONSTRAINT "ledger_records_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_records" ADD CONSTRAINT "ledger_records_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ledger_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_records" ADD CONSTRAINT "ledger_records_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "ledger_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_records" ADD CONSTRAINT "ledger_records_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "financial_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_records" ADD CONSTRAINT "ledger_records_tax_rate_id_fkey" FOREIGN KEY ("tax_rate_id") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_records" ADD CONSTRAINT "ledger_records_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "ledger_payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_records" ADD CONSTRAINT "ledger_records_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_records" ADD CONSTRAINT "ledger_records_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_records" ADD CONSTRAINT "ledger_records_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "project_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_records" ADD CONSTRAINT "ledger_records_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_records" ADD CONSTRAINT "ledger_records_origin_payment_id_fkey" FOREIGN KEY ("origin_payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_records" ADD CONSTRAINT "ledger_records_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_records" ADD CONSTRAINT "ledger_records_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_records" ADD CONSTRAINT "ledger_records_recurring_expense_id_fkey" FOREIGN KEY ("recurring_expense_id") REFERENCES "recurring_expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_records" ADD CONSTRAINT "ledger_records_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_records" ADD CONSTRAINT "ledger_records_approved_by_membership_id_fkey" FOREIGN KEY ("approved_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_records" ADD CONSTRAINT "ledger_records_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_settlements" ADD CONSTRAINT "ledger_settlements_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "ledger_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_settlements" ADD CONSTRAINT "ledger_settlements_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "ledger_payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_settlements" ADD CONSTRAINT "ledger_settlements_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_settlements" ADD CONSTRAINT "ledger_settlements_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_settlements" ADD CONSTRAINT "ledger_settlements_recorded_by_membership_id_fkey" FOREIGN KEY ("recorded_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_attachments" ADD CONSTRAINT "ledger_attachments_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "ledger_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_invoice_imports" ADD CONSTRAINT "ledger_invoice_imports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_invoice_imports" ADD CONSTRAINT "ledger_invoice_imports_matched_company_id_fkey" FOREIGN KEY ("matched_company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_invoice_imports" ADD CONSTRAINT "ledger_invoice_imports_suggested_category_id_fkey" FOREIGN KEY ("suggested_category_id") REFERENCES "ledger_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_invoice_imports" ADD CONSTRAINT "ledger_invoice_imports_ledger_record_id_fkey" FOREIGN KEY ("ledger_record_id") REFERENCES "ledger_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_invoice_imports" ADD CONSTRAINT "ledger_invoice_imports_duplicate_of_record_id_fkey" FOREIGN KEY ("duplicate_of_record_id") REFERENCES "ledger_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_invoice_imports" ADD CONSTRAINT "ledger_invoice_imports_duplicate_of_import_id_fkey" FOREIGN KEY ("duplicate_of_import_id") REFERENCES "ledger_invoice_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_invoice_imports" ADD CONSTRAINT "ledger_invoice_imports_uploaded_by_membership_id_fkey" FOREIGN KEY ("uploaded_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_invoice_imports" ADD CONSTRAINT "ledger_invoice_imports_reviewed_by_membership_id_fkey" FOREIGN KEY ("reviewed_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_invoice_import_lines" ADD CONSTRAINT "ledger_invoice_import_lines_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "ledger_invoice_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ledger_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "ledger_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "ledger_payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_tax_rate_id_fkey" FOREIGN KEY ("tax_rate_id") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_schedules" ADD CONSTRAINT "payroll_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_schedules" ADD CONSTRAINT "payroll_schedules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ledger_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_schedules" ADD CONSTRAINT "payroll_schedules_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "ledger_payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_schedules" ADD CONSTRAINT "payroll_schedules_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "payroll_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "financial_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "ledger_payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_ledger_record_id_fkey" FOREIGN KEY ("ledger_record_id") REFERENCES "ledger_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_approved_by_membership_id_fkey" FOREIGN KEY ("approved_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_closed_by_membership_id_fkey" FOREIGN KEY ("closed_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_period_summaries" ADD CONSTRAINT "financial_period_summaries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_period_summaries" ADD CONSTRAINT "financial_period_summaries_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "financial_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_period_summaries" ADD CONSTRAINT "financial_period_summaries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_period_summaries" ADD CONSTRAINT "financial_period_summaries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_period_summaries" ADD CONSTRAINT "financial_period_summaries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_profitability_snapshots" ADD CONSTRAINT "ledger_profitability_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_profitability_snapshots" ADD CONSTRAINT "ledger_profitability_snapshots_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_profitability_snapshots" ADD CONSTRAINT "ledger_profitability_snapshots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_profitability_snapshots" ADD CONSTRAINT "ledger_profitability_snapshots_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "financial_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_insights" ADD CONSTRAINT "ledger_insights_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_insights" ADD CONSTRAINT "ledger_insights_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "ledger_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_insights" ADD CONSTRAINT "ledger_insights_resolved_by_membership_id_fkey" FOREIGN KEY ("resolved_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_hr_settings" ADD CONSTRAINT "employee_hr_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_team_id_fkey" FOREIGN KEY ("department_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_primary_branch_id_fkey" FOREIGN KEY ("primary_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_employee_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_emergency_contacts" ADD CONSTRAINT "employee_emergency_contacts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_positions" ADD CONSTRAINT "employee_positions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_positions" ADD CONSTRAINT "employee_positions_manager_employee_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_positions" ADD CONSTRAINT "employee_positions_department_team_id_fkey" FOREIGN KEY ("department_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_positions" ADD CONSTRAINT "employee_positions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_compensations" ADD CONSTRAINT "employee_compensations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_compensation_components" ADD CONSTRAINT "employee_compensation_components_compensation_id_fkey" FOREIGN KEY ("compensation_id") REFERENCES "employee_compensations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_parent_skill_id_fkey" FOREIGN KEY ("parent_skill_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_certifications" ADD CONSTRAINT "employee_certifications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_certifications" ADD CONSTRAINT "employee_certifications_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_trainings" ADD CONSTRAINT "employee_trainings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_trainings" ADD CONSTRAINT "employee_trainings_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_languages" ADD CONSTRAINT "employee_languages_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_work_schedules" ADD CONSTRAINT "employee_work_schedules_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_work_schedule_days" ADD CONSTRAINT "employee_work_schedule_days_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "employee_work_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_availability_entries" ADD CONSTRAINT "employee_availability_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_availability_entries" ADD CONSTRAINT "employee_availability_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_availability_entries" ADD CONSTRAINT "employee_availability_entries_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_policies" ADD CONSTRAINT "leave_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_policies" ADD CONSTRAINT "leave_policies_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_policies" ADD CONSTRAINT "leave_policies_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_leave_policies" ADD CONSTRAINT "employee_leave_policies_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_leave_policies" ADD CONSTRAINT "employee_leave_policies_leave_policy_id_fkey" FOREIGN KEY ("leave_policy_id") REFERENCES "leave_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance_transactions" ADD CONSTRAINT "leave_balance_transactions_leave_balance_id_fkey" FOREIGN KEY ("leave_balance_id") REFERENCES "leave_balances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance_transactions" ADD CONSTRAINT "leave_balance_transactions_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_covering_employee_id_fkey" FOREIGN KEY ("covering_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_decided_by_membership_id_fkey" FOREIGN KEY ("decided_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_request_days" ADD CONSTRAINT "leave_request_days_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_request_approvals" ADD CONSTRAINT "leave_request_approvals_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_request_approvals" ADD CONSTRAINT "leave_request_approvals_approver_membership_id_fkey" FOREIGN KEY ("approver_membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_holidays" ADD CONSTRAINT "company_holidays_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_breaks" ADD CONSTRAINT "attendance_breaks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_summaries" ADD CONSTRAINT "attendance_summaries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_summaries" ADD CONSTRAINT "attendance_summaries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_capacity_periods" ADD CONSTRAINT "employee_capacity_periods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_capacity_periods" ADD CONSTRAINT "employee_capacity_periods_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_review_cycles" ADD CONSTRAINT "performance_review_cycles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "performance_review_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_reviewer_membership_id_fkey" FOREIGN KEY ("reviewer_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "performance_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_parent_goal_id_fkey" FOREIGN KEY ("parent_goal_id") REFERENCES "performance_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_goal_updates" ADD CONSTRAINT "performance_goal_updates_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "performance_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_feedback" ADD CONSTRAINT "performance_feedback_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_feedback" ADD CONSTRAINT "performance_feedback_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_feedback" ADD CONSTRAINT "performance_feedback_author_membership_id_fkey" FOREIGN KEY ("author_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_feedback" ADD CONSTRAINT "performance_feedback_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "performance_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_feedback" ADD CONSTRAINT "performance_feedback_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "performance_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_feedback" ADD CONSTRAINT "performance_feedback_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_improvement_plans" ADD CONSTRAINT "performance_improvement_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_improvement_plans" ADD CONSTRAINT "performance_improvement_plans_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_improvement_plans" ADD CONSTRAINT "performance_improvement_plans_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "performance_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_improvement_plan_items" ADD CONSTRAINT "performance_improvement_plan_items_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "performance_improvement_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_signature_request_id_fkey" FOREIGN KEY ("signature_request_id") REFERENCES "signature_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_hr_notes" ADD CONSTRAINT "employee_hr_notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_hr_notes" ADD CONSTRAINT "employee_hr_notes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_hr_notes" ADD CONSTRAINT "employee_hr_notes_author_membership_id_fkey" FOREIGN KEY ("author_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_profile_change_requests" ADD CONSTRAINT "employee_profile_change_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_profile_change_requests" ADD CONSTRAINT "employee_profile_change_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_provider_accounts" ADD CONSTRAINT "comm_provider_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_sender_domains" ADD CONSTRAINT "comm_sender_domains_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_sender_domains" ADD CONSTRAINT "comm_sender_domains_provider_account_id_fkey" FOREIGN KEY ("provider_account_id") REFERENCES "comm_provider_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_sender_identities" ADD CONSTRAINT "comm_sender_identities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_sender_identities" ADD CONSTRAINT "comm_sender_identities_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_sender_identities" ADD CONSTRAINT "comm_sender_identities_provider_account_id_fkey" FOREIGN KEY ("provider_account_id") REFERENCES "comm_provider_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_sender_identities" ADD CONSTRAINT "comm_sender_identities_sender_domain_id_fkey" FOREIGN KEY ("sender_domain_id") REFERENCES "comm_sender_domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_sender_identities" ADD CONSTRAINT "comm_sender_identities_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_signatures" ADD CONSTRAINT "comm_signatures_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_signatures" ADD CONSTRAINT "comm_signatures_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_templates" ADD CONSTRAINT "comm_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_templates" ADD CONSTRAINT "comm_templates_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_templates" ADD CONSTRAINT "comm_templates_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "comm_template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_templates" ADD CONSTRAINT "comm_templates_default_sender_identity_id_fkey" FOREIGN KEY ("default_sender_identity_id") REFERENCES "comm_sender_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_templates" ADD CONSTRAINT "comm_templates_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_template_versions" ADD CONSTRAINT "comm_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "comm_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_template_versions" ADD CONSTRAINT "comm_template_versions_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_template_translations" ADD CONSTRAINT "comm_template_translations_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "comm_template_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_threads" ADD CONSTRAINT "comm_threads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_threads" ADD CONSTRAINT "comm_threads_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_threads" ADD CONSTRAINT "comm_threads_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_threads" ADD CONSTRAINT "comm_threads_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_messages" ADD CONSTRAINT "comm_messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_messages" ADD CONSTRAINT "comm_messages_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_messages" ADD CONSTRAINT "comm_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "comm_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_messages" ADD CONSTRAINT "comm_messages_in_reply_to_message_id_fkey" FOREIGN KEY ("in_reply_to_message_id") REFERENCES "comm_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_messages" ADD CONSTRAINT "comm_messages_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "comm_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_messages" ADD CONSTRAINT "comm_messages_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "comm_template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_messages" ADD CONSTRAINT "comm_messages_sender_identity_id_fkey" FOREIGN KEY ("sender_identity_id") REFERENCES "comm_sender_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_messages" ADD CONSTRAINT "comm_messages_sent_by_membership_id_fkey" FOREIGN KEY ("sent_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_messages" ADD CONSTRAINT "comm_messages_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_messages" ADD CONSTRAINT "comm_messages_recipient_contact_id_fkey" FOREIGN KEY ("recipient_contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_messages" ADD CONSTRAINT "comm_messages_recipient_membership_id_fkey" FOREIGN KEY ("recipient_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_messages" ADD CONSTRAINT "comm_messages_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_messages" ADD CONSTRAINT "comm_messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_messages" ADD CONSTRAINT "comm_messages_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_messages" ADD CONSTRAINT "comm_messages_campaign_run_id_fkey" FOREIGN KEY ("campaign_run_id") REFERENCES "campaign_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_messages" ADD CONSTRAINT "comm_messages_provider_account_id_fkey" FOREIGN KEY ("provider_account_id") REFERENCES "comm_provider_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_messages" ADD CONSTRAINT "comm_messages_ai_generation_id_fkey" FOREIGN KEY ("ai_generation_id") REFERENCES "comm_ai_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_message_recipients" ADD CONSTRAINT "comm_message_recipients_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "comm_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_message_recipients" ADD CONSTRAINT "comm_message_recipients_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_message_recipients" ADD CONSTRAINT "comm_message_recipients_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_message_attachments" ADD CONSTRAINT "comm_message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "comm_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_message_links" ADD CONSTRAINT "comm_message_links_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "comm_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_delivery_events" ADD CONSTRAINT "comm_delivery_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_delivery_events" ADD CONSTRAINT "comm_delivery_events_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "comm_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_delivery_events" ADD CONSTRAINT "comm_delivery_events_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "comm_message_recipients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_delivery_events" ADD CONSTRAINT "comm_delivery_events_provider_webhook_event_id_fkey" FOREIGN KEY ("provider_webhook_event_id") REFERENCES "provider_webhook_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_delivery_events" ADD CONSTRAINT "comm_delivery_events_tracked_link_id_fkey" FOREIGN KEY ("tracked_link_id") REFERENCES "comm_tracked_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_tracked_links" ADD CONSTRAINT "comm_tracked_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_tracked_links" ADD CONSTRAINT "comm_tracked_links_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "comm_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_tracked_links" ADD CONSTRAINT "comm_tracked_links_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_recipient_lists" ADD CONSTRAINT "comm_recipient_lists_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_recipient_lists" ADD CONSTRAINT "comm_recipient_lists_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_recipient_list_members" ADD CONSTRAINT "comm_recipient_list_members_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "comm_recipient_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_recipient_list_members" ADD CONSTRAINT "comm_recipient_list_members_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_recipient_list_members" ADD CONSTRAINT "comm_recipient_list_members_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segments" ADD CONSTRAINT "segments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segments" ADD CONSTRAINT "segments_saved_view_id_fkey" FOREIGN KEY ("saved_view_id") REFERENCES "saved_views"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segments" ADD CONSTRAINT "segments_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_consents" ADD CONSTRAINT "comm_consents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_consents" ADD CONSTRAINT "comm_consents_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_suppressions" ADD CONSTRAINT "comm_suppressions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_suppressions" ADD CONSTRAINT "comm_suppressions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_suppressions" ADD CONSTRAINT "comm_suppressions_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "comm_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_suppressions" ADD CONSTRAINT "comm_suppressions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_duplicated_from_campaign_id_fkey" FOREIGN KEY ("duplicated_from_campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "comm_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "comm_template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_sender_identity_id_fkey" FOREIGN KEY ("sender_identity_id") REFERENCES "comm_sender_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_approved_by_membership_id_fkey" FOREIGN KEY ("approved_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_ai_generation_id_fkey" FOREIGN KEY ("ai_generation_id") REFERENCES "comm_ai_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_audiences" ADD CONSTRAINT "campaign_audiences_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_audiences" ADD CONSTRAINT "campaign_audiences_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "comm_recipient_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_audiences" ADD CONSTRAINT "campaign_audiences_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "campaign_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "comm_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_runs" ADD CONSTRAINT "campaign_runs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_approvals" ADD CONSTRAINT "campaign_approvals_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_approvals" ADD CONSTRAINT "campaign_approvals_approver_membership_id_fkey" FOREIGN KEY ("approver_membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_daily_stats" ADD CONSTRAINT "comm_daily_stats_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_daily_stats" ADD CONSTRAINT "comm_daily_stats_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_ai_generations" ADD CONSTRAINT "comm_ai_generations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_ai_generations" ADD CONSTRAINT "comm_ai_generations_requested_by_membership_id_fkey" FOREIGN KEY ("requested_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comm_ai_generations" ADD CONSTRAINT "comm_ai_generations_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "comm_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_settings" ADD CONSTRAINT "messaging_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_retention_policies" ADD CONSTRAINT "messaging_retention_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_retention_policies" ADD CONSTRAINT "messaging_retention_policies_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_retention_policies" ADD CONSTRAINT "messaging_retention_policies_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_templates" ADD CONSTRAINT "channel_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_retention_policy_id_fkey" FOREIGN KEY ("retention_policy_id") REFERENCES "messaging_retention_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "channel_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_external_user_id_fkey" FOREIGN KEY ("external_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_notification_settings" ADD CONSTRAINT "channel_notification_settings_channel_member_id_fkey" FOREIGN KEY ("channel_member_id") REFERENCES "channel_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_member_restrictions" ADD CONSTRAINT "channel_member_restrictions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_member_restrictions" ADD CONSTRAINT "channel_member_restrictions_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_member_restrictions" ADD CONSTRAINT "channel_member_restrictions_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_membership_id_fkey" FOREIGN KEY ("author_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "messaging_integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_parent_message_id_fkey" FOREIGN KEY ("parent_message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_quoted_message_id_fkey" FOREIGN KEY ("quoted_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_forwarded_from_message_id_fkey" FOREIGN KEY ("forwarded_from_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_versions" ADD CONSTRAINT "message_versions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_mentions" ADD CONSTRAINT "message_mentions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_mentions" ADD CONSTRAINT "message_mentions_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_mentions" ADD CONSTRAINT "message_mentions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_mentions" ADD CONSTRAINT "message_mentions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_mentions" ADD CONSTRAINT "message_mentions_mentioned_channel_id_fkey" FOREIGN KEY ("mentioned_channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_link_previews" ADD CONSTRAINT "message_link_previews_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_record_shares" ADD CONSTRAINT "message_record_shares_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_acknowledgements" ADD CONSTRAINT "message_acknowledgements_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_acknowledgements" ADD CONSTRAINT "message_acknowledgements_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_read_states" ADD CONSTRAINT "channel_read_states_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_read_states" ADD CONSTRAINT "channel_read_states_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_read_states" ADD CONSTRAINT "channel_read_states_last_read_message_id_fkey" FOREIGN KEY ("last_read_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_read_states" ADD CONSTRAINT "channel_read_states_marked_unread_from_id_fkey" FOREIGN KEY ("marked_unread_from_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_read_receipts" ADD CONSTRAINT "message_read_receipts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_read_receipts" ADD CONSTRAINT "message_read_receipts_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_thread_followers" ADD CONSTRAINT "message_thread_followers_root_message_id_fkey" FOREIGN KEY ("root_message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_thread_followers" ADD CONSTRAINT "message_thread_followers_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_pins" ADD CONSTRAINT "channel_pins_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_pins" ADD CONSTRAINT "channel_pins_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_pins" ADD CONSTRAINT "channel_pins_pinned_by_membership_id_fkey" FOREIGN KEY ("pinned_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_messages" ADD CONSTRAINT "saved_messages_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_messages" ADD CONSTRAINT "saved_messages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reminders" ADD CONSTRAINT "message_reminders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reminders" ADD CONSTRAINT "message_reminders_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reminders" ADD CONSTRAINT "message_reminders_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_drafts" ADD CONSTRAINT "message_drafts_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_drafts" ADD CONSTRAINT "message_drafts_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_drafts" ADD CONSTRAINT "message_drafts_thread_root_message_id_fkey" FOREIGN KEY ("thread_root_message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_keywords" ADD CONSTRAINT "messaging_keywords_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_keywords" ADD CONSTRAINT "messaging_keywords_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_sections" ADD CONSTRAINT "channel_sections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_sections" ADD CONSTRAINT "channel_sections_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_section_items" ADD CONSTRAINT "channel_section_items_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "channel_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_section_items" ADD CONSTRAINT "channel_section_items_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_presence" ADD CONSTRAINT "messaging_presence_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_presence" ADD CONSTRAINT "messaging_presence_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_member_settings" ADD CONSTRAINT "messaging_member_settings_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reports" ADD CONSTRAINT "message_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reports" ADD CONSTRAINT "message_reports_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reports" ADD CONSTRAINT "message_reports_reporter_membership_id_fkey" FOREIGN KEY ("reporter_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_export_jobs" ADD CONSTRAINT "messaging_export_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_export_jobs" ADD CONSTRAINT "messaging_export_jobs_requested_by_membership_id_fkey" FOREIGN KEY ("requested_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_integrations" ADD CONSTRAINT "messaging_integrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_integrations" ADD CONSTRAINT "messaging_integrations_default_channel_id_fkey" FOREIGN KEY ("default_channel_id") REFERENCES "channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_calls" ADD CONSTRAINT "channel_calls_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_calls" ADD CONSTRAINT "channel_calls_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_calls" ADD CONSTRAINT "channel_calls_started_by_membership_id_fkey" FOREIGN KEY ("started_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_calls" ADD CONSTRAINT "channel_calls_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_call_participants" ADD CONSTRAINT "channel_call_participants_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "channel_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_call_participants" ADD CONSTRAINT "channel_call_participants_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_usage_daily" ADD CONSTRAINT "messaging_usage_daily_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_usage_daily" ADD CONSTRAINT "messaging_usage_daily_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_settings" ADD CONSTRAINT "support_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_inboxes" ADD CONSTRAINT "support_inboxes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_inboxes" ADD CONSTRAINT "support_inboxes_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_inboxes" ADD CONSTRAINT "support_inboxes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_inboxes" ADD CONSTRAINT "support_inboxes_default_assignee_membership_id_fkey" FOREIGN KEY ("default_assignee_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_channels" ADD CONSTRAINT "support_channels_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_channels" ADD CONSTRAINT "support_channels_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "support_inboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "support_inboxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "support_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_assignee_membership_id_fkey" FOREIGN KEY ("assignee_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_merged_into_conversation_id_fkey" FOREIGN KEY ("merged_into_conversation_id") REFERENCES "support_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_split_from_conversation_id_fkey" FOREIGN KEY ("split_from_conversation_id") REFERENCES "support_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversation_participants" ADD CONSTRAINT "support_conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversation_participants" ADD CONSTRAINT "support_conversation_participants_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_author_membership_id_fkey" FOREIGN KEY ("author_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_canned_response_id_fkey" FOREIGN KEY ("canned_response_id") REFERENCES "support_canned_responses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ai_suggestion_id_fkey" FOREIGN KEY ("ai_suggestion_id") REFERENCES "support_ai_suggestions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_message_attachments" ADD CONSTRAINT "support_message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "support_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_statuses" ADD CONSTRAINT "ticket_statuses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "ticket_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_policy_targets" ADD CONSTRAINT "sla_policy_targets_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "sla_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "support_inboxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "support_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "ticket_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ticket_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_requester_contact_id_fkey" FOREIGN KEY ("requester_contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignee_membership_id_fkey" FOREIGN KEY ("assignee_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_change_request_id_fkey" FOREIGN KEY ("change_request_id") REFERENCES "project_change_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_sla_policy_id_fkey" FOREIGN KEY ("sla_policy_id") REFERENCES "sla_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_merged_into_ticket_id_fkey" FOREIGN KEY ("merged_into_ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "support_incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_conversations" ADD CONSTRAINT "ticket_conversations_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_conversations" ADD CONSTRAINT "ticket_conversations_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_status_history" ADD CONSTRAINT "ticket_status_history_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_status_history" ADD CONSTRAINT "ticket_status_history_from_status_id_fkey" FOREIGN KEY ("from_status_id") REFERENCES "ticket_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_status_history" ADD CONSTRAINT "ticket_status_history_to_status_id_fkey" FOREIGN KEY ("to_status_id") REFERENCES "ticket_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_sla_timers" ADD CONSTRAINT "ticket_sla_timers_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_sla_timers" ADD CONSTRAINT "ticket_sla_timers_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "sla_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_relations" ADD CONSTRAINT "ticket_relations_source_ticket_id_fkey" FOREIGN KEY ("source_ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_relations" ADD CONSTRAINT "ticket_relations_target_ticket_id_fkey" FOREIGN KEY ("target_ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_task_links" ADD CONSTRAINT "ticket_task_links_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_task_links" ADD CONSTRAINT "ticket_task_links_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_task_links" ADD CONSTRAINT "ticket_task_links_ai_suggestion_id_fkey" FOREIGN KEY ("ai_suggestion_id") REFERENCES "support_ai_suggestions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_followers" ADD CONSTRAINT "ticket_followers_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_followers" ADD CONSTRAINT "ticket_followers_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_incidents" ADD CONSTRAINT "support_incidents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_csat_ratings" ADD CONSTRAINT "support_csat_ratings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_csat_ratings" ADD CONSTRAINT "support_csat_ratings_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_csat_ratings" ADD CONSTRAINT "support_csat_ratings_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_csat_ratings" ADD CONSTRAINT "support_csat_ratings_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_csat_ratings" ADD CONSTRAINT "support_csat_ratings_rated_by_user_id_fkey" FOREIGN KEY ("rated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_csat_ratings" ADD CONSTRAINT "support_csat_ratings_agent_membership_id_fkey" FOREIGN KEY ("agent_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_canned_responses" ADD CONSTRAINT "support_canned_responses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_canned_responses" ADD CONSTRAINT "support_canned_responses_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_canned_responses" ADD CONSTRAINT "support_canned_responses_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_categories" ADD CONSTRAINT "knowledge_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_categories" ADD CONSTRAINT "knowledge_categories_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "knowledge_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "knowledge_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_author_membership_id_fkey" FOREIGN KEY ("author_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_source_ticket_id_fkey" FOREIGN KEY ("source_ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_article_versions" ADD CONSTRAINT "knowledge_article_versions_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_article_feedback" ADD CONSTRAINT "knowledge_article_feedback_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_article_feedback" ADD CONSTRAINT "knowledge_article_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ai_sessions" ADD CONSTRAINT "support_ai_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ai_sessions" ADD CONSTRAINT "support_ai_sessions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ai_sessions" ADD CONSTRAINT "support_ai_sessions_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ai_suggestions" ADD CONSTRAINT "support_ai_suggestions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ai_suggestions" ADD CONSTRAINT "support_ai_suggestions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ai_suggestions" ADD CONSTRAINT "support_ai_suggestions_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ai_suggestions" ADD CONSTRAINT "support_ai_suggestions_reviewed_by_membership_id_fkey" FOREIGN KEY ("reviewed_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_event_types" ADD CONSTRAINT "notification_event_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "notification_event_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_actor_membership_id_fkey" FOREIGN KEY ("actor_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "notification_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "notification_event_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_membership_id_fkey" FOREIGN KEY ("recipient_membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_portal_membership_id_fkey" FOREIGN KEY ("portal_membership_id") REFERENCES "customer_portal_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_membership_id_fkey" FOREIGN KEY ("actor_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_digest_id_fkey" FOREIGN KEY ("digest_id") REFERENCES "notification_digests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_push_device_id_fkey" FOREIGN KEY ("push_device_id") REFERENCES "notification_push_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "notification_event_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_org_settings" ADD CONSTRAINT "notification_org_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_org_defaults" ADD CONSTRAINT "notification_org_defaults_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_org_defaults" ADD CONSTRAINT "notification_org_defaults_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "notification_event_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipient_settings" ADD CONSTRAINT "notification_recipient_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipient_settings" ADD CONSTRAINT "notification_recipient_settings_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipient_settings" ADD CONSTRAINT "notification_recipient_settings_portal_membership_id_fkey" FOREIGN KEY ("portal_membership_id") REFERENCES "customer_portal_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_portal_membership_id_fkey" FOREIGN KEY ("portal_membership_id") REFERENCES "customer_portal_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "notification_event_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_keywords" ADD CONSTRAINT "notification_keywords_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_keywords" ADD CONSTRAINT "notification_keywords_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_digests" ADD CONSTRAINT "notification_digests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_digests" ADD CONSTRAINT "notification_digests_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_digests" ADD CONSTRAINT "notification_digests_portal_membership_id_fkey" FOREIGN KEY ("portal_membership_id") REFERENCES "customer_portal_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_push_devices" ADD CONSTRAINT "notification_push_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_delivery_rules" ADD CONSTRAINT "notification_delivery_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_delivery_rules" ADD CONSTRAINT "notification_delivery_rules_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "notification_event_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_spaces" ADD CONSTRAINT "wiki_spaces_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_spaces" ADD CONSTRAINT "wiki_spaces_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_spaces" ADD CONSTRAINT "wiki_spaces_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_spaces" ADD CONSTRAINT "wiki_spaces_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_spaces" ADD CONSTRAINT "wiki_spaces_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_spaces" ADD CONSTRAINT "wiki_spaces_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_space_members" ADD CONSTRAINT "wiki_space_members_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "wiki_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_space_members" ADD CONSTRAINT "wiki_space_members_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_templates" ADD CONSTRAINT "wiki_page_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_templates" ADD CONSTRAINT "wiki_page_templates_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "wiki_spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "wiki_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_parent_page_id_fkey" FOREIGN KEY ("parent_page_id") REFERENCES "wiki_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "wiki_page_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_reviewers" ADD CONSTRAINT "wiki_page_reviewers_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_reviewers" ADD CONSTRAINT "wiki_page_reviewers_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_versions" ADD CONSTRAINT "wiki_page_versions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_permissions" ADD CONSTRAINT "wiki_page_permissions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_links" ADD CONSTRAINT "wiki_page_links_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_attachments" ADD CONSTRAINT "wiki_page_attachments_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_comments" ADD CONSTRAINT "wiki_page_comments_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_comments" ADD CONSTRAINT "wiki_page_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "wiki_page_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_comments" ADD CONSTRAINT "wiki_page_comments_author_membership_id_fkey" FOREIGN KEY ("author_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_favorites" ADD CONSTRAINT "wiki_page_favorites_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_favorites" ADD CONSTRAINT "wiki_page_favorites_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_acknowledgements" ADD CONSTRAINT "wiki_page_acknowledgements_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_acknowledgements" ADD CONSTRAINT "wiki_page_acknowledgements_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_checklists" ADD CONSTRAINT "wiki_checklists_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_checklists" ADD CONSTRAINT "wiki_checklists_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_checklists" ADD CONSTRAINT "wiki_checklists_guide_page_id_fkey" FOREIGN KEY ("guide_page_id") REFERENCES "wiki_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_checklists" ADD CONSTRAINT "wiki_checklists_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_checklist_items" ADD CONSTRAINT "wiki_checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "wiki_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_checklist_items" ADD CONSTRAINT "wiki_checklist_items_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_checklist_items" ADD CONSTRAINT "wiki_checklist_items_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "custom_forms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_checklist_runs" ADD CONSTRAINT "wiki_checklist_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_checklist_runs" ADD CONSTRAINT "wiki_checklist_runs_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "wiki_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_checklist_runs" ADD CONSTRAINT "wiki_checklist_runs_subject_membership_id_fkey" FOREIGN KEY ("subject_membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_checklist_run_items" ADD CONSTRAINT "wiki_checklist_run_items_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "wiki_checklist_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_checklist_run_items" ADD CONSTRAINT "wiki_checklist_run_items_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "wiki_checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_checklist_run_items" ADD CONSTRAINT "wiki_checklist_run_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_forms" ADD CONSTRAINT "custom_forms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_forms" ADD CONSTRAINT "custom_forms_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "wiki_spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_forms" ADD CONSTRAINT "custom_forms_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_form_versions" ADD CONSTRAINT "custom_form_versions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "custom_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_assignments" ADD CONSTRAINT "form_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_assignments" ADD CONSTRAINT "form_assignments_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "custom_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_assignment_recipients" ADD CONSTRAINT "form_assignment_recipients_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "form_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_assignment_recipients" ADD CONSTRAINT "form_assignment_recipients_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_assignment_recipients" ADD CONSTRAINT "form_assignment_recipients_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "form_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "custom_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_version_id_fkey" FOREIGN KEY ("form_version_id") REFERENCES "custom_form_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_respondent_membership_id_fkey" FOREIGN KEY ("respondent_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_created_task_id_fkey" FOREIGN KEY ("created_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submission_files" ADD CONSTRAINT "form_submission_files_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "form_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_ai_index_entries" ADD CONSTRAINT "wiki_ai_index_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_ai_index_entries" ADD CONSTRAINT "wiki_ai_index_entries_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_ai_index_entries" ADD CONSTRAINT "wiki_ai_index_entries_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "custom_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_ai_index_entries" ADD CONSTRAINT "wiki_ai_index_entries_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "form_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_ai_index_entries" ADD CONSTRAINT "wiki_ai_index_entries_knowledge_article_id_fkey" FOREIGN KEY ("knowledge_article_id") REFERENCES "knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_ai_suggestions" ADD CONSTRAINT "wiki_ai_suggestions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_ai_suggestions" ADD CONSTRAINT "wiki_ai_suggestions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_ai_suggestions" ADD CONSTRAINT "wiki_ai_suggestions_related_page_id_fkey" FOREIGN KEY ("related_page_id") REFERENCES "wiki_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_settings" ADD CONSTRAINT "document_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_categories" ADD CONSTRAINT "document_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_categories" ADD CONSTRAINT "document_categories_default_retention_policy_id_fkey" FOREIGN KEY ("default_retention_policy_id") REFERENCES "document_retention_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_storage_connections" ADD CONSTRAINT "document_storage_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_retention_policies" ADD CONSTRAINT "document_retention_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_retention_policies" ADD CONSTRAINT "document_retention_policies_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "document_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_templates" ADD CONSTRAINT "folder_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_templates" ADD CONSTRAINT "folder_templates_project_type_id_fkey" FOREIGN KEY ("project_type_id") REFERENCES "project_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_folder_id_fkey" FOREIGN KEY ("parent_folder_id") REFERENCES "folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "folder_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "document_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_retention_policy_id_fkey" FOREIGN KEY ("retention_policy_id") REFERENCES "document_retention_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_storage_connection_id_fkey" FOREIGN KEY ("storage_connection_id") REFERENCES "document_storage_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_author_membership_id_fkey" FOREIGN KEY ("author_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_restored_from_version_id_fkey" FOREIGN KEY ("restored_from_version_id") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_upload_jobs" ADD CONSTRAINT "document_upload_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_upload_jobs" ADD CONSTRAINT "document_upload_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_upload_jobs" ADD CONSTRAINT "document_upload_jobs_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_upload_jobs" ADD CONSTRAINT "document_upload_jobs_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_upload_jobs" ADD CONSTRAINT "document_upload_jobs_initiated_by_membership_id_fkey" FOREIGN KEY ("initiated_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_previews" ADD CONSTRAINT "document_previews_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_favorites" ADD CONSTRAINT "document_favorites_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_favorites" ADD CONSTRAINT "document_favorites_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_favorites" ADD CONSTRAINT "document_favorites_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_recent_accesses" ADD CONSTRAINT "document_recent_accesses_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_recent_accesses" ADD CONSTRAINT "document_recent_accesses_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_shares" ADD CONSTRAINT "document_shares_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_shares" ADD CONSTRAINT "document_shares_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_shares" ADD CONSTRAINT "document_shares_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_shares" ADD CONSTRAINT "document_shares_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_shares" ADD CONSTRAINT "document_shares_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_shares" ADD CONSTRAINT "document_shares_portal_user_id_fkey" FOREIGN KEY ("portal_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_shares" ADD CONSTRAINT "document_shares_shared_by_membership_id_fkey" FOREIGN KEY ("shared_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_approvals" ADD CONSTRAINT "document_approvals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_approvals" ADD CONSTRAINT "document_approvals_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_approvals" ADD CONSTRAINT "document_approvals_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_approvals" ADD CONSTRAINT "document_approvals_requested_by_membership_id_fkey" FOREIGN KEY ("requested_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_approvers" ADD CONSTRAINT "document_approvers_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "document_approvals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_approvers" ADD CONSTRAINT "document_approvers_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_approvers" ADD CONSTRAINT "document_approvers_portal_user_id_fkey" FOREIGN KEY ("portal_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_deletion_requests" ADD CONSTRAINT "document_deletion_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_deletion_requests" ADD CONSTRAINT "document_deletion_requests_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_keys" ADD CONSTRAINT "vault_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_entries" ADD CONSTRAINT "vault_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_entries" ADD CONSTRAINT "vault_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_entries" ADD CONSTRAINT "vault_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_entries" ADD CONSTRAINT "vault_entries_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_entries" ADD CONSTRAINT "vault_entries_vault_key_id_fkey" FOREIGN KEY ("vault_key_id") REFERENCES "vault_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_entry_grants" ADD CONSTRAINT "vault_entry_grants_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "vault_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_entry_grants" ADD CONSTRAINT "vault_entry_grants_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_entry_grants" ADD CONSTRAINT "vault_entry_grants_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_entry_grants" ADD CONSTRAINT "vault_entry_grants_portal_user_id_fkey" FOREIGN KEY ("portal_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_access_logs" ADD CONSTRAINT "vault_access_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_access_logs" ADD CONSTRAINT "vault_access_logs_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "vault_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_access_logs" ADD CONSTRAINT "vault_access_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_access_logs" ADD CONSTRAINT "vault_access_logs_actor_membership_id_fkey" FOREIGN KEY ("actor_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_tracking_settings" ADD CONSTRAINT "time_tracking_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_tracking_settings" ADD CONSTRAINT "time_tracking_settings_default_approver_membership_id_fkey" FOREIGN KEY ("default_approver_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_activity_types" ADD CONSTRAINT "time_activity_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_project_settings" ADD CONSTRAINT "time_project_settings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_project_settings" ADD CONSTRAINT "time_project_settings_default_activity_type_id_fkey" FOREIGN KEY ("default_activity_type_id") REFERENCES "time_activity_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_project_settings" ADD CONSTRAINT "time_project_settings_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_project_settings" ADD CONSTRAINT "time_project_settings_approver_membership_id_fkey" FOREIGN KEY ("approver_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_rates" ADD CONSTRAINT "billing_rates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_rates" ADD CONSTRAINT "billing_rates_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_rates" ADD CONSTRAINT "billing_rates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_rates" ADD CONSTRAINT "billing_rates_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_rates" ADD CONSTRAINT "billing_rates_activity_type_id_fkey" FOREIGN KEY ("activity_type_id") REFERENCES "time_activity_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_rates" ADD CONSTRAINT "billing_rates_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_workstream_id_fkey" FOREIGN KEY ("workstream_id") REFERENCES "project_workstreams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "project_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_activity_type_id_fkey" FOREIGN KEY ("activity_type_id") REFERENCES "time_activity_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_billing_rate_id_fkey" FOREIGN KEY ("billing_rate_id") REFERENCES "billing_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_cost_rate_id_fkey" FOREIGN KEY ("cost_rate_id") REFERENCES "billing_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_timer_id_fkey" FOREIGN KEY ("timer_id") REFERENCES "timers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "time_import_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_timesheet_id_fkey" FOREIGN KEY ("timesheet_id") REFERENCES "timesheets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_approved_by_membership_id_fkey" FOREIGN KEY ("approved_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_rejected_by_membership_id_fkey" FOREIGN KEY ("rejected_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_locked_by_membership_id_fkey" FOREIGN KEY ("locked_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_unlocked_by_membership_id_fkey" FOREIGN KEY ("unlocked_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_invoice_line_item_id_fkey" FOREIGN KEY ("invoice_line_item_id") REFERENCES "invoice_line_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timers" ADD CONSTRAINT "timers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timers" ADD CONSTRAINT "timers_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timers" ADD CONSTRAINT "timers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timers" ADD CONSTRAINT "timers_workstream_id_fkey" FOREIGN KEY ("workstream_id") REFERENCES "project_workstreams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timers" ADD CONSTRAINT "timers_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "project_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timers" ADD CONSTRAINT "timers_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timers" ADD CONSTRAINT "timers_activity_type_id_fkey" FOREIGN KEY ("activity_type_id") REFERENCES "time_activity_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_import_jobs" ADD CONSTRAINT "time_import_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_import_jobs" ADD CONSTRAINT "time_import_jobs_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_suggestions" ADD CONSTRAINT "time_suggestions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_suggestions" ADD CONSTRAINT "time_suggestions_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_suggestions" ADD CONSTRAINT "time_suggestions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_suggestions" ADD CONSTRAINT "time_suggestions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_suggestions" ADD CONSTRAINT "time_suggestions_activity_type_id_fkey" FOREIGN KEY ("activity_type_id") REFERENCES "time_activity_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_suggestions" ADD CONSTRAINT "time_suggestions_accepted_time_entry_id_fkey" FOREIGN KEY ("accepted_time_entry_id") REFERENCES "time_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry_adjustments" ADD CONSTRAINT "time_entry_adjustments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry_adjustments" ADD CONSTRAINT "time_entry_adjustments_time_entry_id_fkey" FOREIGN KEY ("time_entry_id") REFERENCES "time_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry_adjustments" ADD CONSTRAINT "time_entry_adjustments_invoice_line_item_id_fkey" FOREIGN KEY ("invoice_line_item_id") REFERENCES "invoice_line_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry_adjustments" ADD CONSTRAINT "time_entry_adjustments_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_approver_membership_id_fkey" FOREIGN KEY ("approver_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_approved_by_membership_id_fkey" FOREIGN KEY ("approved_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_rejected_by_membership_id_fkey" FOREIGN KEY ("rejected_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_locked_by_membership_id_fkey" FOREIGN KEY ("locked_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_unlocked_by_membership_id_fkey" FOREIGN KEY ("unlocked_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_actions" ADD CONSTRAINT "timesheet_actions_timesheet_id_fkey" FOREIGN KEY ("timesheet_id") REFERENCES "timesheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_actions" ADD CONSTRAINT "timesheet_actions_actor_membership_id_fkey" FOREIGN KEY ("actor_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_utilization_periods" ADD CONSTRAINT "time_utilization_periods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_utilization_periods" ADD CONSTRAINT "time_utilization_periods_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_utilization_periods" ADD CONSTRAINT "time_utilization_periods_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_types" ADD CONSTRAINT "calendar_event_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_preferences" ADD CONSTRAINT "calendar_preferences_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_preferences" ADD CONSTRAINT "calendar_preferences_default_calendar_id_fkey" FOREIGN KEY ("default_calendar_id") REFERENCES "calendars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_preferences" ADD CONSTRAINT "calendar_preferences_availability_schedule_id_fkey" FOREIGN KEY ("availability_schedule_id") REFERENCES "calendar_availability_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "calendar_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_shares" ADD CONSTRAINT "calendar_shares_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_shares" ADD CONSTRAINT "calendar_shares_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_shares" ADD CONSTRAINT "calendar_shares_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_resources" ADD CONSTRAINT "calendar_resources_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_resources" ADD CONSTRAINT "calendar_resources_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "calendar_event_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_recurring_event_id_fkey" FOREIGN KEY ("recurring_event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_organizer_membership_id_fkey" FOREIGN KEY ("organizer_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_attendees" ADD CONSTRAINT "calendar_event_attendees_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_attendees" ADD CONSTRAINT "calendar_event_attendees_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_attendees" ADD CONSTRAINT "calendar_event_attendees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_attendees" ADD CONSTRAINT "calendar_event_attendees_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_resources" ADD CONSTRAINT "calendar_event_resources_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_resources" ADD CONSTRAINT "calendar_event_resources_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "calendar_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_reminders" ADD CONSTRAINT "calendar_event_reminders_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_reminders" ADD CONSTRAINT "calendar_event_reminders_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_links" ADD CONSTRAINT "calendar_event_links_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_attachments" ADD CONSTRAINT "calendar_event_attachments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_attachments" ADD CONSTRAINT "calendar_event_attachments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_availability_schedules" ADD CONSTRAINT "calendar_availability_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_availability_schedules" ADD CONSTRAINT "calendar_availability_schedules_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_availability_rules" ADD CONSTRAINT "calendar_availability_rules_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "calendar_availability_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_availability_overrides" ADD CONSTRAINT "calendar_availability_overrides_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "calendar_availability_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_links" ADD CONSTRAINT "booking_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_links" ADD CONSTRAINT "booking_links_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_links" ADD CONSTRAINT "booking_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_links" ADD CONSTRAINT "booking_links_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "calendar_event_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_links" ADD CONSTRAINT "booking_links_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "calendars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_links" ADD CONSTRAINT "booking_links_availability_schedule_id_fkey" FOREIGN KEY ("availability_schedule_id") REFERENCES "calendar_availability_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_links" ADD CONSTRAINT "booking_links_conferencing_account_id_fkey" FOREIGN KEY ("conferencing_account_id") REFERENCES "calendar_conferencing_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_link_hosts" ADD CONSTRAINT "booking_link_hosts_booking_link_id_fkey" FOREIGN KEY ("booking_link_id") REFERENCES "booking_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_link_hosts" ADD CONSTRAINT "booking_link_hosts_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_bookings" ADD CONSTRAINT "calendar_bookings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_bookings" ADD CONSTRAINT "calendar_bookings_booking_link_id_fkey" FOREIGN KEY ("booking_link_id") REFERENCES "booking_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_bookings" ADD CONSTRAINT "calendar_bookings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_bookings" ADD CONSTRAINT "calendar_bookings_host_membership_id_fkey" FOREIGN KEY ("host_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_bookings" ADD CONSTRAINT "calendar_bookings_invitee_user_id_fkey" FOREIGN KEY ("invitee_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_bookings" ADD CONSTRAINT "calendar_bookings_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_bookings" ADD CONSTRAINT "calendar_bookings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_bookings" ADD CONSTRAINT "calendar_bookings_rescheduled_from_booking_id_fkey" FOREIGN KEY ("rescheduled_from_booking_id") REFERENCES "calendar_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_connection_calendars" ADD CONSTRAINT "calendar_connection_calendars_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "calendar_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_connection_calendars" ADD CONSTRAINT "calendar_connection_calendars_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "calendars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_sync_mappings" ADD CONSTRAINT "calendar_event_sync_mappings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_sync_mappings" ADD CONSTRAINT "calendar_event_sync_mappings_connection_calendar_id_fkey" FOREIGN KEY ("connection_calendar_id") REFERENCES "calendar_connection_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_sync_runs" ADD CONSTRAINT "calendar_sync_runs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "calendar_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_conferencing_accounts" ADD CONSTRAINT "calendar_conferencing_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_conferencing_accounts" ADD CONSTRAINT "calendar_conferencing_accounts_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_settings" ADD CONSTRAINT "automation_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_settings" ADD CONSTRAINT "automation_settings_default_service_account_id_fkey" FOREIGN KEY ("default_service_account_id") REFERENCES "service_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rule_templates" ADD CONSTRAINT "automation_rule_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rule_templates" ADD CONSTRAINT "automation_rule_templates_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_trigger_definition_id_fkey" FOREIGN KEY ("trigger_definition_id") REFERENCES "automation_trigger_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_run_as_service_account_id_fkey" FOREIGN KEY ("run_as_service_account_id") REFERENCES "service_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_project_type_id_fkey" FOREIGN KEY ("project_type_id") REFERENCES "project_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "automation_rule_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_duplicated_from_rule_id_fkey" FOREIGN KEY ("duplicated_from_rule_id") REFERENCES "automation_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rule_versions" ADD CONSTRAINT "automation_rule_versions_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rule_versions" ADD CONSTRAINT "automation_rule_versions_author_membership_id_fkey" FOREIGN KEY ("author_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_events" ADD CONSTRAINT "platform_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_events" ADD CONSTRAINT "platform_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_events" ADD CONSTRAINT "platform_events_actor_membership_id_fkey" FOREIGN KEY ("actor_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_events" ADD CONSTRAINT "platform_events_actor_service_account_id_fkey" FOREIGN KEY ("actor_service_account_id") REFERENCES "service_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_events" ADD CONSTRAINT "platform_events_causation_run_id_fkey" FOREIGN KEY ("causation_run_id") REFERENCES "automation_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_events" ADD CONSTRAINT "platform_events_inbound_webhook_id_fkey" FOREIGN KEY ("inbound_webhook_id") REFERENCES "automation_inbound_webhooks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_events" ADD CONSTRAINT "platform_events_scheduled_job_run_id_fkey" FOREIGN KEY ("scheduled_job_run_id") REFERENCES "scheduled_job_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_rule_version_id_fkey" FOREIGN KEY ("rule_version_id") REFERENCES "automation_rule_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "platform_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_scheduled_job_run_id_fkey" FOREIGN KEY ("scheduled_job_run_id") REFERENCES "scheduled_job_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_actor_membership_id_fkey" FOREIGN KEY ("actor_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_run_as_service_account_id_fkey" FOREIGN KEY ("run_as_service_account_id") REFERENCES "service_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_parent_run_id_fkey" FOREIGN KEY ("parent_run_id") REFERENCES "automation_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_run_steps" ADD CONSTRAINT "automation_run_steps_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "automation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_run_steps" ADD CONSTRAINT "automation_run_steps_action_definition_id_fkey" FOREIGN KEY ("action_definition_id") REFERENCES "automation_action_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_approvals" ADD CONSTRAINT "automation_approvals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_approvals" ADD CONSTRAINT "automation_approvals_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "automation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_approvals" ADD CONSTRAINT "automation_approvals_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "automation_run_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_approvals" ADD CONSTRAINT "automation_approvals_requested_from_membership_id_fkey" FOREIGN KEY ("requested_from_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_approvals" ADD CONSTRAINT "automation_approvals_approver_membership_id_fkey" FOREIGN KEY ("approver_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_ai_steps" ADD CONSTRAINT "automation_ai_steps_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_ai_steps" ADD CONSTRAINT "automation_ai_steps_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "automation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_ai_steps" ADD CONSTRAINT "automation_ai_steps_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "automation_run_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_run_locks" ADD CONSTRAINT "automation_run_locks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_run_locks" ADD CONSTRAINT "automation_run_locks_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_run_locks" ADD CONSTRAINT "automation_run_locks_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "automation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_job_runs" ADD CONSTRAINT "scheduled_job_runs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "scheduled_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_job_runs" ADD CONSTRAINT "scheduled_job_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_job_runs" ADD CONSTRAINT "scheduled_job_runs_triggered_by_membership_id_fkey" FOREIGN KEY ("triggered_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_webhooks" ADD CONSTRAINT "outbound_webhooks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_webhooks" ADD CONSTRAINT "outbound_webhooks_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_webhooks" ADD CONSTRAINT "outbound_webhooks_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "outbound_webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "platform_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_run_step_id_fkey" FOREIGN KEY ("run_step_id") REFERENCES "automation_run_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_inbound_webhooks" ADD CONSTRAINT "automation_inbound_webhooks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_inbound_webhooks" ADD CONSTRAINT "automation_inbound_webhooks_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "automation_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_inbound_webhooks" ADD CONSTRAINT "automation_inbound_webhooks_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Full-text search vectors (search_vector tsvector + GIN index declared in the schema as Unsupported).
-- Maintained by triggers so the API never writes them (06 §6, 11 "Communication History", 12 §30, 13 §1/§6, 15 §7, 17 §11).
CREATE OR REPLACE FUNCTION fts_tasks() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.search_vector := to_tsvector('simple', coalesce(NEW.title,'') || ' ' || coalesce(NEW.description,'')); RETURN NEW; END $$;
CREATE TRIGGER tasks_fts BEFORE INSERT OR UPDATE OF title, description ON "tasks" FOR EACH ROW EXECUTE FUNCTION fts_tasks();
CREATE OR REPLACE FUNCTION fts_messages() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.search_vector := to_tsvector('simple', coalesce(NEW.body_plain, NEW.body, '')); RETURN NEW; END $$;
CREATE TRIGGER messages_fts BEFORE INSERT OR UPDATE OF body, body_plain ON "messages" FOR EACH ROW EXECUTE FUNCTION fts_messages();
CREATE OR REPLACE FUNCTION fts_documents() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.search_vector := to_tsvector('simple', coalesce(NEW.title,'') || ' ' || coalesce(NEW.description,'') || ' ' || coalesce(NEW.search_text,'')); RETURN NEW; END $$;
CREATE TRIGGER documents_fts BEFORE INSERT OR UPDATE OF title, description, search_text ON "documents" FOR EACH ROW EXECUTE FUNCTION fts_documents();
CREATE OR REPLACE FUNCTION fts_wiki_pages() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.search_vector := to_tsvector('simple', coalesce(NEW.title,'') || ' ' || coalesce(NEW.excerpt,'') || ' ' || coalesce(NEW.content_markdown,'')); RETURN NEW; END $$;
CREATE TRIGGER wiki_pages_fts BEFORE INSERT OR UPDATE OF title, excerpt, content_markdown ON "wiki_pages" FOR EACH ROW EXECUTE FUNCTION fts_wiki_pages();
CREATE OR REPLACE FUNCTION fts_knowledge_articles() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.search_vector := to_tsvector('simple', coalesce(NEW.title,'') || ' ' || coalesce(NEW.summary,'') || ' ' || coalesce(NEW.body,'')); RETURN NEW; END $$;
CREATE TRIGGER knowledge_articles_fts BEFORE INSERT OR UPDATE OF title, summary, body ON "knowledge_articles" FOR EACH ROW EXECUTE FUNCTION fts_knowledge_articles();
CREATE OR REPLACE FUNCTION fts_tickets() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.search_vector := to_tsvector('simple', coalesce(NEW.subject,'') || ' ' || coalesce(NEW.description,'')); RETURN NEW; END $$;
CREATE TRIGGER tickets_fts BEFORE INSERT OR UPDATE OF subject, description ON "tickets" FOR EACH ROW EXECUTE FUNCTION fts_tickets();
CREATE OR REPLACE FUNCTION fts_comm_messages() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.search_vector := to_tsvector('simple', coalesce(NEW.subject,'') || ' ' || coalesce(NEW.body_text,'')); RETURN NEW; END $$;
CREATE TRIGGER comm_messages_fts BEFORE INSERT OR UPDATE OF subject, body_text ON "comm_messages" FOR EACH ROW EXECUTE FUNCTION fts_comm_messages();
CREATE OR REPLACE FUNCTION fts_support_messages() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.search_vector := to_tsvector('simple', coalesce(NEW.body,'')); RETURN NEW; END $$;
CREATE TRIGGER support_messages_fts BEFORE INSERT OR UPDATE OF body ON "support_messages" FOR EACH ROW EXECUTE FUNCTION fts_support_messages();
