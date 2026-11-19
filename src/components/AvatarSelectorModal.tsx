import React, { useState, useRef, useEffect } from 'react';
import { X, Check, Upload, Trash2, Camera, AlertCircle, Sparkles } from 'lucide-react';
import { AVATAR_GRADIENTS, updateUserAvatar } from '../utils/googleSheets';
import { processAvatarFile } from '../utils/imageUpload';
import { PRESET_AVATARS } from '../utils/avatarGenerator';
import { User } from '../types';
import { useTheme } from '../context/ThemeContext';
import { UserAvatar } from './UserAvatar';

interface AvatarSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onAvatarUpdated: (updatedUser: User) => void;
}

export const AvatarSelectorModal: React.FC<AvatarSelectorModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onAvatarUpdated
}) => {
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [selectedGradient, setSelectedGradient] = useState('from-cyan-500 to-blue-600');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { isDark } = useTheme();

  // Keep modal state in sync whenever opened or user changes
  useEffect(() => {
    if (!isOpen) return;
    const existing =
      currentUser?.avatar &&
      (currentUser.avatar.startsWith('data:image') ||
        currentUser.avatar.startsWith('http') ||
        currentUser.avatar.startsWith('/'))
        ? currentUser.avatar
        : null;
    setCustomImage(existing);
    setSelectedGradient(currentUser?.avatarBg || 'from-cyan-500 to-blue-600');
    setErrorMessage(null);
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setIsProcessing(true);
    try {
      const compressed = await processAvatarFile(file, 160);
      setCustomImage(compressed);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'ไม่สามารถประมวลผลรูปภาพได้');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemovePhoto = () => {
    setCustomImage(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    if (isProcessing) return;
    const finalAvatar = customImage || '';
    const updated = updateUserAvatar(finalAvatar, selectedGradient);
    if (updated) {
      onAvatarUpdated(updated);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        className={`w-full max-w-md border rounded-3xl p-6 sm:p-8 shadow-2xl relative transition-all duration-300 max-h-[90vh] overflow-y-auto ${
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

        <div className="mb-5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold mb-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-500">
            <Camera className="w-3.5 h-3.5" />
            <span>ปรับแต่งรูปโปรไฟล์</span>
          </div>
          <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
            ตั้งค่ารูปภาพโปรไฟล์
          </h2>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            รูปโปรไฟล์ของคุณจะซิงค์ขึ้นตารางจัดอันดับ (Leaderboard) และ Google Sheets อัตโนมัติ
          </p>
        </div>

        {/* Live Preview Avatar */}
        <div
          className={`p-4 rounded-2xl border mb-5 flex items-center gap-4 ${
            isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <UserAvatar
            avatar={customImage || ''}
            name={currentUser?.displayName || currentUser?.fullName || ''}
            seed={currentUser?.uid || currentUser?.studentId || currentUser?.displayName || ''}
            gradient={selectedGradient}
            size="lg"
          />

          <div>
            <span className={`text-xs block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              ตัวอย่างการแสดงผลบนตารางจัดอันดับ:
            </span>
            <div className={`text-base font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {currentUser?.displayName || 'ผู้เล่น'}
            </div>
            <span className="text-[11px] text-cyan-500 font-mono">
              {currentUser?.studentId ? `ID: ${currentUser.studentId}` : 'TouchTyping Player'}
            </span>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Section 1: Upload from device */}
        <div className="mb-5">
          <label className={`block text-xs font-bold uppercase tracking-wider mb-2.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            1. อัปโหลดรูปภาพจากเครื่อง (Upload Photo)
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          <div className="space-y-2">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full py-3.5 px-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 text-xs font-bold transition-all ${
                customImage && !customImage.startsWith('data:image/svg+xml')
                  ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                  : isDark
                  ? 'border-slate-700 bg-slate-950 hover:bg-slate-900 hover:border-cyan-500 text-slate-300'
                  : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-cyan-500 text-slate-700'
              }`}
            >
              <Upload className="w-5 h-5" />
              <span>
                {isProcessing
                  ? 'กำลังประมวลผลรูปภาพ...'
                  : customImage && !customImage.startsWith('data:image/svg+xml')
                  ? 'เปลี่ยนรูปภาพจากเครื่อง'
                  : 'คลิกเพื่อเลือกไฟล์รูปภาพจากอุปกรณ์'}
              </span>
              <span className="text-[10px] font-normal text-slate-500">
                รองรับ JPG, PNG, WebP (ปรับขนาดอัตโนมัติให้แสดงผลคมชัดทุกเครื่อง)
              </span>
            </button>

            {customImage && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="w-full py-2 px-3 rounded-xl border border-rose-500/30 text-rose-500 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>รีเซ็ตกลับเป็นรูปอวตารประจำตัวอัตโนมัติ</span>
              </button>
            )}
          </div>
        </div>

        {/* Section 2: Quick Preset Character Avatars */}
        <div className="mb-5">
          <label className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-2.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>2. หรือเลือกรูปอวตารสำเร็จรูป (Quick Avatars)</span>
          </label>
          <div className="grid grid-cols-4 gap-2.5">
            {PRESET_AVATARS.map(preset => {
              const isSelected = customImage === preset.dataUri;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setCustomImage(preset.dataUri);
                    setSelectedGradient(preset.gradient);
                    setErrorMessage(null);
                  }}
                  title={preset.label}
                  className={`p-1.5 rounded-2xl border flex flex-col items-center gap-1 transition-all ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-500/15 ring-2 ring-cyan-400/40 scale-[1.03]'
                      : isDark
                      ? 'border-slate-800 bg-slate-950/60 hover:border-slate-600'
                      : 'border-slate-200 bg-slate-50 hover:border-cyan-400'
                  }`}
                >
                  <img
                    src={preset.dataUri}
                    alt={preset.label}
                    className="w-12 h-12 rounded-xl object-cover shadow-xs"
                  />
                  <span className={`text-[10px] font-semibold truncate w-full text-center ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {preset.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 3: Background Gradients */}
        <div className="mb-6">
          <label className={`block text-xs font-bold uppercase tracking-wider mb-2.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            3. เลือกโทนสีกรอบพื้นหลัง (Frame Gradient)
          </label>
          <div className="flex flex-wrap gap-2.5">
            {AVATAR_GRADIENTS.map((grad) => {
              const isSelected = selectedGradient === grad;
              return (
                <button
                  key={grad}
                  type="button"
                  onClick={() => setSelectedGradient(grad)}
                  className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${grad} flex items-center justify-center transition-all hover:scale-110 ${
                    isSelected ? 'ring-2 ring-white scale-105 shadow-md' : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  {isSelected && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className={`flex items-center gap-3 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md shadow-cyan-500/20 transition-all flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>{isProcessing ? 'กำลังประมวลผลรูป...' : 'บันทึกรูปโปรไฟล์'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
