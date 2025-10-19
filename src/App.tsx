import React, { useEffect, useState } from "react";
import { Plus, Upload, List, Grid as GridIcon } from "lucide-react";

export default function PokaListApp() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const srcParam = params.get("src");
  const isEdit = params.get("edit") === "1";
  const isAdmin = params.get("admin") === "1";
  const sourceMode = !!srcParam;
  const shareMode = sourceMode && !isEdit && !isAdmin;
  useEffect(() => { document.title = "BOGUMMY PHOTOCARD"; }, []);

  const [view, setView] = useState("gallery");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          {/* 항상 표시되는 큰 제목 */}
          <div className="text-2xl md:text-3xl font-extrabold tracking-wide whitespace-nowrap">
            BOGUMMY PHOTOCARD LIST❣️
          </div>

          {/* 우측: 보기 아이콘 + (공유 모드일 때 안내 문구 또는 관리자 버튼) */}
          <div className="flex items-center gap-2">
            <button onClick={() => setView("gallery")} className={`p-2 rounded-lg ${view === "gallery" ? "bg-slate-200" : "hover:bg-slate-100"}`} title="갤러리 보기"><GridIcon size={18} /></button>
            <button onClick={() => setView("table")} className={`p-2 rounded-lg ${view === "table" ? "bg-slate-200" : "hover:bg-slate-100"}`} title="표 보기"><List size={18} /></button>

            {shareMode ? (
              <div className="text-sm text-slate-600 ml-2 truncate">보유 체크 현황은 이 브라우저에만 저장됩니다.</div>
            ) : (
              <>
                <button className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-700">
                  <Plus size={14} /> 새 항목
                </button>
                <button className="flex items-center gap-1 bg-gray-200 px-3 py-1 rounded-lg text-sm hover:bg-gray-300">
                  <Upload size={14} /> 이미지 업로드(commit)
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 text-center text-slate-400">
        {isAdmin || isEdit ? (
          <div>관리자/편집 모드입니다. 여기에서 포카리스트를 관리할 수 있습니다.</div>
        ) : (
          <div>공유 보기 모드입니다. 보유 체크는 로컬에만 저장됩니다.</div>
        )}
      </div>
    </div>
  );
}
