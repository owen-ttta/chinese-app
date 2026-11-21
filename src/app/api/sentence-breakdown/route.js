import { NextResponse } from "next/server";
import hsk300 from "@/data/hsk300.json";
import morphemeDict from "@/data/morphemeDict.json";
import charDict from "@/data/charDict.json";
import pinyinDict from "@/data/pinyinDict.json";
import wordThaiDict from "@/data/wordThaiDict.json";
import { SYSTEM_PROMPT } from "@/data/aiPrompt";

const MAX_SENTENCES = 50;
const MAX_SENTENCE_LENGTH = 500;
const LEARNING_BOUNDARY_CHARS = new Set(
  Array.from("我你他她它爱好很是的地得有在不没吗呢吧啊呀嘛么了着过去来想要会能给把被和也都")
);
const PRESERVED_WORDS = new Set([
  "没有", "我们", "你们", "他们", "她们", "它们", "喜欢", "可以", "因为",
  "所以", "但是", "还是", "已经", "正在", "知道", "觉得"
]);
const NO_DIRECT_MEANING_WORDS = new Set([
  "的", "地", "得", "了", "着", "过", "吗", "呢", "吧", "啊", "呀", "嘛", "么"
]);

// In-memory translation cache (survives across requests in the Node process)
const translationCache = new Map();

// Map of clean Chinese text to HSK ground truth item
const hskMap = new Map();
hsk300.forEach((item) => {
  const cleanHanzi = (item.sentence.hanzi || "").replace(/[^\p{Script=Han}]/gu, "");
  if (cleanHanzi) {
    hskMap.set(cleanHanzi, item);
  }
});

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 120; // Throttle Google Translate calls

const safeTranslate = async (text, to, includeRomanization = false, retries = 2) => {
  if (!text || !text.trim()) return { translatedText: "", pinyin: "" };

  const cacheKey = `${text}:${to}:${includeRomanization}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  // Throttle requests to Google Translate
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - timeSinceLast));
  }
  lastRequestTime = Date.now();

  try {
    const params = new URLSearchParams({
      client: "gtx",
      sl: "zh-CN",
      tl: to,
      dt: "t",
      q: text
    });
    if (includeRomanization) params.append("dt", "rm");

    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?${params.toString()}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)"
        }
      }
    );

    if (response.status === 429) {
      console.warn(`Translation rate limit (429) for "${text}". Retrying...`);
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return safeTranslate(text, to, includeRomanization, retries - 1);
      }
      // Graceful fallback when rate limited
      const fallbackText = wordThaiDict[text] || charDict[text] || text;
      const fallbackPinyin = pinyinDict[text] || "";
      const fallbackResult = { translatedText: fallbackText, pinyin: fallbackPinyin };
      translationCache.set(cacheKey, fallbackResult);
      return fallbackResult;
    }

    if (!response.ok) {
      const fallbackText = wordThaiDict[text] || charDict[text] || text;
      const fallbackPinyin = pinyinDict[text] || "";
      return { translatedText: fallbackText, pinyin: fallbackPinyin };
    }

    const data = await response.json();
    const segments = Array.isArray(data?.[0]) ? data[0] : [];
    const translatedText = segments
      .map((segment) => segment?.[0] || "")
      .join("")
      .trim();
    const pinyin = segments
      .map((segment) => segment?.[3] || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const result = {
      translatedText: translatedText || wordThaiDict[text] || text,
      pinyin: pinyin || pinyinDict[text] || ""
    };
    translationCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.warn(`Translation error for "${text}":`, err.message);
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return safeTranslate(text, to, includeRomanization, retries - 1);
    }
    return {
      translatedText: wordThaiDict[text] || charDict[text] || text,
      pinyin: pinyinDict[text] || ""
    };
  }
};

const mapWithConcurrency = async (values, limit, mapper) => {
  const results = new Array(values.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index], index);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker())
  );
  return results;
};

const segmentChinese = (sentence) => {
  const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });
  return [...segmenter.segment(sentence)]
    .filter((part) => part.isWordLike && /[\p{Script=Han}]/u.test(part.segment))
    .flatMap((part) => {
      const word = part.segment;
      if (PRESERVED_WORDS.has(word)) return word;

      const refined = [];
      let lexicalBuffer = "";
      const flushBuffer = () => {
        if (lexicalBuffer) refined.push(lexicalBuffer);
        lexicalBuffer = "";
      };

      Array.from(word).forEach((character) => {
        if (LEARNING_BOUNDARY_CHARS.has(character)) {
          flushBuffer();
          refined.push(character);
        } else {
          lexicalBuffer += character;
        }
      });
      flushBuffer();
      return refined;
    });
};

const analyzeSentenceSmart = async (sentence, index = 1) => {
  // 1. Check exact match in HSK 300 ground truth first
  const cleanHanzi = sentence.replace(/[^\p{Script=Han}]/gu, "");
  if (hskMap.has(cleanHanzi)) {
    const matched = hskMap.get(cleanHanzi);
    return {
      hanzi: matched.sentence.hanzi,
      pinyin: matched.sentence.pinyin,
      thai: matched.sentence.thai,
      english: matched.sentence.english,
      blocks: matched.blocks
    };
  }

  const words = segmentChinese(sentence);
  if (words.length === 0) throw new Error("No Chinese words found");

  const getCharacterBreakdown = async (word) => {
    // Check learned compound dictionary from 300 HSK sentences
    if (morphemeDict[word]) {
      return { topNote: morphemeDict[word], showTopArrow: true };
    }

    const characters = Array.from(word);
    if (characters.length < 2) {
      return { topNote: "", showTopArrow: false };
    }

    // Check individual characters in charDict or suffix rules
    const meanings = [];
    for (const char of characters) {
      if (char === "子" || char === "儿") {
        meanings.push("0");
      } else if (charDict[char]) {
        meanings.push(charDict[char]);
      } else if (NO_DIRECT_MEANING_WORDS.has(char)) {
        meanings.push("0");
      } else {
        const res = await safeTranslate(char, "th");
        meanings.push(res.translatedText && res.translatedText !== char ? res.translatedText : "0");
      }
    }

    return {
      topNote: meanings.join(" + "),
      showTopArrow: true
    };
  };

  const [thaiSentence, englishSentence, wordDetails] = await Promise.all([
    safeTranslate(sentence, "th", true),
    safeTranslate(sentence, "en"),
    mapWithConcurrency(
      words,
      4,
      async (word) => {
        const [result, characterBreakdown] = await Promise.all([
          (wordThaiDict[word] && pinyinDict[word])
            ? Promise.resolve({ translatedText: wordThaiDict[word], pinyin: pinyinDict[word] })
            : safeTranslate(word, "th", true),
          getCharacterBreakdown(word)
        ]);

        const hasDirectMeaning =
          !NO_DIRECT_MEANING_WORDS.has(word) &&
          result.translatedText &&
          result.translatedText !== word;

        return {
          hanzi: word,
          pinyin: result.pinyin || pinyinDict[word] || "",
          thai: hasDirectMeaning ? result.translatedText : (wordThaiDict[word] || "0"),
          ...characterBreakdown
        };
      }
    )
  ]);

  return {
    hanzi: sentence,
    pinyin: thaiSentence.pinyin || "",
    thai: thaiSentence.translatedText || "",
    english: englishSentence.translatedText || "",
    blocks: wordDetails
  };
};

const analyzeWithGemini = async (sentences, apiKey) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const prompt = `${SYSTEM_PROMPT}\n\nกรุณาวิเคราะห์ประโยคต่อไปนี้:\n${sentences.map((s, idx) => `${idx + 1}. ${s}`).join("\n")}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOutput) throw new Error("Empty response from Gemini");

  const parsed = JSON.parse(textOutput);
  if (Array.isArray(parsed?.results)) {
    return parsed.results.map((item) => ({
      hanzi: item.sentence?.hanzi || "",
      pinyin: item.sentence?.pinyin || "",
      thai: item.sentence?.thai || "",
      english: item.sentence?.english || "",
      blocks: Array.isArray(item.blocks) ? item.blocks : []
    }));
  }
  throw new Error("Invalid format from Gemini response");
};

// GET handler: retrieve HSK 300 sentences or search
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get("week");
    const q = searchParams.get("q")?.toLowerCase();
    const num = searchParams.get("num");

    if (num) {
      const item = hsk300.find((s) => s.num === parseInt(num, 10));
      if (!item) return NextResponse.json({ error: "Sentence not found" }, { status: 404 });
      return NextResponse.json({ item });
    }

    if (week) {
      const weekNum = parseInt(week, 10);
      const items = hsk300.filter((s) => s.week === weekNum);
      return NextResponse.json({ week: weekNum, total: items.length, items });
    }

    if (q) {
      const matches = hsk300.filter((s) =>
        (s.sentence.hanzi && s.sentence.hanzi.includes(q)) ||
        (s.sentence.pinyin && s.sentence.pinyin.toLowerCase().includes(q)) ||
        (s.sentence.thai && s.sentence.thai.includes(q)) ||
        (s.sentence.english && s.sentence.english.toLowerCase().includes(q))
      ).slice(0, 50);
      return NextResponse.json({ total: matches.length, items: matches });
    }

    const weeksSummary = Array.from({ length: 15 }, (_, i) => {
      const w = i + 1;
      const count = hsk300.filter((s) => s.week === w).length;
      return { week: w, count, start: (w - 1) * 20 + 1, end: w * 20 };
    });

    return NextResponse.json({ totalSentences: hsk300.length, weeks: weeksSummary });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST handler: analyze sentences via AI or Smart Fallback
export async function POST(request) {
  try {
    const body = await request.json();
    const sentences = Array.isArray(body?.sentences)
      ? body.sentences.map((value) => String(value).trim()).filter(Boolean)
      : [];

    if (sentences.length === 0) {
      return NextResponse.json({ error: "กรุณาใส่ประโยคภาษาจีน" }, { status: 400 });
    }
    if (sentences.length > MAX_SENTENCES) {
      return NextResponse.json(
        { error: `วิเคราะห์ได้สูงสุด ${MAX_SENTENCES} ประโยคต่อครั้ง` },
        { status: 400 }
      );
    }
    if (sentences.some((sentence) => sentence.length > MAX_SENTENCE_LENGTH)) {
      return NextResponse.json(
        { error: `แต่ละประโยคต้องไม่เกิน ${MAX_SENTENCE_LENGTH} ตัวอักษร` },
        { status: 400 }
      );
    }
    if (sentences.some((sentence) => !/[\p{Script=Han}]/u.test(sentence))) {
      return NextResponse.json(
        { error: "พบข้อความที่ไม่มีตัวอักษรจีน กรุณาใส่ภาษาจีนเท่านั้น" },
        { status: 400 }
      );
    }

    // Check API Key for AI mode
    const apiKey = body?.apiKey || request.headers.get("x-gemini-key") || process.env.GEMINI_API_KEY;
    const preferAI = body?.mode === "ai" || Boolean(apiKey);

    if (preferAI && apiKey) {
      try {
        const aiResults = await analyzeWithGemini(sentences, apiKey);
        return NextResponse.json({ results: aiResults, source: "ai" });
      } catch (aiError) {
        console.warn("AI analysis failed, falling back to smart analyzer:", aiError.message);
      }
    }

    // Smart Analyzer using HSK Ground Truth + Morpheme Dictionary (rate-limited, cached, bulletproof)
    const results = await mapWithConcurrency(sentences, 2, (sent, idx) =>
      analyzeSentenceSmart(sent, idx + 1)
    );
    return NextResponse.json({ results, source: "smart" });
  } catch (error) {
    console.error("Sentence breakdown error:", error);
    return NextResponse.json(
      { error: "วิเคราะห์ประโยคไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
