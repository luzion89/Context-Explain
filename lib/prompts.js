// Shared prompt defaults and per-language overrides used by settings and requests.
const CTX_PROMPT_DEFAULTS = {
  "English": {
    "explain": "Explain the selected text \"{{selectedText}}\" in context:\n{{contextBefore}}[{{selectedText}}]{{contextAfter}}\nExplain technical terms clearly and practically.",
    "ask": "Selected text: {{selectedText}}\nContext: {{contextBefore}}[{{selectedText}}]{{contextAfter}}\nQuestion: {{question}}",
    "translate": "Translate {{selectedText}} into {{targetLang}}. Context: {{contextBefore}}[{{selectedText}}]{{contextAfter}}. Give the translation and 1–2 sentences of contextual explanation. Write entirely in {{targetLang}}.",
    "recap": "Recap our conversation: the core question, key insights, and what follow-up questions clarified. Be concise. Respond in {{responseLang}}.",
    "textSystem": "You are a concise expert explainer. Explain selected webpage text in context. Use Markdown when helpful. Respond in {{responseLang}}.",
    "translateSystem": "You are a precise translator. Follow the user instructions and be concise.",
    "imageExplain": "Explain what is shown in this image clearly and informatively.",
    "imageSystem": "You are a helpful image analysis assistant. Respond in {{responseLang}}."
  },
  "Chinese (Simplified)": {
    "explain": "请解释所选内容“{{selectedText}}”在以下语境中的含义：\n{{contextBefore}}[{{selectedText}}]{{contextAfter}}\n清楚解释专业术语，注重实用。",
    "ask": "所选内容：{{selectedText}}\n上下文：{{contextBefore}}[{{selectedText}}]{{contextAfter}}\n我的问题：{{question}}",
    "translate": "请将“{{selectedText}}”翻译成{{targetLang}}。上下文：{{contextBefore}}[{{selectedText}}]{{contextAfter}}。提供自然译文，并用一至两句话解释语境含义；如果原文已是目标语言，直接解释含义。全文使用{{targetLang}}。",
    "recap": "请总结本次对话的核心问题、关键结论，以及追问澄清的内容。简洁表达，可使用要点列表。请使用{{responseLang}}回答。",
    "textSystem": "你是一位简洁、专业的解释助手。结合语境解释网页所选内容，必要时使用 Markdown。请使用{{responseLang}}回答。",
    "translateSystem": "你是一位严谨的翻译专家。严格遵循用户要求，简洁表达。",
    "imageExplain": "请清楚解释这张图片展示的内容和含义。",
    "imageSystem": "你是一位图片分析助手。清楚解释图片内容，请使用{{responseLang}}回答。"
  },
  "Japanese": {
    "explain": "選択した「{{selectedText}}」を文脈に沿って説明してください。\n{{contextBefore}}[{{selectedText}}]{{contextAfter}}",
    "ask": "選択内容：{{selectedText}}\n文脈：{{contextBefore}}[{{selectedText}}]{{contextAfter}}\n質問：{{question}}",
    "translate": "{{selectedText}} を {{targetLang}} に翻訳し、文脈を1～2文で説明してください。文脈：{{contextBefore}}[{{selectedText}}]{{contextAfter}}。{{targetLang}}で回答してください。",
    "recap": "会話の中心的な質問、重要な結論、追加質問で明確になった点を簡潔に要約してください。{{responseLang}}で回答してください。",
    "textSystem": "文脈に沿って選択した文章を簡潔に説明してください。必要に応じてMarkdownを使い、{{responseLang}}で回答してください。",
    "translateSystem": "正確な翻訳者として、ユーザーの指示に従い簡潔に回答してください。",
    "imageExplain": "この画像の内容と意味を明確に説明してください。",
    "imageSystem": "画像を明確に分析し、{{responseLang}}で回答してください。"
  },
  "Korean": {
    "explain": "선택한 “{{selectedText}}”의 의미를 문맥에 맞게 설명하세요.\n{{contextBefore}}[{{selectedText}}]{{contextAfter}}",
    "ask": "선택 내용: {{selectedText}}\n문맥: {{contextBefore}}[{{selectedText}}]{{contextAfter}}\n질문: {{question}}",
    "translate": "{{selectedText}}을(를) {{targetLang}}로 번역하고 문맥을 1~2문장으로 설명하세요. 문맥: {{contextBefore}}[{{selectedText}}]{{contextAfter}}. {{targetLang}}로 답하세요.",
    "recap": "대화의 핵심 질문, 주요 결론과 추가 질문으로 명확해진 내용을 간결하게 요약하세요. {{responseLang}}로 답하세요.",
    "textSystem": "문맥에 맞게 선택한 웹페이지 내용을 명확하고 간결하게 설명하세요. 필요시 Markdown을 사용하고 {{responseLang}}로 답하세요.",
    "translateSystem": "정확한 번역가로서 사용자 지시를 따르고 간결하게 답하세요.",
    "imageExplain": "이 이미지의 내용과 의미를 명확히 설명하세요.",
    "imageSystem": "이미지를 명확히 분석하고 {{responseLang}}로 답하세요."
  }
};
let ctxPromptOverrides = {};
const ctxPromptsReady = chrome.storage.local.get('ctxPromptOverrides').then(data => {ctxPromptOverrides=data.ctxPromptOverrides || {};});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local' && changes.ctxPromptOverrides)ctxPromptOverrides=changes.ctxPromptOverrides.newValue || {};});
function ctxPromptLanguage(lang) { return CTX_PROMPT_DEFAULTS[lang] ? lang : 'English'; }
function ctxPromptTemplate(key,lang) {lang=ctxPromptLanguage(lang);return ctxPromptOverrides[lang]?.[key] || CTX_PROMPT_DEFAULTS[lang][key];}
function ctxPrompt(key,lang,variables={}) {return ctxPromptTemplate(key,lang).replace(/\{\{(\w+)\}\}/g, (all,key)=>variables[key] ?? all);}
