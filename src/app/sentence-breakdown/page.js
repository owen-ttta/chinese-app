"use client";

import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import hsk300Data from "@/data/hsk300.json";
import { SYSTEM_PROMPT } from "@/data/aiPrompt";

const STORAGE_KEY = "chinese-app:sentence-breakdown:v1";

const createId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const createEmptyItem = (index = 1) => ({
  id: createId(),
  sentence: { index: `${index}.`, hanzi: "", pinyin: "", english: "", thai: "" },
  blocks: []
});

const createBlock = (values = {}) => ({
  id: createId(),
  thai: "",
  hanzi: "",
  pinyin: "",
  topNote: "",
  showTopArrow: false,
  ...values
});

const normalizeItems = (value) => {
  if (!Array.isArray(value) || value.length === 0) return [createEmptyItem()];
  return value.map((item, index) => ({
    id: item?.id || createId(),
    sentence: {
      index: item?.sentence?.index || `${index + 1}.`,
      hanzi: item?.sentence?.hanzi || "",
      pinyin: item?.sentence?.pinyin || "",
      english: item?.sentence?.english || "",
      thai: item?.sentence?.thai || ""
    },
    blocks: Array.isArray(item?.blocks)
      ? item.blocks.map((block) => createBlock(block))
      : []
  }));
};

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const DEFAULT_FONT_SETTINGS = {
  scale: 100,      // % ขนาดรวม
  hanzi: 28,       // px ตัวอักษรจีนคำศัพท์
  pinyin: 18,      // px พินอิน
  thai: 18,        // px คำแปลไทยของคำศัพท์
  topNote: 16,     // px รากศัพท์ / โน้ตด้านบน
  sentence: 18,    // px ประโยคเต็มและคำแปล
};

const buildGoogleDocsContent = (items, fontSettings = DEFAULT_FONT_SETTINGS) => {
  const WORDS_PER_ROW = 8;
  const scale = (fontSettings.scale || 100) / 100;
  const hanziPt = ((fontSettings.hanzi || 28) * scale * 0.6).toFixed(1);
  const pinyinPt = ((fontSettings.pinyin || 18) * scale * 0.6).toFixed(1);
  const thaiPt = ((fontSettings.thai || 18) * scale * 0.6).toFixed(1);
  const topNotePt = ((fontSettings.topNote || 16) * scale * 0.6).toFixed(1);
  const sentencePt = ((fontSettings.sentence || 18) * scale * 0.6).toFixed(1);
  const indexPt = Math.max(14, Number(sentencePt) + 2).toFixed(1);

  const noWrap = (value = "") =>
    escapeHtml(value).replaceAll(" ", "&nbsp;");
  const chunkBlocks = (blocks) => {
    const chunks = [];
    for (let index = 0; index < blocks.length; index += WORDS_PER_ROW) {
      chunks.push(blocks.slice(index, index + WORDS_PER_ROW));
    }
    return chunks;
  };

  const htmlItems = items.map((item) => {
    const tables = chunkBlocks(item.blocks).map((chunk) => {
      const cells = (renderer, extraStyle = "") =>
        chunk.map((block) =>
          `<td nowrap="nowrap" style="min-width:56px;text-align:center;white-space:nowrap;padding:2px 4px;border:0;vertical-align:middle;${extraStyle}">${renderer(block)}</td>`
        ).join("");
      const hasTopNote = chunk.some((block) => block.topNote);
      const hasTopArrow = chunk.some((block) => block.showTopArrow);
      return `<table cellpadding="0" cellspacing="0" border="0" style="border:0;border-collapse:collapse;table-layout:auto;margin:6px 0 10px 0;">
        <tbody>
          ${hasTopNote ? `<tr>${cells((block) => `<span style="font-size:${topNotePt}pt;font-weight:600;white-space:nowrap;color:#000000;">${noWrap(block.topNote)}</span>`, "height:24px;")}</tr>` : ""}
          ${hasTopArrow ? `<tr>${cells((block) => block.showTopArrow ? `<span style="font-size:${topNotePt}pt;color:#000000;">↑</span>` : "", "height:14px;padding-top:0;padding-bottom:0;")}</tr>` : ""}
          <tr>${cells((block) => `<span style="font-size:${thaiPt}pt;font-weight:600;white-space:nowrap;color:#000000;">${noWrap(block.thai || "0")}</span>`, "height:24px;")}</tr>
          <tr>${cells((block) => block.thai ? `<span style="font-size:${thaiPt}pt;color:#000000;">↑</span>` : "", "height:14px;padding-top:0;padding-bottom:0;")}</tr>
          <tr>${cells((block) => `<strong style="font-size:${hanziPt}pt;white-space:nowrap;color:#000000;">${noWrap(block.hanzi)}</strong>`, "height:28px;")}</tr>
          <tr>${cells((block) => block.pinyin ? `<span style="font-size:${pinyinPt}pt;color:#000000;">↑</span>` : "", "height:14px;padding-top:0;padding-bottom:0;")}</tr>
          <tr>${cells((block) => `<span style="font-size:${pinyinPt}pt;color:#000000;white-space:nowrap;">${noWrap(block.pinyin)}</span>`, "height:24px;")}</tr>
        </tbody>
      </table>`;
    }).join("");

    return `<div style="margin:0 0 28px 0;font-family:Sarabun,Arial,'Noto Sans Thai','Noto Sans SC',sans-serif;page-break-inside:avoid;color:#000000;">
      <p style="font-size:${indexPt}pt;font-weight:700;margin:0 0 6px 0;color:#000000;">${escapeHtml(item.sentence.index)}</p>
      ${tables}
      ${item.sentence.hanzi ? `<p style="font-size:${sentencePt}pt;font-weight:700;margin:3px 0;color:#000000;">${escapeHtml(item.sentence.hanzi)}</p>` : ""}
      ${item.sentence.pinyin ? `<p style="font-size:${sentencePt}pt;margin:3px 0;color:#000000;">${escapeHtml(item.sentence.pinyin)}</p>` : ""}
      ${item.sentence.english ? `<p style="font-size:${sentencePt}pt;margin:3px 0;color:#000000;">${escapeHtml(item.sentence.english)}</p>` : ""}
      ${item.sentence.thai ? `<p style="font-size:${sentencePt}pt;font-weight:600;margin:6px 0 3px 0;color:#000000;">${escapeHtml(item.sentence.thai)}</p>` : ""}
    </div>`;
  }).join("");
  }).join("");

  const html = `<div>${htmlItems}</div>`;
  const text = items.map((item) => {
    const words = chunkBlocks(item.blocks).map((chunk) => {
      const rows = [];
      if (chunk.some((block) => block.topNote)) {
        rows.push(chunk.map((block) => block.topNote || "").join("\t"));
      }
      if (chunk.some((block) => block.showTopArrow)) {
        rows.push(chunk.map((block) => block.showTopArrow ? "↑" : "").join("\t"));
      }
      rows.push(
        chunk.map((block) => block.thai || "0").join("\t"),
        chunk.map((block) => block.thai ? "↑" : "").join("\t"),
        chunk.map((block) => block.hanzi).join("\t"),
        chunk.map((block) => block.pinyin ? "↑" : "").join("\t"),
        chunk.map((block) => block.pinyin).join("\t")
      );
      return rows.join("\n");
    }).join("\n\n");
    return [
      item.sentence.index,
      words,
      item.sentence.hanzi,
      item.sentence.pinyin,
      item.sentence.english,
      item.sentence.thai
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  return { html, text };
};

// --- Icons ---
const BookIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>
);
const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
);
const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
);
const ArrowUpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
);
const ArrowDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
);
const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);
const ZapIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
);
const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);
const VolumeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
);
const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
);

const InputField = ({ label, value, onChange, placeholder = "", className = "" }) => (
  <div className={className}>
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all text-sm outline-none"
    />
  </div>
);

export default function SentenceBreakdown() {
  const [items, setItems] = useState(() => [createEmptyItem()]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [exporting, setExporting] = useState("");
  const [notice, setNotice] = useState("");
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [searchHskQuery, setSearchHskQuery] = useState("");
  const [aiMode, setAiMode] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // --- Font Settings & A4 Preview State ---
  const [fontSettings, setFontSettings] = useState(DEFAULT_FONT_SETTINGS);
  const [showFontPanel, setShowFontPanel] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(100);

  const previewRef = useRef(null);
  const importRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setItems(normalizeItems(JSON.parse(saved)));
      const savedKey = localStorage.getItem("chinese_gemini_api_key");
      if (savedKey) setGeminiApiKey(savedKey);
      const savedFonts = localStorage.getItem("chinese_font_settings");
      if (savedFonts) {
        try {
          setFontSettings((prev) => ({ ...prev, ...JSON.parse(savedFonts) }));
        } catch {}
      }
    } catch (error) {
      console.error("Failed to restore sentence breakdown", error);
      setNotice("ไม่สามารถกู้คืนงานที่บันทึกไว้ได้");
    } finally {
      setIsHydrated(true);
    }
  }, []);

  const updateFontSetting = (key, value) => {
    setFontSettings((prev) => {
      const next = { ...prev, [key]: Number(value) };
      try {
        localStorage.setItem("chinese_font_settings", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const resetFontSettings = () => {
    setFontSettings(DEFAULT_FONT_SETTINGS);
    try {
      localStorage.removeItem("chinese_font_settings");
    } catch {}
    setNotice("รีเซ็ตขนาดฟอนต์เป็นค่ามาตรฐานแล้ว");
  };

  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error("Failed to save sentence breakdown", error);
      setNotice("งานมีขนาดใหญ่เกินพื้นที่บันทึกอัตโนมัติ กรุณาสำรองเป็นไฟล์โปรเจกต์");
    }
  }, [items, isHydrated]);

  useEffect(() => () => {
    audioRef.current?.pause();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(timeout);
  }, [notice]);

  // --- Quick Generate ---
  const [quickInput, setQuickInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState("");

  const handleSaveApiKey = (val) => {
    setGeminiApiKey(val);
    try {
      if (val) localStorage.setItem("chinese_gemini_api_key", val);
      else localStorage.removeItem("chinese_gemini_api_key");
    } catch {}
  };

  const loadHskSentence = (hskItem) => {
    const hasOnlyEmptyItem =
      items.length === 1 &&
      items[0].blocks.length === 0 &&
      !items[0].sentence.hanzi;
    const newItem = {
      id: createId(),
      sentence: {
        index: hasOnlyEmptyItem ? `${items.length}.` : `${items.length + 1}.`,
        hanzi: hskItem.sentence.hanzi,
        pinyin: hskItem.sentence.pinyin,
        english: hskItem.sentence.english,
        thai: hskItem.sentence.thai
      },
      blocks: hskItem.blocks.map((block) => createBlock(block))
    };
    setItems((current) => hasOnlyEmptyItem ? [newItem] : [...current, newItem]);
    setNotice(`นำเข้าประโยค ${hskItem.num}: ${hskItem.sentence.hanzi} แล้ว`);
  };

  const loadHskWeek = (weekNum, replace = false) => {
    const weekItems = hsk300Data.filter((s) => s.week === weekNum);
    const converted = weekItems.map((hskItem, idx) => ({
      id: createId(),
      sentence: {
        index: `${replace ? idx + 1 : items.length + idx + 1}.`,
        hanzi: hskItem.sentence.hanzi,
        pinyin: hskItem.sentence.pinyin,
        english: hskItem.sentence.english,
        thai: hskItem.sentence.thai
      },
      blocks: hskItem.blocks.map((block) => createBlock(block))
    }));

    if (replace) {
      setItems(converted);
      setNotice(`โหลดสัปดาห์ที่ ${weekNum} (${converted.length} ประโยค) แทนที่เรียบร้อย`);
    } else {
      const hasOnlyEmptyItem =
        items.length === 1 &&
        items[0].blocks.length === 0 &&
        !items[0].sentence.hanzi;
      setItems((current) => hasOnlyEmptyItem ? converted : [...current, ...converted]);
      setNotice(`เพิ่มสัปดาห์ที่ ${weekNum} (${converted.length} ประโยค) เรียบร้อย`);
    }
    setShowLibraryModal(false);
  };

  const handleQuickGenerate = async () => {
    const sentences = quickInput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (sentences.length === 0) {
      setNotice("กรุณาใส่ประโยคภาษาจีนอย่างน้อย 1 ประโยค");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress(`0/${sentences.length}`);
    try {
      const results = [];
      const batchSize = 10;
      for (let index = 0; index < sentences.length; index += batchSize) {
        const batch = sentences.slice(index, index + batchSize);
        let batchResults = null;
        let lastError = null;

        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const response = await fetch("/api/sentence-breakdown", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sentences: batch,
                apiKey: geminiApiKey || undefined,
                mode: aiMode ? "ai" : "smart"
              })
            });
            const data = await response.json();
            if (response.ok && Array.isArray(data?.results)) {
              batchResults = data.results;
              break;
            }
            lastError = new Error(data?.error || `Server status ${response.status}`);
          } catch (err) {
            lastError = err;
          }
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 1200));
          }
        }

        if (!batchResults) {
          throw lastError || new Error("วิเคราะห์ประโยคไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        }

        results.push(...batchResults);
        setAnalysisProgress(`${Math.min(index + batch.length, sentences.length)}/${sentences.length}`);

        if (index + batchSize < sentences.length) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      const hasOnlyEmptyItem =
        items.length === 1 &&
        items[0].blocks.length === 0 &&
        !items[0].sentence.hanzi;
      const startingIndex = hasOnlyEmptyItem ? 1 : items.length + 1;
      const newItems = results.map((result, index) => ({
        id: createId(),
        sentence: {
          index: `${startingIndex + index}.`,
          hanzi: result.hanzi,
          pinyin: result.pinyin,
          thai: result.thai,
          english: result.english
        },
        blocks: result.blocks.map((block) => createBlock(block))
      }));

      setItems((current) => hasOnlyEmptyItem ? newItems : [...current, ...newItems]);
      setQuickInput("");
      setNotice(`วิเคราะห์และสร้าง ${newItems.length} ประโยคเรียบร้อย`);
    } catch (error) {
      console.error("Failed to analyze sentences", error);
      setNotice(error.message || "วิเคราะห์ประโยคไม่สำเร็จ");
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress("");
    }
  };

  // --- Item Management ---
  const addNewItem = () => {
    setItems((current) => [...current, createEmptyItem(current.length + 1)]);
  };

  const removeItem = (itemId) => {
    setItems((current) => {
      const remaining = current.filter(item => item.id !== itemId);
      return remaining.length > 0 ? remaining : [createEmptyItem()];
    });
  };

  const updateSentence = (itemId, field, value) => {
    setItems(items.map(item => item.id === itemId ? {
      ...item,
      sentence: { ...item.sentence, [field]: value }
    } : item));
  };

  // --- Block Management ---
  const addBlock = (itemId) => {
    setItems(items.map(item => item.id === itemId ? {
      ...item,
      blocks: [...item.blocks, createBlock()]
    } : item));
  };

  const updateBlock = (itemId, blockId, field, value) => {
    setItems(items.map(item => item.id === itemId ? {
      ...item,
      blocks: item.blocks.map(b => b.id === blockId ? { ...b, [field]: value } : b)
    } : item));
  };

  const removeBlock = (itemId, blockId) => {
    setItems(items.map(item => item.id === itemId ? {
      ...item,
      blocks: item.blocks.filter(b => b.id !== blockId)
    } : item));
  };

  const moveBlock = (itemId, blockIndex, direction) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        const newBlocks = [...item.blocks];
        if (direction === -1 && blockIndex > 0) {
          const temp = newBlocks[blockIndex];
          newBlocks[blockIndex] = newBlocks[blockIndex - 1];
          newBlocks[blockIndex - 1] = temp;
        } else if (direction === 1 && blockIndex < newBlocks.length - 1) {
          const temp = newBlocks[blockIndex];
          newBlocks[blockIndex] = newBlocks[blockIndex + 1];
          newBlocks[blockIndex + 1] = temp;
        }
        return { ...item, blocks: newBlocks };
      }
      return item;
    }));
  };

  const duplicateItem = (itemId) => {
    setItems((current) => {
      const sourceIndex = current.findIndex((item) => item.id === itemId);
      if (sourceIndex < 0) return current;
      const source = current[sourceIndex];
      const duplicate = {
        ...source,
        id: createId(),
        sentence: { ...source.sentence, index: `${sourceIndex + 2}.` },
        blocks: source.blocks.map((block) => ({ ...block, id: createId() }))
      };
      const next = [...current];
      next.splice(sourceIndex + 1, 0, duplicate);
      return next;
    });
    setNotice("คัดลอกประโยคแล้ว");
  };

  const moveItem = (itemIndex, direction) => {
    setItems((current) => {
      const destination = itemIndex + direction;
      if (destination < 0 || destination >= current.length) return current;
      const next = [...current];
      [next[itemIndex], next[destination]] = [next[destination], next[itemIndex]];
      return next;
    });
  };

  const syncSentenceFromBlocks = (itemId) => {
    setItems((current) => current.map((item) => {
      if (item.id !== itemId || item.blocks.length === 0) return item;
      return {
        ...item,
        sentence: {
          ...item.sentence,
          hanzi: item.blocks.map((block) => block.hanzi).join(""),
          pinyin: item.blocks.map((block) => block.pinyin).filter(Boolean).join(" "),
          thai: item.blocks.map((block) => block.thai).filter(Boolean).join(" ")
        }
      };
    }));
    setNotice("อัปเดตข้อมูลประโยคจากช่องคำแล้ว");
  };

  const playSentence = (text) => {
    if (!text) {
      setNotice("กรุณากรอกประโยคภาษาจีนก่อน");
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(`/api/tts?text=${encodeURIComponent(text)}&lang=zh-CN`);
    audioRef.current = audio;
    audio.play().catch(() => setNotice("ไม่สามารถเล่นเสียงได้"));
  };

  const exportProject = () => {
    const blob = new Blob([JSON.stringify({ version: 1, items }, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `sentence_breakdown_project_${Date.now()}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("ดาวน์โหลดไฟล์โปรเจกต์แล้ว");
  };

  const importProject = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      setItems(normalizeItems(parsed.items ?? parsed));
      setNotice("นำเข้าโปรเจกต์เรียบร้อย");
    } catch (error) {
      console.error("Failed to import project", error);
      setNotice("ไฟล์โปรเจกต์ไม่ถูกต้อง");
    }
  };

  const clearProject = () => {
    if (!window.confirm("ล้างประโยคทั้งหมดและเริ่มใหม่ใช่หรือไม่?")) return;
    setItems([createEmptyItem()]);
    setQuickInput("");
    setNotice("เริ่มโปรเจกต์ใหม่แล้ว");
  };

  // --- Export ---
  const downloadImage = async () => {
    if (!previewRef.current) return;
    setExporting("image");
    try {
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        onclone: (clonedDoc) => {
          const el = clonedDoc.querySelector("[data-preview-paper]");
          if (el && el.parentElement) {
            el.parentElement.style.transform = "none";
            el.parentElement.style.marginBottom = "0px";
          }
        }
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `sentence_breakdown_${Date.now()}.png`;
      a.click();
    } catch (error) {
      console.error("Failed to generate image", error);
      setNotice("สร้างรูปภาพไม่สำเร็จ");
    } finally {
      setExporting("");
    }
  };

  const copyToGoogleDocs = async () => {
    setExporting("gdocs");
    try {
      const { html, text } = buildGoogleDocsContent(items, fontSettings);
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" })
          })
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }

      const docsWindow = window.open("https://docs.new", "_blank", "noopener,noreferrer");
      setNotice(
        docsWindow
          ? "คัดลอกแล้ว — กด Ctrl+V ใน Google Docs เพื่อวาง"
          : "คัดลอกแล้ว — เปิด Google Docs และกด Ctrl+V เพื่อวาง"
      );
    } catch (error) {
      console.error("Failed to copy for Google Docs", error);
      setNotice("คัดลอกไม่สำเร็จ กรุณาอนุญาตการเข้าถึงคลิปบอร์ด");
    } finally {
      setExporting("");
    }
  };

  const downloadDocx = async () => {
    setExporting("docx");
    try {
      const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, VerticalAlign, TableLayoutType } = await import("docx");

      const scale = (fontSettings.scale || 100) / 100;
      const hanziHalfPt = Math.round((fontSettings.hanzi || 28) * scale * 1.3);
      const pinyinHalfPt = Math.round((fontSettings.pinyin || 18) * scale * 1.3);
      const thaiHalfPt = Math.round((fontSettings.thai || 18) * scale * 1.3);
      const topNoteHalfPt = Math.round((fontSettings.topNote || 16) * scale * 1.3);
      const sentenceHalfPt = Math.round((fontSettings.sentence || 18) * scale * 1.3);
      const indexHalfPt = Math.round(Math.max(26, sentenceHalfPt + 4));

      const noBorders = {
        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      };

      const children = [];

      items.forEach(item => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ font: "Sarabun", text: item.sentence.index || "", bold: true, size: indexHalfPt, color: "000000" }),
            ],
            spacing: { before: 300, after: 80 },
          })
        );

        if (item.blocks.length > 0) {
          const WORDS_PER_ROW = 8;
          for (let startIdx = 0; startIdx < item.blocks.length; startIdx += WORDS_PER_ROW) {
            const chunk = item.blocks.slice(startIdx, startIdx + WORDS_PER_ROW);
            const rows = [];
            const hasTopNote = chunk.some(b => b.topNote);
            const hasTopArrow = chunk.some(b => b.showTopArrow);

            if (hasTopNote) {
              rows.push(new TableRow({ children: chunk.map(b => new TableCell({ children: [new Paragraph({ children: [new TextRun({ font: "Sarabun", text: b.topNote || "", size: topNoteHalfPt, color: "000000" })], alignment: AlignmentType.CENTER })], borders: noBorders, verticalAlign: VerticalAlign.BOTTOM })) }));
            }
            if (hasTopArrow) {
              rows.push(new TableRow({ children: chunk.map(b => new TableCell({ children: [new Paragraph({ children: [new TextRun({ font: "Sarabun", text: b.showTopArrow ? "↑" : "", size: topNoteHalfPt, color: "000000" })], alignment: AlignmentType.CENTER })], borders: noBorders, verticalAlign: VerticalAlign.BOTTOM })) }));
            }
            rows.push(new TableRow({ children: chunk.map(b => new TableCell({ children: [new Paragraph({ children: [new TextRun({ font: "Sarabun", text: b.thai || "", size: thaiHalfPt, color: "000000" })], alignment: AlignmentType.CENTER })], borders: noBorders, verticalAlign: VerticalAlign.BOTTOM })) }));
            rows.push(new TableRow({ children: chunk.map(b => new TableCell({ children: [new Paragraph({ children: [new TextRun({ font: "Sarabun", text: b.thai ? "↑" : "", size: thaiHalfPt, color: "000000" })], alignment: AlignmentType.CENTER })], borders: noBorders, verticalAlign: VerticalAlign.CENTER })) }));
            rows.push(new TableRow({ children: chunk.map(b => new TableCell({ children: [new Paragraph({ children: [new TextRun({ font: "Sarabun", text: b.hanzi || "", size: hanziHalfPt, bold: true, color: "000000" })], alignment: AlignmentType.CENTER })], borders: noBorders, verticalAlign: VerticalAlign.CENTER })) }));
            rows.push(new TableRow({ children: chunk.map(b => new TableCell({ children: [new Paragraph({ children: [new TextRun({ font: "Sarabun", text: b.pinyin ? "↑" : "", size: pinyinHalfPt, color: "000000" })], alignment: AlignmentType.CENTER })], borders: noBorders, verticalAlign: VerticalAlign.TOP })) }));
            rows.push(new TableRow({ children: chunk.map(b => new TableCell({ children: [new Paragraph({ children: [new TextRun({ font: "Sarabun", text: b.pinyin || "", size: pinyinHalfPt, color: "000000" })], alignment: AlignmentType.CENTER })], borders: noBorders, verticalAlign: VerticalAlign.TOP })) }));

            const table = new Table({
              rows: rows,
              layout: TableLayoutType.FIXED,
              width: { size: 100, type: WidthType.PERCENTAGE },
              margins: { top: 0, bottom: 0, left: 40, right: 40 }
            });
            children.push(table);
            children.push(new Paragraph({ text: "", spacing: { after: 80 } }));
          }
        }

        if (item.sentence.hanzi) children.push(new Paragraph({ children: [new TextRun({ font: "Sarabun", text: item.sentence.hanzi, size: sentenceHalfPt, bold: true, color: "000000" })], spacing: { before: 160 } }));
        if (item.sentence.pinyin) children.push(new Paragraph({ children: [new TextRun({ font: "Sarabun", text: item.sentence.pinyin, size: sentenceHalfPt, color: "000000" })] }));
        if (item.sentence.english) children.push(new Paragraph({ children: [new TextRun({ font: "Sarabun", text: item.sentence.english, size: sentenceHalfPt, color: "000000" })] }));
        if (item.sentence.thai) children.push(new Paragraph({ children: [new TextRun({ font: "Sarabun", text: item.sentence.thai, size: sentenceHalfPt, color: "000000" })], spacing: { before: 80 } }));
        
        children.push(new Paragraph({ text: "" }));
      });

      const doc = new Document({ sections: [{ properties: {}, children: children }] });
      const buffer = await Packer.toBlob(doc);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(buffer);
      a.download = `sentence_breakdown_${Date.now()}.docx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (error) {
      console.error("Failed to generate docx", error);
      setNotice("สร้างไฟล์ Word ไม่สำเร็จ");
    } finally {
      setExporting("");
    }
  };

  const fontScale = (fontSettings.scale || 100) / 100;
  const hanziPx = Math.round((fontSettings.hanzi || 28) * fontScale);
  const pinyinPx = Math.round((fontSettings.pinyin || 18) * fontScale);
  const thaiPx = Math.round((fontSettings.thai || 18) * fontScale);
  const topNotePx = Math.round((fontSettings.topNote || 16) * fontScale);
  const sentencePx = Math.round((fontSettings.sentence || 18) * fontScale);
  const indexPx = Math.round(Math.max(20, sentencePx * 1.25));
  const arrowPx = Math.round(Math.max(13, pinyinPx * 0.95));
  const topArrowPx = Math.round(Math.max(13, topNotePx * 0.95));

  return (
    <main className="flex-1 min-h-screen bg-slate-100 py-8 px-4 md:px-8 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 items-start">
        
        {/* Left Column: Editor */}
        <div className="w-full lg:w-1/2 flex flex-col gap-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200 text-white">
              <ZapIcon />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">สร้างโครงสร้างประโยค</h1>
          </div>

          <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap gap-2">
            <button onClick={exportProject} className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors">
              สำรองโปรเจกต์
            </button>
            <button onClick={() => importRef.current?.click()} className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors">
              นำเข้าโปรเจกต์
            </button>
            <button onClick={() => setShowLibraryModal(true)} className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-colors flex items-center gap-1.5 border border-indigo-200">
              <BookIcon /> คลัง 300 ประโยค (HSK Week 1-15)
            </button>
            <input ref={importRef} type="file" accept="application/json,.json" onChange={importProject} className="hidden" />
            <button onClick={clearProject} className="ml-auto px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold transition-colors">
              เริ่มใหม่
            </button>
            <p className="basis-full text-[11px] text-slate-400 px-1">
              บันทึกอัตโนมัติในอุปกรณ์นี้ {isHydrated ? "• พร้อมใช้งาน" : "• กำลังกู้คืนข้อมูล…"}
            </p>
          </div>

          {notice && (
            <div role="status" className="fixed z-[60] bottom-5 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-xl">
              {notice}
            </div>
          )}
          
          {/* Quick Input Section */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-bold text-indigo-700 flex items-center gap-2">
                <ZapIcon /> สร้างอัตโนมัติจากประโยคจีน
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPromptModal(true)}
                  className="px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1"
                >
                  <SparklesIcon /> ดู AI Prompt
                </button>
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setAiMode(false)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${!aiMode ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    Smart (คลัง 300)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiMode(true)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${aiMode ? "bg-indigo-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    <SparklesIcon /> AI (Gemini)
                  </button>
                </div>
              </div>
            </div>

            {aiMode && (
              <div className="mb-3 p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-indigo-900 flex items-center gap-1">
                    <SparklesIcon /> Gemini API Key (ตัวเลือกเสริม):
                  </span>
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                    รับคีย์ฟรีที่ Google AI Studio →
                  </a>
                </div>
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => handleSaveApiKey(e.target.value)}
                  placeholder="AIzaSy... (หากเว้นว่างจะใช้คีย์ของระบบหรือ Smart Fallback)"
                  className="w-full px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>
            )}
            <p className="text-xs text-slate-500 mb-4 leading-relaxed bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
              ใส่เฉพาะประโยคภาษาจีน <b className="text-indigo-700">หนึ่งประโยคต่อหนึ่งบรรทัด</b>
              ระบบจะแยกคำ สร้างพินอิน และแปลไทย–อังกฤษให้อัตโนมัติ
              รองรับไม่จำกัดจำนวนบรรทัด และคำช่วยที่ไม่มีความหมายตรงตัวจะแสดงเป็น <b className="text-indigo-700">0</b>
            </p>
            <textarea
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder="我爱你。&#10;很高兴认识你。&#10;今天天气很好。"
              disabled={isAnalyzing}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all min-h-[160px] text-sm outline-none resize-y mb-3"
            />
            <button
              onClick={handleQuickGenerate}
              disabled={isAnalyzing || !quickInput.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-xl transition-all shadow-md shadow-indigo-200 active:scale-[0.98] flex justify-center items-center gap-2 text-sm"
            >
              <ZapIcon /> {isAnalyzing ? `กำลังวิเคราะห์ ${analysisProgress}` : "วิเคราะห์และสร้างอัตโนมัติ"}
            </button>
          </div>
          
          {/* Items List */}
          <div className="space-y-6">
            {items.map((item, itemIndex) => (
              <div key={item.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative group transition-all hover:shadow-md">
                
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <span className="bg-slate-100 text-slate-600 w-8 h-8 rounded-lg flex items-center justify-center text-sm">{itemIndex + 1}</span>
                    ประโยคที่ {itemIndex + 1}
                  </h2>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveItem(itemIndex, -1)} disabled={itemIndex === 0} className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors disabled:opacity-25" title="ย้ายประโยคขึ้น"><ArrowUpIcon /></button>
                    <button onClick={() => moveItem(itemIndex, 1)} disabled={itemIndex === items.length - 1} className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors disabled:opacity-25" title="ย้ายประโยคลง"><ArrowDownIcon /></button>
                    <button onClick={() => duplicateItem(item.id)} className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors" title="คัดลอกประโยค"><CopyIcon /></button>
                    <button onClick={() => playSentence(item.sentence.hanzi)} className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 p-2 rounded-lg transition-colors" title="ฟังเสียงประโยค"><VolumeIcon /></button>
                    <button 
                      onClick={() => removeItem(item.id)}
                      className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                      title="ลบข้อนี้"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-6">
                  {/* Sentence Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputField label="เลขข้อ" value={item.sentence.index} onChange={(e) => updateSentence(item.id, 'index', e.target.value)} className="sm:col-span-1" />
                    <InputField label="จีน" value={item.sentence.hanzi} onChange={(e) => updateSentence(item.id, 'hanzi', e.target.value)} className="sm:col-span-1" />
                    <InputField label="พินอิน" value={item.sentence.pinyin} onChange={(e) => updateSentence(item.id, 'pinyin', e.target.value)} className="sm:col-span-1" />
                    <InputField label="อังกฤษ" value={item.sentence.english} onChange={(e) => updateSentence(item.id, 'english', e.target.value)} className="sm:col-span-1" />
                    <InputField label="ไทย" value={item.sentence.thai} onChange={(e) => updateSentence(item.id, 'thai', e.target.value)} className="sm:col-span-2" />
                  </div>

                  {/* Word Blocks */}
                  <div className="pt-2">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">คำศัพท์ในประโยค</h3>
                      <div className="flex flex-wrap justify-end gap-2">
                        {item.blocks.length > 0 && (
                          <button onClick={() => syncSentenceFromBlocks(item.id)} className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg font-semibold hover:bg-emerald-100 transition-colors">
                            รวมเป็นประโยค
                          </button>
                        )}
                        <button
                          onClick={() => addBlock(item.id)}
                          className="flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-semibold hover:bg-indigo-100 transition-colors"
                        >
                          <PlusIcon /> เพิ่มคำ
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {item.blocks.length === 0 ? (
                        <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
                          ยังไม่มีคำศัพท์ กดเพิ่มคำ หรือใช้เครื่องมือสร้างอัตโนมัติด้านบน
                        </div>
                      ) : item.blocks.map((block, blockIndex) => (
                        <div key={block.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl relative group/block hover:border-indigo-200 transition-colors">
                          <div className="absolute -left-3 top-1/2 -translate-y-1/2 flex-col gap-1 sm:opacity-0 sm:group-hover/block:opacity-100 transition-opacity hidden sm:flex">
                            <button onClick={() => moveBlock(item.id, blockIndex, -1)} disabled={blockIndex === 0} className="p-1.5 bg-white shadow-sm border border-slate-200 hover:text-indigo-600 rounded-full text-slate-400 disabled:opacity-30 transition-colors"><ArrowUpIcon /></button>
                            <button onClick={() => moveBlock(item.id, blockIndex, 1)} disabled={blockIndex === item.blocks.length - 1} className="p-1.5 bg-white shadow-sm border border-slate-200 hover:text-indigo-600 rounded-full text-slate-400 disabled:opacity-30 transition-colors"><ArrowDownIcon /></button>
                          </div>
                          
                          <div className="absolute top-2 right-2 sm:opacity-0 sm:group-hover/block:opacity-100 transition-opacity">
                            <button onClick={() => removeBlock(item.id, block.id)} className="p-1.5 hover:bg-red-100 hover:text-red-600 rounded-md text-slate-400 transition-colors"><TrashIcon /></button>
                          </div>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pr-8 pl-1 sm:pl-4">
                            <InputField label="จีน" value={block.hanzi} onChange={(e) => updateBlock(item.id, block.id, 'hanzi', e.target.value)} />
                            <InputField label="ไทย" value={block.thai} onChange={(e) => updateBlock(item.id, block.id, 'thai', e.target.value)} />
                            <InputField label="พินอิน" value={block.pinyin} onChange={(e) => updateBlock(item.id, block.id, 'pinyin', e.target.value)} />
                            <InputField label="Note บน" value={block.topNote} placeholder="(เช่น รัก)" onChange={(e) => updateBlock(item.id, block.id, 'topNote', e.target.value)} />
                          </div>
                          <div className="mt-3 pl-1 sm:pl-4 flex items-center gap-2">
                            <input type="checkbox" id={`arrow-${block.id}`} checked={block.showTopArrow} onChange={(e) => updateBlock(item.id, block.id, 'showTopArrow', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            <label htmlFor={`arrow-${block.id}`} className="text-xs font-medium text-slate-500 cursor-pointer select-none">แสดงลูกศร ↑ ชี้ Note</label>
                            <div className="ml-auto flex gap-1 sm:hidden">
                              <button onClick={() => moveBlock(item.id, blockIndex, -1)} disabled={blockIndex === 0} className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-500 disabled:opacity-25" aria-label="ย้ายคำขึ้น"><ArrowUpIcon /></button>
                              <button onClick={() => moveBlock(item.id, blockIndex, 1)} disabled={blockIndex === item.blocks.length - 1} className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-500 disabled:opacity-25" aria-label="ย้ายคำลง"><ArrowDownIcon /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            <button onClick={addNewItem} className="w-full py-4 border-2 border-dashed border-slate-300 text-slate-500 font-bold rounded-2xl hover:bg-white hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 group cursor-pointer">
              <span className="bg-slate-200 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 p-1 rounded-full transition-colors"><PlusIcon /></span> 
              เพิ่มประโยคใหม่
            </button>
          </div>
        </div>

        {/* Right Column: Preview (Sticky, Strict A4 Size Only) */}
        <div className="w-full lg:w-1/2 lg:sticky lg:top-8 flex flex-col gap-3">
          
          {/* Action Header */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800">ตัวอย่าง (Preview)</h2>
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                ขนาด A4 เท่านั้น
              </span>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <button disabled={Boolean(exporting)} onClick={downloadImage} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white px-3.5 py-2 rounded-xl font-semibold shadow-xs transition-colors text-xs cursor-pointer disabled:cursor-wait">
                <DownloadIcon /> {exporting === "image" ? "กำลังสร้าง…" : "รูปภาพ"}
              </button>
              <button disabled={Boolean(exporting)} onClick={downloadDocx} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-3.5 py-2 rounded-xl font-semibold shadow-xs transition-colors text-xs cursor-pointer disabled:cursor-wait">
                <DownloadIcon /> {exporting === "docx" ? "กำลังสร้าง…" : "Word"}
              </button>
              <button disabled={Boolean(exporting)} onClick={copyToGoogleDocs} className="basis-full sm:basis-auto flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white px-3.5 py-2 rounded-xl font-semibold shadow-xs transition-colors text-xs cursor-pointer disabled:cursor-wait">
                <CopyIcon /> {exporting === "gdocs" ? "กำลังคัดลอก…" : "Google Docs"}
              </button>
            </div>
          </div>

          {/* Font Size & A4 Zoom Toolbar */}
          <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-700">ขนาดฟอนต์:</span>
                <button
                  type="button"
                  onClick={() => updateFontSetting("scale", Math.max(60, fontSettings.scale - 5))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                  title="ลดขนาดตัวอักษร 5%"
                >
                  A-
                </button>
                <span className="text-xs font-bold text-indigo-700 px-1 min-w-[42px] text-center">
                  {fontSettings.scale}%
                </span>
                <button
                  type="button"
                  onClick={() => updateFontSetting("scale", Math.min(160, fontSettings.scale + 5))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                  title="เพิ่มขนาดตัวอักษร 5%"
                >
                  A+
                </button>
                <button
                  type="button"
                  onClick={() => setShowFontPanel(!showFontPanel)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
                    showFontPanel
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                  }`}
                >
                  ⚙️ {showFontPanel ? "ปิดแถบปรับขนาด" : "ปรับขนาดละเอียด"}
                </button>
              </div>

              {/* Viewport Zoom */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-400 text-[11px]">ซูม A4:</span>
                {[75, 85, 100].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setPreviewZoom(z)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                      previewZoom === z
                        ? "bg-slate-800 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {z}%
                  </button>
                ))}
              </div>
            </div>

            {/* Expandable Detailed Font Settings Panel */}
            {showFontPanel && (
              <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs animate-in fade-in duration-150">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-slate-600 font-medium">
                    <span>ตัวอักษรจีนคำศัพท์ (Hanzi):</span>
                    <b className="text-indigo-600">{fontSettings.hanzi}px</b>
                  </div>
                  <input
                    type="range"
                    min="18"
                    max="48"
                    value={fontSettings.hanzi}
                    onChange={(e) => updateFontSetting("hanzi", e.target.value)}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-slate-600 font-medium">
                    <span>พินอินคำศัพท์ (Pinyin):</span>
                    <b className="text-indigo-600">{fontSettings.pinyin}px</b>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="28"
                    value={fontSettings.pinyin}
                    onChange={(e) => updateFontSetting("pinyin", e.target.value)}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-slate-600 font-medium">
                    <span>คำแปลไทยคำศัพท์ (Thai):</span>
                    <b className="text-indigo-600">{fontSettings.thai}px</b>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="28"
                    value={fontSettings.thai}
                    onChange={(e) => updateFontSetting("thai", e.target.value)}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-slate-600 font-medium">
                    <span>ความหมายรากศัพท์ (Note บน):</span>
                    <b className="text-indigo-600">{fontSettings.topNote}px</b>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="26"
                    value={fontSettings.topNote}
                    onChange={(e) => updateFontSetting("topNote", e.target.value)}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1 sm:col-span-2">
                  <div className="flex justify-between text-slate-600 font-medium">
                    <span>ประโยคเต็มและคำแปล (Sentence):</span>
                    <b className="text-indigo-600">{fontSettings.sentence}px</b>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="30"
                    value={fontSettings.sentence}
                    onChange={(e) => updateFontSetting("sentence", e.target.value)}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center justify-between pt-1 border-t border-slate-100">
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFontSettings({ ...fontSettings, scale: 85 })}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium"
                    >
                      กะทัดรัด (85%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFontSettings({ ...fontSettings, scale: 100 })}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium"
                    >
                      มาตรฐาน (100%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFontSettings({ ...fontSettings, scale: 115 })}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium"
                    >
                      ตัวใหญ่ (115%)
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={resetFontSettings}
                    className="text-xs text-red-600 hover:underline"
                  >
                    รีเซ็ตค่าเริ่มต้น
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Strictly A4 Document Canvas */}
          <div className="bg-[#525659] p-4 sm:p-6 rounded-2xl border border-slate-300 overflow-x-auto shadow-inner flex flex-col items-center max-h-[calc(100vh-140px)] overflow-y-auto">
            {/* A4 Sheet Dimensions Indicator */}
            <div className="w-full max-w-[210mm] flex items-center justify-between text-slate-300 text-xs mb-3 px-1 select-none">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                เอกสาร A4 (210 × 297 มม.) • สัดส่วนต้นฉบับ
              </span>
              <span className="text-[11px] text-slate-400">
                ฟอนต์ {fontSettings.scale}% • มุมมอง {previewZoom}%
              </span>
            </div>

            {/* A4 Paper Sheet strictly 210mm width */}
            <div
              style={{
                transform: previewZoom !== 100 ? `scale(${previewZoom / 100})` : undefined,
                transformOrigin: "top center",
                marginBottom: previewZoom !== 100 ? `${(previewZoom / 100 - 1) * 350}px` : undefined,
                width: "210mm",
                minWidth: "210mm",
                maxWidth: "210mm",
              }}
              className="transition-transform duration-150"
            >
              <div 
                ref={previewRef} 
                data-preview-paper="true"
                className="bg-white shadow-2xl mx-auto flex flex-col gap-12 border border-slate-200"
                style={{ 
                  width: "210mm",
                  minWidth: "210mm",
                  maxWidth: "210mm",
                  minHeight: "297mm",
                  padding: "20mm 16mm",
                  boxSizing: "border-box",
                  color: "#000000", 
                  fontFamily: "var(--font-sarabun), var(--font-noto-sans-sc), sans-serif" 
                }}
              >
                {items.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <div 
                      className="font-bold pt-8 whitespace-nowrap min-w-[2rem] text-black"
                      style={{ fontSize: `${indexPx}px`, color: "#000000" }}
                    >
                      {item.sentence.index}
                    </div>
                    
                    <div className="flex flex-col gap-6 flex-1">
                      {/* Top Word Breakdown Section */}
                      {item.blocks.length > 0 && (
                        <div className="flex flex-wrap gap-x-5 gap-y-6">
                          {item.blocks.map((block) => (
                            <div key={block.id} className="flex flex-col items-center justify-end min-w-[2.8rem]">
                              <div className="flex flex-col items-center justify-end mb-1 text-black" style={{ minHeight: `${Math.round(topNotePx * 2.2)}px` }}>
                                {block.topNote && (
                                  <span className="font-medium text-black leading-tight" style={{ fontSize: `${topNotePx}px`, color: "#000000" }}>
                                    {block.topNote}
                                  </span>
                                )}
                                {block.showTopArrow && (
                                  <span className="mt-0.5 text-black leading-none" style={{ fontSize: `${topArrowPx}px`, color: "#000000" }}>
                                    ↑
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center font-medium text-black leading-tight" style={{ fontSize: `${thaiPx}px`, minHeight: `${thaiPx + 6}px`, color: "#000000" }}>
                                {block.thai}
                              </div>
                              {block.thai && (
                                <div className="leading-none text-black my-0.5" style={{ fontSize: `${arrowPx}px`, color: "#000000" }} aria-hidden="true">
                                  ↑
                                </div>
                              )}
                              <div className="font-bold my-0.5 text-black leading-none" style={{ fontSize: `${hanziPx}px`, color: "#000000" }}>
                                {block.hanzi}
                              </div>
                              {block.pinyin && (
                                <div className="leading-none text-black my-0.5" style={{ fontSize: `${arrowPx}px`, color: "#000000" }}>
                                  ↑
                                </div>
                              )}
                              <div className="font-medium text-black leading-tight" style={{ fontSize: `${pinyinPx}px`, color: "#000000" }}>
                                {block.pinyin}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Sentence Translation Section */}
                      <div className="flex flex-col gap-1.5 mt-2 text-black leading-relaxed" style={{ fontSize: `${sentencePx}px`, color: "#000000" }}>
                        {item.sentence.hanzi && <div className="font-semibold text-black" style={{ fontSize: `${Math.round(sentencePx * 1.05)}px`, color: "#000000" }}>{item.sentence.hanzi}</div>}
                        {item.sentence.pinyin && <div className="text-black" style={{ color: "#000000" }}>{item.sentence.pinyin}</div>}
                        {item.sentence.english && <div className="text-black" style={{ color: "#000000" }}>{item.sentence.english}</div>}
                        {item.sentence.thai && <div className="mt-2 font-medium text-black" style={{ color: "#000000" }}>{item.sentence.thai}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
        </div>
      </div>

      {/* HSK 300 Library Modal */}
      {showLibraryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <BookIcon /> คลังประโยค HSK 300 ประโยค (15 สัปดาห์)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ประโยคมาตรฐานพร้อมคำแยกรากศัพท์ (topNote), พินอิน, และคำแปล 100% จากเอกสารต้นฉบับ
                </p>
              </div>
              <button
                onClick={() => setShowLibraryModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-200/80 hover:bg-slate-300 text-slate-700 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Week Pills & Filter Bar */}
            <div className="p-4 border-b border-slate-100 bg-white flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={searchHskQuery}
                  onChange={(e) => setSearchHskQuery(e.target.value)}
                  placeholder="ค้นหาจีน, พินอิน, หรือไทย (เช่น 我爱你, ตู้เย็น, 201)..."
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {selectedWeek > 0 && !searchHskQuery && (
                  <button
                    onClick={() => loadHskWeek(selectedWeek, false)}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs shrink-0"
                  >
                    + โหลดทั้ง Week {selectedWeek} (20 ประโยค)
                  </button>
                )}
                {selectedWeek > 0 && !searchHskQuery && (
                  <button
                    onClick={() => {
                      if (window.confirm(`แทนที่งานปัจจุบันด้วย Week ${selectedWeek} ใช่หรือไม่?`)) {
                        loadHskWeek(selectedWeek, true);
                      }
                    }}
                    className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold rounded-xl transition-all shrink-0"
                  >
                    แทนที่ด้วย Week {selectedWeek}
                  </button>
                )}
              </div>

              {!searchHskQuery && (
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  {Array.from({ length: 15 }, (_, i) => i + 1).map((w) => (
                    <button
                      key={w}
                      onClick={() => setSelectedWeek(w)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                        selectedWeek === w
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Week {w} ({(w - 1) * 20 + 1}-{w * 20})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sentences List */}
            <div className="p-4 overflow-y-auto max-h-[50vh] flex flex-col gap-3 bg-slate-50/50">
              {(() => {
                const filtered = hsk300Data.filter((item) => {
                  if (searchHskQuery.trim()) {
                    const q = searchHskQuery.toLowerCase();
                    return (
                      item.sentence.hanzi.includes(q) ||
                      item.sentence.pinyin.toLowerCase().includes(q) ||
                      item.sentence.thai.includes(q) ||
                      String(item.num).includes(q)
                    );
                  }
                  return item.week === selectedWeek;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-10 text-slate-400 text-sm">
                      ไม่พบประโยคที่ตรงกับคำค้นหา
                    </div>
                  );
                }

                return filtered.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-white rounded-xl border border-slate-200 flex items-start justify-between gap-4 hover:border-indigo-300 hover:shadow-xs transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-900 text-sm">
                          {item.num}. {item.sentence.hanzi}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {item.sentence.pinyin}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mb-2">
                        {item.sentence.thai} • <span className="text-slate-400">{item.sentence.english}</span>
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {item.blocks.map((b, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 text-[11px] bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded text-slate-700"
                          >
                            <span className="font-semibold">{b.hanzi}</span>
                            <span className="text-slate-400 text-[10px]">({b.thai})</span>
                            {b.topNote && (
                              <span className="text-indigo-600 text-[10px] font-mono">[{b.topNote}]</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => loadHskSentence(item)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-lg shrink-0 transition-colors"
                    >
                      + นำเข้า
                    </button>
                  </div>
                ));
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 bg-white flex justify-end">
              <button
                onClick={() => setShowLibraryModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI System Prompt Modal */}
      {showPromptModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <SparklesIcon /> AI System Instruction & Prompt
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  คำสั่งฝึกสอน AI สำหรับนำไปใช้ใน ChatGPT, Claude, หรือ Gemini Studio เพื่อสร้างรูปแบบเอกสารนี้
                </p>
              </div>
              <button
                onClick={() => setShowPromptModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-200/80 hover:bg-slate-300 text-slate-700 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[60vh]">
              <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono whitespace-pre-wrap leading-relaxed select-all">
                {SYSTEM_PROMPT}
              </pre>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <span className="text-xs text-slate-500">
                ไฟล์ Dataset พร้อมใช้งานอยู่ที่ <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">ai-training/dataset.jsonl</code>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(SYSTEM_PROMPT);
                    setCopiedPrompt(true);
                    setTimeout(() => setCopiedPrompt(false), 2000);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs"
                >
                  <CopyIcon /> {copiedPrompt ? "คัดลอกเรียบร้อย!" : "คัดลอก Prompt"}
                </button>
                <button
                  onClick={() => setShowPromptModal(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
