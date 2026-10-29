"use client";

import React, { useEffect, useMemo, useState } from "react";
import { classLabel } from "@/lib/classes";
import { useSchoolClasses } from "./SchoolClassesProvider";
import {
  callGrades,
  sectionsForGrade,
  deleteHealthRecord,
  gradeSectionLabel,
  groupHealthRecords,
  healthAccess,
  listHealthGrants,
  listHealthRecords,
  listStaffForCall,
  listStudentHints,
  saveHealthGrant,
  saveHealthRecord,
  selectionFromClassId,
  sessionCallRole,
  type CallRole,
  type HealthGrant,
  type HealthRecord,
  type StaffCallProfile,
  type StudentHint,
} from "@/lib/callHealth";

const fieldClass =
  "w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400";

const OWNER_ACTOR = "__owner__";

const emptyForm = {
  studentName: "",
  nationalId: "",
  gradeId: "3",
  sectionId: "a",
  conditionTitle: "",
  parentPhone: "",
  studentId: "",
  sample: false,
};

export default function HealthStatusDashboard({
  schoolId,
  currentUserId,
}: {
  schoolId: string;
  currentUserId: string;
}) {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [students, setStudents] = useState<StudentHint[]>([]);
  const [staff, setStaff] = useState<StaffCallProfile[]>([]);
  const [grants, setGrants] = useState<HealthGrant[]>([]);
  const [actorId, setActorId] = useState(OWNER_ACTOR);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const { options } = useSchoolClasses();
  const grades = callGrades();
  const sections = sectionsForGrade(form.gradeId);
  const sessionRole = sessionCallRole(currentUserId);
  const actor = staff.find((member) => member.id === actorId) ?? null;
  const actorRole: CallRole = actorId === OWNER_ACTOR ? sessionRole : actor?.callRole ?? "معلم";
  const actorGrant = actorId === OWNER_ACTOR ? null : grants.find((grant) => grant.staffId === actorId) ?? null;
  const access = healthAccess(actorRole, actorGrant);
  const showForm = access.add || (Boolean(editingId) && access.edit);

  const groups = useMemo(() => groupHealthRecords(records), [records]);

  const load = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const [healthRows, studentRows, staffRows, grantRows] = await Promise.all([
        listHealthRecords(schoolId),
        listStudentHints(schoolId),
        listStaffForCall(schoolId),
        listHealthGrants(schoolId),
      ]);
      setRecords(healthRows);
      setStudents(studentRows);
      setStaff(staffRows);
      setGrants(grantRows);
    } catch (error) {
      console.error(error);
      setErrorMsg("تعذر جلب الحالات الصحية.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (schoolId) load();
  }, [schoolId]);

  const applyStudent = (studentId: string) => {
    const student = students.find((item) => item.id === studentId);
    if (!student) {
      setForm((current) => ({ ...current, studentId: "" }));
      return;
    }
    const selection = selectionFromClassId(student.classId);
    setForm((current) => ({
      ...current,
      studentId: student.id,
      studentName: student.studentName,
      parentPhone: student.parentPhone || current.parentPhone,
      nationalId: student.nationalId || current.nationalId,
      gradeId: selection?.gradeId ?? current.gradeId,
      sectionId: selection?.sectionId ?? current.sectionId,
    }));
  };

  const startEdit = (record: HealthRecord) => {
    setEditingId(record.id);
    setForm({
      studentName: record.studentName,
      nationalId: record.nationalId,
      gradeId: record.gradeId || "3",
      sectionId: record.sectionId || "a",
      conditionTitle: record.conditionTitle,
      parentPhone: record.parentPhone,
      studentId: record.studentId,
      sample: record.sample,
    });
    setSuccessMsg("");
    setErrorMsg("");
  };

  const resetForm = () => {
    setEditingId("");
    setForm(emptyForm);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (editingId ? !access.edit : !access.add) {
      setErrorMsg("ليست لديك صلاحية حفظ هذا السجل.");
      return;
    }
    try {
      setSaving(true);
      setErrorMsg("");
      await saveHealthRecord(schoolId, form, editingId || undefined);
      setSuccessMsg(editingId ? "تم تحديث سجل الحالة الصحية." : "تم حفظ سجل الحالة الصحية.");
      resetForm();
      await load();
    } catch (error) {
      console.error(error);
      setErrorMsg(error instanceof Error ? error.message : "تعذر حفظ السجل.");
    } finally {
      setSaving(false);
    }
  };

  const grantFor = (staffId: string): HealthGrant =>
    grants.find((grant) => grant.staffId === staffId) ?? {
      staffId,
      canAdd: false,
      canEdit: false,
      canDelete: false,
    };

  const updateGrant = (staffId: string, patch: Partial<Pick<HealthGrant, "canAdd" | "canEdit" | "canDelete">>) => {
    setGrants((current) => {
      const existing = current.find((grant) => grant.staffId === staffId);
      if (!existing) return [...current, { staffId, canAdd: false, canEdit: false, canDelete: false, ...patch }];
      return current.map((grant) => (grant.staffId === staffId ? { ...grant, ...patch } : grant));
    });
  };

  const handleSaveGrant = async (staffId: string) => {
    try {
      setSaving(true);
      setErrorMsg("");
      await saveHealthGrant(schoolId, grantFor(staffId));
      setSuccessMsg("تم حفظ صلاحيات الموظف.");
    } catch (error) {
      console.error(error);
      setErrorMsg("تعذر حفظ الصلاحيات.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: HealthRecord) => {
    if (!access.remove) {
      setErrorMsg("الحذف متاح فقط لمن منحه مدير المدرسة هذه الصلاحية.");
      return;
    }
    try {
      setErrorMsg("");
      await deleteHealthRecord(schoolId, record.id);
      setPendingDeleteId("");
      if (editingId === record.id) resetForm();
      setSuccessMsg("تم حذف السجل.");
      await load();
    } catch (error) {
      console.error(error);
      setErrorMsg("تعذر حذف السجل.");
    }
  };

  return (
    <div
      className="bg-white shadow-lg rounded-2xl border border-rose-100 p-4 sm:p-6"
      dir="rtl"
      data-health-role={actorRole}
      data-health-view={access.view ? "yes" : "no"}
      data-health-add={access.add ? "yes" : "no"}
      data-health-edit={access.edit ? "yes" : "no"}
      data-health-delete={access.remove ? "yes" : "no"}
      data-health-grants={access.manageGrants ? "yes" : "no"}
    >
      <div className="border-b border-slate-100 pb-4 mb-6">
        <h2 className="rk-title text-slate-800">الحالات الصحية</h2>
        <p className="rk-lead text-slate-500">
          الحالات المزمنة مجمّعة حسب عنوان الحالة. الإدخال والتعديل للمرشد الطلابي، والاطلاع للوكيل والمدير، والحذف لمن يمنحه المدير.
        </p>
      </div>

      {sessionRole === "مدير" && (
        <label className="block mb-6 max-w-xl">
          <span className="rk-label">العمل بصفة</span>
          <select
            value={actorId}
            onChange={(event) => {
              setActorId(event.target.value);
              resetForm();
              setPendingDeleteId("");
            }}
            className={fieldClass}
            data-actor-role={actorRole}
          >
            <option value={OWNER_ACTOR}>مدير المدرسة (الحساب الحالي)</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName} — {member.callRole}
              </option>
            ))}
          </select>
        </label>
      )}

      {errorMsg && <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded-xl text-center font-medium">{errorMsg}</div>}
      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-center font-medium">{successMsg}</div>
      )}

      {access.manageGrants && (
        <section className="mb-8 border border-slate-200 rounded-2xl p-4 bg-slate-50" data-grant-panel="open">
          <h3 className="rk-section text-slate-800 mb-2">منح صلاحيات الحالات الصحية</h3>
          <p className="text-sm text-slate-500 mb-4">
            يختار مدير المدرسة موظفاً أو معلماً ويمنحه الإضافة أو التعديل أو الحذف. الحذف ليس صلاحية افتراضية للمرشد.
          </p>
          {staff.length === 0 ? (
            <p className="text-sm text-slate-500">أضف الموظفين من شاشة النداء الصوتي ثم عد لمنح الصلاحيات.</p>
          ) : (
            <div className="space-y-3">
              {staff.map((member) => {
                const grant = grantFor(member.id);
                return (
                  <div key={member.id} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col lg:flex-row lg:items-center gap-3" data-grant-staff={member.fullName}>
                    <p className="font-semibold text-slate-800 lg:w-56">
                      {member.fullName}
                      <span className="mr-2 text-xs font-medium text-slate-500">{member.callRole}</span>
                    </p>
                    <label className="text-sm text-slate-700 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={grant.canAdd}
                        onChange={(event) => updateGrant(member.id, { canAdd: event.target.checked })}
                      />
                      إضافة
                    </label>
                    <label className="text-sm text-slate-700 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={grant.canEdit}
                        onChange={(event) => updateGrant(member.id, { canEdit: event.target.checked })}
                      />
                      تعديل
                    </label>
                    <label className="text-sm text-slate-700 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={grant.canDelete}
                        data-grant-delete={member.fullName}
                        onChange={(event) => updateGrant(member.id, { canDelete: event.target.checked })}
                      />
                      حذف
                    </label>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveGrant(member.id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-60"
                    >
                      حفظ الصلاحية
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {showForm && (
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-8 bg-slate-50 border border-slate-200 p-4 rounded-2xl" data-health-form="open">
        <div className="xl:col-span-3">
          <h3 className="rk-section text-slate-800">{editingId ? "تعديل سجل الحالة الصحية" : "إضافة سجل حالة صحية"}</h3>
        </div>
        {students.length > 0 && (
          <label className="xl:col-span-3 block">
            <span className="rk-label">تعبئة من طالب مسجّل</span>
            <select
              value={form.studentId}
              onChange={(event) => applyStudent(event.target.value)}
              className={fieldClass}
            >
              <option value="">بدون ربط، أو اختر طالباً لتعبئة الاسم والجوال والصف</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.studentName}
                  {student.classId ? ` — ${options.find((item) => item.id === student.classId)?.label ?? classLabel(student.classId)}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span className="rk-label">اسم الطالب</span>
          <input
            value={form.studentName}
            onChange={(event) => setForm((current) => ({ ...current, studentName: event.target.value }))}
            className={fieldClass}
            required
          />
        </label>
        <label>
          <span className="rk-label">السجل المدني</span>
          <input
            value={form.nationalId}
            onChange={(event) => setForm((current) => ({ ...current, nationalId: event.target.value }))}
            className={fieldClass}
            inputMode="numeric"
            required
          />
        </label>
        <label>
          <span className="rk-label">الصف</span>
          <select
            value={form.gradeId}
            onChange={(event) => {
              const gradeId = event.target.value;
              const nextSections = sectionsForGrade(gradeId);
              setForm((current) => ({
                ...current,
                gradeId,
                sectionId: nextSections.some((section) => section.id === current.sectionId)
                  ? current.sectionId
                  : nextSections[0]?.id ?? "a",
              }));
            }}
            className={fieldClass}
          >
            {grades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="rk-label">الفصل</span>
          <select
            value={form.sectionId}
            onChange={(event) => setForm((current) => ({ ...current, sectionId: event.target.value }))}
            className={fieldClass}
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="rk-label">الحالة الصحية</span>
          <input
            value={form.conditionTitle}
            onChange={(event) => setForm((current) => ({ ...current, conditionTitle: event.target.value }))}
            className={fieldClass}
            placeholder="مثل: الربو"
            required
          />
        </label>
        <label>
          <span className="rk-label">جوال ولي الأمر</span>
          <input
            value={form.parentPhone}
            onChange={(event) => setForm((current) => ({ ...current, parentPhone: event.target.value }))}
            className={fieldClass}
            inputMode="tel"
            required
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600 md:col-span-2 xl:col-span-3">
          <input
            type="checkbox"
            checked={form.sample}
            onChange={(event) => setForm((current) => ({ ...current, sample: event.target.checked }))}
          />
          تعليم السجل كتجريبي
        </label>
        <div className="flex gap-2 md:col-span-2 xl:col-span-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm disabled:opacity-60"
          >
            {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديل" : "حفظ السجل"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="px-5 py-2.5 rounded-xl text-sm border border-slate-200 text-slate-600">
              إلغاء التعديل
            </button>
          )}
        </div>
      </form>
      )}

      {!access.view ? (
        <p className="text-center text-slate-500 rk-lead" data-health-locked="yes">
          ليست لديك صلاحية الاطلاع على صفحة الحالات الصحية.
        </p>
      ) : loading ? (
        <p className="text-center text-slate-500 rk-lead">جاري تحميل الحالات الصحية...</p>
      ) : groups.length === 0 ? (
        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3 text-right font-semibold">م</th>
                <th className="p-3 text-right font-semibold">اسم الطالب</th>
                <th className="p-3 text-right font-semibold">السجل المدني</th>
                <th className="p-3 text-right font-semibold">الصف والفصل</th>
                <th className="p-3 text-right font-semibold">الحالة الصحية</th>
                <th className="p-3 text-right font-semibold">جوال ولي الأمر</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-4 text-center text-slate-500" colSpan={6}>
                  لا توجد حالات صحية بعد.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.title}>
              <h3 className="rk-section text-slate-800 mb-3">{group.title}</h3>
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-sm min-w-[760px]">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-3 text-right font-semibold">م</th>
                      <th className="p-3 text-right font-semibold">اسم الطالب</th>
                      <th className="p-3 text-right font-semibold">السجل المدني</th>
                      <th className="p-3 text-right font-semibold">الصف والفصل</th>
                      <th className="p-3 text-right font-semibold">الحالة الصحية</th>
                      <th className="p-3 text-right font-semibold">جوال ولي الأمر</th>
                      {(access.edit || access.remove) && <th className="p-3 text-right font-semibold">إجراء</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((record, index) => (
                      <tr key={record.id} className="border-t border-slate-100">
                        <td className="p-3">{index + 1}</td>
                        <td className="p-3 font-medium text-slate-800">
                          {record.studentName}
                          {record.sample && (
                            <span className="mr-2 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                              تجريبي
                            </span>
                          )}
                        </td>
                        <td className="p-3">{record.nationalId}</td>
                        <td className="p-3">{gradeSectionLabel(record.gradeId, record.sectionId)}</td>
                        <td className="p-3">{record.conditionTitle}</td>
                        <td className="p-3" dir="ltr">{record.parentPhone}</td>
                        {(access.edit || access.remove) && (
                          <td className="p-3 whitespace-nowrap">
                            {access.edit && (
                              <button type="button" onClick={() => startEdit(record)} className="text-blue-700 font-semibold ml-3">
                                تعديل
                              </button>
                            )}
                            {access.remove && pendingDeleteId === record.id && (
                              <>
                                <button type="button" onClick={() => handleDelete(record)} className="text-rose-700 font-semibold ml-3">
                                  تأكيد الحذف
                                </button>
                                <button type="button" onClick={() => setPendingDeleteId("")} className="text-slate-500 font-semibold">
                                  إلغاء
                                </button>
                              </>
                            )}
                            {access.remove && pendingDeleteId !== record.id && (
                              <button type="button" onClick={() => setPendingDeleteId(record.id)} className="text-rose-600 font-semibold">
                                حذف
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
