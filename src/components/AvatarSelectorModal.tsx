import React, { useState, useRef } from 'react';
import { X, Check, Upload, Trash2, Camera, User as UserIcon } from 'lucide-react';
import { AVATAR_GRADIENTS, updateUserAvatar } from '../utils/googleSheets';
import { processAvatarFile } from '../utils/imageUpload';
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
  const [customImage, setCustomImage] = useState<string | null>(
    currentUser?.avatar && (currentUser.avatar.startsWith('data:image') || currentUser.avatar.startsWith('http'))
      ? currentUser.avatar
      : null
  );
  const [selectedGradient, setSelectedGradient] = useState(
    currentUser?.avatarBg || 'from-cyan-500 to-blue-600'
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { isDark } = useTheme();

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const compressed = await processAvatarFile(file, 260);
      setCustomImage(compressed);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'ไม่สามารถประมวลผลรูปภาพได้');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemovePhoto = () => {
    setCustomImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
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

        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold mb-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-500">
            <Camera className="w-3.5 h-3.5" />
            <span>ปรับแต่งรูปโปรไฟล์</span>
          </div>
          <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
            อัปโหลดรูปภาพโปรไฟล์
          </h2>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            รูปภาพจะแสดงบนตารางจัดอันดับ (Leaderboard) และหน้าโปรไฟล์ของคุณ
          </p>
        </div>

        {/* Live Preview Avatar */}
        <div
          className={`p-4 rounded-2xl border mb-6 flex items-center gap-4 ${
            isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <UserAvatar
            avatar={customImage || ''}
            name={currentUser?.displayName || currentUser?.fullName || ''}
            gradient={selectedGradient}
            size="lg"
          />

          <div>
            <span className={`text-xs block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              ตัวอย่างการแสดงผล:
            </span>
            <div className={`text-base font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {currentUser?.displayName || 'ผู้เล่น'}
            </div>
            <span className="text-[11px] text-cyan-500 font-mono">
              {currentUser?.studentId ? `ID: ${currentUser.studentId}` : 'TouchTyping Player'}
            </span>
          </div>
        </div>

        {/* Section 1: Upload from device */}
        <div className="mb-6">
          <label className={`block text-xs font-bold uppercase tracking-wider mb-2.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            1. เลือกรูปภาพจากเครื่อง (Upload Photo)
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
              className={`w-full py-4 px-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 text-xs font-bold transition-all ${
                customImage
                  ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                  : isDark
                  ? 'border-slate-700 bg-slate-950 hover:bg-slate-850 hover:border-cyan-500 text-slate-300'
                  : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-cyan-500 text-slate-700'
              }`}
            >
              <Upload className="w-5 h-5" />
              <span>{isProcessing ? 'กำลังประมวลผลรูปภาพ...' : customImage ? 'เปลี่ยนรูปภาพจากเครื่อง' : 'คลิกเพื่อเลือกไฟล์รูปภาพจากอุปกรณ์'}</span>
              <span className={`text-[10px] font-normal ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                รองรับ JPG, PNG, WebP จากคอมพิวเตอร์และมือถือ
              </span>
            </button>

            {customImage && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="w-full py-2 px-3 rounded-xl border border-rose-500/30 text-rose-500 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ลบรูปภาพและใช้ชื่อย่อแทน</span>
              </button>
            )}
          </div>
        </div>

        {/* Section 2: Background Gradients */}
        <div className="mb-6">
          <label className={`block text-xs font-bold uppercase tracking-wider mb-2.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            2. เลือกโทนสีพื้นหลัง (Background Gradient)
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
        <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-500/20 transition-all flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>บันทึกรูปโปรไฟล์</span>
          </button>
        </div>
      </div>
    </div>
  );
};
