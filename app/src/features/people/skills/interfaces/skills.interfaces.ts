import type { AvailabilityStatus, Ref } from "@/features/people/employees/interfaces/employees.interfaces";

export type SkillCategory = "TECHNICAL" | "PROGRAMMING_LANGUAGE" | "FRAMEWORK" | "PLATFORM" | "TOOL" | "DOMAIN" | "SOFT_SKILL" | "OTHER";
export type SkillProficiency = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";

export interface Skill {
    id: string;
    name: string;
    slug: string;
    category: SkillCategory;
    description: string | null;
    archived_at: string | null;
    _count: { employees: number };
}

export interface EmployeeSkill {
    id: string;
    skill_id: string;
    proficiency: SkillProficiency;
    years_experience: string | null;
    is_primary: boolean;
    verified_at: string | null;
    skill: { id: string; name: string; category: SkillCategory };
}

export interface Certification {
    id: string;
    name: string;
    issuer: string | null;
    issued_on: string | null;
    expires_on: string | null;
    credential_url: string | null;
}

export interface SkillMatch {
    id: string;
    name: string;
    photo_url: string | null;
    job_title: string | null;
    department: Ref | null;
    availability_status: AvailabilityStatus;
    skills: EmployeeSkill[];
    certifications: { id: string; name: string; expires_on: string | null }[];
    matched: { skill_id: string; proficiency: SkillProficiency }[];
}
