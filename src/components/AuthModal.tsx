import React, { useState, useRef } from 'react';
import { X, LogIn, UserPlus, AlertCircle, IdCard, KeyRound, Upload, Trash2 } from 'lucide-react';
import { User } from '../types';
import { apiLoginUser, apiRegisterStudent, CLASSROOM_OPTIONS } from '../utils/googleSheets';
import { processAvatarFile } from '../utils/imageUpload';
import { useTheme } from '../context/ThemeContext';
import { UserAvatar } from './UserAvatar';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  onSwitchToFullPage?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onSwitchToFullPage
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login states
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');

  // Register states
  const [regStudentId, setRegStudentId] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regClassroom, setRegClassroom] = useState('ปวช.3/1');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Photo upload
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { isDark } = useTheme();

  if (!isOpen) return null;

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      const dataUrl = await processAvatarFile(file, 200);
      setUploadedPhoto(dataUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถอัปโหลดรูปภาพได้';
      setError(msg);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register') {
      const cleanId = regStudentId.trim();
      const cleanName = regFullName.trim();
      const cleanNick = (regDisplayName || cleanName.split(' ')[0] || cleanId).trim();

      if (!cleanId) {
        setError('กรุณาระบุรหัสนักเรียน');
        return;
      }
      if (!cleanName) {
        setError('กรุณาระบุชื่อ-นามสกุลจริง');
        return;
      }
      if (regPassword.length < 4) {
        setError('รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
        return;
      }
      if (regPassword !== confirmPassword) {
        setError('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
        return;
      }

      setIsLoading(true);
      const finalAvatar = uploadedPhoto || '';
      const res = await apiRegisterStudent({
        studentId: cleanId,
        fullName: cleanName,
        classroom: regClassroom,
        displayName: cleanNick,
        password: regPassword,
        avatar: finalAvatar,
        avatarBg: uploadedPhoto ? 'from-slate-700 to-slate-900' : 'from-cyan-500 to-blue-600'
      });
      setIsLoading(false);

      if (res.success && res.user) {
        onSuccess(res.user);
        onClose();
      } else {
        setError(res.message || 'ไม่สามารถสมัครสมาชิกได้');
      }
    } else {
      const cleanId = studentId.trim();
      if (!cleanId || !password.trim()) {
        setError('กรุณากรอกรหัสนักเรียนและรหัสผ่านให้ครบถ้วน');
        return;
      }

      setIsLoading(true);
      const res = await apiLoginUser(cleanId, password);
      setIsLoading(false);

      if (res.success && res.user) {
        onSuccess(res.user);
        onClose();
      } else {
        setError(res.message || 'รหัสนักเรียนหรือรหัสผ่านไม่ถูกต้อง');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        className={`w-full max-w-lg border rounded-3xl p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto transition-all duration-300 ${
          isDark
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200/90 shadow-slate-200/60'
        }`}
      >
        <button
          onClick={onClose}
          className={`absolute top-5 right-5 p-2 rounded-xl transition-colors ${
            isDark
              ? 'text-slate-400 hover:text-white hover:bg-slate-800'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tab switch */}
        <div
          className={`flex p-1 rounded-2xl border mb-5 ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
              mode === 'login'
                ? 'bg-cyan-600 text-white shadow-md'
                : isDark
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            เข้าสู่ระบบ (Login)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
              mode === 'register'
                ? 'bg-cyan-600 text-white shadow-md'
                : isDark
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            สมัครสมาชิก (Register)
          </button>
        </div>

        <div className="mb-5">
          <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิกใหม่'}
          </h2>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            บันทึกคะแนนและพัฒนาการการฝึกพิมพ์ลง Google Sheets อัตโนมัติ
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* LOGIN VIEW */}
          {mode === 'login' && (
            <>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  รหัสนักเรียน *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={studentId}
                    onChange={e => setStudentId(e.target.value)}
                    placeholder="กรอกรหัสนักเรียน เช่น 66309010001"
                    className={`w-full px-3.5 py-2.5 rounded-xl border font-mono text-sm focus:outline-none focus:border-cyan-500 transition-colors ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                    required
                  />
                  <IdCard className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  รหัสผ่าน *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านของคุณ"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-cyan-500 transition-colors ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                    required
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </>
          )}

          {/* REGISTER VIEW */}
          {mode === 'register' && (
            <>
              {/* Photo uploader */}
              <div
                className={`p-3 rounded-2xl border flex items-center gap-3.5 ${
                  isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="relative shrink-0">
                  <UserAvatar
                    avatar={uploadedPhoto || ''}
                    name={regFullName || regDisplayName || regStudentId || 'User'}
                    size="md"
                    gradient={uploadedPhoto ? 'from-slate-700 to-slate-900' : 'from-cyan-500 to-blue-600'}
                  />
                  {uploadedPhoto && (
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedPhoto(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px]"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex-1">
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
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors ${
                      isDark ? 'bg-slate-850 hover:bg-slate-800 text-slate-200 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadedPhoto ? 'เปลี่ยนรูปจากเครื่อง' : 'เลือกรูปโปรไฟล์จากเครื่อง'}</span>
                  </button>
                  <p className="text-[10px] text-slate-400 mt-1">
                    รองรับรูปภาพจากคอมพิวเตอร์และมือถือ
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    รหัสนักเรียน *
                  </label>
                  <input
                    type="text"
                    value={regStudentId}
                    onChange={e => setRegStudentId(e.target.value)}
                    placeholder="เช่น 66309010001"
                    className={`w-full px-3 py-2 rounded-xl border font-mono text-xs focus:outline-none focus:border-cyan-500 transition-colors ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    ระดับชั้น / ห้อง *
                  </label>
                  <select
                    value={regClassroom}
                    onChange={e => setRegClassroom(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:border-cyan-500 transition-colors ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    {CLASSROOM_OPTIONS.map(room => (
                      <option key={room} value={room}>
                        {room}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
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
                  placeholder="เช่น นายสมชาย มุ่งมั่น"
                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:border-cyan-500 transition-colors ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                  required
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  ชื่อที่ใช้แสดงผลในเกม / ชื่อเล่น
                </label>
                <input
                  type="text"
                  value={regDisplayName}
                  onChange={e => setRegDisplayName(e.target.value)}
                  placeholder="เช่น สมชาย"
                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:border-cyan-500 transition-colors ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    รหัสผ่าน *
                  </label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="อย่างน้อย 4 ตัว"
                    className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:border-cyan-500 transition-colors ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    ยืนยันรหัสผ่าน *
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="ยืนยันรหัสผ่าน"
                    className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:border-cyan-500 transition-colors ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                    required
                  />
                </div>
              </div>

            </>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 mt-4"
          >
            {isLoading ? (
              <span className="animate-pulse">
                {mode === 'login'
                  ? 'กำลังตรวจสอบบัญชีจาก Google Sheets...'
                  : 'กำลังบันทึกบัญชีลง Google Sheets...'}
              </span>
            ) : mode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>เข้าสู่ระบบ</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>สมัครสมาชิก</span>
              </>
            )}
          </button>
        </form>

        <div className={`mt-5 pt-3 border-t flex items-center justify-between text-xs ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
          {onSwitchToFullPage ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSwitchToFullPage();
              }}
              className="text-cyan-400 hover:underline"
            >
              เปิดหน้าเต็ม (Full Page) ➔
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={onClose}
            className={`transition-colors ${
              isDark ? 'text-slate-400 hover:text-cyan-300' : 'text-slate-500 hover:text-cyan-600'
            }`}
          >
            ปิดหน้าต่าง ✕
          </button>
        </div>
      </div>
    </div>
  );
};
