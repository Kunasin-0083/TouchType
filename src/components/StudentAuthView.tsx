import React, { useState, useRef } from 'react';
import {
  LogIn,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Upload,
  Image as ImageIcon,
  KeyRound,
  IdCard,
  UserCheck,
  Trash2,
  GraduationCap,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowLeft
} from 'lucide-react';
import { User } from '../types';
import { apiLoginUser, apiRegisterStudent, setCurrentUser } from '../utils/googleSheets';
import { processAvatarFile } from '../utils/imageUpload';
import { useTheme } from '../context/ThemeContext';
import { UserAvatar } from './UserAvatar';

interface StudentAuthViewProps {
  currentUser: User | null;
  onAuthSuccess: (user: User) => void;
  onNavigateHome: () => void;
}

export const StudentAuthView: React.FC<StudentAuthViewProps> = ({
  currentUser,
  onAuthSuccess,
  onNavigateHome
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'teacher'>('login');

  // Student Login form state
  const [loginStudentId, setLoginStudentId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Teacher Login form state
  const [teacherUsername, setTeacherUsername] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [showTeacherPass, setShowTeacherPass] = useState(false);

  // Register form state
  const [regStudentId, setRegStudentId] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regClassroom, setRegClassroom] = useState('ปวช.3/1');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Custom photo upload
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const { isDark } = useTheme();

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setErrorMsg(null);
      const dataUrl = await processAvatarFile(file, 240);
      setUploadedPhoto(dataUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถอัปโหลดรูปภาพได้';
      setErrorMsg(msg);
    }
  };

  const handleRemovePhoto = () => {
    setUploadedPhoto(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanId = loginStudentId.trim();
    if (!cleanId) {
      setErrorMsg('กรุณากรอกรหัสนักเรียนหรือรหัสผู้ใช้งาน');
      return;
    }
    if (!loginPassword) {
      setErrorMsg('กรุณากรอกรหัสผ่าน');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiLoginUser(cleanId, loginPassword);

      if (res.success && res.user) {
        setSuccessMsg(`ยินดีต้อนรับ ${res.user.displayName} เข้าสู่ระบบสำเร็จ`);
        onAuthSuccess(res.user);
      } else {
        setErrorMsg(res.message || 'รหัสนักเรียนหรือรหัสผ่านไม่ถูกต้อง');
      }
    } catch {
      setErrorMsg('เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTeacherLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanId = teacherUsername.trim();
    if (!cleanId) {
      setErrorMsg('กรุณากรอกรหัสผู้ใช้งานสำหรับครู');
      return;
    }
    if (!teacherPassword) {
      setErrorMsg('กรุณากรอกรหัสผ่าน');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiLoginUser(cleanId, teacherPassword);

      if (res.success && res.user) {
        if (res.user.role !== 'teacher' && res.user.role !== 'admin') {
          setCurrentUser(null);
          setErrorMsg('บัญชีนี้ไม่มีสิทธิ์ครูผู้สอน กรุณาเข้าสู่ระบบที่หน้าสำหรับนักเรียน');
          return;
        }
        setSuccessMsg(`ยินดีต้อนรับ ${res.user.displayName} เข้าสู่แดชบอร์ดครูผู้สอน`);
        onAuthSuccess(res.user);
      } else {
        setErrorMsg(res.message || 'รหัสผู้ใช้งานหรือรหัสผ่านครูไม่ถูกต้อง');
      }
    } catch {
      setErrorMsg('เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanId = regStudentId.trim();
    const cleanName = regFullName.trim();
    const cleanNick = (regDisplayName || cleanName.split(' ')[0] || cleanId).trim();

    if (!cleanId) {
      setErrorMsg('กรุณาระบุรหัสนักเรียน');
      return;
    }
    if (cleanId.length < 3) {
      setErrorMsg('รหัสนักเรียนต้องมีความยาวอย่างน้อย 3 ตัวอักษร');
      return;
    }
    if (!cleanName) {
      setErrorMsg('กรุณาระบุชื่อ-นามสกุลจริง');
      return;
    }
    if (regPassword.length < 4) {
      setErrorMsg('รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMsg('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setIsLoading(true);
    try {
      const finalAvatar = uploadedPhoto || '';
      const res = await apiRegisterStudent({
        studentId: cleanId,
        fullName: cleanName,
        classroom: regClassroom,
        displayName: cleanNick,
        password: regPassword,
        avatar: finalAvatar,
        avatarBg: uploadedPhoto
          ? 'from-slate-700 to-slate-900'
          : 'from-cyan-500 to-blue-600',
        role: 'student'
      });

      if (res.success && res.user) {
        setSuccessMsg(`สมัครสมาชิกสำเร็จ! ยินดีต้อนรับคุณ ${res.user.displayName}`);
        onAuthSuccess(res.user);
      } else {
        setErrorMsg(res.message || 'ไม่สามารถสมัครสมาชิกได้ กรุณาลองใหม่อีกครั้ง');
      }
    } catch {
      setErrorMsg('เกิดข้อผิดพลาดในการสมัครสมาชิก กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoading(false);
    }
  };

  const isCurrentLoggedIn = currentUser && currentUser.username !== 'guest' && currentUser.studentId;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in py-4">
      {/* Top Banner / Header */}
      <div
        className={`border rounded-3xl p-6 sm:p-8 shadow-xl text-center relative overflow-hidden transition-all duration-300 ${
          isDark
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200/90 shadow-slate-200/50'
        }`}
      >
        <div
          className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-white shadow-lg ${
            activeTab === 'teacher'
              ? 'bg-gradient-to-tr from-indigo-600 via-violet-600 to-blue-600 shadow-indigo-500/25'
              : 'bg-gradient-to-tr from-cyan-500 via-sky-500 to-blue-600 shadow-cyan-500/25'
          }`}
        >
          {activeTab === 'teacher' ? (
            <GraduationCap className="w-8 h-8" />
          ) : (
            <span className="text-3xl">⌨️</span>
          )}
        </div>
        <h1 className={`text-2xl sm:text-3xl font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {activeTab === 'teacher'
            ? 'เข้าสู่ระบบสำหรับครูผู้สอน'
            : activeTab === 'login'
            ? 'เข้าสู่ระบบนักเรียน'
            : 'สมัครสมาชิกใหม่'}
        </h1>
        <p className={`text-sm mt-2 max-w-md mx-auto ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          {activeTab === 'teacher'
            ? 'เข้าสู่ระบบเพื่อดูแดชบอร์ด ติดตามพัฒนาการ และตรวจสอบผลคะแนนนักเรียนทั้งหมด'
            : 'บันทึกคะแนนการฝึกพิมพ์ แบบทดสอบก่อน-หลังเรียน และคะแนนประลองจัดอันดับลง Google Sheets'}
        </p>

        {isCurrentLoggedIn && (
          <div
            className={`mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs ${
              isDark ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-300 text-emerald-700'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>เข้าสู่ระบบอยู่แล้ว: {currentUser.fullName || currentUser.displayName} ({currentUser.studentId})</span>
          </div>
        )}
      </div>

      {/* Main Form Box */}
      <div
        className={`border rounded-3xl p-6 sm:p-8 shadow-xl transition-all duration-300 ${
          isDark
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200/90 shadow-slate-200/50'
        }`}
      >
        {/* Mode Switch Tabs */}
        {activeTab !== 'teacher' ? (
          <div
            className={`flex p-1.5 rounded-2xl border mb-6 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'login'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>เข้าสู่ระบบ (Login)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'register'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>สมัครสมาชิก (Register)</span>
            </button>
          </div>
        ) : (
          <div className={`flex items-center justify-between mb-6 pb-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                isDark ? 'text-slate-300 hover:text-cyan-300' : 'text-slate-600 hover:text-cyan-700'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>กลับหน้าเข้าสู่ระบบนักเรียน</span>
            </button>
            <span className="text-xs font-bold text-indigo-500">ส่วนสำหรับครูผู้สอน</span>
          </div>
        )}

        {/* Notifications */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs sm:text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. LOGIN FORM */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                รหัสนักเรียน / รหัสผู้ใช้งาน *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={loginStudentId}
                  onChange={e => setLoginStudentId(e.target.value)}
                  placeholder="เช่น 66309010001"
                  className={`w-full px-4 py-3 rounded-xl border font-mono text-sm focus:outline-none focus:border-cyan-500 transition-colors ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                  required
                />
                <IdCard className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                รหัสผ่าน *
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านของคุณ"
                  className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:border-cyan-500 transition-colors ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                  required
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span className="animate-pulse">กำลังตรวจสอบข้อมูล...</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>เข้าสู่ระบบ</span>
                  </>
                )}
              </button>
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('register')}
                className="text-xs text-cyan-400 hover:underline"
              >
                ยังไม่มีบัญชีใช่หรือไม่? สมัครสมาชิกใหม่ที่นี่
              </button>
            </div>

            {/* Teacher Login Trigger Box (Bottom) */}
            <div
              className={`mt-3 p-3.5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                isDark
                  ? 'bg-indigo-950/30 border-indigo-500/30 text-indigo-200'
                  : 'bg-indigo-50/80 border-indigo-200 text-indigo-900'
              }`}
            >
              <div className="flex items-center gap-2.5 text-xs">
                <GraduationCap className="w-4 h-4 text-indigo-500 shrink-0" />
                <div className="font-bold">สำหรับครูผู้สอน</div>
              </div>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  setActiveTab('teacher');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                เข้าสู่ระบบครูผู้สอน
              </button>
            </div>
          </form>
        )}

        {/* 1B. TEACHER LOGIN FORM */}
        {activeTab === 'teacher' && (
          <form onSubmit={handleTeacherLoginSubmit} className="space-y-4">
            <div
              className={`p-3.5 rounded-2xl border flex items-center gap-2.5 text-xs ${
                isDark
                  ? 'bg-indigo-950/30 border-indigo-500/30 text-indigo-200'
                  : 'bg-indigo-50 border-indigo-200 text-indigo-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>เข้าสู่ระบบด้วยบัญชีครูผู้สอนเพื่อเปิดดูแดชบอร์ดและข้อมูลผลคะแนนนักเรียน</span>
            </div>

            <div>
              <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                รหัสผู้ใช้งานครู *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={teacherUsername}
                  onChange={e => setTeacherUsername(e.target.value)}
                  placeholder="กรอกรหัสผู้ใช้งานสำหรับครู"
                  autoComplete="username"
                  className={`w-full px-4 py-3 rounded-xl border font-mono text-sm focus:outline-none focus:border-indigo-500 transition-colors ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                  required
                />
                <IdCard className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                รหัสผ่าน *
              </label>
              <div className="relative">
                <input
                  type={showTeacherPass ? 'text' : 'password'}
                  value={teacherPassword}
                  onChange={e => setTeacherPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่าน"
                  autoComplete="current-password"
                  className={`w-full pl-4 pr-11 py-3 rounded-xl border text-sm focus:outline-none focus:border-indigo-500 transition-colors ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowTeacherPass(v => !v)}
                  aria-label={showTeacherPass ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showTeacherPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span className="animate-pulse">กำลังตรวจสอบสิทธิ์ครูผู้สอน...</span>
                ) : (
                  <>
                    <GraduationCap className="w-4 h-4" />
                    <span>เข้าสู่ระบบแดชบอร์ดครู</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* 2. REGISTER FORM */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            {/* Profile Photo Uploader Section */}
            <div
              className={`p-4 rounded-2xl border transition-colors ${
                isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <label className={`block text-xs font-bold mb-2.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                รูปภาพโปรไฟล์ (เลือกรูปจากเครื่อง)
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Photo Preview */}
                <div className="relative group shrink-0">
                  <UserAvatar
                    avatar={uploadedPhoto || ''}
                    name={regFullName || regDisplayName || regStudentId || 'User'}
                    size="lg"
                    gradient={uploadedPhoto ? 'from-slate-700 to-slate-900' : 'from-cyan-500 to-blue-600'}
                  />

                  {uploadedPhoto && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      title="ลบรูปและใช้ชื่อย่อแทน"
                      className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md hover:bg-rose-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Upload action buttons */}
                <div className="flex-1 w-full space-y-2 text-center sm:text-left">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                      uploadedPhoto
                        ? 'bg-cyan-500/15 border-cyan-400 text-cyan-400 hover:bg-cyan-500/25'
                        : isDark
                        ? 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-xs'
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    <span>{uploadedPhoto ? 'เปลี่ยนรูปภาพจากเครื่อง' : 'เลือกรูปภาพจากเครื่อง (Browse Image)'}</span>
                  </button>

                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    รองรับไฟล์ JPG, PNG, WebP ทุกขนาด (หากไม่เลือก ระบบจะใช้ชื่อย่อเป็นรูปโปรไฟล์)
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Student ID */}
              <div>
                <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  รหัสนักเรียน *
                </label>
                <input
                  type="text"
                  value={regStudentId}
                  onChange={e => setRegStudentId(e.target.value)}
                  placeholder="เช่น 66309010001"
                  className={`w-full px-3.5 py-2.5 rounded-xl border font-mono text-sm focus:outline-none focus:border-cyan-500 transition-colors ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                  required
                />
              </div>

              {/* Classroom */}
              <div>
                <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  ระดับชั้น / ห้องเรียน *
                </label>
                <select
                  value={regClassroom}
                  onChange={e => setRegClassroom(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-cyan-500 transition-colors ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="ปวช.3/1">ปวช.3/1</option>
                  <option value="ปวช.3/2">ปวช.3/2</option>
                  <option value="ปวช.3/3">ปวช.3/3</option>
                  <option value="ปวช.3/4">ปวช.3/4</option>
                  <option value="ปวช.1">ปวช.1</option>
                  <option value="ปวช.2">ปวช.2</option>
                  <option value="ทั่วไป">ทั่วไป</option>
                </select>
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                ชื่อ-นามสกุลจริง *
              </label>
              <input
                type="text"
                value={regFullName}
                onChange={e => {
                  setRegFullName(e.target.value);
                  if (!regDisplayName) {
                    setRegDisplayName(e.target.value.split(' ')[0] || '');
                  }
                }}
                placeholder="เช่น นายธนากร บุญรอด"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-cyan-500 transition-colors ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
                required
              />
            </div>

            {/* Display Name */}
            <div>
              <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                ชื่อที่ใช้แสดงในเกม / ชื่อเล่น
              </label>
              <input
                type="text"
                value={regDisplayName}
                onChange={e => setRegDisplayName(e.target.value)}
                placeholder="เช่น ธนากร"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-cyan-500 transition-colors ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>

            {/* Passwords */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  ตั้งรหัสผ่าน *
                </label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  placeholder="อย่างน้อย 4 ตัวอักษร"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-cyan-500 transition-colors ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                  required
                />
              </div>

              <div>
                <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  ยืนยันรหัสผ่าน *
                </label>
                <input
                  type="password"
                  value={regConfirmPassword}
                  onChange={e => setRegConfirmPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านซ้ำอีกครั้ง"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-cyan-500 transition-colors ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                  required
                />
              </div>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span className="animate-pulse">กำลังบันทึกข้อมูล...</span>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>สมัครสมาชิก</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
