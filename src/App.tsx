import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Upload, List, Grid as GridIcon, Search, Image as ImageIcon, X, Link as LinkIcon, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";

/** 수정 요약
 * 1) 상세 모달의 이벤트/연도 입력을 드롭다운으로 복원
 * 2) 관리자 패널 상단 버튼 정렬(flex wrap) 문제 해결
 */

export default function PokaListApp() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const isAdmin = params.get("admin") === "1";
  const isEdit = params.get("edit") === "1";
  const srcRaw = params.get("src") || "";
  let srcParam = srcRaw; try { srcParam = decodeURIComponent(srcRaw); } catch {}
  const shareMode = !!srcParam && !isAdmin && !isEdit;

  const [items, setItems] = useState<any[]>([]);
  const [detail, setDetail] = useState<any|null>(null);
  const [adminOpen, setAdminOpen] = useState(isAdmin);
  const [gh, setGh] = useState({ owner: "gumming6-6", repo: "bogummy", branch: "main", token: "" });

  const eventOptions = useMemo(() => ["", "팬미팅", "팬미 추가특전", "기타"], []);
  const yearOptions = useMemo(() => ["", "2023", "2024", "2025"], []);

  useEffect(()=>{ document.title = "BOGUMMY PHOTOCARD" }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-2">
          <div className="text-2xl font-extrabold">BOGUMMY PHOTOCARD LIST❣️</div>
          {!shareMode && (
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <button className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-blue-700"><Plus size={14}/> 새 항목</button>
              <label className="bg-slate-700 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-slate-800 cursor-pointer"><Upload size={14}/> 다중 이미지 추가<input type="file" multiple className="hidden"/></label>
              <button className="bg-amber-500 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-amber-600"><LinkIcon size={14}/> JSON 주소로 공유(src)</button>
              <button onClick={()=>setAdminOpen(v=>!v)} className="bg-purple-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-purple-700">관리자 패널 {adminOpen?"닫기":"열기"}</button>
            </div>
          )}
        </div>

        {/* 관리자 패널 */}
        {!shareMode && adminOpen && (
          <div className="mx-auto max-w-6xl px-4 pb-3">
            <div className="p-3 rounded-xl border bg-purple-50 border-purple-200 space-y-2">
              <div className="text-sm font-semibold text-purple-800">관리자: GitHub 바로 커밋</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <input className="px-3 py-2 rounded-lg border" placeholder="owner" value={gh.owner} onChange={(e)=>setGh({...gh, owner:e.target.value})}/>
                <input className="px-3 py-2 rounded-lg border" placeholder="repo" value={gh.repo} onChange={(e)=>setGh({...gh, repo:e.target.value})}/>
                <input className="px-3 py-2 rounded-lg border" placeholder="branch" value={gh.branch} onChange={(e)=>setGh({...gh, branch:e.target.value})}/>
                <input className="px-3 py-2 rounded-lg border" placeholder="token" value={gh.token} onChange={(e)=>setGh({...gh, token:e.target.value})}/>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="bg-slate-200 hover:bg-slate-300 px-3 py-2 rounded-xl inline-flex items-center gap-2 cursor-pointer"><Upload size={16}/> 이미지 업로드<input type="file" multiple className="hidden"/></label>
                <button className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">catalog.json 커밋</button>
                <div className="text-xs text-slate-600">커밋 후 1~2분 후 반영됩니다.</div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* 상세 모달 */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm grid place-items-center p-3 z-[200]">
          <div className="bg-white rounded-2xl w-[90vw] max-w-[360px] shadow-xl p-3">
            <div className="flex items-center justify-between mb-2 border-b pb-2">
              <b>상세 정보</b>
              <button onClick={()=>setDetail(null)}><X size={18}/></button>
            </div>
            <div className="space-y-2 text-sm">
              <label className="block">제목<input className="w-full border rounded px-2 py-1 mt-1"/></label>
              <label className="block">구매 날짜<input type="date" className="w-full border rounded px-2 py-1 mt-1"/></label>
              <label className="block">이벤트<select className="w-full border rounded px-2 py-1 mt-1">{eventOptions.map(v=>(<option key={v}>{v}</option>))}</select></label>
              <label className="block">구매처<input className="w-full border rounded px-2 py-1 mt-1"/></label>
              <label className="block">연도<select className="w-full border rounded px-2 py-1 mt-1">{yearOptions.map(v=>(<option key={v}>{v}</option>))}</select></label>
              <label className="block">비고<textarea rows={3} className="w-full border rounded px-2 py-1 mt-1"/></label>
              <div className="flex justify-end gap-2 pt-2 border-t mt-2">
                <button className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200">닫기</button>
                <button className="px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700">저장</button>
                <button className="px-3 py-1.5 rounded bg-rose-600 text-white hover:bg-rose-700">삭제</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
