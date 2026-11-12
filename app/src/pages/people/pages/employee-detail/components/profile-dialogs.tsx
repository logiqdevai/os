import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    useAddCompensation, useAddDocument, useAddEmergencyContact, useAddEquipment, useAddHrNote, useSetAvailability, useStartOffboarding,
} from "@/features/people/employees/hooks/use-employees";
import {
    compensationFormSchema, offboardingFormSchema, type CompensationFormValues, type OffboardingFormValues,
} from "@/features/people/employees/validation-schemas/employees.schema";
import type {
    AvailabilityStatus, DocumentCategory, EmployeeDetail, EquipmentType, HrNoteCategory, HrNoteVisibility, PayType,
} from "@/features/people/employees/interfaces/employees.interfaces";
import {
    AvailabilityFormOptions, DocumentCategoryFormOptions, EquipmentTypeFormOptions, HrNoteCategoryFormOptions, HrNoteVisibilityFormOptions, PayTypeFormOptions,
    TerminationKindFormOptions,
} from "@/config/constants/dropdowns/people/employee-form.options";

interface DialogProps {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    employee: EmployeeDetail;
}

const today = () => new Date().toISOString().slice(0, 10);

function SimpleSelect<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { id: T; label: string }[] }) {
    return (
        <div className="space-y-1.5">
            <Label>{label}</Label>
            <Select value={value} onValueChange={(v) => onChange(v as T)}>
                <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
                <SelectContent>{options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
        </div>
    );
}

/** Availability status (own via employees.profile.update_own, others via employees.availability.manage). */
export function AvailabilityDialog({ open, onOpenChange, employee }: DialogProps) {
    const mutation = useSetAvailability();
    const [status, setStatus] = useState<AvailabilityStatus>(employee.availability_status);
    const [note, setNote] = useState(employee.availability_note ?? "");
    useEffect(() => { if (open) { setStatus(employee.availability_status); setNote(employee.availability_note ?? ""); } }, [open, employee]);
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Set availability</DialogTitle><DialogDescription>Shown in the directory and to project managers.</DialogDescription></DialogHeader>
                <div className="space-y-4">
                    <SimpleSelect label="Status" value={status} onChange={setStatus} options={AvailabilityFormOptions} />
                    <div className="space-y-1.5"><Label htmlFor="av-note">Note</Label><Input id="av-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Back on Monday" maxLength={500} /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    {/* Optimistic: the availability badge changes at once, so the dialog closes right away. */}
                    <Button onClick={() => { mutation.mutate({ id: employee.id, status, note: note || undefined }); onOpenChange(false); }}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function OffboardingDialog({ open, onOpenChange, employee }: DialogProps) {
    const mutation = useStartOffboarding();
    const form = useForm<OffboardingFormValues>({ resolver: zodResolver(offboardingFormSchema), defaultValues: { termination_date: today(), termination_kind: "RESIGNATION", termination_reason: "", rehire_eligible: true } });
    useEffect(() => { if (open) form.reset({ termination_date: today(), termination_kind: "RESIGNATION", termination_reason: "", rehire_eligible: true }); }, [open, form]);
    const submit = form.handleSubmit((v) => mutation.mutate({ id: employee.id, ...v, termination_reason: v.termination_reason || undefined }, {
        onSuccess: () => onOpenChange(false),
    }));
    return (
        <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader><DialogTitle>Start offboarding {employee.name}</DialogTitle><DialogDescription>Sets the status to Offboarding. Completing it closes the position and compensation and cancels future leave.</DialogDescription></DialogHeader>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="termination_date" render={({ field }) => (
                                <FormItem><FormLabel>Last working day</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="termination_kind" render={({ field }) => (
                                <FormItem><FormLabel>Reason</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Reason"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{TerminationKindFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                                    <FormMessage /></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="termination_reason" render={({ field }) => (
                            <FormItem><FormLabel>Details</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="rehire_eligible" render={({ field }) => (
                            <FormItem className="flex items-center justify-between gap-3 rounded-md border border-border p-3"><FormLabel className="m-0">Eligible for rehire</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" variant="destructive" loading={mutation.isPending}>Start offboarding</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

export function CompensationDialog({ open, onOpenChange, employee }: DialogProps) {
    const mutation = useAddCompensation();
    const defaults: CompensationFormValues = { effective_from: today(), pay_type: "MONTHLY_SALARY", base_amount: "", currency: "EUR", cost_rate_hourly: "", contracted_weekly_hours: employee.weekly_capacity_hours ?? "40", reason: "" };
    const form = useForm<CompensationFormValues>({ resolver: zodResolver(compensationFormSchema), defaultValues: defaults });
    useEffect(() => { if (open) form.reset(defaults); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
    const submit = form.handleSubmit((v) => mutation.mutate({
        id: employee.id, effective_from: v.effective_from, employment_type: employee.employment_type, pay_type: v.pay_type as PayType, base_amount: Number(v.base_amount), currency: v.currency,
        cost_rate_hourly: v.cost_rate_hourly ? Number(v.cost_rate_hourly) : undefined, contracted_weekly_hours: v.contracted_weekly_hours ? Number(v.contracted_weekly_hours) : undefined, reason: v.reason || undefined,
    }, { onSuccess: () => onOpenChange(false) }));
    return (
        <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader><DialogTitle>New compensation</DialogTitle><DialogDescription>The current record ends the day before. The hourly cost rate is derived when left empty.</DialogDescription></DialogHeader>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="effective_from" render={({ field }) => (<FormItem><FormLabel>Effective from</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="pay_type" render={({ field }) => (
                                <FormItem><FormLabel>Pay type</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Pay type"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>{PayTypeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="base_amount" render={({ field }) => (<FormItem><FormLabel>Base amount</FormLabel><FormControl><Input type="number" min={0} step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="currency" render={({ field }) => (<FormItem><FormLabel>Currency</FormLabel><FormControl><Input maxLength={3} {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="contracted_weekly_hours" render={({ field }) => (<FormItem><FormLabel>Weekly hours</FormLabel><FormControl><Input type="number" min={0} max={80} {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="cost_rate_hourly" render={({ field }) => (<FormItem><FormLabel>Cost per hour</FormLabel><FormControl><Input type="number" min={0} step="0.01" placeholder="Derived" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <FormField control={form.control} name="reason" render={({ field }) => (<FormItem><FormLabel>Reason</FormLabel><FormControl><Input placeholder="Annual raise" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" loading={mutation.isPending}>Save</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

export function EquipmentDialog({ open, onOpenChange, employee }: DialogProps) {
    const mutation = useAddEquipment();
    const [type, setType] = useState<EquipmentType>("LAPTOP");
    const [name, setName] = useState("");
    const [serial, setSerial] = useState("");
    const [date, setDate] = useState(today());
    useEffect(() => { if (open) { setType("LAPTOP"); setName(""); setSerial(""); setDate(today()); } }, [open]);
    return (
        <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Assign equipment</DialogTitle><DialogDescription>Open items show up in offboarding until returned.</DialogDescription></DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                    <SimpleSelect label="Type" value={type} onChange={setType} options={EquipmentTypeFormOptions} />
                    <div className="space-y-1.5"><Label htmlFor="eq-date">Assigned on</Label><Input id="eq-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="eq-name">Name</Label><Input id="eq-name" value={name} onChange={(e) => setName(e.target.value)} placeholder='MacBook Pro 14"' /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="eq-serial">Serial number</Label><Input id="eq-serial" value={serial} onChange={(e) => setSerial(e.target.value)} /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button disabled={!name.trim()} loading={mutation.isPending} onClick={() => mutation.mutate({ id: employee.id, asset_type: type, name: name.trim(), serial_number: serial || undefined, assigned_on: date }, { onSuccess: () => onOpenChange(false) })}>Assign</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function DocumentDialog({ open, onOpenChange, employee }: DialogProps) {
    const mutation = useAddDocument();
    const [category, setCategory] = useState<DocumentCategory>("EMPLOYMENT_CONTRACT");
    const [title, setTitle] = useState("");
    const [due, setDue] = useState("");
    const [visible, setVisible] = useState(true);
    useEffect(() => { if (open) { setCategory("EMPLOYMENT_CONTRACT"); setTitle(""); setDue(""); setVisible(true); } }, [open]);
    return (
        <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Request a document</DialogTitle><DialogDescription>Adds the document to the HR file as Requested. The file itself is stored in Files.</DialogDescription></DialogHeader>
                <div className="space-y-4">
                    <SimpleSelect label="Category" value={category} onChange={setCategory} options={DocumentCategoryFormOptions} />
                    <div className="space-y-1.5"><Label htmlFor="doc-title">Title</Label><Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Signed employment contract" /></div>
                    <div className="space-y-1.5"><Label htmlFor="doc-due">Due date</Label><Input id="doc-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
                    <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3"><Label htmlFor="doc-visible" className="m-0">Visible to the employee</Label><Switch id="doc-visible" checked={visible} onCheckedChange={setVisible} /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button disabled={!title.trim()} loading={mutation.isPending} onClick={() => mutation.mutate({ id: employee.id, category, title: title.trim(), due_date: due || undefined, employee_visible: visible }, { onSuccess: () => onOpenChange(false) })}>Request</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function HrNoteDialog({ open, onOpenChange, employee }: DialogProps) {
    const mutation = useAddHrNote();
    const [category, setCategory] = useState<HrNoteCategory>("HR_COMMENT");
    const [visibility, setVisibility] = useState<HrNoteVisibility>("HR_AND_MANAGERS");
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    useEffect(() => { if (open) { setCategory("HR_COMMENT"); setVisibility("HR_AND_MANAGERS"); setTitle(""); setBody(""); } }, [open]);
    return (
        <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>Add HR note</DialogTitle><DialogDescription>Private notes with role-based visibility. Every change is audited.</DialogDescription></DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                    <SimpleSelect label="Category" value={category} onChange={setCategory} options={HrNoteCategoryFormOptions} />
                    <SimpleSelect label="Visibility" value={visibility} onChange={setVisibility} options={HrNoteVisibilityFormOptions} />
                    <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="note-title">Title</Label><Input id="note-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="note-body">Note</Label><Textarea id="note-body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button disabled={!body.trim()} loading={mutation.isPending} onClick={() => mutation.mutate({ id: employee.id, category, visibility, title: title || undefined, body: body.trim() }, { onSuccess: () => onOpenChange(false) })}>Add note</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function EmergencyContactDialog({ open, onOpenChange, employee }: DialogProps) {
    const mutation = useAddEmergencyContact();
    const [name, setName] = useState("");
    const [relationship, setRelationship] = useState("");
    const [phone, setPhone] = useState("");
    useEffect(() => { if (open) { setName(""); setRelationship(""); setPhone(""); } }, [open]);
    return (
        <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Add emergency contact</DialogTitle><DialogDescription>Personal data: visible to the employee and HR only.</DialogDescription></DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-1.5"><Label htmlFor="ec-name">Name</Label><Input id="ec-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label htmlFor="ec-rel">Relationship</Label><Input id="ec-rel" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="Partner" /></div>
                    <div className="space-y-1.5"><Label htmlFor="ec-phone">Phone</Label><Input id="ec-phone" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button disabled={!name.trim() || phone.trim().length < 3} loading={mutation.isPending} onClick={() => mutation.mutate({ id: employee.id, name: name.trim(), relationship: relationship || undefined, phone: phone.trim(), is_primary: !employee.emergency_contacts?.length }, { onSuccess: () => onOpenChange(false) })}>Add</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
