"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSchoolClasses } from "./SchoolClassesProvider";
import { useArabicSpeech } from "./useArabicSpeech";
import {
  CALL_ROLES,
  addCallTeacher,
  classKey,
  classOptionLabel,
  gradeLabel,
  healthAccess,
  listClassAssignments,
  listHealthGrants,
  listHealthRecords,
  listStaffForCall,
  listTimetableLessons,
  matchSpokenGradeSection,
  matchSpokenTeacher,
  primaryTeacherForClass,
  saveStaffCallProfile,
  sectionLabel,
  sessionCallRole,
  speakArabic,
  teacherAssignedKeys,
  teacherTelHref,
  visibleHealthRecords,
  type CallRole,
  type ClassAssignment,
  type HealthGrant,
  type HealthRecord,
  type StaffCallProfile,
} from "@/lib/callHealth";
import { teacherLessonsNow, type TimetableLesson } from "@/lib/schoolBell";
import { classLabel } from "@/lib/classes";

const fieldClass =
  "w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400";

const OWNER_VIEW = "__owner__";

type ListenMode = "teacher" | "class";

interface CallAnswer {
  mode: ListenMode | "mine";
  caption: string;
  title: string;
  detail: string;
  phoneName: string;
  phone: string;
  phoneOn: "caption" | "title" | "none";
  gradeId: string;
  sectionId: string;
}

export default function VoiceCallDashboard({
  schoolId,
  currentUserId,
}: {
  schoolId: string;
  currentUserId: string;
}) {
  const [staff, setStaff] = useState<StaffCallProfile[]>([]);
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);
  const [lessons, setLessons] = useState<TimetableLesson[]>([]);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [grants, setGrants] = useState<HealthGrant[]>([]);
  const [viewerId, setViewerId] = useState(OWNER_VIEW);
  const [teacherNameDraft, setTeacherNameDraft] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<CallRole>("معلم");
  const [typedQuery, setTypedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingStaff, setSavingStaff] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [spokenPhrase, setSpokenPhrase] = useState("");
  const [speechInvoked, setSpeechInvoked] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [engaged, setEngaged] = useState<ListenMode | null>(null);
  const [listenMode, setListenMode] = useState<ListenMode>("class");
  const [answer, setAnswer] = useState<CallAnswer | null>(null);
  const speech = useArabicSpeech();

  const { options } = useSchoolClasses();
  const sessionRole = sessionCallRole(currentUserId);

  const load = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const [staffRows, assignmentRows, healthRows, grantRows, lessonRows] = await Promise.all([
        listStaffForCall(schoolId),
        listClassAssignments(schoolId),
        listHealthRecords(schoolId),
        listHealthGrants(schoolId),
        listTimetableLessons(schoolId),
      ]);
      setStaff(staffRows);
      setAssignments(assignmentRows);
      setLessons(lessonRows);
      setRecords(healthRows);
      setGrants(grantRows);
    } catch (error) {
      console.error(error);
      setErrorMsg("تعذر جلب بيانات النداء.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (schoolId) load();
  }, [schoolId]);

  const viewerStaff = staff.find((item) => item.id === viewerId) ?? null;
  const viewerRole: CallRole = viewerId === OWNER_VIEW ? sessionRole : viewerStaff?.callRole ?? "معلم";
  const viewerGrant = viewerId === OWNER_VIEW ? null : grants.find((grant) => grant.staffId === viewerId) ?? null;
  const viewerAccess = healthAccess(viewerRole, viewerGrant);
  const filterTeacher = viewerAccess.callNames === "assigned" ? viewerStaff : null;
  const assignedKeys = filterTeacher
    ? teacherAssignedKeys(filterTeacher.id, filterTeacher.assignedClassIds, assignments, filterTeacher.fullName)
    : [];

  const healthMatches = useMemo(() => {
    if (!healthOpen || answer?.mode !== "class" || !answer.gradeId || !answer.sectionId) return [];
    return visibleHealthRecords({
      records,
      gradeId: answer.gradeId,
      sectionId: answer.sectionId,
      callNames: viewerAccess.callNames,
      assignedKeys,
    });
  }, [healthOpen, answer, records, viewerAccess.callNames, assignedKeys]);

  const updateStaff = (staffId: string, patch: Partial<Pick<StaffCallProfile, "callRole" | "assignedClassIds" | "phone">>) => {
    setStaff((current) => current.map((item) => (item.id === staffId ? { ...item, ...patch } : item)));
  };

  const handleSaveStaff = async (member: StaffCallProfile) => {
    try {
      setSavingStaff(true);
      setErrorMsg("");
      await saveStaffCallProfile(schoolId, member.id, {
        callRole: member.callRole,
        assignedClassIds: member.assignedClassIds,
        phone: member.phone,
      });
      setSuccessMsg(`تم حفظ دور ${member.fullName} وإسناد فصوله.`);
    } catch (error) {
      console.error(error);
      setErrorMsg("تعذر حفظ دور المعلم.");
    } finally {
      setSavingStaff(false);
    }
  };

  const handleAddTeacher = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSavingStaff(true);
      setErrorMsg("");
      await addCallTeacher(schoolId, teacherNameDraft, newStaffRole);
      setTeacherNameDraft("");
      setSuccessMsg("تمت إضافة المعلم إلى الكادر.");
      await load();
    } catch (error) {
      console.error(error);
      setErrorMsg(error instanceof Error ? error.message : "تعذر إضافة المعلم.");
    } finally {
      setSavingStaff(false);
    }
  };

  const announce = (phrase: string) => {
    setSpokenPhrase(phrase);
    setSpeaking(true);
    setSpeechInvoked(true);
    try {
      speakArabic(phrase);
    } catch (error) {
      console.error(error);
      setSpeaking(false);
      setErrorMsg(error instanceof Error ? error.message : "تعذر تشغيل النداء الصوتي.");
    }
  };

  const resolveQuery = (mode: ListenMode, candidates: string[]) => {
    setErrorMsg("");
    speech.setError("");
    if (mode === "teacher") {
      const teacher = candidates.map((text) => matchSpokenTeacher(text, staff)).find(Boolean) ?? null;
      if (!teacher) {
        setAnswer(null);
        setErrorMsg("لم يُعثر على معلم بهذا الاسم.");
        return;
      }
      const classes = teacherAssignedKeys(teacher.id, teacher.assignedClassIds, assignments, teacher.fullName);
      const classText = classes.length > 0 ? classes.map((classId) => classOptionLabel(classId)).join(" ، ") : "بدون فصل ظاهر في الإسناد";
      setHealthOpen(false);
      setAnswer({
        mode: "teacher",
        caption: teacher.fullName,
        title: classText,
        detail: "",
        phoneName: teacher.fullName,
        phone: teacher.phone,
        phoneOn: "caption",
        gradeId: "",
        sectionId: "",
      });
      announce(`نداء للمعلم ${teacher.fullName}، ${classText}.`);
      return;
    }

    const found = candidates.map((text) => matchSpokenGradeSection(text)).find(Boolean) ?? null;
    if (!found) {
      setAnswer(null);
      setErrorMsg("لم يُعثر على هذا الصف والفصل. مثال: الثالث ب");
      return;
    }
    const teacher = primaryTeacherForClass(found.classId, assignments, staff);
    setHealthOpen(false);
    setAnswer({
      mode: "class",
      caption: found.label,
      title: teacher?.name || "لا يوجد معلم مسند لهذا الفصل",
      detail: "",
      phoneName: teacher?.name || "",
      phone: teacher?.phone || "",
      phoneOn: "title",
      gradeId: found.gradeId,
      sectionId: found.sectionId,
    });
    announce(
      teacher
        ? `نداء إلى ${found.label}، المعلم ${teacher.name}.`
        : `نداء إلى ${found.label}.`
    );
  };

  const startCall = (mode: ListenMode) => {
    setListenMode(mode);
    if (engaged === mode) {
      speech.stop();
      setEngaged(null);
      return;
    }
    setEngaged(mode);
    setErrorMsg("");
    speech.start((text, alternatives) => {
      setEngaged(null);
      resolveQuery(mode, [text, ...alternatives]);
    });
  };

  const handleTyped = (event: React.FormEvent) => {
    event.preventDefault();
    resolveQuery(engaged ?? listenMode, [typedQuery]);
    setEngaged(null);
    speech.stop();
  };

  const handleMyLesson = () => {
    speech.stop();
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setSpeechInvoked(false);
    setSpokenPhrase("");
    setEngaged(null);
    setHealthOpen(false);
    if (!viewerStaff || viewerStaff.callRole !== "معلم") {
      setAnswer(null);
      setErrorMsg("زر حصتي خاص بالمعلم. اختر المعلم من القائمة.");
      return;
    }
    setErrorMsg("");
    const nowLessons = teacherLessonsNow(viewerStaff, lessons);
    if (nowLessons.length === 0) {
      setAnswer({
        mode: "mine",
        caption: viewerStaff.fullName,
        title: "ليس لديك حصة الآن",
        detail: "",
        phoneName: "",
        phone: "",
        phoneOn: "none",
        gradeId: "",
        sectionId: "",
      });
      return;
    }
    const places = nowLessons.map((lesson) => {
      const place = classLabel(lesson.classId);
      const subject = lesson.subjectName ? ` — ${lesson.subjectName}` : "";
      return `${place}${subject}، الحصة ${lesson.periodNumber}`;
    });
    setAnswer({
      mode: "mine",
      caption: viewerStaff.fullName,
      title: places[0],
      detail: places.slice(1).join(" · "),
      phoneName: "",
      phone: "",
      phoneOn: "none",
      gradeId: "",
      sectionId: "",
    });
  };

  const handleHealth = () => {
    if (answer?.mode !== "class") {
      setHealthOpen(false);
      setErrorMsg("ابدأ النداء بالصف والفصل أولاً، ثم اضغط الحالات الصحية.");
      return;
    }
    setErrorMsg("");
    setHealthOpen(true);
  };

  const listeningHint = engaged
    ? speech.interim
      ? `سمعت: ${speech.interim}`
      : engaged === "class"
        ? "انطق الصف والفصل"
        : "انطق اسم المعلم"
    : speech.error;

  return (
    <div className="bg-white shadow-lg rounded-2xl border border-rose-100 p-4 sm:p-6" dir="rtl">
      <div className="border-b border-slate-100 pb-4 mb-6">
        <h2 className="rk-title text-slate-800">النداء الصوتي</h2>
        <p className="rk-lead text-slate-500">نداء المعلم أو الصف والفصل، ثم الحالات الصحية أسفل الجواب.</p>
      </div>

      {errorMsg && <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded-xl text-center font-medium">{errorMsg}</div>}
      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-center font-medium">{successMsg}</div>
      )}

      {loading ? (
        <p className="text-center text-slate-500 rk-lead">جاري تجهيز النداء...</p>
      ) : (
        <>
          <div className="rk-call-pad mb-4" data-call-pad="true">
            <div className="rk-call-key rk-call-key-brand flex flex-col items-center justify-center">
              <span className="text-xs tracking-widest" dir="ltr">
                RAKEEZ
              </span>
              <span>ركيز</span>
            </div>
            <button
              type="button"
              className="rk-call-key"
              data-sunk={engaged === "teacher" ? "true" : "false"}
              aria-pressed={engaged === "teacher"}
              onClick={() => startCall("teacher")}
            >
              المعلمين
            </button>
            <button
              type="button"
              className="rk-call-key"
              data-sunk={engaged === "class" ? "true" : "false"}
              aria-pressed={engaged === "class"}
              onClick={() => startCall("class")}
            >
              الصف والفصل
            </button>
            <button type="button" className="rk-call-key" onClick={handleMyLesson} data-my-lesson="true">
              حصتي
            </button>
            <button type="button" className="rk-call-key" onClick={handleHealth}>
              الحالات الصحية
            </button>
          </div>

          {listeningHint && <p className="text-center text-sm text-slate-500 mb-3">{listeningHint}</p>}

          <form onSubmit={handleTyped} className="flex flex-col sm:flex-row gap-2 max-w-xl mx-auto mb-4">
            <input
              value={typedQuery}
              onChange={(event) => setTypedQuery(event.target.value)}
              placeholder={listenMode === "teacher" ? "أو اكتب اسم المعلم" : "أو اكتب الصف والفصل، مثل: الثالث ب"}
              className={fieldClass}
              aria-label="نص النداء"
            />
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm">
              نداء
            </button>
            <button
              type="button"
              onClick={() => {
                window.speechSynthesis?.cancel();
                speech.stop();
                setSpeaking(false);
                setEngaged(null);
              }}
              className="px-4 py-2.5 rounded-xl text-sm border border-slate-200 text-slate-700"
            >
              إيقاف
            </button>
          </form>

          <label className="block max-w-xl mx-auto mb-6">
              <span className="rk-label">صفة ظهور الحالة الصحية</span>
              <select
                value={viewerId}
                onChange={(event) => setViewerId(event.target.value)}
                className={fieldClass}
                data-viewer-role={viewerRole}
              >
                <option value={OWNER_VIEW}>المدير (الحساب الحالي)</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName} — {member.callRole}
                  </option>
                ))}
              </select>
            </label>

          <section
            className="rounded-2xl bg-blue-700 text-white p-5 mb-6 min-h-36 text-center"
            data-call-board="true"
            data-speech-invoked={speechInvoked ? "true" : "false"}
            data-speech-phrase={spokenPhrase}
            data-speaking={speaking ? "true" : "false"}
            data-call-mode={answer?.mode ?? ""}
          >
            {answer ? (
              <>
                <p className="text-sm text-white/80 mb-2 inline-flex items-center justify-center gap-2">
                  <span>{answer.caption}</span>
                  {answer.phoneOn === "caption" && <TeacherPhoneLink name={answer.phoneName} phone={answer.phone} />}
                </p>
                <p className="text-2xl font-bold inline-flex items-center justify-center gap-2">
                  <span>{answer.title}</span>
                  {answer.phoneOn === "title" && <TeacherPhoneLink name={answer.phoneName} phone={answer.phone} />}
                </p>
                {answer.mode === "class" && (
                  <p className="mt-2 text-white/80">
                    {gradeLabel(answer.gradeId)} — الفصل {sectionLabel(answer.sectionId)}
                  </p>
                )}
                {answer.mode === "mine" && answer.detail && <p className="mt-2 text-white/80">{answer.detail}</p>}
              </>
            ) : (
              <p className="text-white/80 rk-lead">اضغط المعلمين أو الصف والفصل، ثم انطق الطلب أو اكتبه.</p>
            )}
          </section>

          <section
            className="border-t border-slate-200 pt-4 mb-6"
            data-health-panel={healthOpen && answer?.mode === "class" ? "open" : "closed"}
            data-call-names={viewerAccess.callNames}
          >
            {healthOpen && answer?.mode === "class" ? (
              <>
                <h3 className="rk-section text-slate-800 mb-2">الحالة الصحية للنداء</h3>
                <p className="text-sm text-slate-500 mb-3">
                  {gradeLabel(answer.gradeId)} — الفصل {sectionLabel(answer.sectionId)} — الظهور بصفة {viewerRole}
                  {filterTeacher ? ` (${filterTeacher.fullName})` : ""}
                </p>
                {viewerAccess.callNames === "none" ? (
                  <p className="text-slate-600 rk-lead">لا تملك صلاحية الاطلاع على أسماء الحالات الصحية.</p>
                ) : viewerAccess.callNames === "assigned" && !assignedKeys.includes(classKey(answer.gradeId, answer.sectionId)) ? (
                  <p className="text-slate-600 rk-lead">لا تظهر أسماء خارج الصف والفصل المسندين لهذا المعلم.</p>
                ) : healthMatches.length === 0 ? (
                  <p className="text-slate-600 rk-lead">لا توجد حالات صحية مسجلة لهذا الصف والفصل.</p>
                ) : (
                  <ul className="space-y-2">
                    {healthMatches.map((record) => (
                      <li key={record.id} className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-3" data-health-student={record.studentName}>
                        <p className="font-semibold text-slate-800">{record.studentName}</p>
                        <p className="text-sm text-rose-800">الحالة: {record.conditionTitle}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400">بعد نداء الصف والفصل، اضغط الحالات الصحية لتظهر الأسماء ونوع الحالة في الأسفل.</p>
            )}
          </section>

          <details className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
            <summary className="cursor-pointer font-semibold text-slate-800">أدوار الكادر وإسناد الفصول</summary>
            <p className="rk-lead text-slate-500 mt-2 mb-4">
              المدير والوكيل والمرشد يرون أسماء الصف المختار دون شرط الإسناد. المعلم يرى طلاب الصف والفصل المسندين إليه فقط.
            </p>
            <form onSubmit={handleAddTeacher} className="flex flex-col sm:flex-row gap-2 mb-4">
              <input
                value={teacherNameDraft}
                onChange={(event) => setTeacherNameDraft(event.target.value)}
                placeholder="اسم موظف أو معلم"
                className={fieldClass}
              />
              <select
                value={newStaffRole}
                onChange={(event) => setNewStaffRole(event.target.value as CallRole)}
                className="p-2.5 border border-slate-200 rounded-xl text-sm bg-white"
              >
                {CALL_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={savingStaff}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm disabled:opacity-60"
              >
                إضافة
              </button>
            </form>
            <div className="space-y-3">
              {staff.length === 0 && <p className="text-sm text-slate-500">لا يوجد كادر بعد.</p>}
              {staff.map((member) => {
                const fromSchedule = teacherAssignedKeys(member.id, [], assignments, member.fullName);
                return (
                  <div key={member.id} className="bg-white border border-slate-200 rounded-xl p-3">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                      <p className="font-semibold text-slate-800 lg:w-48">{member.fullName}</p>
                      <input
                        value={member.phone}
                        onChange={(event) => updateStaff(member.id, { phone: event.target.value })}
                        placeholder="جوال المعلم"
                        inputMode="tel"
                        className="p-2 border border-slate-200 rounded-xl text-sm bg-white lg:w-40"
                        aria-label={`جوال ${member.fullName}`}
                      />
                      <select
                        value={member.callRole}
                        onChange={(event) => updateStaff(member.id, { callRole: event.target.value as CallRole })}
                        className="p-2 border border-slate-200 rounded-xl text-sm bg-white lg:w-36"
                      >
                        {CALL_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={savingStaff}
                        onClick={() => handleSaveStaff(member)}
                        className="text-sm font-bold text-white bg-blue-600 rounded-xl px-3 py-2 disabled:opacity-60"
                      >
                        حفظ
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {options.map((item) => (
                        <label key={item.id} className="text-xs text-slate-600 flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={member.assignedClassIds.includes(item.id)}
                            onChange={(event) => {
                              const next = event.target.checked
                                ? [...member.assignedClassIds, item.id]
                                : member.assignedClassIds.filter((classId) => classId !== item.id);
                              updateStaff(member.id, { assignedClassIds: next });
                            }}
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                      {fromSchedule.length > 0 && (
                      <p className="text-xs text-slate-500 mt-2">
                        من الجدول والإسناد: {fromSchedule.map((classId) => classOptionLabel(classId)).join(" ، ")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function TeacherPhoneLink({ name, phone }: { name: string; phone: string }) {
  const href = teacherTelHref(phone);
  if (!href) return null;
  return (
    <a
      href={href}
      data-teacher-phone={href}
      aria-label={`اتصال بالمعلم ${name}`}
      title={`اتصال بـ ${name}`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-blue-700"
    >
      <PhoneIcon />
    </a>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M7 3.5h2.2c.4 0 .7.3.8.7l.8 2.4a.9.9 0 0 1-.2.9L9.2 8.6a12.2 12.2 0 0 0 6.2 6.2l1.1-1.4a.9.9 0 0 1 .9-.2l2.4.8c.4.1.7.4.7.8V17a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 3.5 6.6 1.5 1.5 0 0 1 5 5h2z" />
    </svg>
  );
}
