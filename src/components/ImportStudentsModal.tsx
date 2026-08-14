import React, { useState, useRef } from 'react';
import axios from 'axios';
import {
  Upload, X, CheckCircle, AlertTriangle, FileSpreadsheet,
  ArrowLeft, ArrowRight, RefreshCw, Database
} from 'lucide-react';
import { useI18n } from '../services/i18n';
import { API_URL } from '../config';

interface ImportStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingLeads?: any[];
}

const CRM_FIELDS: Array<{ key: string; labelAr: string; labelEn: string; required: boolean; aliases: string[] }> = [
  { key: 'name', labelAr: 'اسم الطالب', labelEn: 'Student Name', required: true, aliases: ['اسم الطالب', 'اسم الطالب ثلاثي', 'الاسم', 'student name', 'name', 'اسم التلميذ', 'الاسم كامل'] },
  { key: 'phone', labelAr: 'رقم الهاتف / الجوال', labelEn: 'Phone Number', required: false, aliases: ['رقم الهاتف', 'الهاتف', 'الموبايل', 'phone', 'mobile', 'رقم الجوال', 'هاتف ولي الأمر', 'phone number', 'موبايل'] },
  { key: 'grade', labelAr: 'الصف الدراسي', labelEn: 'Grade Level', required: false, aliases: ['الصف الدراسي', 'الصف', 'grade', 'class', 'المرحلة', 'المرحلة الدراسية', 'grade level'] },
  { key: 'student_nationality', labelAr: 'جنسية الطالب', labelEn: 'Student Nationality', required: false, aliases: ['جنسية الطالب', 'الجنسية', 'nationality', 'student nationality', 'جنسية التلميذ'] },
  { key: 'student_passport', labelAr: 'رقم الهوية / الباسبور', labelEn: 'National ID / Passport', required: false, aliases: ['رقم الهوية', 'رقم الجواز', 'الرقم القومي', 'national id', 'passport', 'id number', 'رقم السجل المدني', 'رقم الهوية الوطنية'] },
  { key: 'parent_name', labelAr: 'اسم ولي الأمر', labelEn: 'Parent Name', required: false, aliases: ['اسم ولي الأمر', 'ولي الأمر', 'parent name', 'guardian name', 'اسم الأب', 'اسم الوالد'] },
  { key: 'parent_nationality', labelAr: 'جنسية ولي الأمر', labelEn: 'Parent Nationality', required: false, aliases: ['جنسية ولي الأمر', 'parent nationality'] },
  { key: 'parent_passport', labelAr: 'هوية / باسبور ولي الأمر', labelEn: 'Parent ID / Passport', required: false, aliases: ['هوية ولي الأمر', 'جواز ولي الأمر', 'parent passport', 'parent id'] },
  { key: 'birth_date', labelAr: 'تاريخ الميلاد', labelEn: 'Birth Date', required: false, aliases: ['تاريخ الميلاد', 'birth date', 'dob', 'تاريخ ولادة الطالب', 'تاريخ الميلاد (سسسس-مم-يي)'] },
  { key: 'email', labelAr: 'البريد الإلكتروني', labelEn: 'Email Address', required: false, aliases: ['البريد الإلكتروني', 'الإيميل', 'email', 'e-mail', 'البريد'] },
  { key: 'address', labelAr: 'العنوان السكني', labelEn: 'Home Address', required: false, aliases: ['العنوان', 'السكن', 'العنوان السكني', 'address', 'city', 'المدينة'] },
  { key: 'channel', labelAr: 'مصدر القبول / القناة', labelEn: 'Channel / Source', required: false, aliases: ['القناة', 'مصدر التواصل', 'channel', 'source', 'مصدر القبول'] },
  { key: 'status', labelAr: 'حالة الطالب', labelEn: 'Status', required: false, aliases: ['الحالة', 'status', 'حالة الطالب'] },
  { key: 'notes', labelAr: 'ملاحظات إضافية', labelEn: 'Notes', required: false, aliases: ['ملاحظات', 'notes', 'تفاصيل إضافية', 'ملاحظات إضافيه'] }
];

export const ImportStudentsModal: React.FC<ImportStudentsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingLeads = []
}) => {
  const { isRTL } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [fileName, setFileName] = useState<string>('');
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [isDragOver, setIsDragOver] = useState(false);

  // Validation & Processing states
  const [validRecords, setValidRecords] = useState<any[]>([]);
  const [invalidRecords, setInvalidRecords] = useState<Array<{ row: number; data: any; reason: string }>>([]);
  const [duplicateCount, setDuplicateCount] = useState<number>(0);

  // Import Progress
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [importSummary, setImportSummary] = useState<{ imported: number; updated: number; failed: number; total: number } | null>(null);

  if (!isOpen) return null;

  // ----------------------------------------------------
  // Robust CSV Line Parser
  // ----------------------------------------------------
  const parseCSVContent = (content: string) => {
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          if (inQuotes && line[i + 1] === char) {
            current += char;
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length === 0 || (values.length === 1 && values[0] === '')) continue;
      const rowObj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowObj[h] = values[idx] !== undefined ? values[idx] : '';
      });
      rows.push(rowObj);
    }

    return { headers, rows };
  };

  // ----------------------------------------------------
  // File Upload Handler
  // ----------------------------------------------------
  const handleFileSelect = (file: File) => {
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSVContent(text);
      if (parsed.headers.length === 0) {
        alert(isRTL ? 'الملف المرفوع فارغ أو غير صالح' : 'Uploaded file is empty or invalid');
        return;
      }
      setFileHeaders(parsed.headers);
      setRawRows(parsed.rows);

      // Intelligent Column Auto-Detection
      const autoMappings: Record<string, string> = {};
      CRM_FIELDS.forEach(field => {
        const matchedHeader = parsed.headers.find(header => {
          const cleanHeader = header.trim().toLowerCase();
          return field.aliases.some(alias => alias.toLowerCase() === cleanHeader);
        });
        if (matchedHeader) {
          autoMappings[field.key] = matchedHeader;
        }
      });
      setMappings(autoMappings);
      setStep(2);
    };

    reader.readAsText(file, 'UTF-8');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // ----------------------------------------------------
  // Column Mapping Confirmation & Validation
  // ----------------------------------------------------
  const handleConfirmMapping = () => {
    // Check required fields
    const missingRequired = CRM_FIELDS.filter(f => f.required && !mappings[f.key]);
    if (missingRequired.length > 0) {
      alert(isRTL 
        ? `يرجى تحديد عمود لـ: ${missingRequired.map(m => m.labelAr).join(', ')}` 
        : `Please map required field: ${missingRequired.map(m => m.labelEn).join(', ')}`
      );
      return;
    }

    const valid: any[] = [];
    const invalid: Array<{ row: number; data: any; reason: string }> = [];
    let dupes = 0;

    const existingPhones = new Set(existingLeads.map(l => (l.phone || '').replace(/\D/g, '')));
    const existingPassports = new Set(existingLeads.map(l => (l.student_passport || '').trim().toLowerCase()));

    rawRows.forEach((rawRow, index) => {
      const studentName = (rawRow[mappings['name']] || '').trim();
      const phone = (rawRow[mappings['phone']] || '').trim();
      const grade = (rawRow[mappings['grade']] || '').trim();
      const passport = (rawRow[mappings['student_passport']] || '').trim();

      if (!studentName) {
        invalid.push({
          row: index + 2,
          data: rawRow,
          reason: isRTL ? 'اسم الطالب مفقود' : 'Missing student name'
        });
        return;
      }

      const cleanPhone = phone.replace(/\D/g, '');
      const cleanPassport = passport.toLowerCase();

      // Check duplicates
      const isDuplicate = (cleanPhone && existingPhones.has(cleanPhone)) ||
                          (cleanPassport && existingPassports.has(cleanPassport));
      if (isDuplicate) {
        dupes++;
      }

      const rawStatus = (rawRow[mappings['status']] || '').toLowerCase();
      let status = 'interested';
      if (rawStatus.includes('registered') || rawStatus.includes('مسجل') || rawStatus.includes('تسجيل')) {
        status = 'registered';
      } else if (rawStatus.includes('pending') || rawStatus.includes('معلق') || rawStatus.includes('مهتم') || rawStatus.includes('interested')) {
        status = 'interested';
      } else if (rawStatus.includes('new') || rawStatus.includes('جديد')) {
        status = 'new';
      } else if (rawStatus.includes('following') || rawStatus.includes('متابعة')) {
        status = 'following';
      }

      const record: Record<string, any> = {
        id: `import_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 4)}`,
        name: studentName,
        phone: phone || '—',
        grade: grade || '—',
        channel: (rawRow[mappings['channel']] || 'excel_import').toLowerCase(),
        status: status,
        student_nationality: rawRow[mappings['student_nationality']] || null,
        student_passport: passport || null,
        parent_name: rawRow[mappings['parent_name']] || null,
        parent_nationality: rawRow[mappings['parent_nationality']] || null,
        parent_passport: rawRow[mappings['parent_passport']] || null,
        birth_date: rawRow[mappings['birth_date']] || null,
        email: rawRow[mappings['email']] || null,
        address: rawRow[mappings['address']] || null,
        notes: rawRow[mappings['notes']] || null,
        score: 85,
        ai_enabled: 1,
        follow_up: 1
      };

      valid.push(record);
    });

    setValidRecords(valid);
    setInvalidRecords(invalid);
    setDuplicateCount(dupes);
    setStep(3);
  };

  // ----------------------------------------------------
  // Batch Execution & Real-Time Progress
  // ----------------------------------------------------
  const executeImport = async () => {
    if (validRecords.length === 0) return;

    setIsImporting(true);
    setProgress(0);

    const BATCH_SIZE = 50;
    let importedTotal = 0;
    let updatedTotal = 0;
    let failedTotal = 0;

    const token = localStorage.getItem('gmis_token');

    for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
      const batch = validRecords.slice(i, i + BATCH_SIZE);
      try {
        const response = await axios.post(
          `${API_URL}/api/students/import-batch`,
          {
            records: batch,
            filename: fileName
          },
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          }
        );

        if (response.data.success) {
          importedTotal += response.data.imported || 0;
          updatedTotal += response.data.updated || 0;
        } else {
          failedTotal += batch.length;
        }
      } catch (err) {
        console.error('Batch import error:', err);
        failedTotal += batch.length;
      }

      const percent = Math.min(100, Math.round(((i + batch.length) / validRecords.length) * 100));
      setProgress(percent);
    }

    setIsImporting(false);
    setImportSummary({
      imported: importedTotal,
      updated: updatedTotal,
      failed: failedTotal + invalidRecords.length,
      total: rawRows.length
    });
    setStep(4);
  };

  const handleFinish = () => {
    onSuccess();
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
      display: 'grid', placeItems: 'center', padding: 20
    }}>
      <div className="card animate-scale" style={{
        width: '100%', maxWidth: 750, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', borderRadius: 20
      }}>

        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.75rem', background: 'var(--primary)', color: '#fff',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <FileSpreadsheet size={24} color="#14C35D" />
            <div>
              <h3 style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0, color: '#fff' }}>
                {isRTL ? 'استيراد بيانات الطلاب (Excel / CSV)' : 'Import Student Data (Excel / CSV)'}
              </h3>
              <p style={{ fontSize: '0.75rem', opacity: 0.85, margin: 0 }}>
                {isRTL ? 'خطوة ' + step + ' من 4 — معالجة سريعة وآمنة للبيانات' : `Step ${step} of 4 — Fast and secure data import`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.8 }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.75rem', overflowY: 'auto', flex: 1 }}>

          {/* STEP 1: FILE UPLOAD */}
          {step === 1 && (
            <div style={{ textAlign: 'center' }}>
              <div
                onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragOver ? '#14C35D' : 'var(--border-color)'}`,
                  background: isDragOver ? 'rgba(20,195,93,0.05)' : '#f8fafc',
                  borderRadius: 16, padding: '3rem 2rem', cursor: 'pointer',
                  transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 14
                }}
              >
                <div style={{
                  width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,28,94,0.06)',
                  display: 'grid', placeItems: 'center', color: 'var(--primary)'
                }}>
                  <Upload size={32} />
                </div>
                <div>
                  <h4 style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 6 }}>
                    {isRTL ? 'اسحب ملف البيانات هنا أو انقر للاختيار' : 'Drag & drop data file here or click to select'}
                  </h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {isRTL ? 'يدعم ملفات CSV و Excel (.csv, .xlsx, .xls)' : 'Supports CSV & Excel files (.csv, .xlsx, .xls)'}
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv, .xlsx, .xls, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />
              </div>

              <div style={{ marginTop: '1.5rem', background: '#eff6ff', padding: '1rem 1.25rem', borderRadius: 12, textAlign: isRTL ? 'right' : 'left', fontSize: '0.8rem', color: '#1e40af' }}>
                💡 <strong>{isRTL ? 'تلميح ذكي:' : 'Smart Tip:'}</strong> {isRTL ? 'النظام يكتشف أسماء الأعمدة تلقائياً سواء كانت بالعربية مثل (اسم الطالب، رقم الهاتف) أو بالإنجليزية.' : 'The system automatically detects column names in both Arabic and English.'}
              </div>
            </div>
          )}

          {/* STEP 2: MAPPING PREVIEW */}
          {step === 2 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h4 style={{ fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
                    {isRTL ? 'مطابقة الأعمدة' : 'Column Mapping'}
                  </h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                    {isRTL ? `الملف: ${fileName} (${rawRows.length} سجل)` : `File: ${fileName} (${rawRows.length} rows)`}
                  </p>
                </div>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setStep(1)}
                  style={{ fontSize: '0.75rem' }}
                >
                  {isRTL ? 'تغيير الملف' : 'Change File'}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 340, overflowY: 'auto', paddingRight: 6 }}>
                {CRM_FIELDS.map(field => {
                  const currentMapped = mappings[field.key] || '';
                  return (
                    <div
                      key={field.key}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                        background: '#f8fafc', borderRadius: 10, border: '1px solid var(--border-color)'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
                          {isRTL ? field.labelAr : field.labelEn}
                        </span>
                        {field.required && <span style={{ color: '#ef4444', marginInlineStart: 4 }}>*</span>}
                      </div>

                      <div style={{ color: 'var(--text-light)', fontSize: '0.8rem' }}>➜</div>

                      <select
                        className="form-input"
                        style={{ flex: 1.2, fontSize: '0.8rem', padding: '6px 10px' }}
                        value={currentMapped}
                        onChange={e => setMappings(prev => ({ ...prev, [field.key]: e.target.value }))}
                      >
                        <option value="">{isRTL ? '-- غير محدد --' : '-- Unmapped --'}</option>
                        {fileHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: '1.5rem' }}>
                <button className="btn btn-outline" onClick={() => setStep(1)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button className="btn btn-primary" onClick={handleConfirmMapping}>
                  {isRTL ? 'التحقق والمتابعة' : 'Validate & Next'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PRE-VALIDATION & DUPLICATE CHECK */}
          {step === 3 && (
            <div>
              <h4 style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 12 }}>
                {isRTL ? 'نتائج التحقق قبل الاستيراد' : 'Pre-Import Validation Results'}
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: 14, borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#059669' }}>{validRecords.length}</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#047857' }}>{isRTL ? 'سجلات صالحة للاستيراد' : 'Valid Records'}</div>
                </div>

                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: 14, borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#d97706' }}>{duplicateCount}</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309' }}>{isRTL ? 'سجلات مكررة (سيتم تحديثها)' : 'Duplicates (Will update)'}</div>
                </div>

                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 14, borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#dc2626' }}>{invalidRecords.length}</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b91c1c' }}>{isRTL ? 'سجلات مرفوضة' : 'Invalid / Rejected'}</div>
                </div>
              </div>

              {invalidRecords.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h5 style={{ fontWeight: 700, fontSize: '0.85rem', color: '#dc2626', marginBottom: 8 }}>
                    {isRTL ? 'تفاصيل السجلات المرفوضة:' : 'Rejected Rows Details:'}
                  </h5>
                  <div style={{ maxHeight: 150, overflowY: 'auto', background: '#fff', border: '1px solid var(--border-color)', borderRadius: 10, padding: 10 }}>
                    {invalidRecords.map((inv, idx) => (
                      <div key={idx} style={{ fontSize: '0.75rem', color: '#991b1b', padding: '4px 0', borderBottom: '1px dashed #fee2e2', display: 'flex', justifyContent: 'space-between' }}>
                        <span>الصف #{inv.row}: {inv.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress bar if importing */}
              {isImporting && (
                <div style={{ marginTop: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, marginBottom: 6 }}>
                    <span>{isRTL ? 'جاري استيراد البيانات دفعة واحدة...' : 'Importing batch data...'}</span>
                    <span>{progress}%</span>
                  </div>
                  <div style={{ height: 10, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: 'var(--secondary)', transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: '1.5rem' }}>
                <button className="btn btn-outline" onClick={() => setStep(2)} disabled={isImporting}>
                  {isRTL ? 'تعديل المطابقة' : 'Edit Mapping'}
                </button>
                <button className="btn btn-primary" onClick={executeImport} disabled={isImporting || validRecords.length === 0}>
                  {isImporting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      {isRTL ? 'جاري الاستيراد...' : 'Importing...'}
                    </>
                  ) : (
                    <>
                      <Database size={16} />
                      {isRTL ? `بدء استيراد ${validRecords.length} طالب` : `Start Import (${validRecords.length})`}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS & SUMMARY */}
          {step === 4 && importSummary && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <CheckCircle size={56} color="#14C35D" style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 8 }}>
                {isRTL ? 'اكتملت عملية الاستيراد بنجاح!' : 'Import Completed Successfully!'}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-sec)', marginBottom: '1.5rem' }}>
                {isRTL ? 'تم حفظ وإضافة بيانات الطلاب في قاعدة البيانات بنجاح وتم تسجيل العملية.' : 'Student records have been saved to the database and logged.'}
              </p>

              <div style={{ background: '#f8fafc', borderRadius: 14, padding: '1.25rem', maxWidth: 450, margin: '0 auto 1.5rem', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{isRTL ? 'إجمالي السجلات:' : 'Total Rows:'}</span>
                  <span style={{ fontWeight: 800 }}>{importSummary.total}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.85rem', color: '#059669' }}>
                  <span>{isRTL ? 'طلاب جدد تم إضافة بياناتهم:' : 'New Students Added:'}</span>
                  <span style={{ fontWeight: 800 }}>{importSummary.imported}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.85rem', color: '#d97706' }}>
                  <span>{isRTL ? 'سجلات تم تحديثها:' : 'Updated Existing:'}</span>
                  <span style={{ fontWeight: 800 }}>{importSummary.updated}</span>
                </div>
                {importSummary.failed > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.85rem', color: '#dc2626' }}>
                    <span>{isRTL ? 'سجلات مرفوضة:' : 'Failed / Rejected:'}</span>
                    <span style={{ fontWeight: 800 }}>{importSummary.failed}</span>
                  </div>
                )}
              </div>

              <button className="btn btn-primary" onClick={handleFinish} style={{ minWidth: 160 }}>
                {isRTL ? 'إغلاق وتحديث الشاشة' : 'Close & Refresh'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ImportStudentsModal;
